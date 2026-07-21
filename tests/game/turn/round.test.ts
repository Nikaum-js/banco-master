// Contador de rodada (044, D1 do plan). A definição é "a busca do próximo assento deu a
// volta na ordem", não "N turnos" — só essa definição é estável com elimição no meio.
import { describe, it, expect } from 'vitest'
import { createSeedState } from '@/game/setup'
import { rollDice, resolvePending, finalizeTurn } from '@/game/turn/turnMachine'
import type { GameState } from '@/game/turn/types'
import type { TurnCtx } from '@/game/turn/turnMachine'
import { ctxWith } from './_helpers'

function fullTurn(g: GameState, ctx: TurnCtx): GameState {
  g = rollDice(g, ctx)
  if (g.turn.state === 'casa-a-resolver') g = resolvePending(g, ctx)
  if (g.turn.state === 'aguardando-finalizacao') g = finalizeTurn(g, ctx)
  return g
}

describe('round (044)', () => {
  it('começa em 1', () => {
    const g = createSeedState(['p1', 'p2', 'p3'])
    expect(g.round).toBe(1)
  })

  it('incrementa UMA VEZ por volta completa na ordem de assentos (mesa de 3)', () => {
    let g = createSeedState(['p1', 'p2', 'p3'])
    const ctx = ctxWith([3, 2]) // sem dupla

    g = fullTurn(g, ctx) // p1 → p2
    expect(g.activeSeat).toBe(1)
    expect(g.round).toBe(1)

    g = fullTurn(g, ctx) // p2 → p3
    expect(g.activeSeat).toBe(2)
    expect(g.round).toBe(1)

    g = fullTurn(g, ctx) // p3 → p1 (deu a volta)
    expect(g.activeSeat).toBe(0)
    expect(g.round).toBe(2)
  })

  it('turno extra por dupla NÃO conta como rodada nova', () => {
    let g = createSeedState(['p1', 'p2', 'p3'])
    const dupla = ctxWith([1, 1]) // sempre dupla → re-roll do mesmo jogador

    g = fullTurn(g, dupla) // 1ª dupla de p1: mayRollAgain, ainda é a vez de p1
    expect(g.activeSeat).toBe(0)
    expect(g.turn.consecutiveDoubles).toBe(1)
    expect(g.round).toBe(1)

    g = fullTurn(g, dupla) // 2ª dupla de p1: ainda re-roll, ainda p1
    expect(g.activeSeat).toBe(0)
    expect(g.turn.consecutiveDoubles).toBe(2)
    expect(g.round).toBe(1)

    // 3ª dupla → prisão, encerra o turno à força e passa a vez (sem dar a volta ainda)
    g = fullTurn(g, dupla)
    expect(g.players[0].jail.inJail).toBe(true)
    expect(g.activeSeat).toBe(1)
    expect(g.round).toBe(1) // p1 → p2 não é volta completa
  })

  it('continua correto quando um jogador é eliminado no meio da volta (a ordem encurta)', () => {
    let g = createSeedState(['p1', 'p2', 'p3'])
    const ctx = ctxWith([3, 2])

    g = fullTurn(g, ctx) // p1 → p2, ainda rodada 1
    expect(g.activeSeat).toBe(1)
    expect(g.round).toBe(1)

    g.players[2].eliminated = true // p3 cai no meio da volta

    g = fullTurn(g, ctx) // p2 pula p3 (eliminado) e volta a p1: deu a volta
    expect(g.activeSeat).toBe(0)
    expect(g.round).toBe(2)

    g = fullTurn(g, ctx) // p1 → p2 (só os dois vivos alternam agora)
    expect(g.activeSeat).toBe(1)
    expect(g.round).toBe(2)
  })
})
