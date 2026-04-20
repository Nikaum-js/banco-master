import { describe, it, expect } from 'vitest'
import {
  freeLots,
  maybeOpenLandAuction,
  placeLandBid,
  closeLandAuction,
  closeExpiredLandLots,
  committedCash,
  LAND_AUCTION_WINDOW,
} from '@/game/economy/landAuction'
import { createSeedState } from '@/game/store'
import type { GameState } from '@/game/turn/types'
import { BOARD } from '@/lib/boardData'

const COMPRAVEIS = BOARD.filter(
  (sq) => sq.kind === 'property' || sq.kind === 'airport' || sq.kind === 'utility',
).map((sq) => sq.pos)

// Estado com exatamente `n` terrenos livres (os demais comprados por p1).
function seedFree(n: number, players: string[] = ['p1', 'p2']): GameState {
  const g = createSeedState(players)
  const keepFree = COMPRAVEIS.slice(0, n)
  for (const pos of COMPRAVEIS) if (!keepFree.includes(pos)) g.titles[pos].ownerId = 'p1'
  return g
}

describe('Leilão de escassez de terrenos — gatilho (US1)', () => {
  it('SC-001: abre com ≤3 livres e ≥2 vivos', () => {
    const out = maybeOpenLandAuction(seedFree(3), 1000)
    expect(out.landAuction).not.toBeNull()
    expect(out.landAuction!.lots).toHaveLength(3)
    expect(out.landAuction!.bidders).toEqual(['p1', 'p2'])
    expect(out.landAuction!.lots.every((l) => l.currentBid === 0 && l.highBidder === null)).toBe(true)
    expect(out.landAuction!.lots.every((l) => l.deadline === 1000 + LAND_AUCTION_WINDOW)).toBe(true)
    expect(out.landAuctionArmed).toBe(false)
  })

  it('SC-001 (negativo): não abre com 1 vivo', () => {
    const g = seedFree(3)
    g.players[1].eliminated = true
    expect(maybeOpenLandAuction(g, 1000).landAuction).toBeNull()
  })

  it('U1: não abre pregão vazio (0 terrenos livres)', () => {
    expect(maybeOpenLandAuction(seedFree(0), 1000).landAuction).toBeNull()
  })

  it('SC-006: dispara 1× por episódio e re-arma só quando a contagem sobe', () => {
    const aberto = maybeOpenLandAuction(seedFree(3), 1000)
    expect(aberto.landAuctionArmed).toBe(false)
    // simula "fechado" mantendo armed=false, ainda com ≤3 livres → NÃO reabre
    const fechado: GameState = { ...aberto, landAuction: null }
    expect(maybeOpenLandAuction(fechado, 2000).landAuction).toBeNull()
    // contagem sobe acima do limiar → re-arma (sem abrir)
    const muitoLivre: GameState = { ...fechado }
    muitoLivre.titles = { ...fechado.titles }
    for (const pos of COMPRAVEIS.slice(0, 5)) muitoLivre.titles[pos] = { ...muitoLivre.titles[pos], ownerId: null }
    const rearmado = maybeOpenLandAuction(muitoLivre, 3000)
    expect(rearmado.landAuctionArmed).toBe(true)
    expect(rearmado.landAuction).toBeNull()
  })
})

