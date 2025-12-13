import { describe, it, expect } from 'vitest'
import { executeTrade } from '@/game/economy/trade'
import { transferKeepFee } from '@/game/economy/mortgage'
import { createSeedState } from '@/game/store'
import type { GameState } from '@/game/turn/types'
import { BOARD } from '@/lib/boardData'

const AIRPORT = BOARD.find((s) => s.kind === 'airport')!.pos

// p1 dono da pos 1 (Roma), p2 dono da pos 3 (Veneza).
function twoOwners(): GameState {
  const g = createSeedState(['p1', 'p2'])
  g.titles[1].ownerId = 'p1'
  g.titles[3].ownerId = 'p2'
  return g
}

describe('Negociação — troca (US1)', () => {
  it('SC-001: troca propriedades + caixa entre dois jogadores', () => {
    const g = twoOwners()
    const out = executeTrade(g, { fromId: 'p1', toId: 'p2', fromProps: [1], fromCash: 100, toProps: [3], toCash: 0 })
    expect(out.titles[1].ownerId).toBe('p2')
    expect(out.titles[3].ownerId).toBe('p1')
    expect(out.players[0].cash).toBe(1900)
    expect(out.players[1].cash).toBe(2100)
  })

  it('SC-001: oferta unilateral (presente) é válida; não toca mão/Bus Tickets', () => {
    const g = twoOwners()
    const out = executeTrade(g, { fromId: 'p1', toId: 'p2', fromProps: [1], fromCash: 50, toProps: [], toCash: 0 })
    expect(out.titles[1].ownerId).toBe('p2')
    expect(out.players[0].cash).toBe(1950)
    expect(out.players[1].cash).toBe(2050)
    expect(out.players[0].hand).toEqual(g.players[0].hand) // cartas não mudam (SC-005)
    expect(out.players[0].busTickets).toBe(g.players[0].busTickets)
  })

  it('SC-006: troca fora do turno do proponente é processada', () => {
    const g = createSeedState(['p1', 'p2', 'p3']) // ativo = p1
    g.titles[5].ownerId = 'p2'
    const out = executeTrade(g, { fromId: 'p2', toId: 'p3', fromProps: [5], fromCash: 0, toProps: [], toCash: 200 })
    expect(out.titles[5].ownerId).toBe('p3')
    expect(out.players[1].cash).toBe(2000 + 200) // p2 recebe
    expect(out.players[2].cash).toBe(2000 - 200) // p3 paga
    expect(out.activeSeat).toBe(0) // turno não muda
  })

  it('SC-002: rejeições deixam o estado inalterado (atômico)', () => {
    const g = twoOwners()
    expect(executeTrade(g, { fromId: 'p1', toId: 'p2', fromProps: [3], fromCash: 0, toProps: [], toCash: 0 })).toBe(g) // p1 não possui pos 3
    expect(executeTrade(g, { fromId: 'p1', toId: 'p1', fromProps: [1], fromCash: 0, toProps: [], toCash: 0 })).toBe(g) // mesmo jogador
    const semCaixa = twoOwners()
    semCaixa.players[0].cash = 50
    expect(executeTrade(semCaixa, { fromId: 'p1', toId: 'p2', fromProps: [], fromCash: 100, toProps: [], toCash: 0 })).toBe(semCaixa) // oferece mais do que tem
    const elim = twoOwners()
    elim.players[1].eliminated = true
    expect(executeTrade(elim, { fromId: 'p1', toId: 'p2', fromProps: [1], fromCash: 0, toProps: [], toCash: 0 })).toBe(elim)
    const pausado = { ...twoOwners(), paused: true }
    expect(executeTrade(pausado, { fromId: 'p1', toId: 'p2', fromProps: [1], fromCash: 0, toProps: [], toCash: 0 })).toBe(pausado)
  })

  it('SC-002: cidade com construção bloqueia a troca daquela propriedade', () => {
    const g = twoOwners()
    g.titles[1].houses = 1 // Roma com 1 casa
    expect(executeTrade(g, { fromId: 'p1', toId: 'p2', fromProps: [1], fromCash: 0, toProps: [], toCash: 0 })).toBe(g)
  })
})

describe('Negociação — hipoteca e Hangar (US2)', () => {
  it('SC-003: hipotecada trocada chega hipotecada e cobra 10% do recebedor', () => {
    const g = twoOwners()
    g.titles[3].mortgaged = true // Veneza (price 80) hipotecada, de p2
    const fee = transferKeepFee(BOARD[3]) // round((80/2)*0.1) = 4
    const out = executeTrade(g, { fromId: 'p2', toId: 'p1', fromProps: [3], fromCash: 0, toProps: [], toCash: 0 })
    expect(out.titles[3].ownerId).toBe('p1')
    expect(out.titles[3].mortgaged).toBe(true) // continua hipotecada
    expect(out.players[0].cash).toBe(2000 - fee) // p1 (recebedor) paga a taxa
    expect(out.players[1].cash).toBe(2000) // p2 não paga taxa
  })

  it('SC-003: recebedor sem caixa para a taxa → no-op', () => {
    const g = twoOwners()
    g.titles[3].mortgaged = true
    g.players[0].cash = 2 // < fee 4
    expect(executeTrade(g, { fromId: 'p2', toId: 'p1', fromProps: [3], fromCash: 0, toProps: [], toCash: 0 })).toBe(g)
  })

  it('SC-004: aeroporto com Hangar trocado mantém o Hangar no novo dono', () => {
    const g = createSeedState(['p1', 'p2'])
    g.titles[AIRPORT].ownerId = 'p1'
    g.titles[AIRPORT].hangar = true
    const out = executeTrade(g, { fromId: 'p1', toId: 'p2', fromProps: [AIRPORT], fromCash: 0, toProps: [], toCash: 0 })
    expect(out.titles[AIRPORT].ownerId).toBe('p2')
    expect(out.titles[AIRPORT].hangar).toBe(true)
  })
})
