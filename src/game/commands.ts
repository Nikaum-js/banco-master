// Dispatcher puro de comandos (spec 037 — fundação multiplayer host-autoritativo).
//
// `applyCommand(state, cmd, ctx)` é a FONTE ÚNICA de despacho: o mesmo código roda no
// host (autoridade) e em cada cliente (replay). Espelha exatamente os pontos de despacho
// de `src/game/store.ts` sobre os reducers PUROS já existentes — não cria regra nova nem
// altera nenhuma (princípio I; motor M1 intacto). Timers/efeitos (rearm de leilão) são
// responsabilidade da casca (store single-player / host multiplayer), não deste dispatcher:
// aqui só entra o gatilho de escassez de terrenos (`maybeOpenLandAuction`), que é mudança
// de ESTADO, nos mesmos pontos em que o store o chama.
import type { GameState } from './turn/types'
import type { TurnCtx } from './turn/turnMachine'
import {
  rollDice,
  resolvePending,
  finalizeTurn,
  jailDecision,
  chooseBusMove,
  chooseTripleDest,
  useBusTicket as applyBusTicket, // alias: evita falso-positivo do react-hooks (prefixo "use")
  activePlayer,
  dismissNotice,
} from './turn/turnMachine'
import { buyProperty, declineProperty } from './economy/purchase'
import { placeBid, passBid, closeAuction } from './economy/auction'
import { maybeOpenLandAuction, placeLandBid, closeLandAuction, closeExpiredLandLots } from './economy/landAuction'
import { buildHouse, sellBuilding, buildHangar, sellHangar } from './economy/construction'
import { mortgageProperty, unmortgageProperty } from './economy/mortgage'
import { payDebt, declareBankruptcy } from './falencia/falencia'
import { grantLoan, proposeLoan, respondLoan, payOffLoan } from './emprestimos/emprestimos'
import { executeTrade, proposeTrade, acceptTrade, rejectTrade, type Trade } from './economy/trade'
import { confirmCardReveal, playHandCard, resolveCardDiscard, resolveCardShortcut } from './cards/draw'
import { respondReaction } from './cards/reacao'

// Ações de jogador — mesma forma do `SimAction` (dev-only, 036), promovida a produção.
// A identidade do remetente NÃO vive na ação: viaja no envelope `Command` (host valida).
export type PlayerAction =
  // Turno (turnMachine.ts) — ator = jogador ativo.
  | { kind: 'roll' }
  | { kind: 'finalize' }
  | { kind: 'jail-decision'; decision: 'pay' | 'card' | 'try' }
  | { kind: 'choose-bus-move'; opt: 'die0' | 'die1' | 'sum' }
  | { kind: 'choose-triple-dest'; dest: number }
  | { kind: 'use-bus-ticket'; dest: number }
  | { kind: 'resolve-pending' }
  // Casa/compra — ator = jogador ativo.
  | { kind: 'buy-property' }
  | { kind: 'decline-property' }
  // Leilão de propriedade — ator = `playerId` explícito (licitante).
  | { kind: 'place-bid'; playerId: string; amount: number }
  | { kind: 'pass-bid'; playerId: string }
  // Pregão de terrenos (031) — ator = licitante.
  | { kind: 'place-land-bid'; playerId: string; pos: number; amount: number }
  // Construção/hipoteca — ator = jogador ativo.
  | { kind: 'build-house'; pos: number }
  | { kind: 'sell-building'; pos: number }
  | { kind: 'build-hangar'; pos: number }
  | { kind: 'sell-hangar'; pos: number }
  | { kind: 'mortgage'; pos: number }
  | { kind: 'unmortgage'; pos: number }
  // Cartas — ator = jogador ativo (mão) ou reator (resolução pendente).
  | { kind: 'play-hand-card'; cardId: string; target?: number; targetPlayer?: string }
  | { kind: 'discard-card'; cardId: string }
  | { kind: 'choose-card-shortcut'; dir: 'frente' | 'tras' }
  | { kind: 'confirm-card-reveal' }
  | { kind: 'respond-reaction'; use: boolean }
  // Dívida/falência — ator = devedor (jogador ativo da resolução `debt`).
  | { kind: 'pay-debt' }
  | { kind: 'declare-bankruptcy' }
  // Empréstimo (§15) — devedor = jogador ativo; resposta = credor.
  | { kind: 'grant-loan'; creditorId: string; principal: number; ratePct: number }
  | { kind: 'propose-loan'; creditorId: string }
  | { kind: 'respond-loan'; accept: boolean; ratePct: number }
  | { kind: 'pay-off-loan' }
  // Troca — propor = qualquer; aceitar/recusar = destinatário.
  | { kind: 'execute-trade'; trade: Trade }
  | { kind: 'propose-trade'; trade: Trade }
  | { kind: 'accept-trade' }
  | { kind: 'reject-trade' }
  // Notificação informativa (030).
  | { kind: 'dismiss-notice' }

