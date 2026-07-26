// Espólio do falido-ao-banco (spec 039, SRS §9.2 / D-031) — o gatilho e as guardas.
//
// A regra: quem falir devendo AO BANCO tem as propriedades leiloadas em pregão simultâneo,
// em vez de devolvidas de graça. Quem falir devendo a um JOGADOR (ou tendo empréstimo ativo)
// segue exatamente como antes — nenhum leilão.
//
// Cuidado ao ler as asserções: `ownerId === null` NÃO distingue "no banco" de "em pregão" —
// os dois estados de título são idênticos. O que prova o espólio é o LOTE em `landAuction`.
import { describe, it, expect } from 'vitest'
import { declareBankruptcy } from '@/game/falencia/falencia'
import { placeLandBid, closeExpiredLandLots, LAND_AUCTION_WINDOW } from '@/game/economy/landAuction'
import { createSeedState, defaultPorts } from '@/game/setup'
import type { GameState } from '@/game/turn/types'
import type { TurnCtx } from '@/game/turn/turnMachine'

const NOW = 10_000
// `now` injetado: o prazo dos lotes tem que vir do `ctx` (recorder da 037 grava/reproduz),
// nunca de `Date.now()` — é o que faz host e cliente convergirem.
const ctx: TurnCtx = { rng: () => 0, ports: defaultPorts, now: () => NOW }

// p1 (ativo) insolvente com dívida pendente; `creditorId: null` = devia ao BANCO.
function withDebt(creditorId: string | null, props: number[], players = ['p1', 'p2', 'p3']): GameState {
  const g = createSeedState(players)
  g.turn.state = 'casa-a-resolver'
  g.turn.pendingResolve = true
  g.resolution = { kind: 'debt', amount: 5000, creditorId } // alto: insolvente de certeza
  g.players[0].cash = 0
  for (const pos of props) g.titles[pos].ownerId = 'p1'
  return g
}

describe('Espólio — o gatilho (US1)', () => {
  it('FR-001/003: falir devendo ao banco leva as propriedades a pregão', () => {
    const after = declareBankruptcy(withDebt(null, [1, 3, 6]), ctx)
    expect(after.landAuction).not.toBeNull()
    expect(after.landAuction!.lots.map((l) => l.pos).sort((a, b) => a - b)).toEqual([1, 3, 6])
    expect(after.landAuction!.origin).toBe('bankruptcy')
    expect(after.landAuction!.bankruptId).toBe('p1')
    // Lotes nascem virgens e com o prazo vindo do ctx.
    expect(after.landAuction!.lots.every((l) => l.currentBid === 0 && l.highBidder === null)).toBe(true)
    expect(after.landAuction!.lots.every((l) => l.deadline === NOW + LAND_AUCTION_WINDOW)).toBe(true)
  })

  it('FR-012: o falido não licita no próprio espólio', () => {
    const after = declareBankruptcy(withDebt(null, [1, 3]), ctx)
    expect(after.landAuction!.bidders).toEqual(['p2', 'p3'])
    expect(after.landAuction!.bidders).not.toContain('p1')
  })

  it('FR-014: abrir o pregão não interfere na eliminação nem na passagem da vez', () => {
    const g = withDebt(null, [1, 3])
    const after = declareBankruptcy(g, ctx)
    expect(after.players[0].eliminated).toBe(true)
    expect(after.players[0].cash).toBe(0)
    expect(after.resolution).toBeNull()
    expect(after.turn.pendingResolve).toBe(false)
    expect(after.activeSeat).not.toBe(0) // a vez passou, o pregão roda em paralelo
    expect(after.players[after.turnOrder[after.activeSeat]].eliminated).toBe(false)
  })

  it('FR-004: o caixa do falido NÃO entra no espólio (nem no pote, nem no leilão)', () => {
    const g = withDebt(null, [1])
    g.players[0].cash = 300 // ainda insolvente para a dívida de 5000
    const potBefore = g.centerPot
    const after = declareBankruptcy(g, ctx)
    expect(after.players[0].cash).toBe(0)
    expect(after.centerPot).toBe(potBefore) // destruído, como antes da 039
    expect(after.landAuction!.lots).toHaveLength(1) // só a propriedade
  })

  it('FR-018: o espólio não consome o episódio da escassez', () => {
    const g = withDebt(null, [1, 3])
    expect(g.landAuctionArmed).toBe(true)
    const after = declareBankruptcy(g, ctx)
    expect(after.landAuctionArmed).toBe(true) // intacto — a escassez ainda pode disparar
  })

  it('serializa: o pregão do espólio sobrevive ao round-trip JSON (snapshot)', () => {
    const after = declareBankruptcy(withDebt(null, [1, 3]), ctx)
    expect(JSON.parse(JSON.stringify(after))).toEqual(after)
  })
})

