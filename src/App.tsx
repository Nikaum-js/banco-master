import Board01Classic from '@/boards/Board01Classic'
import { GameHUD } from '@/game/ui/GameHUD'

// O tabuleiro Clássico É a tela inicial. O GameHUD (barra inferior) liga o motor
// de jogo (002–006) à tela — demo local jogável de um cliente.
export default function App() {
  return (
    <>
      <Board01Classic />
      <GameHUD />
    </>
  )
}
