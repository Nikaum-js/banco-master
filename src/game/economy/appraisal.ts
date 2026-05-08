// Avaliação de proposta e piso de contrapartida (050, SRS §8.5 / D-055) — puro.
//
// O que esta regra barra não é negociação ruim, é o ABANDONO COM DANO DIRIGIDO: quem está
// perdendo entrega o patrimônio inteiro a um jogador escolhido a dedo e sai, e a partida
// passa a ser decidida por uma rixa em vez de pelo tabuleiro.
//
// A assimetria é deliberada: o piso incide sobre os ATIVOS que um lado entrega (propriedade,
// Bus Ticket, imunidade), nunca sobre o dinheiro que ele paga. Pagar caro é uma decisão
// econômica ruim para quem paga, não uma transferência de controle — e se o dinheiro pesasse
// contra o pagador, comprar um país acima da tabela viraria proposta ilegal.
//
// Os valores abaixo são MEDIDA DE VERIFICAÇÃO, nunca cobrança: ninguém paga nem recebe nada
// por causa deles.
import { BOARD } from '@/lib/boardData'
import type { GameState } from '../turn/types'
import type { ImmunityGrant, Trade } from './types'

export const BUS_TICKET_APPRAISAL = 100
/** Imunidade vale, por volta, esta fração do preço da propriedade que ela protege. */
export const IMMUNITY_LAP_RATE = 0.1
/** Teto da imunidade (e valor da permanente): esta fração do preço da propriedade. */
export const IMMUNITY_MAX_RATE = 0.5
/** Cada lado precisa receber ao menos esta fração do valor dos ativos que entrega (§8.5). */
export const MIN_COUNTERPART_RATIO = 0.5

function priceOf(pos: number): number {
  const sq = BOARD[pos]
  return sq && 'price' in sq ? sq.price : 0
}

// Preço de tabela; hipotecada vale metade — senão hipotecar em massa viraria a burla óbvia
// (quatro propriedades hipotecadas "valeriam" o dobro do que representam).
function appraiseProperty(state: GameState, pos: number): number {
  const price = priceOf(pos)
  return state.titles[pos]?.mortgaged ? Math.round(price / 2) : price
}

/**
 * Imunidade vale uma fração do que ela protege, nunca um valor fixo.
 *
 * Um número fixo quebra nas duas pontas: alto demais, isentar uma casa marrom "vale" mais que
 * a própria casa e qualquer troca com imunidade passa a ser recusada; baixo demais, a imunidade
 * some da conta e deixa de ser contrapartida. Atrelar ao preço também fecha a lavagem — para
 * "receber" o equivalente a um império doado, o outro lado precisa comprometer um império.
 */
function appraiseImmunity(pos: number, laps: number | null): number {
  const price = priceOf(pos)
  const cap = price * IMMUNITY_MAX_RATE
  return Math.round(laps === null ? cap : Math.min(laps * price * IMMUNITY_LAP_RATE, cap))
}

function appraiseGrants(grants: ImmunityGrant[] | undefined): number {
  return (grants ?? []).reduce((sum, g) => sum + appraiseImmunity(g.pos, g.laps), 0)
}

// Imunidade JÁ ATIVA que troca de beneficiário (§8.4): vale pelas voltas que ainda restam.
function appraiseTransfers(state: GameState, beneficiaryId: string, positions: number[] | undefined): number {
  let sum = 0
  for (const pos of positions ?? []) {
    const im = state.immunities.find((i) => i.beneficiaryId === beneficiaryId && i.pos === pos)
    if (im) sum += appraiseImmunity(pos, im.lapsRemaining)
  }
  return sum
}

/** O que um lado entrega em ATIVOS — a base do piso. Dinheiro não entra aqui de propósito. */
function assetsFrom(state: GameState, trade: Trade, which: 'from' | 'to'): number {
  const props = which === 'from' ? trade.fromProps : trade.toProps
  const tickets = (which === 'from' ? trade.fromBusTickets : trade.toBusTickets) ?? 0
  const grants = which === 'from' ? trade.fromImmunities : trade.toImmunities
  const transfers = which === 'from' ? trade.fromImmunityTransfers : trade.toImmunityTransfers
  const holderId = which === 'from' ? trade.fromId : trade.toId
  return (
    props.reduce((sum, pos) => sum + appraiseProperty(state, pos), 0)
    + tickets * BUS_TICKET_APPRAISAL
    + appraiseGrants(grants)
    + appraiseTransfers(state, holderId, transfers)
  )
}

export interface SideBalance {
  /** Valor avaliado dos ativos que este lado entrega. */
  given: number
  /** Tudo o que este lado recebe — ativos do outro lado MAIS o dinheiro dele. */
  received: number
  /** Mínimo que este lado precisa receber para a proposta valer. */
  required: number
  /** Quanto falta para atingir o piso; `0` quando já atinge. */
  missing: number
}

// Entregar QUALQUER coisa — inclusive só dinheiro — e não receber absolutamente nada não é
// troca, é doação. O piso de 50% sozinho não pega esse caso porque dinheiro pago de propósito
// não pesa contra o pagador; sem esta linha, transferir o caixa inteiro ao líder continuaria
// possível. Receber $1 já sai daqui e cai no piso normal — é o mesmo desenho do resto.
function givesWithoutReceiving(assetsGiven: number, cashGiven: number, received: number): boolean {
  return (assetsGiven > 0 || cashGiven > 0) && received === 0
}

/**
 * As duas contas da proposta, lado a lado. A interface usa `missing` para explicar a recusa —
 * proposta bloqueada sem número é lida como bug.
 */
export function tradeBalance(state: GameState, trade: Trade): { from: SideBalance; to: SideBalance } {
  const fromAssets = assetsFrom(state, trade, 'from')
  const toAssets = assetsFrom(state, trade, 'to')
  const side = (given: number, received: number): SideBalance => {
    const required = Math.ceil(given * MIN_COUNTERPART_RATIO)
    return { given, received, required, missing: Math.max(0, required - received) }
  }
  return {
    from: side(fromAssets, toAssets + trade.toCash),
    to: side(toAssets, fromAssets + trade.fromCash),
  }
}

/** Predicado do §8.5, consumido por `validateTrade` — criação e aceitação passam pelo mesmo. */
export function meetsCounterpart(state: GameState, trade: Trade): boolean {
  const { from, to } = tradeBalance(state, trade)
  if (from.missing > 0 || to.missing > 0) return false
  if (givesWithoutReceiving(from.given, trade.fromCash, from.received)) return false
  if (givesWithoutReceiving(to.given, trade.toCash, to.received)) return false
  return true
}
