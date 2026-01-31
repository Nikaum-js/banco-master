// Falência & Fim de jogo — puro. A dívida é uma resolução pendente (bloqueia o turno);
// o jogador liquida (comandos de 004/005) e paga, ou declara falência. §9.
import { BOARD } from '@/lib/boardData'
import type { Square, PropertySquare } from '@/lib/boardData'
import type { GameState } from '../turn/types'
import type { ResolutionSlice } from '../economy/types'
import { buildCost, cityLevel, HANGAR_COST } from '../economy/construction'
import { activePlayer, completeResolution, advanceSeat, type TurnCtx } from '../turn/turnMachine'
import { activeLoanFor } from '../emprestimos/emprestimos'
import { openEstateAuction } from '../economy/landAuction'
import { logEvent } from '../log'

function clone(state: GameState): GameState {
  return structuredClone(state)
}

function priceOf(sq: Square): number {
  return 'price' in sq ? sq.price : 0
}

// Máximo que o jogador consegue levantar: caixa + construções a metade + hipoteca das livres.
export function liquidationValue(state: GameState, playerId: string): number {
  let v = state.players.find((p) => p.id === playerId)?.cash ?? 0
  for (const sq of BOARD) {
    const t = state.titles[sq.pos]
    if (!t || t.ownerId !== playerId) continue
    if (sq.kind === 'property') {
      const units = cityLevel(t) // 0–7: casas/hotel/2º hotel/Skyscraper, cada nível = buildCost
      v += Math.round((units * buildCost(sq as PropertySquare)) / 2) // venda de construção (metade)
    }
    if (sq.kind === 'airport' && t.hangar) v += Math.round(HANGAR_COST / 2) // venda do Hangar
    if (!t.mortgaged) v += Math.round(priceOf(sq) / 2) // hipoteca das não-hipotecadas
  }
  return v
}

export function isBankrupt(state: GameState, playerId: string, debt: number): boolean {
  return liquidationValue(state, playerId) < debt
}

// Fim de jogo: resta 1 não-eliminado → phase 'ended'. Muta o estado.
// `now` é o relógio INJETADO (044/D3) — o mesmo `ctx.now` que `bankrupt` já tem em mãos;
// nunca `Date.now()` aqui dentro. Sem relógio (testes), grava o sentinela `0`, igual a
// `startedAt`: `matchSummary` já trata `startedAt === 0` como "duração indisponível".
export function checkEndGame(state: GameState, now?: () => number): void {
  if (state.players.filter((p) => !p.eliminated).length <= 1) {
    state.phase = 'ended'
    state.endedAt = now?.() ?? 0
  }
}

// Dívida que nasceu DENTRO do movimento (empréstimo), não da casa onde o jogador parou. Os
// dois fatos são narrados separados no log, mas para o pagamento são o mesmo caso: quitar
// libera o slot sem concluir a casa pendente.
type DebtOrigin = Extract<ResolutionSlice, { kind: 'debt' }>['origin']
function bornInMovement(origin: DebtOrigin): boolean {
  return origin === 'loan-interest' || origin === 'loan-due'
}

/**
 * Quem deve a dívida pendente (D-061).
 *
 * `debtorId` ausente = snapshot gravado ANTES da D-061, quando a dívida era implicitamente do
 * jogador ativo — e essa é exatamente a leitura de compatibilidade: o valor que o campo teria
 * tido. Uma FONTE ÚNICA para a pergunta, porque `payDebt`, `declareBankruptcy`, a proteção de
 * credor da troca (§8.5), a trava do §6.4 e o `waitingFor` precisam todos concordar sobre quem
 * é o devedor; cinco `activePlayer(state).id` espalhados foi o que permitiu a dívida fora da
 * vez ser inexpressável por três specs.
 */
export function debtorOf(state: GameState): string | null {
  if (state.resolution?.kind !== 'debt') return null
  return state.resolution.debtorId ?? activePlayer(state).id
}

function playerOf(state: GameState, id: string) {
  return state.players.find((p) => p.id === id)
}

// Paga a dívida pendente se o caixa cobrir. No-op senão (jogador precisa liquidar ou falir).
export function payDebt(state: GameState): GameState {
  if (state.resolution?.kind !== 'debt') return state
  const { amount, creditorId, origin } = state.resolution
  const debtorId = debtorOf(state)!
  if ((playerOf(state, debtorId)?.cash ?? 0) < amount) return state
  const s = clone(state)
  const debtor = playerOf(s, debtorId)
  if (!debtor) return state
  debtor.cash -= amount
  if (creditorId) {
    const c = s.players.find((x) => x.id === creditorId)
    if (c) c.cash += amount
  } else {
    s.centerPot += amount // dívida ao banco (imposto) → pote do Free Parking
  }
  logEvent(s, { kind: 'debt-paid', who: debtorId, amount, creditorId }) // 021/040/D-063
  // Dívida de quem NÃO está na vez (D-061): quitar só limpa o slot. `completeResolution` mexe
  // no `turn` — mandaria o turno de OUTRO jogador para 'aguardando-finalizacao' no meio da
  // jogada dele. A dívida fora da vez nunca foi a resolução de uma casa; é evento paralelo,
  // igual à reação a carta ofensiva, que também limpa o slot sem tocar no turno.
  if (debtorId !== activePlayer(s).id) {
    s.resolution = null
    return s
  }
  if (bornInMovement(origin) && s.turn.state === 'casa-a-resolver') {
    // Dívida nascida no MOVIMENTO (juros do GO §15.4, ou vencimento do empréstimo §15.6), não
    // da casa: quitar só limpa o slot — a casa onde o jogador pousou segue pendente e resolve
    // na sequência (GameDriver/resolvePending).
    s.resolution = null
  } else {
    completeResolution(s)
  }
  return s
}

