import { describe, expect, it } from 'vitest'
import { createSeedState } from '@/game/setup'
import { createSoundProjector } from '@/game/ui/sound/project'

describe('createSoundProjector', () => {
  it('silencia o primeiro snapshot e uma repetição sem mudanças', () => {
    const game = createSeedState(['p1', 'p2'])
    const projector = createSoundProjector()

    expect(projector.project(game)).toEqual([])
    expect(projector.project(structuredClone(game))).toEqual([])
  })

  it('projeta uma borda de resolução apenas uma vez', () => {
    const game = createSeedState(['p1', 'p2'])
    const projector = createSoundProjector()
    projector.project(game)

    game.resolution = { kind: 'debt', amount: 100, creditorId: null }
    expect(projector.project(game)).toEqual(['debt'])
    expect(projector.project(structuredClone(game))).toEqual([])
  })

  it('não duplica delta de caixa quando o fato já tem cue próprio', () => {
    const game = createSeedState(['p1', 'p2'])
    const projector = createSoundProjector()
    projector.project(game)

    game.players[0].cash -= 100
    game.titles[1].ownerId = 'p1'
    game.titles[1].houses = 1
    game.log.push({ kind: 'build', who: 'p1', pos: 1, level: 1, cost: 100 })

    expect(projector.project(game)).toEqual(['build'])
  })

  it('usa o tail tipado do log e suprime o delta monetário correspondente', () => {
    const game = createSeedState(['p1', 'p2'])
    const projector = createSoundProjector()
    projector.project(game)

    game.players[0].cash -= 60
    game.log.push({ kind: 'buy', who: 'p1', pos: 1, price: 60 })

    expect(projector.project(game)).toEqual(['buy'])
  })

  it('projeta apenas turn-end numa virada de turno silenciosa', () => {
    const game = createSeedState(['p1', 'p2'])
    const projector = createSoundProjector()
    projector.project(game)

    game.turn.seat = 1

    expect(projector.project(game)).toEqual(['turn-end'])
  })
})
