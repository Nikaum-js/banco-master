import { describe, it, expect } from 'vitest'
import { cardResolve, resolveCardDiscard } from '@/game/cards/draw'
import { handCount } from '@/game/cards/hand'
import { createSeedState } from '@/game/store'
import type { TurnPorts } from '@/game/turn/resolution'
import { BOARD } from '@/lib/boardData'

function ports(): TurnPorts {
  return { onPassGo: () => 200, onPayToCenter: () => {}, onCollectCenter: () => 0, isEliminated: () => false }
}

describe('Mão (US2)', () => {
  it('SC-002: 4ª carta de mão abre descarte; discardCard resolve', () => {
    const g = createSeedState(['p1', 'p2'])
    g.players[0].hand = ['saia-prisao-1', 'diplomacia-1', 'imunidade-1'] // 3 cartas de mão
    g.decks.acaso = ['aquisicao-hostil-1', 'volta-go-1']
    const out = cardResolve({ playerId: 'p1', square: BOARD[8], roll: null, ports: ports(), state: g })
    expect(out).toEqual({ done: false, blocksFinalize: true })
    expect(g.players[0].hand.length).toBe(4)
    expect(g.resolution?.kind).toBe('card-discard')

    const after = resolveCardDiscard(g, 'imunidade-1')
    expect(after.players[0].hand.length).toBe(3)
    expect(after.players[0].hand).not.toContain('imunidade-1')
    expect(after.resolution).toBeNull()
  })

  it('SC-003: handCount é a visão pública; Bus Ticket fora do limite', () => {
    const g = createSeedState(['p1', 'p2'])
    g.players[0].hand = ['saia-prisao-1', 'diplomacia-1']
    g.players[0].busTickets = 5
    expect(handCount(g, 'p1')).toBe(2)
    // 3ª carta de mão entra sem descarte (Bus Tickets não contam)
    g.decks.tesouro = ['imunidade-1']
    cardResolve({ playerId: 'p1', square: BOARD[2], roll: null, ports: ports(), state: g })
    expect(g.players[0].hand.length).toBe(3)
    expect(g.resolution).toBeNull()
  })
})
