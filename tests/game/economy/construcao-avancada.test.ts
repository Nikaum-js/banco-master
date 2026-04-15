import { describe, it, expect } from 'vitest'
import { buildHouse, sellBuilding, buildHangar, sellHangar, buildCost } from '@/game/economy/construction'
import { rentCity } from '@/game/economy/rent'
import { economyResolve } from '@/game/economy/resolveRentable'
import { createSeedState } from '@/game/store'
import type { GameState } from '@/game/turn/types'
import type { PropertySquare } from '@/lib/boardData'
import { BOARD } from '@/lib/boardData'
import { mockPorts } from '../turn/_helpers'

// Grupo brown = 3 cidades (pos 1/3/5). `owned` = quais o p1 possui; `level` = nível de cada uma.
const BROWN = [1, 3, 5]
function brown(level: number, owned: number[] = BROWN): GameState {
  const g = createSeedState(['p1', 'p2'])
  for (const pos of owned) {
    const t = g.titles[pos]
    t.ownerId = 'p1'
    if (level <= 4) t.houses = level
    else {
      t.hotel = true
      t.hotel2 = level >= 6
      t.skyscraper = level >= 7
    }
  }
  g.players[0].cash = 5000
  return g
}

const AIRPORT = BOARD.find((s) => s.kind === 'airport')!.pos
const COST1 = buildCost(BOARD[1] as PropertySquare) // round(60/2)=30

describe('2º hotel (US1)', () => {
  it('SC-001: sobe hotel→2º hotel, custo do hotel (sem estoque — ilimitado)', () => {
    const g = brown(5)
    const out = buildHouse(g, 1)
    expect(out.titles[1].hotel2).toBe(true)
    expect(out.players[0].cash).toBe(5000 - COST1)
  })

  it('SC-001: aluguel do 2º hotel é MAIOR que o do 1º hotel (§14.4)', () => {
    const hotel = rentCity(100, 3, 3, { houses: 0, hotel: true, hotel2: false })
    const hotel2 = rentCity(100, 3, 3, { houses: 0, hotel: true, hotel2: true })
    expect(hotel2).toBeGreaterThan(hotel)
    expect(hotel).toBe(100 * 100) // HOTEL_RENT_MULT
    expect(hotel2).toBe(100 * 175) // HOTEL2_RENT_MULT
  })

  it('SC-004: vende 2º hotel → metade, volta ao 1º hotel', () => {
    const g = brown(6)
    const out = sellBuilding(g, 1)
    expect(out.titles[1].hotel2).toBe(false)
    expect(out.titles[1].hotel).toBe(true)
    expect(out.players[0].cash).toBe(5000 + Math.round(COST1 / 2))
  })

  it('uniformidade: não constrói 2º hotel se outra do grupo está só no hotel', () => {
    let g = brown(5)
    g = buildHouse(g, 1) // pos1 → 2º hotel
    expect(buildHouse(g, 1)).toBe(g) // pos3/5 ainda no hotel → no-op
  })
})

describe('Hangar (US2)', () => {
  it('SC-002: build $100 e aluguel do aeroporto dobra', () => {
    const g = brown(0, []) // ninguém possui brown; usamos só o aeroporto
    g.titles[AIRPORT].ownerId = 'p1'
    const built = buildHangar(g, AIRPORT)
    expect(built.titles[AIRPORT].hangar).toBe(true)
    expect(built.players[0].cash).toBe(5000 - 100)

    // p2 cai no aeroporto → paga o dobro da base (1 aeroporto: 25 → 50)
    built.players[1].cash = 1000
    const after = economyResolve({ playerId: 'p2', square: BOARD[AIRPORT], roll: null, ports: mockPorts(), state: built })!
    expect(after.done).toBe(true)
    expect(built.players[1].cash).toBe(1000 - 50)
    expect(built.players[0].cash).toBe(5000 - 100 + 50)
  })

  it('SC-002/SC-004: máx. 1 Hangar; venda devolve $50 e zera o efeito', () => {
    let g = brown(0, [])
    g.titles[AIRPORT].ownerId = 'p1'
    g = buildHangar(g, AIRPORT)
    expect(buildHangar(g, AIRPORT)).toBe(g) // já tem Hangar → no-op
    const sold = sellHangar(g, AIRPORT)
    expect(sold.titles[AIRPORT].hangar).toBe(false)
    expect(sold.players[0].cash).toBe(5000 - 100 + 50)
  })

  it('hipotecado ou sem caixa → build no-op', () => {
    const g1 = brown(0, [])
    g1.titles[AIRPORT].ownerId = 'p1'
    g1.titles[AIRPORT].mortgaged = true
    expect(buildHangar(g1, AIRPORT)).toBe(g1)
    const g2 = brown(0, [])
    g2.titles[AIRPORT].ownerId = 'p1'
    g2.players[0].cash = 50
    expect(buildHangar(g2, AIRPORT)).toBe(g2)
  })
})

describe('Skyscraper (US3)', () => {
  it('SC-003: 2 hotéis viram arranha-céu em grupo completo', () => {
    const g = brown(6) // grupo completo (1/3/5) todo no 2º hotel
    const out = buildHouse(g, 1)
    expect(out.titles[1].skyscraper).toBe(true)
  })

  it('SC-003: só maioria (grupo incompleto) → no-op', () => {
    const g = brown(6, [1, 3]) // possui 2 de 3, no nível 6
    expect(buildHouse(g, 1)).toBe(g) // exige grupo completo
  })

  it('SC-003: cidade com Skyscraper cobra o fixo; demais do grupo ×3', () => {
    const comSky = rentCity(100, 3, 3, { houses: 0, hotel: true, hotel2: true, skyscraper: true }, true)
    expect(comSky).toBe(100 * 250) // aluguel fixo, sem ×3 sobre si

    const semSkyNoGrupo = rentCity(100, 3, 3, { houses: 0, hotel: true, hotel2: true }, true)
    const base = rentCity(100, 3, 3, { houses: 0, hotel: true, hotel2: true }, false)
    expect(semSkyNoGrupo).toBe(base * 3) // demais do grupo triplicam
  })

  it('SC-004: vende Skyscraper → volta ao 2º hotel', () => {
    const g = brown(7) // todas no Skyscraper
    const out = sellBuilding(g, 1)
    expect(out.titles[1].skyscraper).toBe(false)
    expect(out.titles[1].hotel2).toBe(true)
  })
})
