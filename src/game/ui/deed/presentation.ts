// Fatos canônicos de uma escritura. Os layouts escolhem como desenhar, mas nome,
// subtítulo, cor, avatar, aluguéis e custos saem desta única projeção.
import { GROUP_COLOR } from '@/boards/groupColors'
import { buildCost } from '@/game/economy/construction'
import { mortgageValue } from '@/game/economy/mortgage'
import { rentLadder } from '@/game/economy/rent'
import { THEME } from '@/game/theme'
import { activeLabels, capLabel } from '@/game/ui/theme/boardTheme'
import type { AirportSquare, MineSquare, PropertySquare, Square, UtilitySquare } from '@/lib/boardData'
import { METAL_ACCENT, METAL_BONUS_TEXT, METAL_LABEL } from '@/boards/glyphs/metals'

export type DeedSquare = PropertySquare | AirportSquare | UtilitySquare | MineSquare

export interface MoneyRentRow {
  key: string
  label: string
  kind: 'money'
  value: number
}

export interface MultiplierRentRow {
  key: string
  label: string
  kind: 'multiplier'
  value: number
}

export type DeedRentRow = MoneyRentRow | MultiplierRentRow

interface DeedPresentationBase {
  name: string
  subtitle: string
  accent: string
  flagCode: string | null
  price: number
  mortgage: number
  rentRows: DeedRentRow[]
}

export interface PropertyDeedPresentation extends DeedPresentationBase {
  kind: 'property'
  /** Código de bandeira no mapa Cidades do Mundo; null nos mapas por ícone (055). */
  flagCode: string | null
  buildCost: number
  rents: {
    base: number
    house1: number
    house2: number
    house3: number
    house4: number
    hotel: number
    hotel2: number
    skyscraper: number
  }
}

export interface AirportDeedPresentation extends DeedPresentationBase {
  kind: 'airport'
  rents: readonly number[]
  hangar: { cost: number; multiplier: number }
}

export interface UtilityDeedPresentation extends DeedPresentationBase {
  kind: 'utility'
  multipliers: readonly number[]
}

export interface MineDeedPresentation extends DeedPresentationBase {
  kind: 'mine'
  /** O metal da lavra — define a cor e QUAL bônus passivo ela dá (D-071). */
  metal: MineSquare['metal']
  /** O bônus passivo, em uma frase. É o que o jogador precisa ler antes de comprar. */
  bonus: string
}

export type DeedPresentation =
  | PropertyDeedPresentation
  | AirportDeedPresentation
  | UtilityDeedPresentation
  | MineDeedPresentation

export function deedPresentation(square: PropertySquare): PropertyDeedPresentation
export function deedPresentation(square: AirportSquare): AirportDeedPresentation
export function deedPresentation(square: UtilitySquare): UtilityDeedPresentation
export function deedPresentation(square: MineSquare): MineDeedPresentation
export function deedPresentation(square: DeedSquare): DeedPresentation
export function deedPresentation(square: Square): DeedPresentation | null
export function deedPresentation(square: Square): DeedPresentation | null {
  const labels = activeLabels()
  if (square.kind === 'property') {
    const ladder = rentLadder(square.group, square.rent)
    const rents = {
      base: square.rent,
      house1: ladder.house[0],
      house2: ladder.house[1],
      house3: ladder.house[2],
      house4: ladder.house[3],
      hotel: ladder.hotel,
      hotel2: ladder.hotel2,
      skyscraper: ladder.skyscraper,
    }
    return {
      kind: 'property',
      name: square.name,
      subtitle: square.capital ?? '',
      accent: GROUP_COLOR[square.group],
      flagCode: square.uf ?? null,
      price: square.price,
      mortgage: mortgageValue(square),
      buildCost: buildCost(square),
      rents,
      // Rótulos pelo catálogo do mapa ativo (055): casa/oficina, hotel/fábrica…
      rentRows: [
        { key: 'base', label: 'Base', kind: 'money', value: rents.base },
        { key: 'house1', label: `1 ${labels.house}`, kind: 'money', value: rents.house1 },
        { key: 'house2', label: `2 ${labels.houses}`, kind: 'money', value: rents.house2 },
        { key: 'house3', label: `3 ${labels.houses}`, kind: 'money', value: rents.house3 },
        { key: 'house4', label: `4 ${labels.houses}`, kind: 'money', value: rents.house4 },
        { key: 'hotel', label: capLabel(labels.hotel), kind: 'money', value: rents.hotel },
        { key: 'hotel2', label: capLabel(labels.hotel2), kind: 'money', value: rents.hotel2 },
        { key: 'skyscraper', label: capLabel(labels.skyscraper), kind: 'money', value: rents.skyscraper },
      ],
    }
  }

  if (square.kind === 'airport') {
    return {
      kind: 'airport',
      name: square.name,
      subtitle: labels.airport,
      accent: 'var(--color-brass)',
      flagCode: null,
      price: square.price,
      mortgage: mortgageValue(square),
      rents: THEME.AIRPORT_RENT,
      hangar: { cost: THEME.HANGAR_COST, multiplier: 2 },
      rentRows: THEME.AIRPORT_RENT.map((value, index) => ({
        key: `airport${index + 1}`,
        label: `${index + 1} ${labels.airport.toLowerCase()}${index > 0 ? 's' : ''}`,
        kind: 'money' as const,
        value,
      })),
    }
  }

  if (square.kind === 'utility') {
    return {
      kind: 'utility',
      name: square.name,
      subtitle: 'Utilidade',
      accent: 'var(--color-brass)',
      flagCode: null,
      price: square.price,
      mortgage: mortgageValue(square),
      multipliers: THEME.UTILITY_MULT,
      rentRows: THEME.UTILITY_MULT.map((value, index) => ({
        key: `utility${index + 1}`,
        label: `${index + 1} utilidade${index > 0 ? 's' : ''}`,
        kind: 'multiplier' as const,
        value,
      })),
    }
  }

  if (square.kind === 'mine') {
    return {
      kind: 'mine',
      name: square.name,
      subtitle: `Mina · ${METAL_LABEL[square.metal]}`,
      accent: METAL_ACCENT[square.metal],
      flagCode: null,
      price: square.price,
      mortgage: mortgageValue(square),
      metal: square.metal,
      bonus: METAL_BONUS_TEXT[square.metal],
      rentRows: [],
    }
  }

  return null
}
