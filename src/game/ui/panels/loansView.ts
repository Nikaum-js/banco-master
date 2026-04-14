// VIEW-MODEL DOS EMPRÉSTIMOS ATIVOS (058/US3).
//
// ---------------------------------------------------------------------------------------
// O DEFEITO QUE ESTE MÓDULO EXISTE PARA FECHAR
//
// O `LoanPanel` lia a dívida assim:
//
//     const active = game.players[game.turnOrder[game.activeSeat]]
//     const loan = game.loans.find((l) => l.debtorId === active.id)
//     if (!loan) return null
//
// `game.loans` é uma LISTA. O painel pegava UM elemento dela, escolhido pelo assento da
// VEZ. Consequência medida na jogatina: um empréstimo entre dois adversários existe no
// estado o tempo todo e **some da tela** até chegar a vez do devedor — a mesa lê isso como
// "a dívida foi paga", ou como bug.
//
// O SRS não deixa margem: "Status de empréstimos ativos" é HUD público (§12.3), e "o prazo
// restante é informação pública: quantas voltas faltam aparece onde o empréstimo é exibido"
// (§15.6). A existência de uma dívida nunca dependeu de quem está jogando.
//
// Puro e testável em node, como `playersView` e `activeHudView` — a mesma seam.
import { identityOf, type PlayerIdentity } from '@/net/identity'
import type { Room } from '@/net/room'
import type { GameState } from '@/game/turn/types'
import { interestOf, lapsRemainingOf, LOAN_TERM_LAPS } from '@/game/emprestimos/emprestimos'

export interface LoanRow {
  debtorId: string
  creditorId: string
  debtor: PlayerIdentity
  creditor: PlayerIdentity
  /** Valor emprestado. Fixo — juros nunca o alteram (§15.4, juros simples). */
  principal: number
  ratePct: number
  /** Quanto sai do devedor a cada passagem pelo GO. */
  interest: number
  /** Voltas até o vencimento (§15.6). No prazo 1, o principal sai sozinho no próximo GO. */
  lapsLeft: number
  /** O que o devedor paga para encerrar agora: só o principal (§15.3). */
  payoff: number
  /** O que o vencimento cobra de uma vez, quando a última volta chegar. */
  dueTotal: number
  /** Este dispositivo é o devedor? Quem decide a AÇÃO continua sendo `mayActAction`. */
  iAmDebtor: boolean
  iAmCreditor: boolean
}

export interface LoansView {
  rows: LoanRow[]
  count: number
  /**
   * O de prazo mais próximo — é o que muda decisão de troca e de lance, e o único que cabe
   * num resumo compacto quando há vários. Desempate pelo maior principal: entre dois que
   * vencem na mesma volta, o que dói mais é o maior.
   */
  mostUrgent: LoanRow | null
  /** Há empréstimo em que ESTE dispositivo é o devedor? Atalho do resumo. */
  anyMine: boolean
}

/**
 * Projeta TODOS os empréstimos ativos.
 *
 * `localSeatId` é o assento deste dispositivo, ou `null` em cliente único — onde, por
 * convenção estabelecida no projeto, quem age é o jogador da vez. Ele decide apenas o
 * PAPEL exibido (devo / me devem / fulano deve a beltrano); a autorização da ação continua
 * vindo de `mayActAction`, a mesma tabela que o host usa para descartar comando ilegítimo.
 */
export function loansView(
  game: GameState,
  room: Room | null = null,
  localSeatId: string | null = null,
): LoansView {
  const rows: LoanRow[] = game.loans.map((loan) => ({
    debtorId: loan.debtorId,
    creditorId: loan.creditorId,
    debtor: identityOf(room, loan.debtorId),
    creditor: identityOf(room, loan.creditorId),
    principal: loan.principal,
    ratePct: loan.ratePct,
    interest: interestOf(loan.principal, loan.ratePct),
    lapsLeft: lapsRemainingOf(loan),
    payoff: loan.principal,
    dueTotal: loan.principal + interestOf(loan.principal, loan.ratePct),
    iAmDebtor: localSeatId === null || localSeatId === loan.debtorId,
    iAmCreditor: localSeatId === loan.creditorId,
  }))

  const mostUrgent = rows.reduce<LoanRow | null>((atual, r) => {
    if (!atual) return r
    if (r.lapsLeft !== atual.lapsLeft) return r.lapsLeft < atual.lapsLeft ? r : atual
    return r.principal > atual.principal ? r : atual
  }, null)

  return {
    rows,
    count: rows.length,
    mostUrgent,
    anyMine: rows.some((r) => localSeatId !== null && r.debtorId === localSeatId),
  }
}

export { LOAN_TERM_LAPS }
