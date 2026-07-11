import { describe, it, expect } from 'vitest'
import { goBonus, payToCenter, collectCenter } from '@/game/balancing/balancing'
import { jailDecision } from '@/game/turn/turnMachine'
import { resolveSquare } from '@/game/turn/resolution'
import { createSeedState } from '@/game/setup'
import type { TurnPorts } from '@/game/turn/resolution'
import { BOARD } from '@/lib/boardData'
import { THEME } from '@/game/theme'

// Caixa inicial vem do THEME: um literal aqui trava o balanceamento no teste (D-076).
const CASH0 = THEME.INITIAL_CASH

// Portas reais (balanceamento) para os testes de integração.
function realPorts(): TurnPorts {
  return {
    onPassGo: (s, id) => goBonus(s, id),
    onPayToCenter: (s, a) => payToCenter(s, a),
    onCollectCenter: (s, id) => collectCenter(s, id),
    draw: (state, deckId) => state.decks[deckId].shift() ?? null, // 043 — igual ao default de produção (setup.ts)
    hasReaction: () => null,
  }
}

describe('GO fixo (US1)', () => {
  it('passar pelo GO é FIXO, igual para todos (sem ranking)', () => {
    const g = createSeedState(['p1', 'p2', 'p3'])
    g.players[0].cash = 5000 // mais rico
    g.players[2].cash = 100 // mais pobre
    // O VALOR é knob de balanceamento (D-076 levou de $200 a $250); o que este teste trava é a
    // ausência de ranking — os três recebem o MESMO, seja ele qual for.
    expect(goBonus(g, 'p1')).toBe(THEME.GO_PASS)
    expect(goBonus(g, 'p2')).toBe(THEME.GO_PASS)
    expect(goBonus(g, 'p3')).toBe(THEME.GO_PASS)
  })
})

describe('Free Parking (US2)', () => {
  it('SC-002 (helper): payToCenter soma ao pote', () => {
    const g = createSeedState(['p1', 'p2']) // pote = PARKING_SEED
    payToCenter(g, 200)
    expect(g.centerPot).toBe(THEME.PARKING_SEED + 200)
  })

  it('SC-002: imposto debita o jogador e soma ao pote', () => {
    const g = createSeedState(['p1', 'p2'])
    const imposto = (BOARD[4] as { amount: number }).amount // Imposto de Renda
    resolveSquare({ playerId: 'p1', square: BOARD[4], roll: null, ports: realPorts(), state: g })
    expect(g.players[0].cash).toBe(CASH0 - imposto)
    expect(g.centerPot).toBe(THEME.PARKING_SEED + imposto)
  })

  it('SC-003: multa de $50 da prisão debita e soma ao pote', () => {
    const g = createSeedState(['p1'])
    g.players[0].pos = 12
    g.players[0].jail = { inJail: true, attempts: 0 }
    g.turn.state = 'prisao-decisao'
    const after = jailDecision(g, 'pay', { rng: () => 0, ports: realPorts() })
    expect(after.players[0].cash).toBe(CASH0 - THEME.JAIL_FINE)
    expect(after.centerPot).toBe(THEME.PARKING_SEED + THEME.JAIL_FINE)
  })

  it('SC-004: parar em Férias coleta o pote e reseta à semente', () => {
    const g = createSeedState(['p1', 'p2'])
    g.centerPot = 750
    collectCenter(g, 'p1')
    expect(g.players[0].cash).toBe(CASH0 + 750)
    expect(g.centerPot).toBe(THEME.PARKING_SEED)
  })

  it('round-trip JSON com centerPot', () => {
    const g = createSeedState(['p1', 'p2'])
    g.centerPot = 1234
    expect(JSON.parse(JSON.stringify(g))).toEqual(g)
  })
})
