// Balanceamento (catch-up) — puro. GO fixo e pote do Free Parking, ambos derivados do tema.
// Injetado nas portas do 002 pelo store (002 não importa daqui).
import type { GameState } from '../turn/types'
import { THEME } from '../theme'
import { logEvent } from '../log'

export const PARKING_SEED = THEME.PARKING_SEED

// Bônus do GO: valor fixo do tema (o `advance` dobra quando o jogador CAI exatamente no GO).
// Substitui o GO Progressivo por ranking (D-007; valores recalibrados pela D-076).
// Mantém a assinatura (state, playerId) para as portas/UI já existentes.
export function goBonus(_state: GameState, _playerId: string): number {
  return THEME.GO_PASS
}

// Free Parking: rotear ao pote / coletar (reabastece com a semente do tema).
export function payToCenter(state: GameState, amount: number): void {
  state.centerPot += amount
}

export function collectCenter(state: GameState, playerId: string): void {
  const p = state.players.find((x) => x.id === playerId)
  const amount = state.centerPot // valor coletado (antes do reabastecimento)
  if (p) {
    p.cash += amount
    state.notice = { kind: 'free-parking', playerId, amount } // 030, §12.2
    logEvent(state, { kind: 'free-parking', who: playerId, amount })
  }
  state.centerPot = PARKING_SEED
}
