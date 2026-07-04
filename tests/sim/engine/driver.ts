// Driver do harness (036/D1-D2): dirige o MESMO motor puro que src/game/store.ts liga
// ao Zustand — sem Zustand, sem timers reais. `now()` é um relógio LÓGICO controlado
// pelo próprio harness (não Date.now()), avançado explicitamente para fechar leilões.
import { BOARD } from '@/lib/boardData'
import { THEME } from '@/game/theme'
import { createSeedState } from '@/game/store'
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
import { economyResolve } from '@/game/economy/resolveRentable'
import { buyProperty, declineProperty } from '@/game/economy/purchase'
import { placeBid, passBid, closeAuction } from '@/game/economy/auction'
import { maybeOpenLandAuction, placeLandBid, closeExpiredLandLots } from '@/game/economy/landAuction'
import { buildHouse, sellBuilding, buildHangar, sellHangar } from '@/game/economy/construction'
import { mortgageProperty, unmortgageProperty } from '@/game/economy/mortgage'
import { goBonus, payToCenter, collectCenter } from '@/game/balancing/balancing'
import { payDebt, declareBankruptcy } from '@/game/falencia/falencia'
import { proposeLoan, respondLoan, payOffLoan, chargeLoanInterest } from '@/game/emprestimos/emprestimos'
import { rollTaxMan } from '@/game/balancing/taxMan'
import { executeTrade as _executeTrade, proposeTrade, acceptTrade, rejectTrade } from '@/game/economy/trade'
import { tickImmunities } from '@/game/economy/imunidade'
import { tickTempEffects } from '@/game/economy/tempEffects'
import { deckCardIds } from '@/game/cards/catalog'
import { weightedShuffle } from '@/game/cards/decks'
import { cardRevealResolve, confirmCardReveal, playHandCard, resolveCardDiscard, resolveCardShortcut } from '@/game/cards/draw'
import { taxBunkerResolve, respondReaction } from '@/game/cards/reacao'
import { mulberry32 } from './rng'
import type { SimAction } from './types'

export interface SimSession {
  game: GameState
  ctx: TurnCtx
  clock: number // relógio lógico (ms simulados); avançado só pelo driver, nunca Date.now()
}

// Mesmas portas de src/game/store.ts (defaultPorts + taxMan) — a simulação usa a
// configuração padrão do produto, sem modos especiais (FR-013).
function buildPorts() {
  return {
    onPassGo: (state: GameState, id: string) => goBonus(state, id),
    onPayToCenter: (state: GameState, amount: number) => payToCenter(state, amount),
    onCollectCenter: (state: GameState, id: string) => collectCenter(state, id),
    isEliminated: () => false,
    onInsolvency: () => {},
    afterPassGo: (state: GameState, id: string) => {
      chargeLoanInterest(state, id)
      tickImmunities(state, id)
      tickTempEffects(state, id)
    },
    taxMan: (s: GameState, rng: TurnCtx['rng']) => rollTaxMan(s, rng),
  }
}

export function createSimSession(seed: number, playerIds: string[]): SimSession {
  const rng = mulberry32(seed)
  const game = createSeedState(playerIds)
  // Baralhos embaralhados pela MESMA seed (nunca freshGame()/Math.random() — FR-003).
  game.decks.acaso = weightedShuffle(deckCardIds('acaso'), rng)
  game.decks.tesouro = weightedShuffle(deckCardIds('tesouro'), rng)

  const session: SimSession = { game, clock: 0, ctx: null as unknown as TurnCtx }
  session.ctx = {
    rng,
    ports: buildPorts(),
    resolve: (r) => economyResolve(r) ?? cardRevealResolve(r) ?? taxBunkerResolve(r),
    now: () => session.clock,
    speedDie: THEME.SPEED_DIE_ENABLED,
  }
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
