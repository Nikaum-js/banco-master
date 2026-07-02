import Board01Classic from '@/boards/Board01Classic'
import { GameHUD } from '@/game/ui/GameHUD'
import { GameDriver } from '@/game/ui/GameDriver'
import { ModalLayer } from '@/game/ui/modals/ModalLayer'
import { TradeLayer } from '@/game/ui/trade/TradeLayer'
import { LandAuctionLayer } from '@/game/ui/landAuction/LandAuctionLayer'
import { HandCardLayer } from '@/game/ui/cards/HandCardLayer'
import { NoticeLayer } from '@/game/ui/NoticeLayer'
import { SoundLayer } from '@/game/ui/sound/SoundLayer'
import { AudioControl } from '@/game/ui/sound/AudioControl'
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
      <LandAuctionLayer />
      <HandCardLayer />
      <NoticeLayer />
      <SoundLayer />
      <GameHUD />
      <AudioControl />
      <DebugLogger />
    </>
  )
}