describe('Leilão de escassez de terrenos — lances e fechamento (US1)', () => {
  it('SC-002: lance válido atualiza o lote e reinicia o deadline', () => {
    const g = maybeOpenLandAuction(seedFree(3), 1000)
    const pos = g.landAuction!.lots[0].pos
    const out = placeLandBid(g, 'p1', pos, 50, 2000)
    const lot = out.landAuction!.lots.find((l) => l.pos === pos)!
    expect(lot.currentBid).toBe(50)
    expect(lot.highBidder).toBe('p1')
    expect(lot.deadline).toBe(2000 + LAND_AUCTION_WINDOW)
  })

  it('timer por lote: lance no terreno A NÃO reinicia o prazo de B', () => {
    const g = maybeOpenLandAuction(seedFree(3), 1000)
    const [a, b] = g.landAuction!.lots.map((l) => l.pos)
    const prazoBAntes = g.landAuction!.lots.find((l) => l.pos === b)!.deadline
    const out = placeLandBid(g, 'p1', a, 50, 5000)
    expect(out.landAuction!.lots.find((l) => l.pos === a)!.deadline).toBe(5000 + LAND_AUCTION_WINDOW) // A reiniciou
    expect(out.landAuction!.lots.find((l) => l.pos === b)!.deadline).toBe(prazoBAntes) // B intacto
  })

  it('fechamento por lote: só o expirado fecha; o último a fechar encerra o pregão', () => {
    let g = maybeOpenLandAuction(seedFree(2), 1000)
    const [a, b] = g.landAuction!.lots.map((l) => l.pos)
    g = placeLandBid(g, 'p1', a, 50, 1000) // A vence em 1000+W
    g = placeLandBid(g, 'p2', b, 30, 5000) // B empurrado p/ 5000+W
    const out1 = closeExpiredLandLots(g, 1000 + LAND_AUCTION_WINDOW) // expira só A
    expect(out1.titles[a].ownerId).toBe('p1')
    expect(out1.landAuction).not.toBeNull()
    expect(out1.landAuction!.lots.map((l) => l.pos)).toEqual([b])
    const out2 = closeExpiredLandLots(out1, 5000 + LAND_AUCTION_WINDOW) // expira B → acaba
    expect(out2.titles[b].ownerId).toBe('p2')
    expect(out2.landAuction).toBeNull()
  })

  it('SC-002: lance ≤ atual, de não-participante, ou em lote inexistente → no-op', () => {
    let g = maybeOpenLandAuction(seedFree(3), 1000)
    const pos = g.landAuction!.lots[0].pos
    g = placeLandBid(g, 'p1', pos, 50, 2000)
    expect(placeLandBid(g, 'p2', pos, 50, 3000)).toBe(g) // igual ao atual
    expect(placeLandBid(g, 'p2', pos, 40, 3000)).toBe(g) // menor
    expect(placeLandBid(g, 'p9', pos, 99, 3000)).toBe(g) // não-participante
    expect(placeLandBid(g, 'p2', 999, 99, 3000)).toBe(g) // lote inexistente
  })

  it('SC-004: fechar transfere cada líder (paga ao banco); lote sem lance fica livre', () => {
    let g = maybeOpenLandAuction(seedFree(3), 1000)
    const [a, b, c] = g.landAuction!.lots.map((l) => l.pos)
    const p1Cash = g.players[0].cash
    const p2Cash = g.players[1].cash
    g = placeLandBid(g, 'p1', a, 50, 1100)
    g = placeLandBid(g, 'p2', b, 30, 1200)
    const out = closeLandAuction(g)
    expect(out.titles[a].ownerId).toBe('p1')
    expect(out.titles[b].ownerId).toBe('p2')
    expect(out.titles[c].ownerId).toBeNull() // sem lance → fica livre
    expect(out.players[0].cash).toBe(p1Cash - 50)
    expect(out.players[1].cash).toBe(p2Cash - 30)
    expect(out.landAuction).toBeNull()
  })

  it('SC-005: abrir e fechar NÃO alteram o turno', () => {
    const base = seedFree(3)
    const turnoBase = JSON.stringify(base.turn)
    const aberto = maybeOpenLandAuction(base, 1000)
    expect(JSON.stringify(aberto.turn)).toBe(turnoBase)
    expect(JSON.stringify(closeLandAuction(aberto).turn)).toBe(turnoBase)
  })

  it('serializável (VII): round-trip JSON do estado com pregão aberto', () => {
    const g = maybeOpenLandAuction(seedFree(2), 1000)
    expect(JSON.parse(JSON.stringify(g))).toEqual(g)
  })
})

describe('Leilão de escassez — trava de solvência / múltiplos arremates (US2)', () => {
  it('committedCash soma os lances líderes nos OUTROS lotes', () => {
    let g = maybeOpenLandAuction(seedFree(2), 1000)
    const [a, b] = g.landAuction!.lots.map((l) => l.pos)
    g = placeLandBid(g, 'p1', a, 100, 1100)
    expect(committedCash(g, 'p1', b)).toBe(100) // lidera A, avaliando lance em B
    expect(committedCash(g, 'p1', a)).toBe(0) // exclui o próprio lote
  })

  it('SC-002/003: lance que estoura o caixa (somado aos líderes) é rejeitado; coberto libera', () => {
    let g = maybeOpenLandAuction(seedFree(2), 1000)
    const [a, b] = g.landAuction!.lots.map((l) => l.pos)
    g.players[0].cash = 120
    g.players[1].cash = 500
    g = placeLandBid(g, 'p1', a, 100, 1100) // 0 + 100 ≤ 120 ✓
    expect(g.landAuction!.lots.find((l) => l.pos === a)!.highBidder).toBe('p1')
    expect(placeLandBid(g, 'p1', b, 50, 1200)).toBe(g) // 100 + 50 = 150 > 120 → rejeitado
    g = placeLandBid(g, 'p1', b, 20, 1200) // 100 + 20 = 120 ≤ 120 ✓
    expect(g.landAuction!.lots.find((l) => l.pos === b)!.highBidder).toBe('p1')
    // p2 cobre A → libera o comprometido de p1
    g = placeLandBid(g, 'p2', a, 110, 1300)
    expect(committedCash(g, 'p1', b)).toBe(0)
    g = placeLandBid(g, 'p1', b, 115, 1400) // agora 0 + 115 ≤ 120 ✓
    expect(g.landAuction!.lots.find((l) => l.pos === b)!.currentBid).toBe(115)
  })

  it('SC-003: ao fechar, vencedor de vários paga a soma e caixa fica ≥ 0', () => {
    let g = maybeOpenLandAuction(seedFree(2), 1000)
    const [a, b] = g.landAuction!.lots.map((l) => l.pos)
    g.players[0].cash = 120
    g = placeLandBid(g, 'p1', a, 100, 1100)
    g = placeLandBid(g, 'p1', b, 20, 1200)
    const out = closeLandAuction(g)
    expect(out.titles[a].ownerId).toBe('p1')
    expect(out.titles[b].ownerId).toBe('p1')
    expect(out.players[0].cash).toBe(0)
    expect(out.players[0].cash).toBeGreaterThanOrEqual(0)
  })
})

describe('freeLots', () => {
  it('conta só compráveis sem dono', () => {
    expect(freeLots(seedFree(3))).toHaveLength(3)
    expect(freeLots(seedFree(0))).toHaveLength(0)
    expect(freeLots(createSeedState(['p1', 'p2']))).toHaveLength(COMPRAVEIS.length) // tudo livre no seed
  })
})
