import { describe, it, expect } from 'vitest'
import { rentCity, rentAirport, rentUtility, diceValue } from '@/game/economy/rent'
import { economyResolve } from '@/game/economy/resolveRentable'
import { createSeedState, defaultPorts } from '@/game/store'
import { BOARD } from '@/lib/boardData'
import type { Roll } from '@/game/turn/types'

describe('Aluguel — cálculo puro (US2)', () => {
  it('SC-003: cidade base / 150% maioria / 200% completo', () => {
    // grupo de 3
    expect(rentCity(10, 1, 3)).toBe(10) // não-maioria
    expect(rentCity(10, 2, 3)).toBe(15) // maioria (2 de 3)
    expect(rentCity(10, 3, 3)).toBe(20) // completo
    // grupo de 4
    expect(rentCity(8, 2, 4)).toBe(8) // 2 de 4 → base
    expect(rentCity(8, 3, 4)).toBe(12) // 3 de 4 (maioria) → 150%
    expect(rentCity(8, 4, 4)).toBe(16) // completo → 200%
  })

  it('SC-004: aeroporto $25/$50/$100/$200', () => {
    expect([1, 2, 3, 4].map(rentAirport)).toEqual([25, 50, 100, 200])
  })

  it('SC-005: utilidade 4×/10×/20× o valor dos dados', () => {
    expect(rentUtility(1, 8)).toBe(32)
    expect(rentUtility(2, 8)).toBe(80)
    expect(rentUtility(3, 5)).toBe(100)
  })

  it('diceValue inclui a face numérica do Speed Die, não os símbolos', () => {
    const r: Roll = { white: [3, 4], speed: 2, isDouble: false, move: 9, special: null }
    expect(diceValue(r)).toBe(9)
    const r2: Roll = { white: [3, 4], speed: 'mr-banco', isDouble: false, move: 7, special: 'mr-banco' }
    expect(diceValue(r2)).toBe(7)
  })
})

describe('Aluguel — resolução (US2)', () => {
  const ports = defaultPorts

  it('cobra aluguel do pagador e credita o dono (Roma base = 2)', () => {
    const g = createSeedState(['p1', 'p2'])
    g.titles[1] = { ownerId: 'p2', mortgaged: false } // Roma (brown), p2 só tem 1 do grupo
    const out = economyResolve({ playerId: 'p1', square: BOARD[1], roll: null, ports, state: g })
    expect(out).toEqual({ done: true })
    expect(g.players[0].cash).toBe(2000 - 2)
    expect(g.players[1].cash).toBe(2000 + 2)
  })

  it('SC-006: propriedade hipotecada não cobra', () => {
    const g = createSeedState(['p1', 'p2'])
    g.titles[1] = { ownerId: 'p2', mortgaged: true }
    economyResolve({ playerId: 'p1', square: BOARD[1], roll: null, ports, state: g })
    expect(g.players[0].cash).toBe(2000)
  })

  it('SC-006: propriedade própria não cobra', () => {
    const g = createSeedState(['p1', 'p2'])
    g.titles[1] = { ownerId: 'p1', mortgaged: false }
    const out = economyResolve({ playerId: 'p1', square: BOARD[1], roll: null, ports, state: g })
    expect(out).toEqual({ done: true })
    expect(g.players[0].cash).toBe(2000)
  })

  it('SC-001: casa livre abre o modal de compra (resolução pendente)', () => {
    const g = createSeedState(['p1', 'p2'])
    const out = economyResolve({ playerId: 'p1', square: BOARD[1], roll: null, ports, state: g })
    expect(out).toEqual({ done: false, blocksFinalize: true })
    expect(g.resolution).toEqual({ kind: 'purchase', pos: 1 })
  })

  it('FR-016: caixa insuficiente sinaliza insolvência e não fica negativo', () => {
    const g = createSeedState(['p1', 'p2'])
    g.titles[1] = { ownerId: 'p2', mortgaged: false }
    g.players[0].cash = 1 // < aluguel base 2
    let signalled: [string, number, string | null] | null = null
    economyResolve({
      playerId: 'p1',
      square: BOARD[1],
      roll: null,
      ports: { ...ports, onInsolvency: (p, a, c) => { signalled = [p, a, c] } },
      state: g,
    })
    expect(signalled).toEqual(['p1', 2, 'p2'])
    expect(g.players[0].cash).toBe(1) // não debitou
  })
})