// Ações de sistema — emitidas SÓ pelo host (não passam pela checagem de identidade de
// jogador): fechamento de leilão por prazo e pausa/retomada por (des)conexão.
export type SystemAction =
  | { kind: 'close-auction' } // deadline do leilão de propriedade venceu
  | { kind: 'close-land-lots'; now: number } // lotes do pregão (031) expiraram
  | { kind: 'close-land-auction' } // fecho manual do pregão (026/031)
  | { kind: 'pause' } // desconexão detectada → pausa global (FR-016)
  | { kind: 'resume'; pausedMs: number } // reconexão → retoma; desloca deadlines em voo (FR-017)

export type GameAction = PlayerAction | SystemAction

// Gatilhos de escassez de terrenos (031): mesmos pontos em que `store.ts` chama
// `maybeOpenLand()` após uma mudança de estado.
const LAND_TRIGGERING = new Set<GameAction['kind']>([
  'finalize',
  'buy-property',
  'close-auction',
  'close-land-auction',
  'close-land-lots',
])

// Aplica UM comando ao estado. Puro: reducers no-op retornam a MESMA referência, então o
// chamador detecta no-op por identidade (`next === state`) — base do "comando inválido =
// no-op" (FR-009).
export function applyCommand(state: GameState, action: GameAction, ctx: TurnCtx): GameState {
  let next = state
  switch (action.kind) {
    // — turno —
    case 'roll': next = rollDice(state, ctx); break
    case 'finalize': next = finalizeTurn(state, ctx); break
    case 'jail-decision': next = jailDecision(state, action.decision, ctx); break
    case 'choose-bus-move': next = chooseBusMove(state, action.opt, ctx); break
    case 'choose-triple-dest': next = chooseTripleDest(state, action.dest, ctx); break
    case 'use-bus-ticket': next = applyBusTicket(state, action.dest, ctx); break
    case 'resolve-pending': next = resolvePending(state, ctx); break
    // — compra —
    case 'buy-property': next = buyProperty(state); break
    case 'decline-property': next = declineProperty(state, ctx.now!()); break
    // — leilão de propriedade —
    case 'place-bid': next = placeBid(state, action.playerId, action.amount, ctx.now!()); break
    case 'pass-bid': next = passBid(state, action.playerId); break
    case 'close-auction': next = closeAuction(state); break
    // — pregão de terrenos (031) —
    case 'place-land-bid': next = placeLandBid(state, action.playerId, action.pos, action.amount, ctx.now!()); break
    case 'close-land-auction': next = closeLandAuction(state); break
    case 'close-land-lots': next = closeExpiredLandLots(state, action.now); break
    // — construção / hipoteca —
    case 'build-house': next = buildHouse(state, action.pos); break
    case 'sell-building': next = sellBuilding(state, action.pos); break
    case 'build-hangar': next = buildHangar(state, action.pos); break
    case 'sell-hangar': next = sellHangar(state, action.pos); break
    case 'mortgage': next = mortgageProperty(state, action.pos); break
    case 'unmortgage': next = unmortgageProperty(state, action.pos); break
    // — cartas —
    case 'play-hand-card': next = playHandCard(state, activePlayer(state).id, action.cardId, ctx.ports, action.target, action.targetPlayer); break
    case 'discard-card': next = resolveCardDiscard(state, action.cardId); break
    case 'choose-card-shortcut': next = resolveCardShortcut(state, action.dir, ctx); break
    case 'confirm-card-reveal': next = confirmCardReveal(state, ctx.ports); break
    case 'respond-reaction': next = respondReaction(state, action.use, ctx.ports); break
    // — dívida / falência —
    case 'pay-debt': next = payDebt(state); break
    case 'declare-bankruptcy': next = declareBankruptcy(state, ctx); break
    // — empréstimo (§15) —
    case 'grant-loan': next = grantLoan(state, activePlayer(state).id, action.creditorId, action.principal, action.ratePct); break
    case 'propose-loan': next = proposeLoan(state, activePlayer(state).id, action.creditorId); break
    case 'respond-loan': next = respondLoan(state, action.accept, action.ratePct); break
    case 'pay-off-loan': next = payOffLoan(state, activePlayer(state).id); break
    // — troca —
    case 'execute-trade': next = executeTrade(state, action.trade); break
    case 'propose-trade': next = proposeTrade(state, action.trade); break
    case 'accept-trade': next = acceptTrade(state); break
    case 'reject-trade': next = rejectTrade(state); break
    // — notificação —
    case 'dismiss-notice': next = dismissNotice(state); break
    // — sistema: pausa/retomada —
    case 'pause':
      next = state.paused ? state : { ...state, paused: true }
      break
    case 'resume':
      next = applyResume(state, action.pausedMs)
      break
  }
  // Gatilho de escassez de terrenos — só quando o comando mudou o estado (paridade com store).
  if (next !== state && LAND_TRIGGERING.has(action.kind)) {
    next = maybeOpenLandAuction(next, ctx.now!())
  }
  return next
}

