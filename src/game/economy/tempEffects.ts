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

// D-064 — Estatização: todo aluguel da mesa vai à Loteria em vez do dono, por 1 volta (D-080).
export function estatizacaoActive(state: GameState): boolean {
  return state.tempEffects.some((e) => e.kind === 'estatizacao')
}

// D-064 — Valorização: a propriedade cobra aluguel em dobro por 1 volta.
export function isValorizada(state: GameState, pos: number): boolean {
  return state.tempEffects.some((e) => e.kind === 'valorizacao' && e.pos === pos)
}

// D-064 — Embargo de Obras: o jogador não pode construir por 2 voltas.
export function isEmbargoed(state: GameState, playerId: string): boolean {
  return state.tempEffects.some((e) => e.kind === 'embargo' && e.targetId === playerId)
}

// D-064 — Imunidade Total: o jogador não paga aluguel/imposto nem é alvo de efeito negativo
// por 1 volta. Consultada por aluguel, impostos de casa, Fiscal, ofensivas e cartas que cobram.
export function isPlayerImmune(state: GameState, playerId: string): boolean {
  return state.tempEffects.some((e) => e.kind === 'imunidade-total' && e.ownerId === playerId)
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