// Destina os títulos de quem sai da mesa. `heirId` null = ninguém herda — e o que "ninguém
// herda" significa muda com o MOTIVO da saída, que é o que `freeToBank` decide:
//   • falência (§9.2 / D-031): o título fica sem dono mas GUARDA hipoteca e Hangar, porque
//     vai a pregão e quem arrematar precisa receber exatamente o que estava lá;
//   • desistência (§9.6 / D-057): não há pregão, então o título volta a ser terreno LIVRE de
//     verdade — sem hipoteca e sem Hangar, como se nunca tivesse sido comprado.
// Retorna as posições que ficaram sem dono (vazio quando há herdeiro).
function handOverTitles(s: GameState, ownerId: string, heirId: string | null, freeToBank: boolean): number[] {
  const orphaned: number[] = []
  for (const sq of BOARD) {
    if (!('price' in sq)) continue
    const t = s.titles[sq.pos]
    if (!t || t.ownerId !== ownerId) continue
    if (sq.kind === 'property') {
      // construções são desfeitas na herança (§9.2/§15.5); sem estoque do banco
      t.skyscraper = false
      t.hotel2 = false
      t.hotel = false
      t.houses = 0
    }
    // Hangar de aeroporto NÃO é desfeito quando alguém recebe o título: segue o aeroporto ao
    // herdeiro (§13.6) ou ao vencedor do lote, e a hipoteca idem. Só a devolução ao banco
    // limpa os dois — lá o título deixa de ser de alguém, e não vai a pregão.
    if (!heirId && freeToBank) {
      t.mortgaged = false
      t.hangar = false
    }
    t.ownerId = heirId
    if (!heirId) orphaned.push(sq.pos)
  }
  return orphaned
}

// Tira o jogador da partida: caixa ao herdeiro (se houver), eliminação (§9.4), limpeza dos
// vínculos que só existiam por causa dele, fim de jogo (§9.5) e passagem da vez.
// COMPARTILHADO por falência (§9.2/§9.3) e desistência (§9.6): as duas diferem no gatilho e
// no destino dos bens, não no que sobra depois que o assento esvazia.
function leaveTable(s: GameState, playerId: string, heirId: string | null, ctx: TurnCtx): void {
  const leaver = s.players.find((p) => p.id === playerId)!
  if (heirId) {
    const heir = s.players.find((p) => p.id === heirId)
    if (heir) heir.cash += leaver.cash // caixa restante ao herdeiro
  }
  leaver.cash = 0 // sem herdeiro o caixa é destruído (§9.2/§9.6): não há quem receba
  leaver.eliminated = true // token sai do tabuleiro (LiveTokens pula eliminados)
  s.eliminationOrder.push({ playerId, round: s.round }) // 044/D2 — só fato registrado

  // Empréstimos liquidados: o do devedor (herdado via §9.3) e os em que ele era CREDOR (R8).
  s.loans = s.loans.filter((l) => l.debtorId !== playerId && l.creditorId !== playerId)
  // §9.4 (019): imunidades concedidas/recebidas pelo eliminado e efeitos temporários por ele originados.
  s.immunities = s.immunities.filter((i) => i.granterId !== playerId && i.beneficiaryId !== playerId)
  s.tempEffects = s.tempEffects.filter((e) => e.ownerId !== playerId)
  s.tradeProposals = s.tradeProposals.filter(
    ({ trade }) => trade.fromId !== playerId && trade.toId !== playerId,
  )
  // §9.4/D-061: obrigações do eliminado — como devedor e como credor — saem com ele. Uma dívida
  // de quem não está mais na mesa travaria o slot para sempre: ninguém pode pagá-la nem declarar
  // falência por ela. E uma dívida A ele não tem mais destinatário, pelo mesmo motivo que a
  // tabela do §9.2 só destina caixa quando o credor é um jogador.
  s.obligations = s.obligations.filter((o) => o.debtorId !== playerId && o.creditorId !== playerId)

  s.resolution = null
  // D-061: quem sai pode NÃO ser o jogador da vez (falência de dívida fora da vez). Nesse caso
  // o turno de quem está jogando segue intacto — zerar `pendingResolve` ou passar a vez ali
  // abortaria a jogada de um terceiro que não tem nada a ver com a falência.
  const wasActive = activePlayer(s).id === playerId
  if (wasActive) s.turn.pendingResolve = false
  checkEndGame(s, ctx.now)
  if (s.phase !== 'ended' && wasActive) advanceSeat(s, ctx)
}

