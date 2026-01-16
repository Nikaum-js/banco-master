// View-model da desistência (§9.6 / D-057). Puro e testável: responde "o que exatamente eu
// perco se apertar isso?", que é a única pergunta que a confirmação precisa responder.
//
// Mora aqui, e não dentro do diálogo, pelo mesmo motivo de `playersView`/`deedView`: o número
// que a tela mostra tem de vir da MESMA leitura de estado que o motor usa quando o comando
// chega — em especial o herdeiro, que muda o destino de tudo e não é óbvio pela tela.
import { BOARD } from '@/lib/boardData'
import type { GameState } from '@/game/turn/types'
import { activeLoanFor } from '@/game/emprestimos/emprestimos'

export interface ConcedeView {
  /** Títulos que saem das mãos do jogador (propriedades, aeroportos e utilidades). */
  properties: number
  /** Caixa que ele leva embora — para o herdeiro, ou destruído se não houver. */
  cash: number
  /**
   * Quem herda tudo: o credor do empréstimo ativo (§9.6, igual ao §9.3). `null` = ninguém,
   * e aí as propriedades voltam LIVRES ao banco, sem pregão (D-057).
   */
  heirId: string | null
}

export function concedeView(game: GameState, playerId: string): ConcedeView {
  let properties = 0
  for (const sq of BOARD) {
    if (!('price' in sq)) continue
    if (game.titles[sq.pos]?.ownerId === playerId) properties += 1
  }
  return {
    properties,
    cash: game.players.find((p) => p.id === playerId)?.cash ?? 0,
    heirId: activeLoanFor(game, playerId)?.creditorId ?? null,
  }
}
