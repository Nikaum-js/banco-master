import { describe, it, expect } from 'vitest'
import { rentCity, rentAirport, rentUtility, diceValue, posseFactor } from '@/game/economy/rent'
import { economyResolve } from '@/game/economy/resolveRentable'
import { createSeedState, defaultPorts } from '@/game/store'
import { BOARD } from '@/lib/boardData'
import type { Roll } from '@/game/turn/types'

describe('Aluguel — cálculo puro (US2)', () => {
  it('SC-003: cidade base / 150% maioria / 200% completo', () => {
    // grupo de 3 (sem construção, o grupo não afeta — base/150/200)
    expect(rentCity('pink', 10, 1, 3)).toBe(10) // não-maioria
    expect(rentCity('pink', 10, 2, 3)).toBe(15) // maioria (2 de 3)
    expect(rentCity('pink', 10, 3, 3)).toBe(20) // completo
    // grupo de 4
    expect(rentCity('pink', 8, 2, 4)).toBe(8) // 2 de 4 → base
    expect(rentCity('pink', 8, 3, 4)).toBe(12) // 3 de 4 (maioria) → 150%
    expect(rentCity('pink', 8, 4, 4)).toBe(16) // completo → 200%
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
    g.titles[1].ownerId = 'p2' // Roma (brown), p2 só tem 1 do grupo
    const out = economyResolve({ playerId: 'p1', square: BOARD[1], roll: null, ports, state: g })
    expect(out).toEqual({ done: true })
    expect(g.players[0].cash).toBe(2000 - 2)
    expect(g.players[1].cash).toBe(2000 + 2)
  })

  it('SC-006: propriedade hipotecada não cobra', () => {
    const g = createSeedState(['p1', 'p2'])
    g.titles[1].ownerId = 'p2'
    g.titles[1].mortgaged = true
    economyResolve({ playerId: 'p1', square: BOARD[1], roll: null, ports, state: g })
    expect(g.players[0].cash).toBe(2000)
  })

  it('SC-006: propriedade própria não cobra', () => {
    const g = createSeedState(['p1', 'p2'])
    g.titles[1].ownerId = 'p1'
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

  it('FR-016: caixa insuficiente abre dívida pendente (não fica negativo)', () => {
    const g = createSeedState(['p1', 'p2'])
    g.titles[1].ownerId = 'p2'
    g.players[0].cash = 1 // < aluguel base 2
    const out = economyResolve({ playerId: 'p1', square: BOARD[1], roll: null, ports, state: g })
    expect(out).toEqual({ done: false, blocksFinalize: true })
    expect(g.resolution).toEqual({ kind: 'debt', amount: 2, creditorId: 'p2' }) // dívida (008)
    expect(g.players[0].cash).toBe(1) // não debitou
  })
})

describe('Aluguel com construção — escala por posse do país (034)', () => {
  it('posseFactor: trio 50/75/100, duo 50/100', () => {
    expect(posseFactor(1, 3)).toBe(0.5)
    expect(posseFactor(2, 3)).toBe(0.75)
    expect(posseFactor(3, 3)).toBe(1)
    expect(posseFactor(1, 2)).toBe(0.5)
    expect(posseFactor(2, 2)).toBe(1)
  })

  it('SC-002/034: aluguel construído = tabela × fator de posse', () => {
    // base 10, pink (1 casa ×5 → tabela 50; hotel ×44 → 440), grupo de 3
    expect(rentCity('pink', 10, 1, 3, { houses: 1, hotel: false })).toBe(25) // 1/3 → 50×0,5
    expect(rentCity('pink', 10, 2, 3, { houses: 1, hotel: false })).toBe(38) // 2/3 → 50×0,75 (37,5→38)
    expect(rentCity('pink', 10, 3, 3, { houses: 1, hotel: false })).toBe(50) // 3/3 → 50×1,0
    expect(rentCity('pink', 10, 1, 3, { houses: 0, hotel: true })).toBe(220) // hotel 1/3 → 440×0,5
    expect(rentCity('pink', 10, 3, 3, { houses: 0, hotel: true })).toBe(440) // hotel completo → 440×1,0
  })

  it('SC-003/034: monotonicidade — construir sempre rende ≥ sem construir (mesma posse)', () => {
    // 1/3: sem construção = base 10; com 1 casa = 25 (> 10)
    expect(rentCity('pink', 10, 1, 3, { houses: 1, hotel: false })).toBeGreaterThan(rentCity('pink', 10, 1, 3))
    // 2/3: sem construção = 150% = 15; com 1 casa = 38 (> 15)
    expect(rentCity('pink', 10, 2, 3, { houses: 1, hotel: false })).toBeGreaterThan(rentCity('pink', 10, 2, 3))
  })

  it('sem construção mantém a regra da 003 (200% no grupo completo)', () => {
    expect(rentCity('pink', 10, 3, 3, { houses: 0, hotel: false })).toBe(20)
  })
})
