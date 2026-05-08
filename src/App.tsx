import { lazy, Suspense } from 'react'
import { importWithReload } from '@/app/lazyImportRecovery'
import { OnlineGate } from '@/net/ui/OnlineGate'

const GameSurface = lazy(() => importWithReload(() => import('@/game/ui/GameSurface')))
const SoundBoard = lazy(() => importWithReload(() =>
  import('@/game/ui/sound/SoundBoard').then((module) => ({ default: module.SoundBoard })),
))

const VisualLab = lazy(() => importWithReload(() =>
  import('@/game/ui/lab/VisualLab').then((module) => ({ default: module.VisualLab })),
))

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
// Não há gate de orientação (D-079): home, lobby e tabuleiro funcionam nas duas
// orientações. Em retrato de celular o tabuleiro troca de LAYOUT — vira herói de largura
// inteira com gaveta de abas abaixo (`boards/PortraitDock`) —, não de disponibilidade.
export default function App() {
  // `?sons` abre o board de auditoria dos SFX (dev) no lugar do jogo.
  if (new URLSearchParams(window.location.search).has('sons')) {
    return (
      <Suspense fallback={null}>
        <SoundBoard />
      </Suspense>
    )
  }
  // `?ui-lab` isola os componentes visuais reais em fixtures de desenvolvimento.
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('ui-lab')) {
    return (
      <Suspense fallback={null}>
        <VisualLab />
      </Suspense>
    )
  }
  return (
    <OnlineGate>
      <Suspense fallback={null}>
        <GameSurface />
      </Suspense>
    </OnlineGate>
  )
}
