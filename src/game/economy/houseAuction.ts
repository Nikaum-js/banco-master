// Leilão de casas em escassez (§5.4) — puro; reusa o padrão de leilão da 003.
// O cronômetro vive no store; aqui só o estado (deadline serializável).
//
// NOTA (004): o gatilho natural num fluxo de turno com build de 1 casa é raro
// (estoque esgotado + interesse concorrente). As mecânicas de lance/fecho ficam
// completas e testáveis; a colocação física das casas ganhas é refinamento.
import type { GameState } from '../turn/types'
import type { HouseAuction } from './types'
import { completeResolution } from '../turn/turnMachine'

export const HOUSE_AUCTION_WINDOW = 10_000 // ms

function clone(state: GameState): GameState {
  return structuredClone(state)
}

function cashOf(state: GameState, id: string): number {
  return state.players.find((p) => p.id === id)?.cash ?? 0
}

function auctionOf(s: GameState): HouseAuction {
  return (s.resolution as { kind: 'house-auction'; auction: HouseAuction }).auction
}

// Abre o leilão de casas pelas `housesAvailable` casas, entre os interessados.
export function openHouseAuction(state: GameState, housesAvailable: number, bidders: string[], now: number): GameState {
  const s = clone(state)
  s.resolution = {
    kind: 'house-auction',
    auction: { housesAvailable, currentBid: 0, highBidder: null, activeBidders: bidders, deadline: now + HOUSE_AUCTION_WINDOW },
  }
  return s
}

export function declareBuildInterest(state: GameState, playerId: string): GameState {
  if (state.resolution?.kind !== 'house-auction') return state
  if (state.resolution.auction.activeBidders.includes(playerId)) return state
  const s = clone(state)
  auctionOf(s).activeBidders.push(playerId)
  return s
}

export function placeHouseBid(state: GameState, playerId: string, amount: number, now: number): GameState {
  if (state.resolution?.kind !== 'house-auction') return state
  const a = state.resolution.auction
  if (!a.activeBidders.includes(playerId)) return state
  if (amount <= a.currentBid) return state
  if (amount > cashOf(state, playerId)) return state
  const s = clone(state)
  const au = auctionOf(s)
  au.currentBid = amount
  au.highBidder = playerId
  au.deadline = now + HOUSE_AUCTION_WINDOW
  return s
}

export function closeHouseAuction(state: GameState): GameState {
  if (state.resolution?.kind !== 'house-auction') return state
  const s = clone(state)
  const a = auctionOf(s)
  if (a.highBidder) {
    const winner = s.players.find((p) => p.id === a.highBidder)
    if (winner) winner.cash -= a.currentBid
    s.bank.houses = Math.max(0, s.bank.houses - a.housesAvailable) // casas saem do estoque para o vencedor
  }
  // sem highBidder → casas permanecem no banco
  completeResolution(s)
  return s
}
