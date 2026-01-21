// Efeitos temporários de carta (015, SRS §10.6) — puro. Consultas usadas por resolveRentable/taxMan,
// registro pelas cartas (cards/*), expiração no afterPassGo (GO do originador). Separado de immunities (014).
import type { GameState } from '../turn/types'
import type { TempEffect } from './types'

export function apagaoActive(state: GameState): boolean {
  return state.tempEffects.some((e) => e.kind === 'apagao') // Hangares inativos
}

export function greveActive(state: GameState): boolean {
  return state.tempEffects.some((e) => e.kind === 'greve') // utilidades sem aluguel
}

export function isBoycotted(state: GameState, pos: number): boolean {
  return state.tempEffects.some((e) => e.kind === 'boicote' && e.pos === pos) // ninguém paga
}

export function isTempImmune(state: GameState, pos: number): boolean {
  return state.tempEffects.some((e) => e.kind === 'imunidade-temp' && e.pos === pos) // não pode ser alvo
}

export function addTempEffect(state: GameState, e: TempEffect): void {
  state.tempEffects.push(e)
}

// Decrementa os efeitos do originador ao passar pelo GO; remove os que chegam a 0. MUTA o state.
export function tickTempEffects(state: GameState, ownerId: string): void {
  state.tempEffects = state.tempEffects.filter((e) => {
    if (e.ownerId !== ownerId) return true
    e.lapsRemaining -= 1
    return e.lapsRemaining > 0
  })
}
