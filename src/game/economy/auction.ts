// Leilão — puro. O cronômetro vive no store; aqui só o estado (deadline serializável).
import type { GameState } from '../turn/types'
import type { Auction } from './types'
import { completeResolution } from '../turn/turnMachine'
import { AUCTION_WINDOW } from './purchase'

function clone(state: GameState): GameState {
  return structuredClone(state)
}

function cashOf(state: GameState, id: string): number {
  return state.players.find((p) => p.id === id)?.cash ?? 0
}

// Atalho de tipo: só é chamado quando resolution.kind === 'auction'.
function auctionOf(s: GameState): Auction {
  return (s.resolution as { kind: 'auction'; auction: Auction }).auction
}

export function placeBid(state: GameState, playerId: string, amount: number, now: number): GameState {
  if (state.resolution?.kind !== 'auction') return state
  const a = state.resolution.auction
  if (!a.activeBidders.includes(playerId)) return state
  if (amount <= a.currentBid) return state // deve ser maior que o atual (FR-013)
  if (amount > cashOf(state, playerId)) return state // não licita fiado
  const s = clone(state)
  const au = auctionOf(s)
  au.currentBid = amount
  au.highBidder = playerId
  au.deadline = now + AUCTION_WINDOW // reinicia o cronômetro a cada lance (clarificação)
  return s
}

export function passBid(state: GameState, playerId: string): GameState {
  if (state.resolution?.kind !== 'auction') return state
  const s = clone(state)
  auctionOf(s).activeBidders = auctionOf(s).activeBidders.filter((id) => id !== playerId)
  return s
}

export function closeAuction(state: GameState): GameState {
  if (state.resolution?.kind !== 'auction') return state
  const s = clone(state)
  const a = auctionOf(s)
  if (a.highBidder) {
    const winner = s.players.find((p) => p.id === a.highBidder)
    if (winner) winner.cash -= a.currentBid
    s.titles[a.pos].ownerId = a.highBidder
  }
  // sem highBidder → permanece com o banco (FR-015)
  completeResolution(s)
  return s
}
