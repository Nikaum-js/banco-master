// Leilão de casas em escassez (§5.4) — EVENTO AUTÔNOMO (026): vive em
// `state.houseAuction`, independente da resolução de turno. Abrir/fechar NÃO
// tocam no turno (corrige o acoplamento antigo que perdia a vez). Puro.
import type { GameState } from '../turn/types'

function clone(state: GameState): GameState {
  return structuredClone(state)
}

function cashOf(state: GameState, id: string): number {
  return state.players.find((p) => p.id === id)?.cash ?? 0
}

// Abre o leilão pelas `housesAvailable` casas entre os `bidders`. No-op se já há um.
export function openHouseAuction(state: GameState, housesAvailable: number, bidders: string[]): GameState {
  if (state.houseAuction) return state
  const s = clone(state)
  s.houseAuction = { housesAvailable, currentBid: 0, highBidder: null, activeBidders: bidders, deadline: 0 }
  return s
}

// Lance: participante, > atual e ≤ caixa. No-op senão.
export function placeHouseBid(state: GameState, playerId: string, amount: number): GameState {
  const a = state.houseAuction
  if (!a) return state
  if (!a.activeBidders.includes(playerId)) return state
  if (amount <= a.currentBid) return state
  if (amount > cashOf(state, playerId)) return state
  const s = clone(state)
  s.houseAuction!.currentBid = amount
  s.houseAuction!.highBidder = playerId
  return s
}

// Encerra: havendo vencedor, paga o lance e leva as casas (saem do banco). Limpa
// o campo SEM mexer no turno. Sem vencedor → casas ficam no banco.
export function closeHouseAuction(state: GameState): GameState {
  const a = state.houseAuction
  if (!a) return state
  const s = clone(state)
  if (a.highBidder) {
    const winner = s.players.find((p) => p.id === a.highBidder)
    if (winner) winner.cash -= a.currentBid
    s.bank.houses = Math.max(0, s.bank.houses - a.housesAvailable) // casas vão ao vencedor
  }
  s.houseAuction = null
  return s
}
