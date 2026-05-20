// Seletor puro do painel "Trades" (027): proposta pendente (024) + histórico de
// trocas aceitas (mais recentes primeiro). Somente-leitura; padrão de playersView.
import type { GameState } from '@/game/turn/types'
import type { Trade } from '@/game/economy/types'

export interface TradesView {
  pending: Trade | null // proposta ativa aguardando resposta (024)
  history: Trade[] // trocas aceitas, mais recentes primeiro
}

export function tradesView(game: GameState): TradesView {
  return {
    pending: game.pendingTrade,
    history: [...game.tradeHistory].reverse(),
  }
}
