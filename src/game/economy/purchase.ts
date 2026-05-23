// Compra e recusa de propriedade livre — puras (clonam o estado).
import { BOARD } from '@/lib/boardData'
import type { GameState } from '../turn/types'
import type { Auction } from './types'
import { activePlayer, completeResolution } from '../turn/turnMachine'

export const AUCTION_WINDOW = 10_000 // ms — cronômetro curto do leilão (tunável no tema)

function clone(state: GameState): GameState {
  return structuredClone(state)
}

function priceOf(pos: number): number {
  const sq = BOARD[pos]
  return 'price' in sq ? sq.price : 0
}

export function buyProperty(state: GameState): GameState {
  if (state.resolution?.kind !== 'purchase') return state
  const pos = state.resolution.pos
  const discount = activePlayer(state).nextPurchaseDiscount ?? 0 // Investidor Anjo (006)
  const price = Math.round(priceOf(pos) * (1 - discount))
  if (activePlayer(state).cash < price) return state // sem caixa: não compra fiado (FR-004)
  const s = clone(state)
  const player = activePlayer(s)
  player.cash -= price
  player.nextPurchaseDiscount = 0 // consome o desconto
  s.titles[pos].ownerId = player.id // propriedade livre → sem construção; preserva o shape do título
  completeResolution(s)
  return s
}

export function declineProperty(state: GameState, now: number): GameState {
  if (state.resolution?.kind !== 'purchase') return state
  const pos = state.resolution.pos // narrowed em `state` antes do clone
  const s = clone(state)
  const auction: Auction = {
    pos,
    currentBid: 0,
    highBidder: null,
    activeBidders: s.players.filter((p) => !p.eliminated).map((p) => p.id),
    deadline: now + AUCTION_WINDOW,
  }
  s.resolution = { kind: 'auction', auction }
  return s
}
