import { describe, it, expect } from 'vitest'
import { BOARD, type GroupKey, type PropertySquare } from '@/lib/boardData'

const cityNames = (g: GroupKey) =>
  BOARD.filter((s): s is PropertySquare => s.kind === 'property' && s.group === g).map((s) => s.name)

describe('Composição do tabuleiro (032/033 — rebalance + super-luxo)', () => {
  it('SC-004: 10 grupos (8×3 + navy 2 + Alta Roda 2) = 28 cidades; total 48 casas', () => {
    const cities = BOARD.filter((s) => s.kind === 'property')
    expect(cities.length).toBe(28)
    expect(BOARD.length).toBe(48)

    // 8 grupos com 3; navy (França) e platinum (Alta Roda) com 2.
    const tres: GroupKey[] = ['brown', 'skyblue', 'pink', 'purple', 'orange', 'red', 'yellow', 'green']
    for (const g of tres) expect(cityNames(g).length).toBe(3)
    expect(cityNames('navy').length).toBe(2)
    expect(cityNames('platinum').length).toBe(2)
  })

  it('Emirados (super-luxo) = Abu Dhabi + Dubai; verde 3 e França 2 (Chicago/Lyon saíram)', () => {
    expect(cityNames('platinum')).toEqual(['Abu Dhabi', 'Dubai'])
    expect(cityNames('green')).toEqual(['Nova York', 'Los Angeles', 'Miami'])
    expect(cityNames('navy')).toEqual(['Cannes', 'Paris'])
    const allNames = BOARD.filter((s) => s.kind === 'property').map((s) => s.name)
    expect(allNames).not.toContain('Chicago')
    expect(allNames).not.toContain('Lyon')
    expect(allNames).toContain('Abu Dhabi')
    expect(allNames).toContain('Dubai')
  })

  it('laranja tem 3 (Berlim, Munique, Hamburgo); Salvador fora', () => {
    expect(cityNames('orange')).toEqual(['Berlim', 'Munique', 'Hamburgo'])
    const allNames = BOARD.filter((s) => s.kind === 'property').map((s) => s.name)
    expect(allNames).not.toContain('Salvador')
    expect(cityNames('yellow')).toEqual(['Rio de Janeiro', 'São Paulo', 'Brasília'])
    expect(cityNames('red')).toEqual(['Pequim', 'Xangai', 'Hong Kong'])
  })

  it('aeroportos/utilidades/cantos permanecem nas posições de sempre', () => {
    const posOf = (kind: string) => BOARD.filter((s) => s.kind === kind).map((s) => s.pos)
    expect(posOf('airport')).toEqual([6, 18, 30, 42])
    expect(posOf('utility')).toEqual([14, 32, 43])
    expect([0, 12, 24, 36].every((p) => BOARD[p].kind.startsWith('corner'))).toBe(true)
  })
})
