/**
 * Obrigação entre jogadores (§9.1, D-061) — puro. MUTA o clone que o chamador detém.
 *
 * Por que existe uma FILA e não só o slot de dívida: uma carta pode deixar **vários** jogadores
 * curtos de uma vez. O Aniversário cobra $50 de cada adversário; numa mesa de 8, sete deles
 * podem não ter o valor. `state.resolution` é um slot ÚNICO — só cabe uma decisão interativa
 * por vez —, então as cobranças que sobram precisam de algum lugar para esperar a vez delas.
 * Sem a fila, a única implementação possível era a que existia: truncar o valor e apagar o
 * resto, que é justamente o furo que a D-061 fecha.
 *
 * A fila é promovida ao slot em `applyCommand`, no mesmo lugar onde o gatilho de escassez de
 * terrenos já vive — os dois são "consequência de estado que se reavalia depois do comando",
 * não comandos por si.
 */
import type { GameState } from '../turn/types'
import type { DebtCause, Obligation } from './types'
import { logEvent } from '../log'

/**
 * Cobra `amount` de `debtorId` para `creditorId` (`null` = banco/pote). Transfere o que o caixa
 * cobrir e **enfileira o restante** como obrigação pendente. Devolve o quanto foi efetivamente
 * transferido, para o chamador poder narrar o próprio fato.
 *
 * Esta função é só para obrigação a **outro jogador**. Cobrança ao banco/pote pequena e
 * incondicional (multa de prisão §4.11, Fiscal §13.8, Honorários, Crise, Conserto, Auditoria)
 * continua truncando por decisão explícita da D-061: ali ninguém é privado de receita a que a
 * regra lhe deu direito, e cobrança incondicional que pode falir transforma azar em eliminação.
 */
export function chargePlayer(
  state: GameState,
  debtorId: string,
  creditorId: string,
  amount: number,
  cause: DebtCause,
): number {
  if (amount <= 0) return 0
  const debtor = state.players.find((p) => p.id === debtorId)
  const creditor = state.players.find((p) => p.id === creditorId)
  if (!debtor || !creditor) return 0

  const paid = Math.min(amount, Math.max(0, debtor.cash))
  debtor.cash -= paid
  creditor.cash += paid

  const remaining = amount - paid
  if (remaining > 0) enqueueObligation(state, { debtorId, creditorId, amount: remaining, cause })
  return paid
}

/**
 * Enfileira uma obrigação e **narra a abertura** (D-063). O fato é registrado aqui, no momento
 * em que a dívida nasce — não na promoção ao slot: quem lê o histórico precisa ver a cobrança
 * virar dívida no instante em que isso acontece, e não quando a interface encontra espaço para
 * mostrá-la.
 *
 * Obrigação do MESMO par (devedor, credor, causa) se **acumula** em vez de virar duas linhas na
 * fila. Duas cartas de Aniversário na mesma volta não deveriam produzir duas cobranças
 * sequenciais de $7 e $12; o devedor deve $19 e resolve uma vez.
 */
export function enqueueObligation(state: GameState, obligation: Obligation): void {
  if (obligation.amount <= 0) return
  const existing = state.obligations.find(
    (o) => o.debtorId === obligation.debtorId && o.creditorId === obligation.creditorId && o.cause === obligation.cause,
  )
  if (existing) existing.amount += obligation.amount
  else state.obligations.push({ ...obligation })
  logEvent(state, {
    kind: 'debt-open',
    who: obligation.debtorId,
    amount: obligation.amount,
    creditorId: obligation.creditorId,
    cause: obligation.cause,
  })
}

/**
 * Promove a próxima obrigação da fila ao slot de dívida, se o slot estiver livre. MUTA.
 *
 * Não emite `debt-open` — a abertura já foi narrada no enfileiramento. Aqui é só a passagem do
 * bastão da fila para a superfície de decisão.
 *
 * Jogador eliminado sai da fila em vez de ser promovido: a eliminação (§9.4) desfaz os vínculos
 * que só existiam por causa dele, e uma dívida de quem não está mais na mesa travaria o slot
 * para sempre — ninguém poderia pagá-la nem declarar falência por ela.
 */
export function promoteObligation(state: GameState): void {
  if (state.phase !== 'playing') return
  state.obligations = state.obligations.filter((o) => {
    const debtor = state.players.find((p) => p.id === o.debtorId)
    return debtor !== undefined && !debtor.eliminated
  })
  if (state.resolution !== null) return
  const next = state.obligations.shift()
  if (!next) return
  state.resolution = {
    kind: 'debt',
    amount: next.amount,
    creditorId: next.creditorId,
    debtorId: next.debtorId,
    cause: next.cause,
  }
}

/** Total que `playerId` ainda deve — slot ativo + fila. Base do caixa líquido do HUD (§12.3). */
export function obligationTotalFor(state: GameState, playerId: string): number {
  let total = state.obligations
    .filter((o) => o.debtorId === playerId)
    .reduce((sum, o) => sum + o.amount, 0)
  const r = state.resolution
  if (r?.kind === 'debt' && (r.debtorId ?? state.players[state.turnOrder[state.activeSeat]]?.id) === playerId) {
    total += r.amount
  }
  return total
}

/** Há dívida (slot ou fila) de `playerId`? — usado pela UI e pelas travas de credor. */
export function hasPendingObligation(state: GameState, playerId: string): boolean {
  return obligationTotalFor(state, playerId) > 0
}
