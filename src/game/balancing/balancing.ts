// Balanceamento (catch-up) — puro. GO Progressivo por ranking de patrimônio e
// pote do Free Parking. Injetado nas portas do 002 pelo store (002 não importa daqui).
import type { GameState } from '../turn/types'
import { netWorth } from '../cards/effects'

export const PARKING_SEED = 500

// Bônus do GO: escala inversa ao ranking de patrimônio líquido (006).
// Linear $100 (mais rico) → $400 (mais pobre); desempate estável por assento. §13.5 (tunável).
export function goBonus(state: GameState, playerId: string): number {
  const active = state.players.filter((p) => !p.eliminated)
  if (active.length <= 1) return 100
  const seatOf = (id: string): number => state.turnOrder.indexOf(state.players.findIndex((p) => p.id === id))
  const ranked = active
    .map((p) => ({ id: p.id, nw: netWorth(state, p.id), seat: seatOf(p.id) }))
    .sort((a, b) => b.nw - a.nw || a.seat - b.seat)
  const pos = ranked.findIndex((r) => r.id === playerId)
  if (pos < 0) return 100
  return Math.round(100 + (pos / (ranked.length - 1)) * 300)
}

// Free Parking: rotear ao pote / coletar (reabastece $500).
export function payToCenter(state: GameState, amount: number): void {
  state.centerPot += amount
}

export function collectCenter(state: GameState, playerId: string): void {
  const p = state.players.find((x) => x.id === playerId)
  if (p) p.cash += state.centerPot
  state.centerPot = PARKING_SEED
}
