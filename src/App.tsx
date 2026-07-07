import Board01Classic from '@/boards/Board01Classic'
import { GameHUD } from '@/game/ui/GameHUD'
import { GameDriver } from '@/game/ui/GameDriver'
import { ModalLayer } from '@/game/ui/modals/ModalLayer'
import { TradeLayer } from '@/game/ui/trade/TradeLayer'
import { LandAuctionLayer } from '@/game/ui/landAuction/LandAuctionLayer'
import { HandCardLayer } from '@/game/ui/cards/HandCardLayer'
import { NoticeLayer } from '@/game/ui/NoticeLayer'
import { LiveRegion } from '@/game/ui/a11y/LiveRegion'
import { SoundLayer } from '@/game/ui/sound/SoundLayer'
import { AudioControl } from '@/game/ui/sound/AudioControl'
import { ThemeControl } from '@/game/ui/theme/ThemeControl'
import { SoundBoard } from '@/game/ui/sound/SoundBoard'
import { DebugLogger } from '@/game/ui/DebugLogger'
import { OnlineGate } from '@/net/ui/OnlineGate'
import { PauseBanner } from '@/net/ui/PauseBanner'
import { ConnectionBanner } from '@/net/ui/ConnectionBanner'
import { CommandFailureToast } from '@/net/ui/CommandFailureToast'
import { AccessoryErrorBoundary } from '@/app/AccessoryErrorBoundary'
// Import por efeito colateral (044/T049, D10 do plan): aplica `?scenario=endgame` na
// avaliação do módulo, antes do primeiro render — mesmo timing de `freshGame(initialPlayerIds())`
// em `game/store.ts`. Sem o parâmetro, não faz nada.
import '@/game/ui/e2eScenario'

// O tabuleiro Clássico É a tela inicial. A rolagem é o DiceArena central; o
// GameDriver faz o turno "ir sozinho" (resolve/finaliza); o ModalLayer (022) traz
// as decisões dirigidas por resolução; o GameHUD vira uma barra só de decisões
// (prisão/dívida/reação) e some quando não há nada a decidir. DebugLogger (dev)
// joga o estado no console do browser a cada mudança.
//
// `OnlineGate` (037) é transparente sem `?host=1`/`?room=<id>`: o boot single-player
// segue idêntico. Com esses params, ele monta a sala online e só libera o tabuleiro
// quando o estado da partida chega do host.
//
// `OrientationGate` é montado pelo `OnlineGate` só quando o TABULEIRO existe. A home e o
// lobby funcionam em retrato; durante a partida, o gate continua sem desmontar a sessão
// (só sobrepõe um aviso por cima dos mesmos filhos).
export default function App() {
  // `?sons` abre o board de auditoria dos SFX (dev) no lugar do jogo.
  if (new URLSearchParams(window.location.search).has('sons')) return <SoundBoard />
  return (
    <>
      <OnlineGate>
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
      </OnlineGate>
      {/* Fora do `OnlineGate` para continuar disponível no lobby e na partida.
          Na home, o próprio seletor de mapa assume essa ação e o CSS oculta este controle. */}
      <ThemeControl />
    </>
  )
}
