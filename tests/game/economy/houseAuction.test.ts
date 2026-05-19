import { describe, it, expect } from 'vitest'
import { openHouseAuction, placeHouseBid, closeHouseAuction } from '@/game/economy/houseAuction'
import { createSeedState } from '@/game/store'
import type { GameState } from '@/game/turn/types'

// 026 — leilão de casas é EVENTO AUTÔNOMO (state.houseAuction), fora do turno.
function base(houses: number): GameState {
  const g = createSeedState(['p1', 'p2', 'p3'])
  g.bank.houses = houses
  return g
}

describe('Leilão de casas — evento autônomo (026)', () => {
  it('SC-001: abrir seta o campo; já aberto → no-op', () => {
    const g = openHouseAuction(base(2), 2, ['p1', 'p2', 'p3'])
    expect(g.houseAuction).toMatchObject({ housesAvailable: 2, currentBid: 0, highBidder: null, activeBidders: ['p1', 'p2', 'p3'] })
    expect(openHouseAuction(g, 5, ['p1'])).toBe(g) // já há leilão → no-op
  })

  it('SC-002: lance válido atualiza; rejeita ≤ atual, > caixa, não-participante', () => {
    let g = openHouseAuction(base(2), 2, ['p1', 'p2'])
    g = placeHouseBid(g, 'p2', 50)
    expect(g.houseAuction).toMatchObject({ currentBid: 50, highBidder: 'p2' })
    expect(placeHouseBid(g, 'p1', 40)).toBe(g) // ≤ atual
    expect(placeHouseBid(g, 'p1', 999999)).toBe(g) // > caixa
    expect(placeHouseBid(g, 'p3', 80)).toBe(g) // p3 não é participante
    g = placeHouseBid(g, 'p1', 90)
    expect(g.houseAuction).toMatchObject({ currentBid: 90, highBidder: 'p1' })
  })

  it('SC-003: encerrar com vencedor → paga e leva as casas (estoque cai)', () => {
    let g = openHouseAuction(base(2), 2, ['p1', 'p2', 'p3'])
    g = placeHouseBid(g, 'p3', 90)
    g = closeHouseAuction(g)
    expect(g.players[2].cash).toBe(2000 - 90)
    expect(g.bank.houses).toBe(0) // 2 casas saíram do estoque
    expect(g.houseAuction).toBeNull()
  })

  it('SC-003: encerrar sem lance → casas ficam no banco', () => {
    let g = openHouseAuction(base(3), 3, ['p1', 'p2'])
    g = closeHouseAuction(g)
    expect(g.bank.houses).toBe(3)
    expect(g.houseAuction).toBeNull()
  })

  it('SC-004: abrir/encerrar não alteram o turno', () => {
    const before = base(2)
    const turnBefore = JSON.stringify(before.turn)
    let g = openHouseAuction(before, 2, ['p1', 'p2'])
    expect(JSON.stringify(g.turn)).toBe(turnBefore)
    g = placeHouseBid(g, 'p1', 30)
    g = closeHouseAuction(g)
    expect(JSON.stringify(g.turn)).toBe(turnBefore)
    expect(g.resolution).toBeNull()
  })

  it('reducers sem leilão aberto → no-op', () => {
    const g = base(5)
    expect(placeHouseBid(g, 'p1', 50)).toBe(g)
    expect(closeHouseAuction(g)).toBe(g)
  })
})
