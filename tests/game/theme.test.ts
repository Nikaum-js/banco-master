import { describe, it, expect } from 'vitest'
import { BOARD } from '@/lib/boardData'
import { THEME } from '@/game/theme'
import { createSeedState } from '@/game/store'

describe('Tema Cidades do Mundo (018)', () => {
  it('SC-003: nenhum nome duplicado entre casas nomeadas (cidade/aeroporto/utilidade/imposto)', () => {
    // Acaso/Tesouro/Bus Ticket são marcadores genéricos (repetem de propósito) — fora do escopo.
    const named = ['property', 'airport', 'utility', 'tax']
    const names = BOARD.filter((s) => named.includes(s.kind)).map((s) => s.name)
    const dups = names.filter((n, i) => names.indexOf(n) !== i)
    expect(dups).toEqual([])
  })

  it('aeroportos têm nomes próprios e IATA preservado', () => {
    const airports = BOARD.filter((s) => s.kind === 'airport')
    expect(airports.map((a) => a.name).sort()).toEqual(
      ['Aeroporto Heathrow', 'Aeroporto JFK', 'Aeroporto Narita', 'Aeroporto de Sydney'],
    )
  })

  it('SC-002: o seed reflete o THEME (fonte única)', () => {
    const g = createSeedState(['p1', 'p2'])
    expect(g.players[0].cash).toBe(THEME.INITIAL_CASH)
    expect(g.bank).toEqual(THEME.BANK)
    expect(g.centerPot).toBe(THEME.PARKING_SEED)
  })
})
