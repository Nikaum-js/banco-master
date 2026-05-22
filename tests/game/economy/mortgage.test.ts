import { describe, it, expect } from 'vitest'
import {
  mortgageProperty,
  unmortgageProperty,
  mortgageValue,
  unmortgageCost,
  transferKeepFee,
} from '@/game/economy/mortgage'
import { buildHouse } from '@/game/economy/construction'
import { createSeedState } from '@/game/store'
import type { GameState } from '@/game/turn/types'
import { BOARD } from '@/lib/boardData'

// p1 (seat 0) dono de Roma (pos 1, price 60 → valor de hipoteca 30).
function owned(): GameState {
  const g = createSeedState(['p1', 'p2'])
  g.titles[1].ownerId = 'p1'
  return g
}

describe('Hipotecar (US1)', () => {
  it('SC-001: credita metade do preço e marca mortgaged', () => {
    const g = mortgageProperty(owned(), 1)
    expect(g.players[0].cash).toBe(2000 + 30)
    expect(g.titles[1].mortgaged).toBe(true)
  })

  it('SC-001: bloqueia com construção no grupo (§6.1)', () => {
    let g = createSeedState(['p1', 'p2'])
    g.titles[1].ownerId = 'p1'
    g.titles[3].ownerId = 'p1' // maioria brown (2 de 3)
    g = buildHouse(g, 1) // casa no grupo
    expect(mortgageProperty(g, 3)).toBe(g) // grupo tem construção → no-op
  })

  it('SC-001: já hipotecada / não-dono → no-op', () => {
    const g = owned()
    g.titles[1].mortgaged = true
    expect(mortgageProperty(g, 1)).toBe(g)
    const g2 = createSeedState(['p1', 'p2']) // pos1 do banco
    expect(mortgageProperty(g2, 1)).toBe(g2)
  })
})

describe('Deshipotecar (US2)', () => {
  it('SC-002: debita metade × 1,10 e remove a marca', () => {
    const g0 = owned()
    g0.titles[1].mortgaged = true
    const g = unmortgageProperty(g0, 1)
    expect(g.players[0].cash).toBe(2000 - 33) // round(30 × 1,10)
    expect(g.titles[1].mortgaged).toBe(false)
  })

  it('SC-002: sem caixa / não-hipotecada → no-op', () => {
    const g0 = owned()
    g0.titles[1].mortgaged = true
    g0.players[0].cash = 10
    expect(unmortgageProperty(g0, 1)).toBe(g0)
    const g1 = owned() // não hipotecada
    expect(unmortgageProperty(g1, 1)).toBe(g1)
  })
})

describe('Regra de transferência (US3)', () => {
  it('SC-004: helpers de valor (Roma, price 60 → valor 30)', () => {
    const roma = BOARD[1]
    expect(mortgageValue(roma)).toBe(30)
    expect(unmortgageCost(roma)).toBe(33) // round(30 × 1,10)
    expect(transferKeepFee(roma)).toBe(3) // round(30 × 0,10)
  })
})
