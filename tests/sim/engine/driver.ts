// Driver do harness (036/D1-D2): dirige o MESMO motor puro que src/game/store.ts liga
// ao Zustand — sem Zustand, sem timers reais. `now()` é um relógio LÓGICO controlado
// pelo próprio harness (não Date.now()), avançado explicitamente para fechar leilões.
import { BOARD } from '@/lib/boardData'
import { buildGameCtx, buildInitialGame } from '@/game/setup'
import type { GameState } from '@/game/turn/types'
import type { TurnCtx } from '@/game/turn/turnMachine'
import {
  rollDice,
  resolvePending,
  finalizeTurn,
  jailDecision,
  chooseBusMove,
  chooseTripleDest,
  useBusTicket,
  activePlayer,
} from '@/game/turn/turnMachine'
import { buyProperty, declineProperty } from '@/game/economy/purchase'
import { placeBid, passBid, closeAuction } from '@/game/economy/auction'
import { maybeOpenLandAuction, placeLandBid, closeExpiredLandLots } from '@/game/economy/landAuction'
import { buildHouse, sellBuilding, buildHangar, sellHangar } from '@/game/economy/construction'
import { mortgageProperty, unmortgageProperty } from '@/game/economy/mortgage'
import { payDebt, declareBankruptcy } from '@/game/falencia/falencia'
import { proposeLoan, respondLoan, payOffLoan } from '@/game/emprestimos/emprestimos'
import { proposeTrade, acceptTrade, rejectTrade } from '@/game/economy/trade'
import { confirmCardReveal, playHandCard, resolveCardDiscard, resolveCardShortcut } from '@/game/cards/draw'
import { respondReaction } from '@/game/cards/reacao'
import { mulberry32 } from './rng'
import type { SimAction } from './types'

export interface SimSession {
  game: GameState
  ctx: TurnCtx
  clock: number // relógio lógico (ms simulados); avançado só pelo driver, nunca Date.now()
}

export function createSimSession(seed: number, playerIds: string[]): SimSession {
  const rng = mulberry32(seed)
  // Baralhos embaralhados pela MESMA seed (nunca Math.random() — FR-003).
  const game = buildInitialGame(playerIds, rng)

  const session: SimSession = { game, clock: 0, ctx: null as unknown as TurnCtx }
  // MESMA fábrica do store e do host (`@/game/setup`): a simulação valida a
  // configuração do produto, não uma paralela (FR-013).
  session.ctx = buildGameCtx(rng, () => session.clock)
  return session
}

// Checa o gatilho de escassez de terrenos (031) após eventos que mudam posse — mesmo
// ponto em que o store real chama `maybeOpenLand()`.
function maybeOpenLand(session: SimSession): void {
  session.game = maybeOpenLandAuction(session.game, session.ctx.now!())
}

const LAND_TRIGGERING: SimActionSet = new Set(['buy-property', 'decline-property', 'place-bid', 'accept-trade', 'declare-bankruptcy'])
type SimActionSet = Set<SimAction['kind']>

export function dispatch(session: SimSession, action: SimAction): void {
  const { game, ctx } = session
  const prevRef = game // reducers no-op retornam a MESMA referência — usado abaixo p/ detectar no-op
  switch (action.kind) {
    case 'roll':
      session.game = rollDice(game, ctx)
      break
    case 'finalize':
      session.game = finalizeTurn(game, ctx)
      break
    case 'jail-decision':
      session.game = jailDecision(game, action.decision, ctx)
      break
    case 'choose-bus-move':
      session.game = chooseBusMove(game, action.opt, ctx)
      break
    case 'choose-triple-dest':
      session.game = chooseTripleDest(game, action.dest, ctx)
      break
    case 'use-bus-ticket':
      session.game = useBusTicket(game, action.dest, ctx)
      break
    case 'resolve-pending':
      session.game = resolvePending(game, ctx)
      break
    case 'buy-property':
      session.game = buyProperty(game)
      break
    case 'decline-property':
      session.game = declineProperty(game, ctx.now!())
      break
    case 'place-bid':
      session.game = placeBid(game, action.playerId, action.amount, ctx.now!())
      break
    case 'pass-bid':
      session.game = passBid(game, action.playerId)
      break
    case 'place-land-bid':
      session.game = placeLandBid(game, action.playerId, action.pos, action.amount, ctx.now!())
      break
    case 'build-house':
      session.game = buildHouse(game, action.pos)
      break
    case 'sell-building':
      session.game = sellBuilding(game, action.pos)
      break
    case 'build-hangar':
      session.game = buildHangar(game, action.pos)
      break
    case 'sell-hangar':
      session.game = sellHangar(game, action.pos)
      break
    case 'mortgage':
      session.game = mortgageProperty(game, action.pos)
      break
    case 'unmortgage':
      session.game = unmortgageProperty(game, action.pos)
      break
    case 'play-hand-card':
      session.game = playHandCard(game, activePlayer(game).id, action.cardId, ctx.ports, action.target, action.targetPlayer)
      break
    case 'discard-card':
      session.game = resolveCardDiscard(game, action.cardId)
      break
    case 'choose-card-shortcut':
      session.game = resolveCardShortcut(game, action.dir, ctx)
      break
    case 'confirm-card-reveal':
      session.game = confirmCardReveal(game, ctx.ports)
      break
    case 'respond-reaction':
      session.game = respondReaction(game, action.use, ctx.ports)
      break
    case 'pay-debt':
      session.game = payDebt(game)
      break
    case 'declare-bankruptcy':
      session.game = declareBankruptcy(game, ctx)
      break
    case 'propose-loan':
      session.game = proposeLoan(game, activePlayer(game).id, action.creditorId)
      break
    case 'respond-loan':
      session.game = respondLoan(game, action.accept, action.ratePct)
      break
    case 'pay-off-loan':
      session.game = payOffLoan(game, activePlayer(game).id)
      break
    case 'propose-trade':
      session.game = proposeTrade(game, action.trade)
      break
    case 'accept-trade':
      session.game = acceptTrade(game)
      break
    case 'reject-trade':
      session.game = rejectTrade(game)
      break
  }
  if (session.game !== prevRef && LAND_TRIGGERING.has(action.kind)) maybeOpenLand(session)
}

// Relógio lógico (D2): quando não resta lance possível, avança `clock` até o deadline
// mais próximo e fecha na hora — sem esperar de verdade.
export function closeExhaustedAuctions(session: SimSession): boolean {
  let closed = false
  const { game } = session
  if (game.resolution?.kind === 'auction') {
    const a = game.resolution.auction
    const canStillBid = a.activeBidders.some((id) => {
      const cash = game.players.find((p) => p.id === id)?.cash ?? 0
      return cash > a.currentBid
    })
    if (!canStillBid) {
      // closeAuction não olha `deadline`/`now` (só o timer real do store faz isso) — fecha na hora.
      session.game = closeAuction(session.game)
      closed = true
    }
  }
  if (session.game.landAuction) {
    const la = session.game.landAuction
    const anyBiddable = la.lots.some((lot) =>
      la.bidders.some((id) => {
        const cash = session.game.players.find((p) => p.id === id)?.cash ?? 0
        return cash > lot.currentBid
      }),
    )
    if (!anyBiddable && la.lots.length > 0) {
      const soonest = Math.min(...la.lots.map((l) => l.deadline))
      session.clock = Math.max(session.clock, soonest)
      session.game = closeExpiredLandLots(session.game, session.clock)
      closed = true
    }
  }
  return closed
}

// Só para referência de teste (BOARD_SIZE) — reexport leve, evita import duplicado.
export const BOARD_SIZE = BOARD.length
