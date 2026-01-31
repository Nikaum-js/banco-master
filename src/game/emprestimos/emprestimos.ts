// Empréstimos entre jogadores (010, SRS §15) — puro. Solicitado na janela de dívida
// pendente (008); juros simples cobrados ao passar pelo GO; quitação paga só o principal.
import type { GameState } from '../turn/types'
import type { Loan } from '../economy/types'
import { activePlayer } from '../turn/turnMachine'
import { logEvent } from '../log'

function clone(state: GameState): GameState {
  return structuredClone(state)
}

/**
 * Prazo do empréstimo, em voltas do devedor (§15.6, D-054). Fonte única do número: a UI e
 * os testes leem daqui em vez de escrever `3` por conta própria.
 */
export const LOAN_TERM_LAPS = 3

// Empréstimo ativo em que o jogador é DEVEDOR (máx. 1, §15.3).
export function activeLoanFor(state: GameState, debtorId: string): Loan | undefined {
  return state.loans.find((l) => l.debtorId === debtorId)
}

/**
 * Voltas já corridas. Empréstimo vindo de snapshot anterior à D-054 não tem o campo e conta
 * como recém-concedido: não há registro das passagens pelo GO que já aconteceram, e dar
 * voltas a mais é o erro barato — o contrário cobraria o principal sem aviso.
 */
export function lapsElapsedOf(loan: Loan): number {
  return loan.lapsElapsed ?? 0
}

/** Voltas até o vencimento (1..LOAN_TERM_LAPS). É o que a interface mostra ao devedor. */
export function lapsRemainingOf(loan: Loan): number {
  return Math.max(0, LOAN_TERM_LAPS - lapsElapsedOf(loan))
}

/**
 * Juros simples sobre o principal original (§15.4).
 *
 * Card 3 do review de arquitetura: a fórmula era privada e recebia um `Loan`, mas a UI
 * precisa dela ANTES do empréstimo existir (o credor escolhe a taxa olhando o valor).
 * O formato do parâmetro forçou duas cópias — `GameHUD.tsx:484` e `shared.tsx:1874` —
 * de uma expressão onde trocar `round` por `floor` custa "o jogo cobrou $1 a mais do
 * que a carta prometeu", sem nenhum teste pegando.
 */
export function interestOf(principal: number, ratePct: number): number {
  return Math.round((principal * ratePct) / 100)
}

const interestOfLoan = (loan: Loan): number => interestOf(loan.principal, loan.ratePct)

// Concede um empréstimo já aceito pelo credor (com taxa). Valida §15.2/§15.3. No-op se inválido.
export function grantLoan(
  state: GameState,
  debtorId: string,
  creditorId: string,
  principal: number,
  ratePct: number,
): GameState {
  if (state.paused) return state
  if (state.resolution?.kind !== 'debt') return state // janela = dívida pendente (§15.2)
  if (debtorId !== activePlayer(state).id) return state
  if (activeLoanFor(state, debtorId)) return state // máx. 1 ativo por devedor (§15.3)
  if (!Number.isInteger(ratePct) || ratePct < 10 || ratePct > 50) return state // taxa 10–50%
  if (creditorId === debtorId) return state
  const debtor = state.players.find((p) => p.id === debtorId)
  const creditor = state.players.find((p) => p.id === creditorId)
  if (!debtor || !creditor || creditor.eliminated) return state
  const shortfall = state.resolution.amount - debtor.cash
  if (principal <= 0 || principal < shortfall || principal > creditor.cash) return state // ≥ déficit, ≤ caixa do credor

  const s = clone(state)
  s.players.find((p) => p.id === creditorId)!.cash -= principal
  s.players.find((p) => p.id === debtorId)!.cash += principal
  s.loans.push({ debtorId, creditorId, principal, ratePct, lapsElapsed: 0 }) // prazo começa a correr (§15.6)
  return s
}

/**
 * A quem o jogador da vez pode pedir empréstimo AGORA (§15.2). Lista vazia = a janela
 * está fechada, ou ninguém cobre o déficit.
 *
 * Card 3 do review de arquitetura: `proposeLoan` tem oito guardas, e o `GameHUD`
 * refazia cinco delas à mão para montar a lista de credores — deixando `paused` de
 * fora. Este predicado é derivado do MESMO comando: se `proposeLoan` recusaria, o
 * credor não entra na lista.
 */
export function eligibleLenders(state: GameState): string[] {
  const debtorId = state.players[state.turnOrder[state.activeSeat]]?.id
  if (!debtorId) return []
  return state.players
    .filter((p) => proposeLoan(state, debtorId, p.id) !== state) // "o comando aceitaria?"
    .map((p) => p.id)
}

/** Déficit que o empréstimo cobriria — `0` fora da janela de dívida. */
export function loanShortfall(state: GameState): number {
  if (state.resolution?.kind !== 'debt') return 0
  const debtor = state.players[state.turnOrder[state.activeSeat]]
  if (!debtor) return 0
  return Math.max(0, state.resolution.amount - debtor.cash)
}

