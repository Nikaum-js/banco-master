import { describe, expect, it } from 'vitest'
import { applyOpeningAuction } from '@/game/openingAuction'
import { createSeedState } from '@/game/setup'
import type { Room } from '@/net/room'

const room = (bids: number[]): Room => ({
  id: 'mesa-leilao',
  status: 'playing',
  openingAuction: null,
  seats: bids.map((openingBid, index) => ({
    playerId: `p${index + 1}`,
    uid: `u${index + 1}`,
    name: `Jogador ${index + 1}`,
    color: '#d9a650',
    isHost: index === 0,
    connected: true,
    openingBid,
    bidLocked: true,
    reentryCode: '',
  })),
})

describe('Leilão da Largada — liquidação econômica', () => {
  it('todos pagam o próprio lance ao pote da Loteria antes do primeiro turno', () => {
    const game = createSeedState(['p1', 'p2', 'p3'])
    const initialPot = game.centerPot

    const settled = applyOpeningAuction(game, room([500, 250, 0]))

    expect(settled.players.map((player) => player.cash)).toEqual([1_500, 1_750, 2_000])
    expect(settled.centerPot).toBe(initialPot + 750)
    expect(game.players.map((player) => player.cash)).toEqual([2_000, 2_000, 2_000])
    expect(game.centerPot).toBe(initialPot)
  })

  it('conserva caixa total entre participantes e Loteria', () => {
    const game = createSeedState(['p1', 'p2'])
    const before = game.players.reduce((sum, player) => sum + player.cash, game.centerPot)
    const settled = applyOpeningAuction(game, room([350, 100]))
    const after = settled.players.reduce((sum, player) => sum + player.cash, settled.centerPot)

    expect(after).toBe(before)
  })

  it('trata shape legado sem lance como $0', () => {
    const game = createSeedState(['p1'])
    const legacy = room([0])
    delete legacy.seats[0].openingBid

    expect(applyOpeningAuction(game, legacy)).toEqual(game)
  })
})
