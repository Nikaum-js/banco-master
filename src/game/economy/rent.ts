// Cálculo de aluguel — puro. SOMENTE escalonamento por posse (sem construção).
//
// PONTO DE EXTENSÃO (spec Construção): `rentCity` cobre o aluguel sem construção.
// A spec de Construção envolverá esta função para somar os multiplicadores de
// casas/hotéis/2º hotel/Skyscraper (SRS §5.1, linhas "com construção").
import type { Roll } from '../turn/types'
import type { GroupKey } from '@/lib/boardData'
import { THEME } from '../theme'

// Maioria do grupo: 2 (grupo de 3) / 3 (grupo de 4). §13.3 + clarificação 2026-05-23.
function majority(size: number): number {
  return size === 4 ? 3 : 2
}

// FONTE ÚNICA da tabela de construção (032/D-024): aplica os multiplicadores do GRUPO
// (theme.RENT_MULT) ao aluguel-base da cidade. Consumida por rentCity (motor) E pelas UIs de
// deed (computeRents/ModalLayer/pregão 031) — engine e UI nunca divergem.
export function rentLadder(
  group: GroupKey,
  base: number,
): { house: [number, number, number, number]; hotel: number; hotel2: number; skyscraper: number } {
  const m = THEME.RENT_MULT[group]
  return {
    house: [base * m.houses[0], base * m.houses[1], base * m.houses[2], base * m.houses[3]],
    hotel: base * m.hotel,
    hotel2: base * m.hotel2,
    skyscraper: base * m.skyscraper,
  }
}

// Fator de posse do país no aluguel CONSTRUÍDO (034): escala de 0,5 (1 cidade) a 1,0 (país
// completo). Trio: 1/3=50%, 2/3=75%, 3/3=100%. Duo: 1/2=50%, 2/2=100%. fórmula 0,5+0,5×(tem−1)/(total−1).
export function posseFactor(ownedInGroup: number, size: number): number {
  if (size <= 1) return 1
  const f = 0.5 + (0.5 * (ownedInGroup - 1)) / (size - 1)
  return Math.min(1, Math.max(0.5, f))
}

// Aluguel de cidade. Com construção (004/034), a tabela de construção × posseFactor (0,5→1,0
// conforme cidades do país possuídas) SUBSTITUI o escalonamento por posse sem construção (§5.1).
// Skyscraper = valor fixo do grupo (exige país completo); enquanto o grupo tiver algum Skyscraper,
// as demais cidades sem Skyscraper têm o aluguel ×3 (011, §13.7).
export function rentCity(
  group: GroupKey,
  base: number,
  ownedInGroup: number,
  size: number,
  build?: { houses: number; hotel: boolean; hotel2?: boolean; skyscraper?: boolean },
  groupHasSkyscraper?: boolean,
): number {
  const ladder = rentLadder(group, base)
  if (build?.skyscraper) return ladder.skyscraper // fixo (grupo completo por pré-requisito); sem ×3 sobre si
  const triple = (v: number): number => (groupHasSkyscraper ? v * 3 : v) // ×3 nas demais do grupo
  const complete = ownedInGroup >= size
  if (build && (build.hotel || build.houses > 0)) {
    const table = build.hotel2
      ? ladder.hotel2 // 2º hotel cobra mais que o 1º (§14.4)
      : build.hotel
        ? ladder.hotel
        : ladder.house[build.houses - 1]
    return triple(Math.round(table * posseFactor(ownedInGroup, size))) // escala por posse (034)
  }
  if (complete) return triple(base * 2) // grupo completo → 200% (§5.1)
  if (ownedInGroup >= majority(size)) return triple(Math.round(base * 1.5)) // maioria sem completar → 150%
  return triple(base) // não-maioria → base
}

const AIRPORT_RENT = THEME.AIRPORT_RENT
export function rentAirport(owned: number): number {
  return AIRPORT_RENT[Math.min(owned, 4) - 1] ?? 0
}

const UTILITY_MULT = THEME.UTILITY_MULT
export function rentUtility(owned: number, dice: number): number {
  return (UTILITY_MULT[Math.min(owned, 3) - 1] ?? 0) * dice
}

// "Valor dos dados" para utilidade (§4.4 / 002 FR-027): brancos + face numérica do Speed Die.
export function diceValue(roll: Roll | null): number {
  if (!roll) return 0
  return roll.white[0] + roll.white[1] + (typeof roll.speed === 'number' ? roll.speed : 0)
}
