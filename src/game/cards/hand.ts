// Mão de cartas — privacidade (contador) e remoção por perspectiva. Puro.
import type { GameState } from '../turn/types'
import type { CardSlot } from './types'

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
