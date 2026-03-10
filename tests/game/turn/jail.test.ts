import { describe, it, expect } from 'vitest'
import { createSeedState } from '@/game/store'
import { jailDecision } from '@/game/turn/turnMachine'
import type { GameState } from '@/game/turn/types'
import { rngFromDice, mockPorts } from './_helpers'

// Um jogador, já preso — turnOrder de 1 mantém o mesmo ativo entre tentativas.
function jailedSinglePlayer(): GameState {
  const g = createSeedState(['p1'])
  g.players[0].pos = 12 // preso = na casa da Prisão
  g.players[0].jail = { inJail: true, attempts: 0 }
  g.turn.state = 'prisao-decisao'
  return g
}

describe('Turno de Prisão (US2)', () => {
  it('SC-004: 3 tentativas; na 3ª sem dupla paga $50 e move', () => {
    let g = jailedSinglePlayer()
    const ports = mockPorts()
    const ctx = { rng: rngFromDice([3, 2]), ports } // 3+2 nunca é dupla

    g = jailDecision(g, 'try', ctx) // tentativa 1
    expect(g.players[0].jail.attempts).toBe(1)
    expect(g.players[0].jail.inJail).toBe(true)
    expect(g.turn.state).toBe('prisao-decisao') // mesma p1, segue presa

    g = jailDecision(g, 'try', ctx) // tentativa 2
    expect(g.players[0].jail.attempts).toBe(2)

    g = jailDecision(g, 'try', ctx) // tentativa 3 → forçado
    expect(ports.onPayToCenter).toHaveBeenCalledWith(50)
    expect(g.players[0].jail.inJail).toBe(false)
    expect(g.players[0].pos).toBe(17) // 12 + 5
    expect(g.turn.state).toBe('casa-a-resolver')
  })

  it('FR-019: sair com dupla NÃO dá nova rolagem', () => {
    let g = jailedSinglePlayer()
    g = jailDecision(g, 'try', { rng: rngFromDice([2, 2]), ports: mockPorts() })
    expect(g.players[0].jail.inJail).toBe(false)
    expect(g.players[0].pos).toBe(16) // 12 + 4
    expect(g.turn.mayRollAgain).toBe(false)
    expect(g.turn.state).toBe('casa-a-resolver')
  })

  it('FR-016: pagar $50 sai da prisão e habilita rolagem', () => {
    let g = jailedSinglePlayer()
    const ports = mockPorts()
    g = jailDecision(g, 'pay', { rng: rngFromDice([1, 1]), ports })
    expect(ports.onPayToCenter).toHaveBeenCalledWith(50)
    expect(g.players[0].jail.inJail).toBe(false)
    expect(g.turn.state).toBe('aguardando-rolagem')
  })
})
