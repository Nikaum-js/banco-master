import { describe, it, expect } from 'vitest'
import { goBonus, payToCenter, collectCenter } from '@/game/balancing/balancing'
import { jailDecision } from '@/game/turn/turnMachine'
import { resolveSquare } from '@/game/turn/resolution'
import { createSeedState } from '@/game/store'
import type { TurnPorts } from '@/game/turn/resolution'
import { BOARD } from '@/lib/boardData'

// Portas reais (balanceamento) para os testes de integração.
function realPorts(): TurnPorts {
  return {
    onPassGo: (s, id) => goBonus(s, id),
    onPayToCenter: (s, a) => payToCenter(s, a),
    onCollectCenter: (s, id) => collectCenter(s, id),
    isEliminated: () => false,
  }
}

describe('GO Progressivo (US1)', () => {
  it('SC-001: último +$400, primeiro +$100, meio entre', () => {
    const g = createSeedState(['p1', 'p2', 'p3'])
    g.players[0].cash = 5000 // mais rico
    g.players[1].cash = 2000
    g.players[2].cash = 100 // mais pobre
    expect(goBonus(g, 'p1')).toBe(100)
    expect(goBonus(g, 'p3')).toBe(400)
    expect(goBonus(g, 'p2')).toBe(250) // round(100 + 1/2 × 300)
  })

  it('SC-005: usa netWorth (caixa + ativos, hipotecada ÷2)', () => {
    const g = createSeedState(['p1', 'p2'])
    g.players[0].cash = 1000
    g.players[1].cash = 1000
    g.titles[1].ownerId = 'p1' // Roma (price 60) → p1 mais rico por ativo
    expect(goBonus(g, 'p1')).toBe(100)
    expect(goBonus(g, 'p2')).toBe(400)
  })
})

describe('Free Parking (US2)', () => {
  it('SC-002 (helper): payToCenter soma ao pote', () => {
    const g = createSeedState(['p1', 'p2']) // pote 500
    payToCenter(g, 200)
    expect(g.centerPot).toBe(700)
  })

  it('SC-002: imposto debita o jogador e soma ao pote', () => {
    const g = createSeedState(['p1', 'p2'])
    resolveSquare({ playerId: 'p1', square: BOARD[4], roll: null, ports: realPorts(), state: g }) // Imposto $200
    expect(g.players[0].cash).toBe(2000 - 200)
    expect(g.centerPot).toBe(700)
  })

  it('SC-003: multa de $50 da prisão debita e soma ao pote', () => {
    const g = createSeedState(['p1'])
    g.players[0].pos = 12
    g.players[0].jail = { inJail: true, attempts: 0 }
    g.turn.state = 'prisao-decisao'
    const after = jailDecision(g, 'pay', { rng: () => 0, ports: realPorts() })
    expect(after.players[0].cash).toBe(2000 - 50)
    expect(after.centerPot).toBe(550)
  })

  it('SC-004: parar em Férias coleta o pote e reseta a $500', () => {
    const g = createSeedState(['p1', 'p2'])
    g.centerPot = 750
    collectCenter(g, 'p1')
    expect(g.players[0].cash).toBe(2000 + 750)
    expect(g.centerPot).toBe(500)
  })

  it('round-trip JSON com centerPot', () => {
    const g = createSeedState(['p1', 'p2'])
    g.centerPot = 1234
    expect(JSON.parse(JSON.stringify(g))).toEqual(g)
  })
})
