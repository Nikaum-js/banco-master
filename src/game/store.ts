// Store raiz da partida (Zustand). Único ponto com efeito — regra vive nos reducers
// puros de turn/ e economy/. Estado serializável (princípio VII).
import { create } from 'zustand'
import type { GameState } from './turn/types'
import {
  rollDice,
  resolvePending,
  finalizeTurn,
  jailDecision,
  chooseBusMove,
  chooseTripleDest,
  useBusTicket,
  activePlayer,
  dismissNotice,
  type TurnCtx,
} from './turn/turnMachine'
import { buildGameCtx, buildInitialGame } from './setup'
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

// Jogo novo pronto pra jogar: seed + baralhos embaralhados (FR-001). Usado no
// boot e no "Novo jogo" (reset ao fim da partida). A composição vive em `setup.ts`.
function freshGame(ids: string[]): GameState {
  return buildInitialGame(ids, () => Math.random())
}

interface GameStore {
  game: GameState
  ctx: TurnCtx
  rollDice(): void
  resolvePending(): void
  finalizeTurn(): void
  resetGame(): void // reinicia a partida (fim de jogo → "Novo jogo")
  jailDecision(d: 'pay' | 'card' | 'try'): void
  chooseBusMove(opt: 'die0' | 'die1' | 'sum'): void
  chooseTripleDest(pos: number): void
  useBusTicket(dest: number): void
  buyProperty(): void
  declineProperty(): void
  placeBid(playerId: string, amount: number): void
  passBid(playerId: string): void
  placeLandBid(playerId: string, pos: number, amount: number): void // 031 — pregão de escassez
  closeLandAuction(): void
  buildHouse(pos: number): void
  sellBuilding(pos: number): void
  buildHangar(pos: number): void
  sellHangar(pos: number): void
  mortgageProperty(pos: number): void
  unmortgageProperty(pos: number): void
  playHandCard(cardId: string, target?: number, targetPlayer?: string): void
  discardCard(cardId: string): void
  chooseCardShortcut(dir: 'frente' | 'tras'): void
  confirmCardReveal(): void
  payDebt(): void
  declareBankruptcy(): void
  grantLoan(creditorId: string, principal: number, ratePct: number): void
  proposeLoan(creditorId: string): void
  respondLoan(accept: boolean, ratePct: number): void
  payOffLoan(): void
  executeTrade(trade: Trade): void
  proposeTrade(trade: Trade): void
  acceptTrade(): void
  rejectTrade(): void
  respondReaction(use: boolean): void
  dismissNotice(): void
  setPaused(p: boolean): void
}

// Timer dos leilões: handle fora do estado (não-serializável); reconstruído pelo deadline.
let auctionTimer: ReturnType<typeof setTimeout> | null = null
function clearAuctionTimer(): void {
  if (auctionTimer) {
    clearTimeout(auctionTimer)
    auctionTimer = null
  }
}

// Timer do pregão de escassez de terrenos (031) — separado do leilão de propriedade.
let landTimer: ReturnType<typeof setTimeout> | null = null
function clearLandTimer(): void {
  if (landTimer) {
    clearTimeout(landTimer)
    landTimer = null
  }
}

// Contagem de jogadores no boot: 2 por padrão. Sem lobby (M3/D-025 ainda não chegou —
// app hoje é single-client), o parâmetro de URL `?players=2|3|6` é o único gancho para
// o smoke E2E (036/US3) escolher a contagem sem precisar de UI de lobby nova.
function initialPlayerIds(): string[] {
  if (typeof window === 'undefined') return ['p1', 'p2']
  const requested = Number(new URLSearchParams(window.location.search).get('players'))
  const count = requested === 3 || requested === 6 ? requested : 2
  return Array.from({ length: count }, (_, i) => `p${i + 1}`)
}

