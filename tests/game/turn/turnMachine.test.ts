import { describe, it, expect } from 'vitest'
import { createSeedState } from '@/game/store'
import {
  rollDice,
  resolvePending,
  finalizeTurn,
  chooseBusMove,
  chooseTripleDest,
} from '@/game/turn/turnMachine'
import type { GameState } from '@/game/turn/types'
import type { TurnCtx } from '@/game/turn/turnMachine'
import { ctxWith, mockPorts, rngFromDice } from './_helpers'

function fullTurn(g: GameState, ctx: TurnCtx): GameState {
  g = rollDice(g, ctx)
  if (g.turn.state === 'casa-a-resolver') g = resolvePending(g, ctx)
  if (g.turn.state === 'aguardando-finalizacao') g = finalizeTurn(g, ctx)
  return g
}

describe('Ciclo de turno (US1)', () => {
  it('SC-001: turno completo passa a vez ao próximo jogador', () => {
    let g = createSeedState(['p1', 'p2', 'p3'])
    const ctx = ctxWith([3, 2]) // 3+2 = 5, sem dupla
    g = rollDice(g, ctx)
    expect(g.turn.state).toBe('casa-a-resolver')
    expect(g.players[0].pos).toBe(5)
    g = resolvePending(g, ctx)
    expect(g.turn.state).toBe('aguardando-finalizacao')
    expect(g.activeSeat).toBe(0) // ainda não avançou (SC-005)
    g = finalizeTurn(g, ctx)
    expect(g.activeSeat).toBe(1)
    expect(g.turn.state).toBe('aguardando-rolagem')
  })

  it('SC-001: pula jogadores eliminados na ordem', () => {
    let g = createSeedState(['p1', 'p2', 'p3'])
    g.players[1].eliminated = true
    g = fullTurn(g, ctxWith([3, 2]))
    expect(g.activeSeat).toBe(2) // pulou p2
  })

  it('SC-005/FR-006: comandos fora de hora são no-op (janela livre, sem ordem imposta)', () => {
    const g = createSeedState(['p1', 'p2'])
    const ctx = ctxWith([3, 2])
    expect(resolvePending(g, ctx)).toBe(g) // em aguardando-rolagem → no-op
    expect(finalizeTurn(g, ctx)).toBe(g)
  })

  it('SC-006: cruzar 47→0 credita GO uma vez', () => {
    let g = createSeedState(['p1', 'p2'])
    g.players[0].pos = 45
    const ports = mockPorts()
    g = rollDice(g, { rng: rngFromDice([3, 2]), ports })
    expect(g.players[0].pos).toBe(2) // 45 + 5 = 50 % 48
    expect(ports.onPassGo).toHaveBeenCalledTimes(1)
  })

  it('SC-006/FR-012: ida à prisão não credita GO e encerra o turno', () => {
    let g = createSeedState(['p1', 'p2'])
    g.players[0].pos = 31
    const ports = mockPorts()
    g = rollDice(g, { rng: rngFromDice([3, 2]), ports }) // 31 + 5 = 36 (corner-gotojail)
    expect(g.players[0].pos).toBe(12)
    expect(g.players[0].jail.inJail).toBe(true)
    expect(ports.onPassGo).not.toHaveBeenCalled()
    expect(g.activeSeat).toBe(1) // turno forçado encerrou → próximo
  })

  it('SC-007: pausa torna comandos no-op e preserva o jogador ativo', () => {
    const g = createSeedState(['p1', 'p2'])
    g.paused = true
    const r = rollDice(g, ctxWith([3, 2]))
    expect(r).toBe(g)
    expect(r.activeSeat).toBe(0)
  })

  it('estado é serializável (round-trip JSON) — invariante #9', () => {
    let g = createSeedState(['p1', 'p2'])
    g = rollDice(g, ctxWith([3, 2]))
    expect(JSON.parse(JSON.stringify(g))).toEqual(g)
  })
})

describe('Duplas (US2)', () => {
  it('SC-002: dupla gera re-roll; 3 duplas → prisão sem o 3º movimento', () => {
    let g = createSeedState(['p1', 'p2'])
    const ctx = ctxWith([1, 1]) // sempre dupla 1-1 → move 2

    g = rollDice(g, ctx) // 1ª dupla
    expect(g.turn.mayRollAgain).toBe(true)
    expect(g.players[0].pos).toBe(2)
    g = resolvePending(g, ctx)
    g = finalizeTurn(g, ctx) // re-roll
    expect(g.turn.state).toBe('aguardando-rolagem')
    expect(g.activeSeat).toBe(0) // mesmo jogador
    expect(g.turn.consecutiveDoubles).toBe(1)

    g = rollDice(g, ctx) // 2ª dupla
    expect(g.players[0].pos).toBe(4)
    expect(g.turn.consecutiveDoubles).toBe(2)
    g = resolvePending(g, ctx)
    g = finalizeTurn(g, ctx)

    g = rollDice(g, ctx) // 3ª dupla → prisão
    expect(g.players[0].jail.inJail).toBe(true)
    expect(g.players[0].pos).toBe(12) // não avançou para 6
    expect(g.activeSeat).toBe(1) // passou a vez
  })
})

describe('Speed Die no movimento (US3)', () => {
  it('SC-003: completar a 1ª volta liga o Speed Die a partir da próxima rolagem', () => {
    let g = createSeedState(['p1', 'p2'])
    g.players[0].pos = 45
    g = rollDice(g, ctxWith([3, 2])) // cruza GO (esta rolagem ainda com 2 dados)
    expect(g.players[0].completouPrimeiraVolta).toBe(true)
  })

  it('FR-026/Q1: triple encerra a rolagem sem re-roll', () => {
    let g = createSeedState(['p1', 'p2'])
    g.players[0].completouPrimeiraVolta = true
    const ctx = ctxWith([3, 3, 3]) // triple
    g = rollDice(g, ctx)
    expect(g.turn.awaitingChoice).toBe('triple')
    g = chooseTripleDest(g, 20, ctx)
    expect(g.players[0].pos).toBe(20)
    expect(g.turn.mayRollAgain).toBe(false) // sem re-roll mesmo com brancos iguais
    expect(g.turn.state).toBe('casa-a-resolver')
  })

  it('FR-025/Q3: Ônibus move um dado e não quebra a dupla', () => {
    let g = createSeedState(['p1', 'p2'])
    g.players[0].completouPrimeiraVolta = true
    const ctx = ctxWith([4, 4, 6]) // brancos 4,4 (dupla) + ônibus
    g = rollDice(g, ctx)
    expect(g.turn.awaitingChoice).toBe('onibus')
    g = chooseBusMove(g, 'die0', ctx)
    expect(g.players[0].pos).toBe(4) // moveu só um dado (4)
    expect(g.turn.mayRollAgain).toBe(true) // dupla nos brancos preservada (Q3)
  })

  it('FR-024: Mr. Banco Master avança até a próxima casa comprável', () => {
    let g = createSeedState(['p1', 'p2'])
    g.players[0].completouPrimeiraVolta = true
    const ctx = ctxWith([1, 1, 4]) // brancos 1,1 + mr-banco → move 2 (pos2 tesouro), depois comprável
    g = rollDice(g, ctx)
    expect(g.players[0].pos).toBe(3) // pos2 não-comprável → pos3 (property)
    expect(g.turn.state).toBe('casa-a-resolver')
  })
})
