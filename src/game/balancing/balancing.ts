// Balanceamento (catch-up) — puro. GO Progressivo por ranking de patrimônio e
// pote do Free Parking. Injetado nas portas do 002 pelo store (002 não importa daqui).
import type { GameState } from '../turn/types'
import { THEME } from '../theme'

export const PARKING_SEED = THEME.PARKING_SEED

// Bônus do GO: FLAT $200 ao passar (o `advance` dobra para $400 quando o jogador
// CAI exatamente no GO). Substitui o GO Progressivo por ranking (revisão de regra).
// Mantém a assinatura (state, playerId) para as portas/UI já existentes.
export function goBonus(_state: GameState, _playerId: string): number {
  return THEME.GO_PASS
}

// Free Parking: rotear ao pote / coletar (reabastece $500).
export function payToCenter(state: GameState, amount: number): void {
  state.centerPot += amount
}

export function collectCenter(state: GameState, playerId: string): void {
  const p = state.players.find((x) => x.id === playerId)
  const amount = state.centerPot // valor coletado (antes do reabastecimento)
  if (p) {
    p.cash += amount
    state.notice = { kind: 'free-parking', playerId, amount } // 030, §12.2
  }
  state.centerPot = PARKING_SEED
}
