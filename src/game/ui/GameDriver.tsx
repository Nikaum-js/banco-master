// GameDriver (022.1) — auto-avanço do turno. Faz o jogo "ir sozinho": resolve a
// casa (aluguel/imposto/carta) e finaliza o turno automaticamente; só PAUSA em
// decisão real — modal central (compra/leilão/descarte/atalho) ou prompt do HUD
// (dívida/prisão/reação). Componente headless (sem render). Não toca em regra:
// apenas dispara, no tempo certo, os comandos já existentes do store.
import { useEffect } from 'react'
import { useGameStore } from '@/game/store'
import { useLocalView } from '@/net/roomStore'
import { useTokenAnim } from '@/game/ui/tokenAnim'

export function GameDriver() {
  const state = useGameStore((s) => s.game.turn.state)
  const awaitingChoice = useGameStore((s) => s.game.turn.awaitingChoice)
  const hasResolution = useGameStore((s) => s.game.resolution !== null)
  const paused = useGameStore((s) => s.game.paused)
  const phase = useGameStore((s) => s.game.phase)
  const animating = useTokenAnim((s) => s.animating) // re-roda quando o peão chega
  const mayRollAgain = useGameStore((s) => s.game.turn.mayRollAgain)
  const dispatch = useGameStore((s) => s.dispatch)
  // Online, o auto-avanço é do cliente do ATOR (spec 038, research D5): sem este gate,
  // N clientes emitiriam o mesmo comando para o host descartar N-1 — não corrompe nada
  // (FR-007 protege), mas é tráfego e log inútil. Sem sala, `mayAct` é sempre true.
  const mayResolve = useLocalView().mayAct('resolve-pending')

  useEffect(() => {
    if (paused || phase !== 'playing') return
    if (!mayResolve) return // a vez é de outro dispositivo — ele conduz o próprio turno

    // Resolve a casa sozinho — a menos que haja escolha de Speed Die pendente
    // (triple/ônibus) ou um modal/decisão aberto (leilão/descarte/atalho/dívida)
    // ou a compra inline pendente. Lê o sinal de animação AO VIVO (getState) p/
    // não resolver antes do peão chegar.
    if (state === 'casa-a-resolver' && awaitingChoice === null && !hasResolution) {
      if (useTokenAnim.getState().animating) return // espera o peão terminar de andar
      dispatch({ kind: 'resolve-pending' })
      return
    }
    // DUPLA: re-rola sozinho (finalizeTurn só devolve a rolagem ao MESMO jogador) —
    // sem clique redundante. Passar a vez (não-dupla) segue MANUAL via "Finalizar turno".
    if (state === 'aguardando-finalizacao' && mayRollAgain) {
      dispatch({ kind: 'finalize' })
    }
  }, [state, awaitingChoice, hasResolution, paused, phase, animating, mayRollAgain, mayResolve, dispatch])

  return null
}
