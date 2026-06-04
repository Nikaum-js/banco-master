// Mão de cartas — privacidade (contador) e devolução ao fundo. Puro.
import type { GameState } from '../turn/types'
import type { CardSlot } from './types'
import { cardById } from './catalog'

// Visão PÚBLICA da mão: apenas a quantidade (privacidade — princípio VI).
export function handCount(state: GameState, playerId: string): number {
  return state.players.find((p) => p.id === playerId)?.hand.length ?? 0
}

// 043, D7/T030 — ÚNICO ponto que tolera slot oculto na remoção (data-model §4). Remove
// `cardId` da mão se ele estiver VISÍVEL ali; senão remove um slot oculto qualquer —
// mantendo o comprimento correto em TODAS as perspectivas. `cardId === null` (perspectiva
// alheia processando a ação de outro jogador, D10) cai direto no segundo caso.
export function removeFromHand(hand: CardSlot[], cardId: CardSlot): CardSlot[] {
  const idx = cardId !== null ? hand.indexOf(cardId) : -1
  const useIdx = idx >= 0 ? idx : hand.indexOf(null)
  if (useIdx < 0) return hand // nem o id nem um oculto — no-op defensivo (não deveria ocorrer)
  return [...hand.slice(0, useIdx), ...hand.slice(useIdx + 1)]
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
