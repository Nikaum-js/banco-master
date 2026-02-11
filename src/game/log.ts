// Event log do jogo (021, SRS §12.3) — puro. Os reducers chamam logEvent nos pontos
// onde a ação acontece; o painel Histórico lê GameState.log. Sem timestamp (motor
// determinístico → recência = ordem). Bounded para não crescer indefinidamente.
import type { GameState } from './turn/types'

const LOG_MAX = 50

export function logEvent(state: GameState, who: string, what: string): void {
  state.log.push({ who, what })
  if (state.log.length > LOG_MAX) state.log.shift()
}
