import { describe, it, expect } from 'vitest'
import {
  placeLandBid,
  closeLandAuction,
  closeExpiredLandLots,
  committedCash,
  openEstateAuction,
  LAND_AUCTION_WINDOW,
} from '@/game/economy/landAuction'
import { createSeedState } from '@/game/setup'
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

// Pregão ABERTO em t=`now` com `n` lotes. Desde a D-059 a única porta de entrada é o espólio,
// então o fixture precisa de um falido: o ÚLTIMO jogador da lista cai, e os lotes são as
// propriedades que eram dele. Os demais são os licitantes.
function abrirPregao(n: number, players: string[] = ['p1', 'p2', 'p3'], now = 1000): GameState {
  const g = createSeedState(players)
  const falido = players[players.length - 1]
  const lotes = COMPRAVEIS.slice(0, n)
  for (const pos of COMPRAVEIS) g.titles[pos].ownerId = 'p1'
  // O espólio já saiu do nome do falido quando chega ao pregão (falencia.ts zera o título
  // antes de chamar): um lote e uma propriedade no banco têm o MESMO estado de título.
  for (const pos of lotes) g.titles[pos].ownerId = null
  g.players[players.length - 1].eliminated = true
  const out = openEstateAuction(g, lotes, now, falido)
  expect(out.landAuction!.lots).toHaveLength(n)
  return out
}

describe('Pregão do espólio — lances e fechamento (039)', () => {
  it('SC-002: lance válido atualiza o lote e reinicia o deadline', () => {
    const g = abrirPregao(3)
    const pos = g.landAuction!.lots[0].pos
    const out = placeLandBid(g, 'p1', pos, 50, 2000)
    const lot = out.landAuction!.lots.find((l) => l.pos === pos)!
    expect(lot.currentBid).toBe(50)
    expect(lot.highBidder).toBe('p1')
    expect(lot.deadline).toBe(2000 + LAND_AUCTION_WINDOW)
  })

  it('todo lote nasce sem lance, com o mesmo prazo, e os licitantes são os vivos', () => {
    const g = abrirPregao(3)
    expect(g.landAuction!.bidders).toEqual(['p1', 'p2'])
    expect(g.landAuction!.bankruptId).toBe('p3')
    expect(g.landAuction!.lots.every((l) => l.currentBid === 0 && l.highBidder === null)).toBe(true)
    expect(g.landAuction!.lots.every((l) => l.deadline === 1000 + LAND_AUCTION_WINDOW)).toBe(true)
  })

  it('timer por lote: lance no terreno A NÃO reinicia o prazo de B', () => {
    const g = abrirPregao(3)
    const [a, b] = g.landAuction!.lots.map((l) => l.pos)
    const prazoBAntes = g.landAuction!.lots.find((l) => l.pos === b)!.deadline
    const out = placeLandBid(g, 'p1', a, 50, 5000)
    expect(out.landAuction!.lots.find((l) => l.pos === a)!.deadline).toBe(5000 + LAND_AUCTION_WINDOW) // A reiniciou
    expect(out.landAuction!.lots.find((l) => l.pos === b)!.deadline).toBe(prazoBAntes) // B intacto
  })

  it('fechamento por lote: só o expirado fecha; o último a fechar encerra o pregão', () => {
    let g = abrirPregao(2)
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
    let g = abrirPregao(3)
    const pos = g.landAuction!.lots[0].pos
    g = placeLandBid(g, 'p1', pos, 50, 2000)
    expect(placeLandBid(g, 'p2', pos, 50, 3000)).toBe(g) // igual ao atual
    expect(placeLandBid(g, 'p2', pos, 40, 3000)).toBe(g) // menor
    expect(placeLandBid(g, 'p9', pos, 99, 3000)).toBe(g) // não-participante
    expect(placeLandBid(g, 'p3', pos, 99, 3000)).toBe(g) // o próprio falido
    expect(placeLandBid(g, 'p2', 999, 99, 3000)).toBe(g) // lote inexistente
  })

  it('SC-004: fechar transfere cada líder (paga ao banco); lote sem lance fica livre', () => {
    let g = abrirPregao(3)
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
    const base = seedFree(0, ['p1', 'p2', 'p3'])
    base.players[2].eliminated = true
    const turnoBase = JSON.stringify(base.turn)
    const aberto = openEstateAuction(base, COMPRAVEIS.slice(0, 3), 1000, 'p3')
    expect(JSON.stringify(aberto.turn)).toBe(turnoBase)
    expect(JSON.stringify(closeLandAuction(aberto).turn)).toBe(turnoBase)
  })

  it('serializável (VII): round-trip JSON do estado com pregão aberto', () => {
    const g = abrirPregao(2)
    expect(JSON.parse(JSON.stringify(g))).toEqual(g)
  })
})

