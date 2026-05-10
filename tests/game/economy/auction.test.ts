import { describe, it, expect, vi } from 'vitest'
import { placeBid, closeAuction } from '@/game/economy/auction'
import { declineProperty, AUCTION_WINDOW } from '@/game/economy/purchase'
import { createSeedState } from '@/game/store'
import type { GameState } from '@/game/turn/types'

// Estado com um leilão aberto (recusa em pos 1, deadline = now0 + WINDOW).
function setupAuction(now0: number): GameState {
  const g = createSeedState(['p1', 'p2', 'p3'])
  g.players[0].pos = 1
  g.turn.state = 'casa-a-resolver'
  g.turn.pendingResolve = true
  g.resolution = { kind: 'purchase', pos: 1 }
  return declineProperty(g, now0)
}

describe('Leilão (US3)', () => {
  it('SC-002: lances crescentes; vencedor paga o lance e recebe o título', () => {
    let g = setupAuction(0)
    g = placeBid(g, 'p2', 50, 1000)
    expect(g.resolution).toMatchObject({ auction: { currentBid: 50, highBidder: 'p2' } })
    expect(placeBid(g, 'p3', 40, 2000)).toBe(g) // ≤ atual → no-op
    g = placeBid(g, 'p3', 80, 2000)
    expect(g.resolution).toMatchObject({ auction: { highBidder: 'p3' } })
    g = closeAuction(g)
    expect(g.titles[1].ownerId).toBe('p3')
    expect(g.players[2].cash).toBe(2000 - 80)
    expect(g.resolution).toBeNull()
    expect(g.turn.state).toBe('aguardando-finalizacao')
  })

  it('SC-002: leilão sem lances → permanece com o banco', () => {
    const g = closeAuction(setupAuction(0))
    expect(g.titles[1].ownerId).toBeNull()
    expect(g.resolution).toBeNull()
  })

  it('não se licita fiado (> caixa) nem ≤ lance atual', () => {
    const g = setupAuction(0)
    expect(placeBid(g, 'p2', 99999, 1000)).toBe(g) // > caixa 2000
  })

  it('SC-002: fechar ao esgotar o cronômetro paga o lance (fake timers → closeAuction)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    let g = setupAuction(Date.now()) // deadline = WINDOW
    g = placeBid(g, 'p2', 50, Date.now())
    vi.advanceTimersByTime(AUCTION_WINDOW + 1) // tempo esgota
    g = closeAuction(g) // o que o setTimeout do store dispararia
    expect(g.titles[1].ownerId).toBe('p2')
    vi.useRealTimers()
  })

  it('T018: GameState estendido é serializável (round-trip JSON)', () => {
    const g = setupAuction(0)
    expect(JSON.parse(JSON.stringify(g))).toEqual(g)
  })
})
