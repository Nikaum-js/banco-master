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
  startTurn,
  type TurnCtx,
} from './turn/turnMachine'
import { economyResolve } from './economy/resolveRentable'
import { buyProperty, declineProperty } from './economy/purchase'
import { placeBid, passBid, closeAuction } from './economy/auction'

// Portas default — placeholders até as specs irmãs. onPassGo retorna valor fixo
// provisório (GO Progressivo real é de Balanceamento); onInsolvency é de Falência.
export const defaultPorts: TurnPorts = {
  onPassGo: () => 200,
  onPayToCenter: () => {},
  onCollectCenter: () => 0,
  isEliminated: () => false,
  onInsolvency: () => {},
}

function seedTitles(): Record<number, Title> {
  const titles: Record<number, Title> = {}
  for (const sq of BOARD) {
    if (sq.kind === 'property' || sq.kind === 'airport' || sq.kind === 'utility') {
      titles[sq.pos] = { ownerId: null, mortgaged: false }
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
  buyProperty(): void
  declineProperty(): void
  placeBid(playerId: string, amount: number): void
  passBid(playerId: string): void
  setPaused(p: boolean): void
}

// Timer do leilão: handle fora do estado (não-serializável); reconstruído pelo deadline.
let auctionTimer: ReturnType<typeof setTimeout> | null = null
function clearAuctionTimer(): void {
  if (auctionTimer) {
    clearTimeout(auctionTimer)
    auctionTimer = null
  }
}

export const useGameStore = create<GameStore>((set, get) => {
  // (Re)agenda o fechamento do leilão pelo deadline atual; respeita pausa.
  function rearmAuction(): void {
    clearAuctionTimer()
    const g = get().game
    if (g.resolution?.kind === 'auction' && !g.paused) {
      const ms = Math.max(0, g.resolution.auction.deadline - Date.now())
      auctionTimer = setTimeout(() => {
        set((st) => ({ game: closeAuction(st.game) }))
        clearAuctionTimer()
      }, ms)
    }
  }

  return {
    game: createSeedState(['p1', 'p2']),
    ctx: { rng: () => Math.random(), ports: defaultPorts, resolve: economyResolve, now: () => Date.now() },
    rollDice: () => set((st) => ({ game: rollDice(st.game, st.ctx) })),
    resolvePending: () => set((st) => ({ game: resolvePending(st.game, st.ctx) })),
    finalizeTurn: () => set((st) => ({ game: finalizeTurn(st.game, st.ctx) })),
    jailDecision: (d) => set((st) => ({ game: jailDecision(st.game, d, st.ctx) })),
    chooseBusMove: (opt) => set((st) => ({ game: chooseBusMove(st.game, opt, st.ctx) })),
    chooseTripleDest: (pos) => set((st) => ({ game: chooseTripleDest(st.game, pos, st.ctx) })),
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
    setPaused: (p) => {
      set((st) => ({ game: { ...st.game, paused: p } }))
      rearmAuction()
    },
  }
})
