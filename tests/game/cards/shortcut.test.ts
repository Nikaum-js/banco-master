import { describe, expect, it } from 'vitest'
import { buyProperty } from '@/game/economy/purchase'
import { resolveCardShortcut } from '@/game/cards/draw'
import { buildGameCtx, createSeedState } from '@/game/setup'
import { finalizeTurn, resolvePending, rollDice } from '@/game/turn/turnMachine'
import { rngFromDice } from '../turn/_helpers'

describe('Atalho após dupla', () => {
  it('preserva a nova rolagem depois de mover, resolver o destino e comprar', () => {
    let game = createSeedState(['p1', 'p2'])
    game.players[0].pos = 2
    game.decks.acaso = ['atalho-1']
    const ctx = buildGameCtx(rngFromDice([3, 3]), () => 0)

    game = rollDice(game, ctx)
    expect(game.players[0].pos).toBe(8)
    expect(game.turn.mayRollAgain).toBe(true)

    game = resolvePending(game, ctx)
    expect(game.resolution?.kind).toBe('card-shortcut')

    game = resolveCardShortcut(game, 'frente', ctx)
    expect(game.players[0].pos).toBe(11)
    expect(game.turn.mayRollAgain).toBe(true)

    game = resolvePending(game, ctx)
    expect(game.resolution?.kind).toBe('purchase')
    game = buyProperty(game)
    expect(game.turn.state).toBe('aguardando-finalizacao')

    game = finalizeTurn(game, ctx)
    expect(game.activeSeat).toBe(0)
    expect(game.turn.state).toBe('aguardando-rolagem')
    expect(game.turn.consecutiveDoubles).toBe(1)
  })

  it('cancela a nova rolagem se o Atalho terminar em Vá para a Prisão', () => {
    const game = createSeedState(['p1', 'p2'])
    game.players[0].pos = 33
    game.turn.state = 'casa-a-resolver'
    game.turn.pendingResolve = true
    game.turn.mayRollAgain = true
    game.turn.consecutiveDoubles = 1
    game.resolution = { kind: 'card-shortcut', deckId: 'acaso', cardId: 'atalho-1' }
    const ctx = buildGameCtx(rngFromDice([3, 3]), () => 0)

    const result = resolveCardShortcut(game, 'frente', ctx)

    expect(result.players[0].pos).toBe(12)
    expect(result.players[0].jail.inJail).toBe(true)
    expect(result.activeSeat).toBe(1)
    expect(result.turn.mayRollAgain).toBe(false)
  })
})
