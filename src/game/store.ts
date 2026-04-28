// Store raiz da partida (Zustand). Único ponto com efeito — regra vive nos reducers
// puros de turn/ e economy/. Estado serializável (princípio VII).
import { create } from 'zustand'
import { BOARD } from '@/lib/boardData'
import type { GameState, Player } from './turn/types'
import type { Title } from './economy/types'
import type { TurnPorts } from './turn/resolution'
import {
  rollDice,
  resolvePending,
  finalizeTurn,
  jailDecision,
  chooseBusMove,
  chooseTripleDest,
  useBusTicket,
  startTurn,
  activePlayer,
  type TurnCtx,
} from './turn/turnMachine'
import { economyResolve } from './economy/resolveRentable'
import { buyProperty, declineProperty } from './economy/purchase'
import { placeBid, passBid, closeAuction } from './economy/auction'
import { buildHouse, sellBuilding, buildHangar, sellHangar } from './economy/construction'
import { openHouseAuction, declareBuildInterest, placeHouseBid, closeHouseAuction } from './economy/houseAuction'
import { mortgageProperty, unmortgageProperty } from './economy/mortgage'
import { goBonus, payToCenter, collectCenter } from './balancing/balancing'
import { payDebt, declareBankruptcy } from './falencia/falencia'
import { grantLoan, payOffLoan, chargeLoanInterest } from './emprestimos/emprestimos'
import { rollTaxMan } from './balancing/taxMan'
import { executeTrade, type Trade } from './economy/trade'
import { tickImmunities } from './economy/imunidade'
import { tickTempEffects } from './economy/tempEffects'
import { deckCardIds } from './cards/catalog'
import { shuffle } from './cards/decks'
import { cardResolve, playHandCard, resolveCardDiscard, resolveCardShortcut } from './cards/draw'
import { taxBunkerResolve, respondReaction } from './cards/reacao'

// Portas default — placeholders até as specs irmãs (Balanceamento, Falência).
export const defaultPorts: TurnPorts = {
  onPassGo: (state, id) => goBonus(state, id), // GO Progressivo (007)
  onPayToCenter: (state, amount) => payToCenter(state, amount), // pote (007)
  onCollectCenter: (state, id) => collectCenter(state, id), // Free Parking (007)
  isEliminated: () => false,
  onInsolvency: () => {},
  afterPassGo: (state, id) => {
    chargeLoanInterest(state, id) // juros de empréstimo no GO (010)
    tickImmunities(state, id) // expira imunidades por volta do beneficiário (014)
    tickTempEffects(state, id) // expira efeitos temporários por volta do originador (015)
  },
}

function seedTitles(): Record<number, Title> {
  const titles: Record<number, Title> = {}
  for (const sq of BOARD) {
    if (sq.kind === 'property' || sq.kind === 'airport' || sq.kind === 'utility') {
      titles[sq.pos] = { ownerId: null, mortgaged: false, houses: 0, hotel: false, hotel2: false, skyscraper: false, hangar: false }
    }
  }
  return titles
}

export function createSeedState(playerIds: string[]): GameState {
  const players: Player[] = playerIds.map((id) => ({
    id,
    pos: 0,
    completouPrimeiraVolta: false,
    jail: { inJail: false, attempts: 0 },
    eliminated: false,
    cash: 2000, // SRS §3.1
    hand: [],
    busTickets: 0,
    nextPurchaseDiscount: 0,
  }))
  const state: GameState = {
    players,
    turnOrder: players.map((_, i) => i),
    activeSeat: 0,
    turn: {
      state: 'aguardando-rolagem',
      seat: 0,
      consecutiveDoubles: 0,
      lastRoll: null,
      pendingResolve: false,
      mayRollAgain: false,
      awaitingChoice: null,
    },
    paused: false,
    phase: 'playing',
    titles: seedTitles(),
    resolution: null,
    bank: { houses: 40, hotels: 16, skyscrapers: 4 }, // D-017 + estoque de Skyscrapers (011, provisório)
    decks: { acaso: deckCardIds('acaso'), tesouro: deckCardIds('tesouro') }, // 006 — embaralhar no store
    centerPot: 500, // 007 — Free Parking
    loans: [], // 010 — empréstimos ativos
    taxManPos: 0, // 012 — Fiscal começa em GO
    immunities: [], // 014 — imunidades de aluguel ativas
    tempEffects: [], // 015 — efeitos temporários de carta
  }
  startTurn(state)
  return state
}

