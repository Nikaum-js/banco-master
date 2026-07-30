// Invariantes de estado (036/FR-004a–g) — checados ao fim de cada turno resolvido.
//
// Nota sobre (c): a spec fala em "estoque global de casas/hotéis" mas a construção é
// ILIMITADA desde D-022 (sem estoque do banco — ver src/game/economy/construction.ts).
// Aqui (c) é reinterpretado como a integridade ESTRUTURAL do ladder de construção por
// título (0–7, flags coerentes entre si), que é o que "estoque nunca negativo/absurdo"
// significa na regra atual.
//
// Nota sobre (b): conservação de transferências P2P é verificada só nos comandos onde
// dá para isolar o par de jogadores sem reimplementar a regra de negócio (pay-off-loan,
// concessão de empréstimo, execução de troca) — ver Assumption "conservação de dinheiro"
// do spec.md. Aluguel/cartas ficam cobertos pelos testes unitários das specs donas.
import { BOARD } from '@/lib/boardData'
import type { GameState } from '@/game/turn/types'
import { cityLevel } from '@/game/economy/construction'
import { activeLoanFor } from '@/game/emprestimos/emprestimos'
import type { SimAction } from './types'

export interface Violation {
  // 'a'..'h' — invariantes originais da 036 + conservação de caixa.
  // 'n' narração, 't' não-truncagem, 'o' razão de obrigações, 'v' convergência host×cliente:
  // os quatro que faltavam, e sem os quais os CARDs 01/02/04/05/09 eram invisíveis ao harness.
  code: 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h' | 'n' | 't' | 'o' | 'v'
  detail: string
}

function checkA(state: GameState): Violation[] {
  const out: Violation[] = []
  for (const p of state.players) {
    if (!Number.isFinite(p.cash)) { out.push({ code: 'a', detail: `cash não-finito para ${p.id}: ${p.cash}` }); continue }
    if (!Number.isInteger(p.cash)) { out.push({ code: 'a', detail: `cash fracionário para ${p.id}: ${p.cash}` }); continue }
    // D-061: o caixa NUNCA fica negativo no estado, nem com dívida aberta. A dívida vive no slot
    // de resolução e na fila de obrigações, não como saldo negativo — o negativo do §12.3 é uma
    // LEITURA (caixa − obrigação), calculada na apresentação. Antes desta decisão o invariante
    // tolerava negativo "se houver dívida pendente", e essa tolerância era o que permitia um
    // reducer novo deixar caixa negativo sem ninguém notar.
    if (p.cash < 0) out.push({ code: 'a', detail: `cash negativo para ${p.id}: ${p.cash}` })
  }
  return out
}

function checkB(prev: GameState, next: GameState, action?: SimAction): Violation[] {
  if (!action) return []
  const cashOf = (g: GameState, id: string) => g.players.find((p) => p.id === id)?.cash ?? 0
  const out: Violation[] = []
  if (action.kind === 'pay-off-loan') {
    // devedor = jogador ativo em `prev` (comando sempre opera sobre ele — ver driver.ts)
    const debtorId = prev.turnOrder[prev.activeSeat] !== undefined ? prev.players[prev.turnOrder[prev.activeSeat]].id : null
    if (debtorId) {
      const loan = activeLoanFor(prev, debtorId)
      if (loan) {
        const dDebtor = cashOf(next, debtorId) - cashOf(prev, debtorId)
        const dCreditor = cashOf(next, loan.creditorId) - cashOf(prev, loan.creditorId)
        if (dDebtor !== -loan.principal || dCreditor !== loan.principal) {
          out.push({ code: 'b', detail: `pay-off-loan não conservou: devedor ${dDebtor}, credor ${dCreditor}, principal ${loan.principal}` })
        }
      }
    }
  }
  if (action.kind === 'respond-loan' && action.accept && prev.pendingLoan) {
    const { debtorId, creditorId, principal } = prev.pendingLoan
    const dDebtor = cashOf(next, debtorId) - cashOf(prev, debtorId)
    const dCreditor = cashOf(next, creditorId) - cashOf(prev, creditorId)
    if (dDebtor !== principal || dCreditor !== -principal) {
      out.push({ code: 'b', detail: `concessão de empréstimo não conservou: devedor ${dDebtor}, credor ${dCreditor}, principal ${principal}` })
    }
  }
  if (action.kind === 'accept-trade') {
    const trade = prev.tradeProposals.find((proposal) => proposal.id === action.proposalId)?.trade
    if (trade) {
      const { fromId, toId } = trade
      const before = cashOf(prev, fromId) + cashOf(prev, toId)
      const after = cashOf(next, fromId) + cashOf(next, toId)
      if (after > before) out.push({ code: 'b', detail: `troca criou dinheiro do nada: ${before} → ${after}` })
    }
  }
  return out
}

