import { describe, it, expect } from 'vitest'
import { buildHouse, sellBuilding, buildCost } from '@/game/economy/construction'
import { createSeedState } from '@/game/store'
import type { GameState } from '@/game/turn/types'
import type { PropertySquare } from '@/lib/boardData'
import { BOARD } from '@/lib/boardData'

// p1 (seat 0) dono da maioria do grupo brown (pos 1, 3 de 3 cidades: 1/3/5).
function withBrownMajority(): GameState {
  const g = createSeedState(['p1', 'p2'])
  g.titles[1].ownerId = 'p1'
  g.titles[3].ownerId = 'p1'
  return g
}

describe('Construir (US1)', () => {
  it('SC-001: respeita sequência e uniformidade', () => {
    let g = withBrownMajority()
    g = buildHouse(g, 1)
    expect(g.titles[1].houses).toBe(1)
    expect(buildHouse(g, 1)).toBe(g) // uniformidade: pos3 ainda 0 → no-op
    g = buildHouse(g, 3)
    g = buildHouse(g, 1)
    expect(g.titles[1].houses).toBe(2)
    expect(g.titles[3].houses).toBe(1)
  })

  it('SC-002: bloqueia sem maioria / hipoteca / caixa', () => {
    const g1 = createSeedState(['p1', 'p2'])
    g1.titles[1].ownerId = 'p1' // 1 de 3 < maioria
    expect(buildHouse(g1, 1)).toBe(g1)

    const g2 = withBrownMajority()
    g2.titles[3].mortgaged = true
    expect(buildHouse(g2, 1)).toBe(g2)

    const g3 = withBrownMajority()
    g3.players[0].cash = 0
    expect(buildHouse(g3, 1)).toBe(g3)
  })

  it('SC-005: 4 casas viram hotel (sem estoque — ilimitado)', () => {
    let g = withBrownMajority()
    for (let i = 0; i < 4; i++) {
      g = buildHouse(g, 1)
      g = buildHouse(g, 3)
    }
    expect(g.titles[1].houses).toBe(4)
    g = buildHouse(g, 1) // vira hotel
    expect(g.titles[1].hotel).toBe(true)
    expect(g.titles[1].houses).toBe(0)
  })

  it('T017: GameState com construção é serializável (round-trip JSON)', () => {
    let g = withBrownMajority()
    g = buildHouse(g, 1)
    expect(JSON.parse(JSON.stringify(g))).toEqual(g)
  })
})

describe('Vender construções (US3)', () => {
  it('SC-004: vender casa credita metade', () => {
    let g = withBrownMajority()
    g = buildHouse(g, 1)
    g = buildHouse(g, 3)
    g = buildHouse(g, 1) // pos1 = 2 casas
    const cashBefore = g.players[0].cash
    g = sellBuilding(g, 1) // vende da de maior nível (pos1)
    expect(g.titles[1].houses).toBe(1)
    expect(g.players[0].cash).toBe(cashBefore + Math.round(buildCost(BOARD[1] as PropertySquare) / 2))
  })

  it('SC-004: vender hotel volta para 4 casas (sem desmonte forçado — ilimitado)', () => {
    let g = withBrownMajority()
    for (let i = 0; i < 4; i++) {
      g = buildHouse(g, 1)
      g = buildHouse(g, 3)
    }
    g = buildHouse(g, 1) // hotel pos1
    g = buildHouse(g, 3) // hotel pos3
    g = sellBuilding(g, 1) // vende da de maior nível
    expect(g.titles[1].hotel).toBe(false)
    expect(g.titles[1].houses).toBe(4) // hotel → 4 casas
    expect(g.titles[3].hotel).toBe(true) // os outros do grupo permanecem
  })
})