interface GameStore {
  game: GameState
  ctx: TurnCtx
  rollDice(): void
  resolvePending(): void
  finalizeTurn(): void
  jailDecision(d: 'pay' | 'card' | 'try'): void
  chooseBusMove(opt: 'die0' | 'die1' | 'sum'): void
  chooseTripleDest(pos: number): void
  useBusTicket(dest: number): void
  buyProperty(): void
  declineProperty(): void
  placeBid(playerId: string, amount: number): void
  passBid(playerId: string): void
  buildHouse(pos: number): void
  sellBuilding(pos: number): void
  buildHangar(pos: number): void
  sellHangar(pos: number): void
  openHouseAuction(housesAvailable: number, bidders: string[]): void
  declareBuildInterest(playerId: string): void
  placeHouseBid(playerId: string, amount: number): void
  mortgageProperty(pos: number): void
  unmortgageProperty(pos: number): void
  playHandCard(cardId: string, target?: number, targetPlayer?: string): void
  discardCard(cardId: string): void
  chooseCardShortcut(dir: 'frente' | 'tras'): void
  payDebt(): void
  declareBankruptcy(): void
  grantLoan(creditorId: string, principal: number, ratePct: number): void
  payOffLoan(): void
  executeTrade(trade: Trade): void
  respondReaction(use: boolean): void
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

export const useGameStore = create<GameStore>((set, get) => {
  // (Re)agenda o fechamento do leilão (compra ou casas) pelo deadline; respeita pausa.
  function rearmAuction(): void {
    clearAuctionTimer()
    const g = get().game
    if (g.paused || !g.resolution) return
    const kind = g.resolution.kind
    if (kind !== 'auction' && kind !== 'house-auction') return
    const deadline = g.resolution.auction.deadline
    const ms = Math.max(0, deadline - Date.now())
    auctionTimer = setTimeout(() => {
      set((st) => ({ game: kind === 'auction' ? closeAuction(st.game) : closeHouseAuction(st.game) }))
      clearAuctionTimer()
    }, ms)
  }

  return {
    game: (() => {
      const g = createSeedState(['p1', 'p2'])
      const rng = (): number => Math.random()
      g.decks.acaso = shuffle(g.decks.acaso, rng) // embaralhar no início (FR-001)
      g.decks.tesouro = shuffle(g.decks.tesouro, rng)
      return g
    })(),
    ctx: {
      rng: () => Math.random(),
      // Fiscal injetado só aqui (jogo real); defaultPorts segue sem ele p/ não afetar os testes (012)
      ports: { ...defaultPorts, taxMan: (s, rng) => rollTaxMan(s, rng) },
      resolve: (r) => economyResolve(r) ?? cardResolve(r) ?? taxBunkerResolve(r), // +Bunker intercepta imposto (017)
      now: () => Date.now(),
    },
    rollDice: () => set((st) => ({ game: rollDice(st.game, st.ctx) })),
    resolvePending: () => set((st) => ({ game: resolvePending(st.game, st.ctx) })),
    finalizeTurn: () => set((st) => ({ game: finalizeTurn(st.game, st.ctx) })),
    jailDecision: (d) => set((st) => ({ game: jailDecision(st.game, d, st.ctx) })),
    chooseBusMove: (opt) => set((st) => ({ game: chooseBusMove(st.game, opt, st.ctx) })),
    chooseTripleDest: (pos) => set((st) => ({ game: chooseTripleDest(st.game, pos, st.ctx) })),
    useBusTicket: (dest) => set((st) => ({ game: useBusTicket(st.game, dest, st.ctx) })),
    buyProperty: () => set((st) => ({ game: buyProperty(st.game) })),
    declineProperty: () => {
      set((st) => ({ game: declineProperty(st.game, st.ctx.now!()) }))
      rearmAuction()
    },
    placeBid: (playerId, amount) => {
      set((st) => ({ game: placeBid(st.game, playerId, amount, st.ctx.now!()) }))
      rearmAuction()
    },
    passBid: (playerId) => set((st) => ({ game: passBid(st.game, playerId) })),
    buildHouse: (pos) => set((st) => ({ game: buildHouse(st.game, pos) })),
    sellBuilding: (pos) => set((st) => ({ game: sellBuilding(st.game, pos) })),
    buildHangar: (pos) => set((st) => ({ game: buildHangar(st.game, pos) })),
    sellHangar: (pos) => set((st) => ({ game: sellHangar(st.game, pos) })),
    openHouseAuction: (housesAvailable, bidders) => {
      set((st) => ({ game: openHouseAuction(st.game, housesAvailable, bidders, st.ctx.now!()) }))
      rearmAuction()
    },
    declareBuildInterest: (playerId) => set((st) => ({ game: declareBuildInterest(st.game, playerId) })),
    placeHouseBid: (playerId, amount) => {
      set((st) => ({ game: placeHouseBid(st.game, playerId, amount, st.ctx.now!()) }))
      rearmAuction()
    },
    mortgageProperty: (pos) => set((st) => ({ game: mortgageProperty(st.game, pos) })),
    unmortgageProperty: (pos) => set((st) => ({ game: unmortgageProperty(st.game, pos) })),
    playHandCard: (cardId, target, targetPlayer) =>
      set((st) => ({ game: playHandCard(st.game, activePlayer(st.game).id, cardId, st.ctx.ports, target, targetPlayer) })),
    discardCard: (cardId) => set((st) => ({ game: resolveCardDiscard(st.game, cardId) })),
    chooseCardShortcut: (dir) => set((st) => ({ game: resolveCardShortcut(st.game, dir, st.ctx.ports) })),
    payDebt: () => set((st) => ({ game: payDebt(st.game) })),
    declareBankruptcy: () => set((st) => ({ game: declareBankruptcy(st.game, st.ctx) })),
    grantLoan: (creditorId, principal, ratePct) =>
      set((st) => ({ game: grantLoan(st.game, activePlayer(st.game).id, creditorId, principal, ratePct) })),
    payOffLoan: () => set((st) => ({ game: payOffLoan(st.game, activePlayer(st.game).id) })),
    executeTrade: (trade) => set((st) => ({ game: executeTrade(st.game, trade) })), // não gated por turno (§8.1)
    respondReaction: (use) => set((st) => ({ game: respondReaction(st.game, use, st.ctx.ports) })), // 017
    setPaused: (p) => {
      set((st) => ({ game: { ...st.game, paused: p } }))
      rearmAuction()
    },
  }
})