// Falência: destina ativos, elimina, checa fim de jogo, passa a vez.
// §9.2 (sem empréstimo ativo) ou §9.3/§15.5 (com empréstimo: o CREDOR do empréstimo herda
// tudo — ativos e passivos —, precedendo a dívida-gatilho).
export function declareBankruptcy(state: GameState, ctx: TurnCtx): GameState {
  if (state.resolution?.kind !== 'debt') return state
  const debtorId = debtorOf(state)! // D-061 — pode não ser o jogador da vez
  // §9.1: só há falência quando o jogador NÃO consegue pagar mesmo liquidando tudo (caixa +
  // venda de construções + hipoteca). Solvente → no-op (precisa pagar/hipotecar/vender).
  if (!isBankrupt(state, debtorId, state.resolution.amount)) return state
  const debtCreditorId = state.resolution.creditorId
  const s = clone(state)
  const debtor = playerOf(s, debtorId)
  if (!debtor) return state

  // §9.3/§15.5: havendo empréstimo ativo, o credor do empréstimo herda (precede o §9.2).
  const loan = activeLoanFor(s, debtor.id)
  const heirId = loan ? loan.creditorId : debtCreditorId

  // Sem herdeiro, as propriedades formam o ESPÓLIO e vão a pregão (039, §9.2 / D-031) em vez
  // de voltarem de graça ao banco. Coletamos aqui e decidimos o destino depois de eliminar o
  // devedor — a guarda de "≥2 vivos" do pregão conta sobre o estado JÁ eliminado.
  const estate = handOverTitles(s, debtor.id, heirId, false)

  logEvent(s, { kind: 'bankruptcy', who: debtor.id }) // 021/040 — antes de `leaveTable`: a
  // passagem da vez pode logar (Fiscal), e o fato que encerra a participação vem primeiro.
  leaveTable(s, debtor.id, heirId, ctx)

  // Espólio a pregão (039, §9.2 / D-031) — POR ÚLTIMO, e de propósito:
  // • depois de `debtor.eliminated`, porque a guarda "≥2 vivos" do pregão conta sobre o
  //   estado já eliminado (mesa de 2 → sobra 1 → §9.5 vence, nenhum pregão abre);
  // • depois de `advanceSeat`, porque o pregão é evento AUTÔNOMO e não deve interferir na
  //   passagem da vez (FR-014).
  // O prazo vem de `ctx.now` (não de `Date.now()`): o `recorder` da 037 grava no host e
  // reproduz no cliente, e é isso que faz os prazos convergirem byte a byte.
  if (estate.length > 0) return openEstateAuction(s, estate, ctx.now?.() ?? 0, debtor.id)
  return s
}

// Desistência — §9.6 / D-057. Saída VOLUNTÁRIA, e por isso um reducer próprio em vez de um
// parâmetro de `declareBankruptcy`: as guardas dos dois são opostas. A falência EXIGE
// insolvência (§9.1); a desistência não pode exigir saldo nenhum, senão quem está bem de
// caixa ficaria preso na partida — que é justamente o caso que ela existe para resolver.
//
// Nunca abre pregão de espólio: sem empréstimo ativo, os bens voltam LIVRES ao banco. O
// porquê está na D-057 — pregão é o desfecho de uma disputa, e desistir não tem disputa nem
// vencedor; leiloar o patrimônio de quem só foi embora seria redistribuição de graça,
// disparável de combinação entre dois jogadores.
export function concede(state: GameState, ctx: TurnCtx): GameState {
  if (state.phase !== 'playing') return state
  const quitter = activePlayer(state)
  if (quitter.eliminated) return state
  // Decisões de OUTROS em voo bloqueiam a saída: sumir no meio delas as abortaria. O leilão
  // de propriedade e a reação a carta vivem no mesmo slot de resolução que `leaveTable`
  // limpa, e a proposta de empréstimo aguarda a resposta de um credor. Nenhuma dura mais que
  // segundos — dívida pendente NÃO entra na lista: ali desistir é exatamente a saída.
  const r = state.resolution
  if (r?.kind === 'auction' || r?.kind === 'reaction-diplomacia' || r?.kind === 'reaction-bunker') return state
  if (state.pendingLoan) return state

  const s = clone(state)
  const leaver = activePlayer(s)

  // §9.6: havendo empréstimo ativo, o credor herda tudo — igual ao §9.3. Desistir não é rota
  // de fuga de dívida: quem emprestou arriscou caixa próprio contando com essa garantia.
  const loan = activeLoanFor(s, leaver.id)
  const heirId = loan ? loan.creditorId : null

  handOverTitles(s, leaver.id, heirId, true) // sem herdeiro → terreno livre (§7.2), sem pregão
  logEvent(s, { kind: 'concede', who: leaver.id })
  leaveTable(s, leaver.id, heirId, ctx)
  return s
}
