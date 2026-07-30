// Consultas puras de posse. Lê o board estático (001) + os títulos do estado.
import type { Square } from '@/lib/boardData'
import { BOARD } from '@/lib/boardData'
import type { GroupKey } from '@/lib/boardData'
import type { GameState } from '../turn/types'

export function ownerOf(state: GameState, pos: number): string | null {
  return state.titles[pos]?.ownerId ?? null
}

export function isMortgaged(state: GameState, pos: number): boolean {
  return state.titles[pos]?.mortgaged ?? false
}

export function groupSize(group: GroupKey): number {
  return BOARD.filter((s) => s.kind === 'property' && s.group === group).length
}

export function groupOwnedCount(state: GameState, group: GroupKey, ownerId: string): number {
  return BOARD.filter(
    (s) => s.kind === 'property' && s.group === group && state.titles[s.pos]?.ownerId === ownerId,
  ).length
}

/**
 * Os `kind` de casa que se COMPRAM, rendem aluguel, hipotecam e vão a leilão.
 *
 * Existia como a comparação literal `kind === 'property' || kind === 'airport' || kind ===
 * 'utility'` repetida em 18 lugares (motor, UI, falência, leilão). A mina (D-071) teria de
 * ser somada nos 18, e um esquecido é uma casa que não se compra ou não entra no espólio.
 * Predicado único: quem responde "isto é comprável?" é este.
 */
export function isRentableKind(kind: Square['kind']): kind is 'property' | 'airport' | 'utility' | 'mine' {
  return kind === 'property' || kind === 'airport' || kind === 'utility' || kind === 'mine'
}

export function countOwned(state: GameState, kind: 'airport' | 'utility' | 'mine', ownerId: string): number {
  return BOARD.filter((s) => s.kind === kind && state.titles[s.pos]?.ownerId === ownerId).length
}

// Alguma cidade do grupo tem Skyscraper? (gatilho do aluguel ×3 das demais — 011, §13.7)
export function groupHasSkyscraper(state: GameState, group: GroupKey): boolean {
  return BOARD.some((s) => s.kind === 'property' && s.group === group && state.titles[s.pos]?.skyscraper)
}