// Solicitação de empréstimo (§15.2): o devedor (em dívida) pede a um credor específico.
// NÃO move dinheiro — abre a proposta; o credor define a taxa e aceita/recusa em respondLoan.
// O valor é o déficit atual. No-op se inválido.
export function proposeLoan(state: GameState, debtorId: string, creditorId: string): GameState {
  if (state.paused) return state
  if (state.resolution?.kind !== 'debt') return state // janela = dívida pendente (§15.2)
  if (state.pendingLoan) return state // uma proposta por vez
  if (debtorId !== activePlayer(state).id) return state
  if (activeLoanFor(state, debtorId)) return state // máx. 1 ativo por devedor (§15.3)
  if (creditorId === debtorId) return state
  const debtor = state.players.find((p) => p.id === debtorId)
  const creditor = state.players.find((p) => p.id === creditorId)
  if (!debtor || !creditor || creditor.eliminated) return state
  const principal = state.resolution.amount - debtor.cash // déficit
  if (principal <= 0 || principal > creditor.cash) return state // credor precisa cobrir o déficit

  const s = clone(state)
  s.pendingLoan = { debtorId, creditorId, principal }
  return s
}

// Resposta do credor à solicitação (§15.3): aceita DEFININDO a taxa (10–50%) ou recusa.
// Aceite → concede (grantLoan, move dinheiro + registra) e fecha a proposta. Recusa → só
// fecha a proposta (devedor volta à janela de dívida). Taxa inválida no aceite → no-op
// (mantém a proposta aberta pro credor reescolher).
export function respondLoan(state: GameState, accept: boolean, ratePct: number): GameState {
  if (state.paused) return state
  const req = state.pendingLoan
  if (!req) return state
  if (!accept) {
    const s = clone(state)
    s.pendingLoan = null
    return s
  }
  const granted = grantLoan(state, req.debtorId, req.creditorId, req.principal, ratePct)
  if (granted === state) return state // taxa/condição inválida → proposta segue aberta
  granted.pendingLoan = null
  return granted
}

// Quita o empréstimo pagando SÓ o principal (juros já cobrados por volta, §15.3/R1).
export function payOffLoan(state: GameState, debtorId: string): GameState {
  if (state.paused) return state
  const loan = activeLoanFor(state, debtorId)
  if (!loan) return state
  const debtor = state.players.find((p) => p.id === debtorId)
  if (!debtor || debtor.cash < loan.principal) return state

  const s = clone(state)
  s.players.find((p) => p.id === debtorId)!.cash -= loan.principal
  const c = s.players.find((p) => p.id === loan.creditorId)
  if (c) c.cash += loan.principal
  s.loans = s.loans.filter((l) => l.debtorId !== debtorId)
  return s
}

/**
 * Cobrança da passagem pelo GO (porta afterPassGo, dentro de advance). MUTA o state (que já é
 * um clone do turno).
 *
 * 1ª e 2ª voltas cobram só os juros; a 3ª é o VENCIMENTO (§15.6, D-054) e cobra os juros
 * daquela volta MAIS o principal, encerrando o contrato — automaticamente, sem confirmação de
 * ninguém. Nos dois casos, caixa insuficiente esvazia o devedor, credita o parcial ao credor e
 * abre dívida ao credor (008): é por ali que hipoteca, venda e falência ficam disponíveis.
 *
 * A cobrança roda DEPOIS do bônus de GO (ordem fixada em `buildPorts`) — o mesmo caixa não
 * pode reprovar aqui e aprovar um passo depois.
 */
export function chargeLoanInterest(state: GameState, debtorId: string): void {
  const loan = activeLoanFor(state, debtorId)
  if (!loan) return
  const debtor = state.players.find((p) => p.id === debtorId)
  const creditor = state.players.find((p) => p.id === loan.creditorId)
  if (!debtor || !creditor) return

  const lap = lapsElapsedOf(loan) + 1
  const matures = lap >= LOAN_TERM_LAPS // 3ª passagem: juros + principal, contrato encerrado
  const interest = interestOfLoan(loan)
  const due = matures ? interest + loan.principal : interest

  if (debtor.cash >= due) {
    debtor.cash -= due
    creditor.cash += due
    logEvent(state, matures
      ? { kind: 'loan-due', who: debtorId, amount: due, creditorId: loan.creditorId, principal: loan.principal, interest }
      : { kind: 'loan-interest', who: debtorId, amount: interest, creditorId: loan.creditorId }) // feedback do débito (021/040)
  } else {
    const paid = debtor.cash
    const resto = due - paid
    creditor.cash += paid
    debtor.cash = 0
    // reuso 008; origin marca que a casa onde o jogador pousar AINDA precisa resolver —
    // sem isso, economyResolve sobrescrevia esta dívida (o residual sumia).
    state.resolution = {
      kind: 'debt',
      amount: resto,
      creditorId: loan.creditorId,
      debtorId, // D-061 — explícito; era implicitamente `activePlayer`, e é o devedor mesmo
      cause: matures ? 'loan-due' : 'loan-interest',
      origin: matures ? 'loan-due' : 'loan-interest',
    }
    // Sem `debt-open` aqui: `loan-due-short`/`loan-interest-short` logo abaixo JÁ narram este
    // mesmo fato com o valor do resíduo. Dois fatos para uma abertura contariam a mesma coisa
    // duas vezes no histórico.
    logEvent(state, matures
      ? { kind: 'loan-due-short', who: debtorId, amount: paid, creditorId: loan.creditorId, shortfall: resto }
      : { kind: 'loan-interest-short', who: debtorId, amount: paid, creditorId: loan.creditorId, shortfall: resto })
  }

  // O vencimento encerra o contrato mesmo quando o caixa não cobriu: o que ficou faltando é
  // dívida comum ao credor, não empréstimo em aberto — senão o principal seria cobrado de
  // novo na volta seguinte, e o devedor ficaria preso a um contrato já executado.
  if (matures) state.loans = state.loans.filter((l) => l.debtorId !== debtorId)
  else loan.lapsElapsed = lap
}