function checkC(state: GameState): Violation[] {
  const out: Violation[] = []
  for (const sq of BOARD) {
    if (sq.kind !== 'property') continue
    const t = state.titles[sq.pos]
    if (!t) continue
    if (t.houses < 0 || t.houses > 4) out.push({ code: 'c', detail: `houses fora de [0,4] em ${sq.pos}: ${t.houses}` })
    if (t.hotel && t.houses !== 0) out.push({ code: 'c', detail: `hotel com houses≠0 em ${sq.pos}` })
    if (t.hotel2 && !t.hotel) out.push({ code: 'c', detail: `hotel2 sem hotel em ${sq.pos}` })
    if (t.skyscraper && !t.hotel2) out.push({ code: 'c', detail: `skyscraper sem hotel2 em ${sq.pos}` })
    const level = cityLevel(t)
    if (level < 0 || level > 7) out.push({ code: 'c', detail: `nível de construção fora de [0,7] em ${sq.pos}: ${level}` })
  }
  return out
}

function checkD(state: GameState): Violation[] {
  const out: Violation[] = []
  for (const p of state.players) {
    if (!Number.isInteger(p.pos) || p.pos < 0 || p.pos >= BOARD.length) out.push({ code: 'd', detail: `pos inválida para ${p.id}: ${p.pos}` })
  }
  return out
}

function checkE(state: GameState): Violation[] {
  return state.players.filter((p) => p.hand.length > 3).map((p) => ({ code: 'e' as const, detail: `mão com ${p.hand.length} cartas para ${p.id}` }))
}

function checkF(state: GameState): Violation[] {
  return state.players.filter((p) => p.busTickets < 0).map((p) => ({ code: 'f' as const, detail: `busTickets negativo para ${p.id}: ${p.busTickets}` }))
}

function checkG(state: GameState): Violation[] {
  const out: Violation[] = []
  const ids = new Set(state.players.map((p) => p.id))
  for (const sq of BOARD) {
    const t = state.titles[sq.pos]
    if (!t || t.ownerId === null) continue
    if (!ids.has(t.ownerId)) { out.push({ code: 'g', detail: `dono inexistente em ${sq.pos}: ${t.ownerId}` }); continue }
    const owner = state.players.find((p) => p.id === t.ownerId)!
    if (owner.eliminated) out.push({ code: 'g', detail: `propriedade ${sq.pos} pertence a jogador eliminado ${t.ownerId}` })
  }
  return out
}

// (h) Fila de obrigações bem-formada (§9.1/D-061): valor positivo, devedor vivo, sem duplicata
// do mesmo par — uma entrada de valor zero ou de jogador inexistente travaria o slot de decisão
// para sempre, e o sintoma seria a mesa parada esperando por nada.
function checkH(state: GameState): Violation[] {
  const out: Violation[] = []
  const vivos = new Set(state.players.filter((p) => !p.eliminated).map((p) => p.id))
  const vistos = new Set<string>()
  for (const o of state.obligations) {
    if (!Number.isInteger(o.amount) || o.amount <= 0) out.push({ code: 'h', detail: `obrigação com valor inválido: ${o.amount}` })
    if (!vivos.has(o.debtorId)) out.push({ code: 'h', detail: `obrigação de devedor inexistente/eliminado: ${o.debtorId}` })
    if (o.creditorId !== null && !vivos.has(o.creditorId)) out.push({ code: 'h', detail: `obrigação para credor eliminado: ${o.creditorId}` })
    const chave = `${o.debtorId}→${o.creditorId ?? 'bank'}:${o.cause}`
    if (vistos.has(chave)) out.push({ code: 'h', detail: `obrigação duplicada do mesmo par: ${chave}` })
    vistos.add(chave)
  }
  return out
}

export function checkInvariants(prev: GameState, next: GameState, action?: SimAction): Violation[] {
  return [
    ...checkA(next), ...checkB(prev, next, action), ...checkC(next), ...checkD(next),
    ...checkE(next), ...checkF(next), ...checkG(next), ...checkH(next),
  ]
}
