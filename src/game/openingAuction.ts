import type { Room } from '@/net/room'
import type { GameState } from './turn/types'

/**
 * Liquida o Leilão da Largada sem criar nem destruir dinheiro: cada participante perde o
 * próprio lance e a Loteria recebe exatamente a soma. O reducer é puro para o snapshot
 * inicial poder ser refeito e testado sem depender da UI.
 */
export function applyOpeningAuction(game: GameState, room: Room): GameState {
  const bids = new Map(room.seats.map((seat) => [seat.playerId, seat.openingBid ?? 0]))
  const paid = game.players.reduce((sum, player) => sum + (bids.get(player.id) ?? 0), 0)
  if (paid === 0) return game

  return {
    ...game,
    players: game.players.map((player) => ({
      ...player,
      cash: player.cash - (bids.get(player.id) ?? 0),
    })),
    centerPot: game.centerPot + paid,
  }
}
