// A superfície completa da partida fica fora do chunk da home. O módulo só é baixado
// quando `OnlineGate` realmente renderiza uma partida local ou uma sala em andamento.
// O cenário E2E precisa avaliar antes do store usado pelos componentes abaixo.
import './e2eScenario'
import Board01Classic from '@/boards/Board01Classic'
import { GameDriver } from './GameDriver'
import { ModalLayer } from './modals/ModalLayer'
import { TradeLayer } from './trade/TradeLayer'
import { LandAuctionLayer } from './landAuction/LandAuctionLayer'
import { HandCardLayer } from './cards/HandCardLayer'
import { NoticeLayer } from './NoticeLayer'
import { LiveRegion } from './a11y/LiveRegion'
import { SoundLayer } from './sound/SoundLayer'
import { AudioControl } from './sound/AudioControl'
import { GameHUD } from './GameHUD'
import { DebugLogger } from './DebugLogger'
import { PauseBanner } from '@/net/ui/PauseBanner'
import { ConnectionBanner } from '@/net/ui/ConnectionBanner'
import { CommandFailureToast } from '@/net/ui/CommandFailureToast'
import { AccessoryErrorBoundary } from '@/app/AccessoryErrorBoundary'

export default function GameSurface() {
  return (
    <>
      <Board01Classic />
      <GameDriver />
      <ModalLayer />
      <TradeLayer />
      <LandAuctionLayer />
      <HandCardLayer />
      <NoticeLayer />
      <LiveRegion />
      <AccessoryErrorBoundary label="Som">
        <SoundLayer />
      </AccessoryErrorBoundary>
      <GameHUD />
      <AudioControl />
      <PauseBanner />
      <ConnectionBanner />
      <CommandFailureToast />
      <DebugLogger />
    </>
  )
}
