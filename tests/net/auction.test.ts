import { afterEach, describe, expect, it, vi } from 'vitest'
import { setupGame, clientOf, type NetGame } from './harness'
import type { GameState } from '@/game/turn/types'

function openAuction(net: NetGame): void {
  const prepare = (game: GameState): void => {
    game.turn.state = 'casa-a-resolver'
    game.turn.pendingResolve = true
    game.resolution = {
      kind: 'auction',
      auction: {
        pos: 1,
        currentBid: 0,
        highBidder: null,
        activeBidders: ['p1', 'p2'],
        deadline: net.clock.t + 10_000,
      },
    }
  }
  prepare(net.host.game())
  for (const player of net.players) {
    const game = player.client.game()
    if (game && game !== net.host.game()) prepare(game)
  }
}

describe('leilão de propriedade em rede', () => {
  afterEach(() => vi.useRealTimers())

  it('aprende a diferença entre o relógio do host e o relógio local a cada lance', async () => {
    const net = await setupGame(2, 11)
    openAuction(net)
    vi.useFakeTimers()
    vi.setSystemTime(191_000)

    const client = clientOf(net, 'p1')
    client.send({ kind: 'place-bid', playerId: 'p1', amount: 100 })

    expect((client as typeof client & { clockOffsetMs(): number }).clockOffsetMs()).toBe(-190_000)
  })

  it('cobra somente o vencedor final e converge em todas as visões', async () => {
    const net = await setupGame(2, 11)
    openAuction(net)
    const initialCash = Object.fromEntries(net.host.game().players.map((player) => [player.id, player.cash]))

    clientOf(net, 'p1').send({ kind: 'place-bid', playerId: 'p1', amount: 100 })
    clientOf(net, 'p2').send({ kind: 'place-bid', playerId: 'p2', amount: 110 })
    clientOf(net, 'p1').send({ kind: 'place-bid', playerId: 'p1', amount: 120 })
    net.advance(10_001)

    const game = net.host.game()
    expect(game.titles[1].ownerId).toBe('p1')
    expect(game.players.find((player) => player.id === 'p1')?.cash).toBe(initialCash.p1 - 120)
    expect(game.players.find((player) => player.id === 'p2')?.cash).toBe(initialCash.p2)
    expect(new Set(net.serialized()).size).toBe(1)
  })
})
