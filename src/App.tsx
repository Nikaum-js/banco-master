import Board01Classic from '@/boards/Board01Classic'
import { GameHUD } from '@/game/ui/GameHUD'
import { GameDriver } from '@/game/ui/GameDriver'
import { ModalLayer } from '@/game/ui/modals/ModalLayer'
import { TradeLayer } from '@/game/ui/trade/TradeLayer'
import { HouseAuctionLayer } from '@/game/ui/houseAuction/HouseAuctionLayer'
import { HandCardLayer } from '@/game/ui/cards/HandCardLayer'
import { DebugLogger } from '@/game/ui/DebugLogger'

// O tabuleiro Clássico É a tela inicial. A rolagem é o DiceArena central; o
// GameDriver faz o turno "ir sozinho" (resolve/finaliza); o ModalLayer (022) traz
// as decisões dirigidas por resolução; o GameHUD vira uma barra só de decisões
// (prisão/dívida/reação) e some quando não há nada a decidir. DebugLogger (dev)
// joga o estado no console do browser a cada mudança.
export default function App() {
  return (
    <>
      <Board01Classic />
      <GameDriver />
      <ModalLayer />
      <TradeLayer />
      <HouseAuctionLayer />
      <HandCardLayer />
      <GameHUD />
      <DebugLogger />
    </>
  )
}
