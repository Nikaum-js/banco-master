// Mão de cartas — privacidade (contador) e devolução ao fundo. Puro.
import type { GameState } from '../turn/types'
import { cardById } from './catalog'

// Visão PÚBLICA da mão: apenas a quantidade (privacidade — princípio VI).
export function handCount(state: GameState, playerId: string): number {
  return state.players.find((p) => p.id === playerId)?.hand.length ?? 0
}

// Remove a carta da mão e devolve ao fundo do deck dela. No-op se não estiver na mão.
export function returnCardToBottom(state: GameState, playerId: string, cardId: string): GameState {
  const player = state.players.find((p) => p.id === playerId)
  if (!player || !player.hand.includes(cardId)) return state
  const s = structuredClone(state)
  const p = s.players.find((x) => x.id === playerId)!
  p.hand = p.hand.filter((id) => id !== cardId)
  s.decks[cardById(cardId).deck].push(cardId)
  return s
}