describe('Pregão do espólio — trava de solvência / múltiplos arremates', () => {
  it('committedCash soma os lances líderes nos OUTROS lotes', () => {
    let g = abrirPregao(2)
    const [a, b] = g.landAuction!.lots.map((l) => l.pos)
    g = placeLandBid(g, 'p1', a, 100, 1100)
    expect(committedCash(g, 'p1', b)).toBe(100) // lidera A, avaliando lance em B
    expect(committedCash(g, 'p1', a)).toBe(0) // exclui o próprio lote
  })

  it('SC-002/003: lance que estoura o caixa (somado aos líderes) é rejeitado; coberto libera', () => {
    let g = abrirPregao(2)
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
    let g = abrirPregao(2)
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

// ---------------------------------------------------------------------------
// Espólio do falido (spec 039, §9.2 / D-031) — o pregão aceita lotes DEPOIS de aberto.
// Nada aqui deve exigir mudança em placeLandBid, settleLot, closeExpiredLandLots ou
// committedCash: um lote recém-injetado é indistinguível de um que já estava lá.
// ---------------------------------------------------------------------------

describe('openEstateAuction — abre com pregão FECHADO (039)', () => {
  it('cria o pregão com o falido nomeado', () => {
    const g = seedFree(0, ['p1', 'p2', 'p3']) // tudo de p1; ninguém eliminado
    const out = openEstateAuction(g, [1, 3], 5000, 'p1')
    expect(out.landAuction!.lots.map((l) => l.pos)).toEqual([1, 3])
    expect(out.landAuction!.bankruptId).toBe('p1')
    expect(out.landAuction!.lots.every((l) => l.deadline === 5000 + LAND_AUCTION_WINDOW)).toBe(true)
  })

  it('FR-005: espólio vazio é no-op referencial', () => {
    const g = seedFree(0)
    expect(openEstateAuction(g, [], 5000, 'p1')).toBe(g)
  })

  it('FR-006: menos de 2 não-eliminados é no-op referencial', () => {
    const g = seedFree(0, ['p1', 'p2'])
    g.players[0].eliminated = true // sobra 1 vivo
    expect(openEstateAuction(g, [1, 3], 5000, 'p1')).toBe(g)
  })

  it('FR-012: bidders são os não-eliminados; o falido fica fora', () => {
    const g = seedFree(0, ['p1', 'p2', 'p3'])
    g.players[0].eliminated = true // p1 faliu
    const out = openEstateAuction(g, [1, 3], 5000, 'p1')
    expect(out.landAuction!.bidders).toEqual(['p2', 'p3'])
  })
})

describe('openEstateAuction — INJETA em pregão ABERTO (039, US2)', () => {
  // Pregão já em curso (prazo em t=1000) aberto pela queda de p4, com 2 lotes. É a única
  // forma de chegar a um pregão aberto desde a D-059 — antes o cenário nascia da escassez.
  // CUIDADO com o fixture: os lotes de p4 são COMPRAVEIS[0..1], então o segundo espólio tem
  // de vir de posições ainda com dono (COMPRAVEIS[2..]), senão o filtro do FR-019 as
  // descarta e o teste mede a coisa errada.
  function comPregaoAberto(): GameState {
    return abrirPregao(2, ['p1', 'p2', 'p3', 'p4'])
  }
  const ESPOLIO = COMPRAVEIS.slice(2, 5) // eram de p1 → nunca são lote do primeiro espólio

  it('FR-015: os lotes do espólio somam aos que já existiam', () => {
    const antes = comPregaoAberto()
    const antigos = antes.landAuction!.lots.map((l) => l.pos)
    const out = openEstateAuction(antes, ESPOLIO, 9000, 'p1')
    expect(out.landAuction!.lots).toHaveLength(5)
    expect(out.landAuction!.lots.map((l) => l.pos)).toEqual([...antigos, ...ESPOLIO])
  })

  it('FR-016: os prazos dos lotes preexistentes NÃO mudam', () => {
    const antes = comPregaoAberto()
    const prazosAntes = antes.landAuction!.lots.map((l) => l.deadline)
    const out = openEstateAuction(antes, ESPOLIO, 9000, 'p1')
    expect(out.landAuction!.lots.slice(0, 2).map((l) => l.deadline)).toEqual(prazosAntes)
    // só os NOVOS recebem prazo a partir de agora
    expect(out.landAuction!.lots.slice(2).every((l) => l.deadline === 9000 + LAND_AUCTION_WINDOW)).toBe(true)
  })

  it('FR-017: bidders são recalculados — o recém-falido sai até dos lotes antigos', () => {
    const antes = comPregaoAberto()
    expect(antes.landAuction!.bidders).toEqual(['p1', 'p2', 'p3'])
    antes.players[0].eliminated = true // p1 acabou de falir
    const out = openEstateAuction(antes, ESPOLIO, 9000, 'p1')
    expect(out.landAuction!.bidders).toEqual(['p2', 'p3'])
    // e o pregão inteiro passa a recusar lance dele, inclusive num lote que já estava aberto
    const lotePreexistente = out.landAuction!.lots[0].pos
    expect(placeLandBid(out, 'p1', lotePreexistente, 50, 9100)).toBe(out)
  })

  it('segundo espólio no mesmo pregão: o falido registrado é o mais recente', () => {
    const g = seedFree(0, ['p1', 'p2', 'p3'])
    const primeiro = openEstateAuction(g, [ESPOLIO[0]], 5000, 'p1')
    expect(primeiro.landAuction!.bankruptId).toBe('p1')
    const segundo = openEstateAuction(primeiro, [ESPOLIO[1]], 9000, 'p2')
    expect(segundo.landAuction!.bankruptId).toBe('p2')
    expect(segundo.landAuction!.lots).toHaveLength(2)
  })

  it('FR-019: posição que já é lote não entra duas vezes', () => {
    const antes = comPregaoAberto()
    const jaEmLote = antes.landAuction!.lots[0].pos
    const out = openEstateAuction(antes, [jaEmLote, ESPOLIO[0]], 9000, 'p1')
    expect(out.landAuction!.lots).toHaveLength(3) // 2 antigos + só a posição nova
    expect(out.landAuction!.lots.filter((l) => l.pos === jaEmLote)).toHaveLength(1)
  })

  it('FR-019: quando TODAS as posições já são lote, é no-op referencial', () => {
    const antes = comPregaoAberto()
    const jaEmLote = antes.landAuction!.lots.map((l) => l.pos)
    expect(openEstateAuction(antes, jaEmLote, 9000, 'p1')).toBe(antes)
  })

  it('posição repetida no próprio espólio gera um lote só', () => {
    const g = seedFree(0, ['p1', 'p2'])
    const out = openEstateAuction(g, [ESPOLIO[0], ESPOLIO[0], ESPOLIO[1]], 5000, 'p1')
    expect(out.landAuction!.lots.map((l) => l.pos)).toEqual([ESPOLIO[0], ESPOLIO[1]])
  })
})
