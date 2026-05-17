import { describe, it, expect, vi } from 'vitest'
import { openHouseAuction, placeHouseBid, closeHouseAuction, HOUSE_AUCTION_WINDOW } from '@/game/economy/houseAuction'
import { createSeedState } from '@/game/store'
import type { GameState } from '@/game/turn/types'

// Estado com uma resolução pendente, pronto para abrir o leilão de casas.
function pending(playerIds: string[], houses: number): GameState {
  const g = createSeedState(playerIds)
  g.turn.state = 'casa-a-resolver'
  g.turn.pendingResolve = true
  g.bank.houses = houses
  return g
}

describe('Leilão de casas em escassez (US4)', () => {
  it('SC-006: escassez abre leilão; maior lance paga ao banco e leva as casas', () => {
    let g = openHouseAuction(pending(['p1', 'p2', 'p3'], 2), 2, ['p1', 'p2', 'p3'], 0)
    expect(g.resolution?.kind).toBe('house-auction')
    g = placeHouseBid(g, 'p2', 50, 1000)
    expect(placeHouseBid(g, 'p3', 40, 2000)).toBe(g) // ≤ atual → no-op
    g = placeHouseBid(g, 'p3', 90, 2000)
    expect(g.resolution).toMatchObject({ auction: { highBidder: 'p3', currentBid: 90 } })
    g = closeHouseAuction(g)
    expect(g.players[2].cash).toBe(2000 - 90)
    expect(g.bank.houses).toBe(0) // as 2 casas saíram do estoque
    expect(g.resolution).toBeNull()
    expect(g.turn.state).toBe('aguardando-finalizacao')
  })

  it('SC-006: leilão sem lance → casas permanecem no banco', () => {
    let g = openHouseAuction(pending(['p1', 'p2'], 3), 3, ['p1', 'p2'], 0)
    g = closeHouseAuction(g)
    expect(g.bank.houses).toBe(3)
    expect(g.resolution).toBeNull()
  })

  it('SC-006: fechar ao esgotar o cronômetro (fake timers → closeHouseAuction)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    let g = openHouseAuction(pending(['p1', 'p2'], 1), 1, ['p1', 'p2'], Date.now())
    g = placeHouseBid(g, 'p1', 30, Date.now())
    vi.advanceTimersByTime(HOUSE_AUCTION_WINDOW + 1)
    g = closeHouseAuction(g)
    expect(g.players[0].cash).toBe(2000 - 30)
    vi.useRealTimers()
  })
})
