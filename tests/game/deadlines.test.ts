import { describe, expect, it } from 'vitest'
import { deadlinePlan } from '@/game/deadlines'
import { createSeedState } from '@/game/setup'

describe('deadlinePlan', () => {
  it('expõe o próximo prazo do Leilão sem fechar antes da hora', () => {
    const game = createSeedState(['p1', 'p2'])
    game.resolution = {
      kind: 'auction',
      auction: { pos: 1, currentBid: 0, highBidder: null, activeBidders: ['p1', 'p2'], deadline: 1_000 },
    }

    expect(deadlinePlan(game, 999)).toEqual({ due: [], next: 1_000 })
    expect(deadlinePlan(game, 1_000)).toEqual({ due: [{ kind: 'close-auction' }], next: null })
  })

  it('fecha só os lotes vencidos pelo comando canônico do Pregão', () => {
    const game = createSeedState(['p1', 'p2'])
    game.landAuction = {
      origin: 'scarcity',
      bankruptId: null,
      bidders: ['p1', 'p2'],
      lots: [
        { pos: 1, currentBid: 0, highBidder: null, deadline: 800 },
        { pos: 3, currentBid: 0, highBidder: null, deadline: 1_200 },
      ],
    }

    expect(deadlinePlan(game, 800)).toEqual({
      due: [{ kind: 'close-land-lots', now: 800 }],
      next: 1_200,
    })
  })

  it('devolve os dois comandos quando Leilão e Pregão vencem juntos', () => {
    const game = createSeedState(['p1', 'p2'])
    game.resolution = {
      kind: 'auction',
      auction: { pos: 1, currentBid: 0, highBidder: null, activeBidders: ['p1'], deadline: 500 },
    }
    game.landAuction = {
      origin: 'bankruptcy',
      bankruptId: 'p1',
      bidders: ['p2'],
      lots: [{ pos: 3, currentBid: 0, highBidder: null, deadline: 500 }],
    }

    expect(deadlinePlan(game, 500).due).toEqual([
      { kind: 'close-auction' },
      { kind: 'close-land-lots', now: 500 },
    ])
  })

  it('congela qualquer despertar enquanto a partida está pausada', () => {
    const game = createSeedState(['p1', 'p2'])
    game.resolution = {
      kind: 'auction',
      auction: { pos: 1, currentBid: 0, highBidder: null, activeBidders: ['p1'], deadline: 1 },
    }
    game.paused = { causes: ['disconnect'], since: 0 }

    expect(deadlinePlan(game, 999)).toEqual({ due: [], next: null })
  })
})
