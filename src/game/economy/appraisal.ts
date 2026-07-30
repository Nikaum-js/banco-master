// Trava de esvaziamento (SRS §8.5 / D-058, que substitui a D-055) — puro.
//
// Negociação desequilibrada é LIVRE em qualquer proporção: 3-por-1, um país por $200,
// pagar caro, vender barato — valor é subjetivo entre jogadores e o jogo não legisla
// sobre ele. O que esta regra barra é o ABANDONO COM DANO DIRIGIDO: quem está de saída
// entrega o patrimônio inteiro a um jogador escolhido a dedo, e a partida dos outros
// passa a ser decidida por uma rixa em vez de pelo tabuleiro.
//
// Abandono tem assinatura objetiva — o jogador sai da troca sem patrimônio. Daí as duas
// únicas recusas: doação pura (entregar e não receber absolutamente nada) e esvaziamento
// (ficar com menos de um terço do patrimônio que tinha, contando o que recebe).
//
// Imunidade vale ZERO dos dois lados, por construção do motor: imunidades concedidas ou
// recebidas por um jogador evaporam quando ele sai da partida (§9.4, e a desistência da
// D-057 compartilha essa limpeza). Conceder imunidade não transfere patrimônio — e, para
// quem está entregando o último ativo, receber imunidade não é contrapartida real.
//
// Os valores abaixo são MEDIDA DE VERIFICAÇÃO, nunca cobrança: ninguém paga nem recebe
// nada por causa deles.
import { BOARD } from '@/lib/boardData'
import type { GameState } from '../turn/types'
import type { Trade } from './types'

export const BUS_TICKET_APPRAISAL = 100
/** A troca não pode deixar um lado com menos desta fração do patrimônio que tinha (§8.5). */
export const MIN_KEEP_RATIO = 1 / 3

// Preço de tabela; hipotecada vale metade — senão hipotecar em massa viraria a burla óbvia
// (quatro propriedades hipotecadas "valeriam" o dobro do que representam).
function appraiseProperty(state: GameState, pos: number): number {
  const sq = BOARD[pos]
  const price = sq && 'price' in sq ? sq.price : 0
  return state.titles[pos]?.mortgaged ? Math.round(price / 2) : price
}

/** Patrimônio de um jogador: propriedades avaliadas + Bus Tickets + caixa. Imunidades não. */
function worthOf(state: GameState, playerId: string): number {
  const player = state.players.find((p) => p.id === playerId)
  if (!player) return 0
  let worth = player.cash + player.busTickets * BUS_TICKET_APPRAISAL
  for (const sq of BOARD) {
    if ('price' in sq && state.titles[sq.pos]?.ownerId === playerId) worth += appraiseProperty(state, sq.pos)
  }
  return worth
}

/** Valor duro que um lado põe na mesa: propriedades + tickets + dinheiro. Imunidades pesam zero. */
function hardValue(state: GameState, trade: Trade, which: 'from' | 'to'): number {
  const props = which === 'from' ? trade.fromProps : trade.toProps
  const tickets = (which === 'from' ? trade.fromBusTickets : trade.toBusTickets) ?? 0
  const cash = which === 'from' ? trade.fromCash : trade.toCash
  return props.reduce((sum, pos) => sum + appraiseProperty(state, pos), 0) + tickets * BUS_TICKET_APPRAISAL + cash
}

// Imunidade não pesa, mas EXISTE: recebê-la já tira a proposta do caso "doação pura".
function offersAnything(trade: Trade, which: 'from' | 'to'): boolean {
  const grants = which === 'from' ? trade.fromImmunities : trade.toImmunities
  const transfers = which === 'from' ? trade.fromImmunityTransfers : trade.toImmunityTransfers
  return (grants?.length ?? 0) > 0 || (transfers?.length ?? 0) > 0
}

export interface SideBalance {
  /** Patrimônio deste lado antes da troca. */
  before: number
  /** Patrimônio depois dela, já contando o que recebe em valor duro. */
  after: number
  /** Mínimo com que este lado precisa ficar (⌈before × MIN_KEEP_RATIO⌉). */
  floor: number
  /** Quanto falta receber para a troca não esvaziá-lo; `0` quando não esvazia. */
  missing: number
  /** Entrega valor duro e não recebe absolutamente nada — nem imunidade. */
  donation: boolean
}

/**
 * As duas contas da proposta, lado a lado. A interface usa `missing`/`donation` para
 * explicar a recusa — proposta bloqueada sem motivo na tela é lida como bug.
 */
export function tradeBalance(state: GameState, trade: Trade): { from: SideBalance; to: SideBalance } {
  const fromGiven = hardValue(state, trade, 'from')
  const toGiven = hardValue(state, trade, 'to')
  const side = (playerId: string, given: number, received: number, receivesImmunity: boolean): SideBalance => {
    const before = worthOf(state, playerId)
    const after = before - given + received
    const floor = Math.ceil(before * MIN_KEEP_RATIO)
    return {
      before,
      after,
      floor,
      missing: Math.max(0, floor - after),
      donation: given > 0 && received === 0 && !receivesImmunity,
    }
  }
  return {
    from: side(trade.fromId, fromGiven, toGiven, offersAnything(trade, 'to')),
    to: side(trade.toId, toGiven, fromGiven, offersAnything(trade, 'from')),
  }
}

/** Predicado do §8.5, consumido por `validateTrade` — criação e aceitação passam pelo mesmo. */
export function meetsCounterpart(state: GameState, trade: Trade): boolean {
  const { from, to } = tradeBalance(state, trade)
  return from.missing === 0 && to.missing === 0 && !from.donation && !to.donation
}
