import { describe, it, expect } from 'vitest'
import { applyEffect } from '@/game/cards/effects'
import { playHandCard } from '@/game/cards/draw'
import { tickTempEffects, isBoycotted, isTempImmune } from '@/game/economy/tempEffects'
import { economyResolve } from '@/game/economy/resolveRentable'
import { rollTaxMan } from '@/game/balancing/taxMan'
import { createSeedState, defaultPorts } from '@/game/store'
import type { GameState, Roll } from '@/game/turn/types'
import { BOARD } from '@/lib/boardData'
import { mockPorts, rngFromDice } from '../turn/_helpers'

const AIRPORT = BOARD.find((s) => s.kind === 'airport')!.pos
const UTILITY = BOARD.find((s) => s.kind === 'utility')!.pos
const diceRoll: Roll = { white: [3, 2], speed: null, isDouble: false, move: 5, special: null } // diceValue=5

describe('Apagão e Greve — imediatas (US1)', () => {
  it('SC-001: Apagão desliga a dobra do Hangar; expira no GO do sacador', () => {
    const g = createSeedState(['p1', 'p2', 'p3'])
    g.titles[AIRPORT].ownerId = 'p2'
    g.titles[AIRPORT].hangar = true
    applyEffect('apagao', g, 'p1', mockPorts())
    expect(g.tempEffects.some((e) => e.kind === 'apagao')).toBe(true)

    economyResolve({ playerId: 'p3', square: BOARD[AIRPORT], roll: null, ports: mockPorts(), state: g })
    expect(g.players[2].cash).toBe(2000 - 25) // base (1 aeroporto), SEM a dobra

    tickTempEffects(g, 'p1') // sacador passa pelo GO (1 volta)
    expect(g.tempEffects.some((e) => e.kind === 'apagao')).toBe(false) // expirou
  })

  it('SC-001: Greve zera o aluguel das utilidades', () => {
    const comGreve = createSeedState(['p1', 'p2', 'p3'])
    comGreve.titles[UTILITY].ownerId = 'p2'
    applyEffect('greveUtilidades', comGreve, 'p1', mockPorts())
    economyResolve({ playerId: 'p3', square: BOARD[UTILITY], roll: diceRoll, ports: mockPorts(), state: comGreve })
    expect(comGreve.players[2].cash).toBe(2000) // $0 (greve)

    const semGreve = createSeedState(['p1', 'p2', 'p3'])
    semGreve.titles[UTILITY].ownerId = 'p2'
    economyResolve({ playerId: 'p3', square: BOARD[UTILITY], roll: diceRoll, ports: mockPorts(), state: semGreve })
    expect(semGreve.players[2].cash).toBe(2000 - 20) // 1 utilidade: mult 4 × dados 5 = 20
  })
})

describe('Boicote (US2)', () => {
  function withBoicoteHand(): GameState {
    const g = createSeedState(['p1', 'p2', 'p3'])
    g.players[0].hand.push('boicote-1') // p1 (ativo) com a carta
    g.titles[1].ownerId = 'p2' // Roma de p2 (alvo válido)
    return g
  }

  it('SC-002: boicota propriedade de outro → ninguém paga; expira em 2 voltas', () => {
    let g = withBoicoteHand()
    g = playHandCard(g, 'p1', 'boicote-1', defaultPorts, 1)
    expect(isBoycotted(g, 1)).toBe(true)
    expect(g.players[0].hand).not.toContain('boicote-1') // carta usada

    economyResolve({ playerId: 'p3', square: BOARD[1], roll: null, ports: mockPorts(), state: g })
    expect(g.players[2].cash).toBe(2000) // p3 não paga

    tickTempEffects(g, 'p1')
    expect(isBoycotted(g, 1)).toBe(true) // 1 volta ainda
    tickTempEffects(g, 'p1')
    expect(isBoycotted(g, 1)).toBe(false) // expirou (2 voltas)
  })

  it('SC-002: alvo próprio / sem dono / imune → no-op', () => {
    const propria = withBoicoteHand()
    propria.titles[1].ownerId = 'p1' // própria
    expect(playHandCard(propria, 'p1', 'boicote-1', defaultPorts, 1)).toBe(propria)

    const semDono = withBoicoteHand()
    expect(playHandCard(semDono, 'p1', 'boicote-1', defaultPorts, 5)).toBe(semDono) // pos 5 livre

    const imune = withBoicoteHand()
    imune.tempEffects.push({ kind: 'imunidade-temp', ownerId: 'p2', pos: 1, lapsRemaining: 2 })
    expect(playHandCard(imune, 'p1', 'boicote-1', defaultPorts, 1)).toBe(imune) // protegida
  })

  it('SC-005: Tax Man não cobra propriedade boicotada', () => {
    const g = createSeedState(['p1', 'p2'])
    g.titles[3].ownerId = 'p2'
    g.tempEffects.push({ kind: 'boicote', ownerId: 'p1', pos: 3, lapsRemaining: 2 })
    g.taxManPos = 0
    rollTaxMan(g, rngFromDice([1, 2])) // move 3 → pos 3 (boicotada)
    expect(g.players[1].cash).toBe(2000) // dono não é cobrado
  })
})

describe('Imunidade Temporária (US3)', () => {
  it('SC-003: registra só sobre propriedade própria e bloqueia Boicote', () => {
    const g = createSeedState(['p1', 'p2'])
    g.players[0].hand.push('imunidade-1')
    g.titles[1].ownerId = 'p1' // própria

    const naoPropria = structuredCloneState(g)
    naoPropria.titles[1].ownerId = 'p2'
    expect(playHandCard(naoPropria, 'p1', 'imunidade-1', defaultPorts, 1)).toBe(naoPropria) // não é própria → no-op

    const out = playHandCard(g, 'p1', 'imunidade-1', defaultPorts, 1)
    expect(isTempImmune(out, 1)).toBe(true)
    expect(out.players[0].hand).not.toContain('imunidade-1')
  })

  it('SC-004: expira em 2 voltas do originador', () => {
    const g = createSeedState(['p1', 'p2'])
    g.tempEffects.push({ kind: 'imunidade-temp', ownerId: 'p1', pos: 1, lapsRemaining: 2 })
    tickTempEffects(g, 'p1')
    expect(isTempImmune(g, 1)).toBe(true)
    tickTempEffects(g, 'p1')
    expect(isTempImmune(g, 1)).toBe(false)
  })
})

function structuredCloneState(g: GameState): GameState {
  return structuredClone(g)
}