describe('Espólio — quando NÃO abre (US1, guardas)', () => {
  it('FR-002: devendo a um JOGADOR, as propriedades vão direto ao credor', () => {
    const after = declareBankruptcy(withDebt('p2', [1, 3]), ctx)
    expect(after.landAuction).toBeNull()
    expect(after.titles[1].ownerId).toBe('p2')
    expect(after.titles[3].ownerId).toBe('p2')
  })

  it('§9.3 precede §9.2: com empréstimo ativo, o credor do empréstimo herda — sem leilão', () => {
    const g = withDebt(null, [1, 3])
    g.loans = [{ debtorId: 'p1', creditorId: 'p3', principal: 500, ratePct: 10 }]
    const after = declareBankruptcy(g, ctx)
    expect(after.landAuction).toBeNull()
    expect(after.titles[1].ownerId).toBe('p3')
    expect(after.titles[3].ownerId).toBe('p3')
  })

  it('FR-005: espólio vazio (nenhuma propriedade) não abre pregão', () => {
    const after = declareBankruptcy(withDebt(null, []), ctx)
    expect(after.landAuction).toBeNull()
    expect(after.players[0].eliminated).toBe(true) // o resto da falência corre normal
  })

  it('FR-006: se a falência encerra a partida, o fim de jogo vence — nenhum pregão', () => {
    const g = withDebt(null, [1, 3])
    g.players[2].eliminated = true // sobram p1 e p2; p1 vai falir → resta 1
    const after = declareBankruptcy(g, ctx)
    expect(after.phase).toBe('ended')
    expect(after.landAuction).toBeNull() // leiloar para uma pessoa só não é leilão
    expect(after.titles[1].ownerId).toBeNull() // caem no destino antigo: banco
    expect(after.titles[3].ownerId).toBeNull()
  })

  it('solvente não falir: nada acontece (guarda §9.1 preservada)', () => {
    const g = withDebt(null, [1])
    g.players[0].cash = 10_000 // paga sem liquidar
    const after = declareBankruptcy(g, ctx)
    expect(after).toBe(g) // no-op referencial
    expect(after.landAuction).toBeNull()
  })
})

describe('Espólio — o fecho reusa o pregão sem alteração (US1)', () => {
  it('FR-010: lote com lance vai ao maior licitante, que paga AO BANCO', () => {
    let g = declareBankruptcy(withDebt(null, [1, 3]), ctx)
    const caixaAntes = g.players[1].cash
    const potAntes = g.centerPot
    g = placeLandBid(g, 'p2', 1, 150, NOW)
    g = closeExpiredLandLots(g, NOW + LAND_AUCTION_WINDOW + 1)
    expect(g.titles[1].ownerId).toBe('p2')
    expect(g.players[1].cash).toBe(caixaAntes - 150)
    expect(g.centerPot).toBe(potAntes) // ao BANCO, não ao pote
  })

  it('FR-011: lote sem lance fica livre e o pregão acaba quando o último sai', () => {
    let g = declareBankruptcy(withDebt(null, [1, 3]), ctx)
    g = closeExpiredLandLots(g, NOW + LAND_AUCTION_WINDOW + 1)
    expect(g.titles[1].ownerId).toBeNull()
    expect(g.titles[3].ownerId).toBeNull()
    expect(g.landAuction).toBeNull()
  })

  it('FR-013: a trava de solvência vale igual no espólio', () => {
    let g = declareBankruptcy(withDebt(null, [1, 3]), ctx)
    g.players[1].cash = 200
    g = placeLandBid(g, 'p2', 1, 150, NOW)
    const antes = g
    g = placeLandBid(g, 'p2', 3, 100, NOW) // 150 já comprometido + 100 > 200 → recusado
    expect(g).toBe(antes)
    expect(g.landAuction!.lots.find((l) => l.pos === 3)!.highBidder).toBeNull()
  })
})
