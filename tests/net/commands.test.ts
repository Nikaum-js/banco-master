// FR-008/009 — `applyCommand` é o dispatcher puro sobre os reducers existentes: reproduz o
// motor e trata comando inválido como no-op (mesma referência preservada).
import { describe, expect, it } from 'vitest'
import { applyCommand } from '@/game/commands'
import { buildGameCtx, buildInitialGame } from '@/game/setup'
import { mulberry32 } from '../sim/engine/rng'
import { pausedBy } from './harness'

describe('applyCommand (FR-008/009)', () => {
  it('aplica um comando válido e avança o estado', () => {
    const game = buildInitialGame(['p1', 'p2'], mulberry32(1))
    const ctx = buildGameCtx(mulberry32(9), () => 1_000)
    const next = applyCommand(game, { kind: 'roll' }, ctx)
    expect(next).not.toBe(game) // mudou de referência (aplicou)
    expect(next.turn.lastRoll).not.toBeNull()
  })

  it('comando inválido é no-op: preserva a MESMA referência (base do FR-009)', () => {
    const game = buildInitialGame(['p1', 'p2'], mulberry32(1))
    const ctx = buildGameCtx(mulberry32(9), () => 1_000)
    // Comprar sem estar em resolução de compra → reducer no-op.
    const next = applyCommand(game, { kind: 'buy-property' }, ctx)
    expect(next).toBe(game)
    // Construir numa casa sem posse também é no-op.
    expect(applyCommand(game, { kind: 'build-house', pos: 1 }, ctx)).toBe(game)
  })
})

// Card 1 do review de arquitetura: a pausa era respeitada por 15 reducers e ignorada por
// 14; online a diferença ficava mascarada pelo `if (game.paused)` do host, mas em
// single-player `setPaused(true)` + `mortgageProperty()` aplicava a hipoteca. O gate
// agora é único, no despacho, e vale para QUALQUER chamador.
describe('gate de pausa no despacho (FR-011/FR-017)', () => {
  const ctx = () => buildGameCtx(mulberry32(9), () => 1_000)
  const paused = () => {
    const g = buildInitialGame(['p1', 'p2'], mulberry32(1))
    // Dá posse de uma propriedade a p1 para que a hipoteca fosse legal se não houvesse pausa.
    g.titles[1].ownerId = 'p1'
    return { ...g, paused: pausedBy('disconnect') }
  }

  it.each([
    ['roll', { kind: 'roll' }],
    ['mortgage', { kind: 'mortgage', pos: 1 }],
    ['buy-property', { kind: 'buy-property' }],
    ['finalize', { kind: 'finalize' }],
    ['declare-bankruptcy', { kind: 'declare-bankruptcy' }],
    ['dismiss-notice', { kind: 'dismiss-notice' }],
  ] as const)('pausado, %s é no-op', (_label, action) => {
    const g = paused()
    expect(applyCommand(g, action, ctx())).toBe(g)
  })

  it('mas a RETOMADA atravessa a pausa — senão o jogo trava para sempre', () => {
    const g = paused()
    const next = applyCommand(g, { kind: 'resume', cause: 'disconnect', at: 0 }, ctx())
    expect(next).not.toBe(g)
    expect(next.paused).toBe(null)
  })

  it('sem pausa, a mesma hipoteca passa (o gate é a pausa, não a ação)', () => {
    const g = { ...paused(), paused: null }
    expect(applyCommand(g, { kind: 'mortgage', pos: 1 }, ctx())).not.toBe(g)
  })
})
