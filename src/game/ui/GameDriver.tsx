// GameDriver (022.1) — auto-avanço do turno. Faz o jogo "ir sozinho": resolve a
// casa (aluguel/imposto/carta) e finaliza o turno automaticamente; só PAUSA em
// decisão real — modal central (compra/leilão/descarte/atalho) ou prompt do HUD
// (dívida/prisão/reação). Componente headless (sem render). Não toca em regra:
// apenas dispara, no tempo certo, os comandos já existentes do store.
import { useEffect } from 'react'
import { useGameStore } from '@/game/store'
import { useTokenAnim } from '@/game/ui/tokenAnim'

export function GameDriver() {
  const state = useGameStore((s) => s.game.turn.state)
  const pendingResolve = useGameStore((s) => s.game.turn.pendingResolve)
  const awaitingChoice = useGameStore((s) => s.game.turn.awaitingChoice)
  const hasResolution = useGameStore((s) => s.game.resolution !== null)
  const paused = useGameStore((s) => s.game.paused)
  const phase = useGameStore((s) => s.game.phase)
  const animating = useTokenAnim((s) => s.animating) // re-roda quando o peão chega
  const resolvePending = useGameStore((s) => s.resolvePending)
  const finalizeTurn = useGameStore((s) => s.finalizeTurn)

  useEffect(() => {
    if (paused || phase !== 'playing') return

    // Resolve a casa sozinho — a menos que haja escolha de Speed Die pendente
    // (triple/ônibus) ou um modal aberto (compra/leilão/descarte/atalho/dívida).
    // Lê o sinal de animação AO VIVO (getState) p/ não resolver antes do peão chegar.
    if (state === 'casa-a-resolver' && awaitingChoice === null && !hasResolution) {
      if (useTokenAnim.getState().animating) return // espera o peão terminar de andar
      resolvePending()
      return
    }

    // Finaliza o turno sozinho: avança o assento ou, na dupla, volta a rolar.
    if (state === 'aguardando-finalizacao' && !pendingResolve) {
      finalizeTurn()
    }
  }, [state, pendingResolve, awaitingChoice, hasResolution, paused, phase, animating, resolvePending, finalizeTurn])

  return null
}
