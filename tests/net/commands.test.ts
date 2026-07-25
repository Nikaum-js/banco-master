// FR-008/009 — `applyCommand` é o dispatcher puro sobre os reducers existentes: reproduz o
// motor e trata comando inválido como no-op (mesma referência preservada).
import { describe, expect, it } from 'vitest'
import { applyCommand } from '@/game/commands'
import { buildGameCtx, buildInitialGame } from '@/game/ctx'
import { mulberry32 } from '../sim/engine/rng'

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
