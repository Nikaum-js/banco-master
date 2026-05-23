import { describe, it, expect } from 'vitest'
import { shuffle } from '@/game/cards/decks'
import { cardResolve } from '@/game/cards/draw'
import { createSeedState } from '@/game/store'
import type { TurnPorts } from '@/game/turn/resolution'
import { BOARD } from '@/lib/boardData'

function ports(): TurnPorts {
  return { onPassGo: () => 200, onPayToCenter: () => {}, onCollectCenter: () => 0, isEliminated: () => false }
}

describe('Decks e saque (US1)', () => {
  it('SC-001: saca do topo; imediata aplica e volta ao fundo', () => {
    const g = createSeedState(['p1', 'p2'])
    g.decks.tesouro = ['boom-economico-1', 'erro-banco-1'] // topo = boom
    const out = cardResolve({ playerId: 'p1', square: BOARD[2], roll: null, ports: ports(), state: g })
    expect(out).toEqual({ done: true })
    expect(g.players[0].cash).toBe(2200) // Boom +200 a todos
    expect(g.players[1].cash).toBe(2200)
    expect(g.decks.tesouro[0]).toBe('erro-banco-1') // topo avançou
    expect(g.decks.tesouro.at(-1)).toBe('boom-economico-1') // voltou ao fundo
  })

  it('SC-001: carta de mão vai para a mão (sai do deck)', () => {
    const g = createSeedState(['p1', 'p2'])
    g.decks.tesouro = ['saia-prisao-1', 'erro-banco-1']
    cardResolve({ playerId: 'p1', square: BOARD[2], roll: null, ports: ports(), state: g })
    expect(g.players[0].hand).toEqual(['saia-prisao-1'])
    expect(g.decks.tesouro).toEqual(['erro-banco-1'])
  })

  it('SC-006: deck nunca esgota (imediatas reciclam)', () => {
    const g = createSeedState(['p1', 'p2'])
    g.decks.acaso = ['volta-go-1'] // só imediata
    for (let i = 0; i < 5; i++) cardResolve({ playerId: 'p1', square: BOARD[8], roll: null, ports: ports(), state: g })
    expect(g.decks.acaso.length).toBeGreaterThan(0)
  })

  it('shuffle é determinístico com o mesmo rng', () => {
    const rng = (): number => 0.42
    expect(shuffle(['a', 'b', 'c', 'd'], rng)).toEqual(shuffle(['a', 'b', 'c', 'd'], rng))
  })

  it('T018: GameState estendido (decks/mão/contadores) é serializável', () => {
    const g = createSeedState(['p1', 'p2'])
    g.players[0].hand = ['saia-prisao-1']
    g.players[0].busTickets = 2
    expect(JSON.parse(JSON.stringify(g))).toEqual(g)
  })
})
