// Cálculo de aluguel — puro. SOMENTE escalonamento por posse (sem construção).
//
// PONTO DE EXTENSÃO (spec Construção): `rentCity` cobre o aluguel sem construção.
// A spec de Construção envolverá esta função para somar os multiplicadores de
// casas/hotéis/2º hotel/Skyscraper (SRS §5.1, linhas "com construção").
import type { Roll } from '../turn/types'

// Maioria do grupo: 2 (grupo de 3) / 3 (grupo de 4). §13.3 + clarificação 2026-05-23.
function majority(size: number): number {
  return size === 4 ? 3 : 2
}

// Multiplicadores de aluguel por construção — valores de TEMA provisórios (004, research D3).
const HOUSE_RENT_MULT = [5, 15, 45, 80] as const // 1..4 casas
const HOTEL_RENT_MULT = 100

// Aluguel de cidade. Com construção (004), a tabela de construção × (0.7 parcial | 1.0 completo)
// SUBSTITUI o escalonamento por posse (§5.1). Sem `build` ou sem construção → regra da 003.
export function rentCity(
  base: number,
  ownedInGroup: number,
  size: number,
  build?: { houses: number; hotel: boolean },
): number {
  const complete = ownedInGroup >= size
  if (build && (build.hotel || build.houses > 0)) {
    const table = build.hotel ? base * HOTEL_RENT_MULT : base * HOUSE_RENT_MULT[build.houses - 1]
    return complete ? table : Math.round(table * 0.7) // grupo parcial (maioria) → 70%
  }
  if (complete) return base * 2 // grupo completo → 200% (§5.1)
  if (ownedInGroup >= majority(size)) return Math.round(base * 1.5) // maioria sem completar → 150%
  return base // não-maioria → base
}

const AIRPORT_RENT = [25, 50, 100, 200] as const
export function rentAirport(owned: number): number {
  return AIRPORT_RENT[Math.min(owned, 4) - 1] ?? 0
}

const UTILITY_MULT = [4, 10, 20] as const
export function rentUtility(owned: number, dice: number): number {
  return (UTILITY_MULT[Math.min(owned, 3) - 1] ?? 0) * dice
}

// "Valor dos dados" para utilidade (§4.4 / 002 FR-027): brancos + face numérica do Speed Die.
export function diceValue(roll: Roll | null): number {
  if (!roll) return 0
  return roll.white[0] + roll.white[1] + (typeof roll.speed === 'number' ? roll.speed : 0)
}