export const useGameStore = create<GameStore>((set, get) => {
  // (Re)agenda o fechamento do leilão de PROPRIEDADE pelo deadline; respeita pausa.
  // (O leilão de casas — 026 — é evento autônomo de fecho manual, não usa este timer.)
  function rearmAuction(): void {
    clearAuctionTimer()
    const g = get().game
    if (g.paused || g.resolution?.kind !== 'auction') return
    const deadline = g.resolution.auction.deadline
    const ms = Math.max(0, deadline - Date.now())
    auctionTimer = setTimeout(() => {
      set((st) => ({ game: closeAuction(st.game) }))
      clearAuctionTimer()
      maybeOpenLand() // um terreno acabou de ser arrematado → checa escassez (031)
    }, ms)
  }

  // (Re)agenda o fechamento dos lotes do PREGÃO (031) pelo prazo PRÓPRIO de cada lote:
  // dispara no lote que vence primeiro, fecha os expirados e reagenda p/ os demais. Respeita pausa.
  function rearmLandAuction(): void {
    clearLandTimer()
    const g = get().game
    if (g.paused || !g.landAuction || g.landAuction.lots.length === 0) return
    const soonest = Math.min(...g.landAuction.lots.map((l) => l.deadline))
    const ms = Math.max(0, soonest - Date.now())
    landTimer = setTimeout(() => {
      set((st) => ({ game: closeExpiredLandLots(st.game, Date.now()) }))
      clearLandTimer()
      maybeOpenLand() // reagenda p/ os lotes restantes (ou re-arma o episódio se acabou)
    }, ms)
  }

  // Checa o gatilho de escassez (após eventos que mudam posse) e (re)agenda o timer.
  function maybeOpenLand(): void {
    set((st) => ({ game: maybeOpenLandAuction(st.game, st.ctx.now!()) }))
    rearmLandAuction()
  }

  return {
    game: freshGame(initialPlayerIds()),
    // Composição do jogo: uma fábrica só, compartilhada com host, cliente e simulação.
    ctx: buildGameCtx(() => Math.random(), () => Date.now()),
    rollDice: () => set((st) => ({ game: rollDice(st.game, st.ctx) })),
    resolvePending: () => set((st) => ({ game: resolvePending(st.game, st.ctx) })),
    finalizeTurn: () => {
      set((st) => ({ game: finalizeTurn(st.game, st.ctx) }))
      maybeOpenLand() // 031 — falência/posse pode ter mudado a contagem de terrenos livres
    },
    resetGame: () => {
      clearAuctionTimer()
      clearLandTimer()
      set((st) => ({ game: freshGame(st.game.players.map((p) => p.id)) })) // mesmos jogadores, baralho novo
    },
    jailDecision: (d) => set((st) => ({ game: jailDecision(st.game, d, st.ctx) })),
    chooseBusMove: (opt) => set((st) => ({ game: chooseBusMove(st.game, opt, st.ctx) })),
    chooseTripleDest: (pos) => set((st) => ({ game: chooseTripleDest(st.game, pos, st.ctx) })),
    useBusTicket: (dest) => set((st) => ({ game: useBusTicket(st.game, dest, st.ctx) })),
    buyProperty: () => {
      set((st) => ({ game: buyProperty(st.game) }))
      maybeOpenLand() // 031 — comprar tirou um terreno de circulação → checa escassez
    },
    declineProperty: () => {
      set((st) => ({ game: declineProperty(st.game, st.ctx.now!()) }))
      rearmAuction()
    },
    placeBid: (playerId, amount) => {
      set((st) => ({ game: placeBid(st.game, playerId, amount, st.ctx.now!()) }))
      rearmAuction()
    },
    passBid: (playerId) => set((st) => ({ game: passBid(st.game, playerId) })),
    placeLandBid: (playerId, pos, amount) => {
      set((st) => ({ game: placeLandBid(st.game, playerId, pos, amount, st.ctx.now!()) }))
      rearmLandAuction() // lance reinicia o cronômetro compartilhado (soft-close)
    },
    closeLandAuction: () => {
      set((st) => ({ game: closeLandAuction(st.game) }))
      clearLandTimer()
      maybeOpenLand()
    },
    buildHouse: (pos) => set((st) => ({ game: buildHouse(st.game, pos) })),
    sellBuilding: (pos) => set((st) => ({ game: sellBuilding(st.game, pos) })),
    buildHangar: (pos) => set((st) => ({ game: buildHangar(st.game, pos) })),
    sellHangar: (pos) => set((st) => ({ game: sellHangar(st.game, pos) })),
    mortgageProperty: (pos) => set((st) => ({ game: mortgageProperty(st.game, pos) })),
    unmortgageProperty: (pos) => set((st) => ({ game: unmortgageProperty(st.game, pos) })),
    playHandCard: (cardId, target, targetPlayer) =>
      set((st) => ({ game: playHandCard(st.game, activePlayer(st.game).id, cardId, st.ctx.ports, target, targetPlayer) })),
    discardCard: (cardId) => set((st) => ({ game: resolveCardDiscard(st.game, cardId) })),
    chooseCardShortcut: (dir) => set((st) => ({ game: resolveCardShortcut(st.game, dir, st.ctx) })),
    confirmCardReveal: () => set((st) => ({ game: confirmCardReveal(st.game, st.ctx.ports) })), // 025
    payDebt: () => set((st) => ({ game: payDebt(st.game) })),
    declareBankruptcy: () => set((st) => ({ game: declareBankruptcy(st.game, st.ctx) })),
    grantLoan: (creditorId, principal, ratePct) =>
      set((st) => ({ game: grantLoan(st.game, activePlayer(st.game).id, creditorId, principal, ratePct) })),
    proposeLoan: (creditorId) =>
      set((st) => ({ game: proposeLoan(st.game, activePlayer(st.game).id, creditorId) })), // §15.2
    respondLoan: (accept, ratePct) => set((st) => ({ game: respondLoan(st.game, accept, ratePct) })), // §15.3
    payOffLoan: () => set((st) => ({ game: payOffLoan(st.game, activePlayer(st.game).id) })),
    executeTrade: (trade) => set((st) => ({ game: executeTrade(st.game, trade) })), // não gated por turno (§8.1)
    proposeTrade: (trade) => set((st) => ({ game: proposeTrade(st.game, trade) })), // 024
    acceptTrade: () => set((st) => ({ game: acceptTrade(st.game) })),
    rejectTrade: () => set((st) => ({ game: rejectTrade(st.game) })),
    respondReaction: (use) => set((st) => ({ game: respondReaction(st.game, use, st.ctx.ports) })), // 017
    dismissNotice: () => set((st) => ({ game: dismissNotice(st.game) })), // 030
    setPaused: (p) => {
      set((st) => ({ game: { ...st.game, paused: p } }))
      rearmAuction()
      rearmLandAuction() // 031 — pausa também congela/retoma o cronômetro do pregão
    },
  }
})