// Retoma a partida e DESLOCA os deadlines em voo (leilão de propriedade + lotes do pregão)
// pelo tempo pausado, preservando a janela de decisão restante (FR-017). Puro.
function applyResume(state: GameState, pausedMs: number): GameState {
  if (!state.paused) return state
  const s: GameState = { ...state, paused: false }
  if (pausedMs > 0) {
    if (s.resolution?.kind === 'auction') {
      s.resolution = { ...s.resolution, auction: { ...s.resolution.auction, deadline: s.resolution.auction.deadline + pausedMs } }
    }
    if (s.landAuction) {
      s.landAuction = { ...s.landAuction, lots: s.landAuction.lots.map((l) => ({ ...l, deadline: l.deadline + pausedMs })) }
    }
  }
  return s
}

// Deriva o ATOR de um comando de jogador a partir do estado — quem o host exige que seja o
// remetente (FR-007, fecha `store.ts:262` / item 17 da auditoria). NÃO adiciona gate de
// turno além do que o motor já impõe: apenas garante que o remetente é o jogador em nome de
// quem o comando age (US4-3). Retorna null quando o ator não é determinável no estado atual
// (ex.: responder sem proposta pendente) — o host trata como comando descartável.
export function actorOf(state: GameState, action: PlayerAction): string | null {
  switch (action.kind) {
    // Ações do jogador ativo.
    case 'roll':
    case 'finalize':
    case 'jail-decision':
    case 'choose-bus-move':
    case 'choose-triple-dest':
    case 'use-bus-ticket':
    case 'resolve-pending':
    case 'buy-property':
    case 'decline-property':
    case 'build-house':
    case 'sell-building':
    case 'build-hangar':
    case 'sell-hangar':
    case 'mortgage':
    case 'unmortgage':
    case 'play-hand-card':
    case 'discard-card':
    case 'choose-card-shortcut':
    case 'confirm-card-reveal':
    case 'pay-debt':
    case 'declare-bankruptcy':
    case 'grant-loan':
    case 'propose-loan':
    case 'pay-off-loan':
    case 'dismiss-notice':
      return activePlayer(state).id
    // Licitante explícito.
    case 'place-bid':
    case 'pass-bid':
    case 'place-land-bid':
      return action.playerId
    // Respostas do contra-parte (derivadas do estado pendente).
    case 'respond-reaction': {
      const r = state.resolution
      if (r?.kind === 'reaction-diplomacia' || r?.kind === 'reaction-bunker') return r.reactorId
      return null
    }
    case 'respond-loan':
      return state.pendingLoan?.creditorId ?? null
    case 'accept-trade':
    case 'reject-trade':
      return state.pendingTrade?.toId ?? null
    case 'propose-trade':
    case 'execute-trade':
      return action.trade.fromId
  }
}
