// GameDriver (022.1) — casca React do auto-avanço. Componente headless (sem render).
//
// A POLÍTICA ("o que o jogo faz sozinho, e quando") vive em `@/game/turn/advancePolicy`,
// pura e testável em node. Aqui ficam só as duas coisas que dependem do browser: os
// portões (animação do peão, perspectiva do assento local) e QUANDO reavaliar.
//
// As assinaturas seguem granulares de propósito: o motor faz `structuredClone` a cada
// comando, então assinar `s.game` inteiro re-rodaria o efeito a cada mutação do jogo.
import { useEffect } from 'react'
import { useGameStore } from '@/game/store'
import { useLocalView } from '@/net/roomStore'
import { useTokenAnim } from '@/game/ui/tokenAnim'
import { advancePolicy } from '@/game/turn/advancePolicy'

export function GameDriver() {
  const state = useGameStore((s) => s.game.turn.state)
  const awaitingChoice = useGameStore((s) => s.game.turn.awaitingChoice)
  const hasResolution = useGameStore((s) => s.game.resolution !== null)
  const paused = useGameStore((s) => s.game.paused)
  const phase = useGameStore((s) => s.game.phase)
  const mayRollAgain = useGameStore((s) => s.game.turn.mayRollAgain)
  const animating = useTokenAnim((s) => s.animating) // re-roda quando o peão chega
  const dispatch = useGameStore((s) => s.dispatch)
  // Online, o auto-avanço é do cliente do ATOR (spec 038, research D5): sem este portão,
  // N clientes emitiriam o mesmo comando para o host descartar N-1 — não corrompe nada
  // (FR-007 protege), mas é tráfego e log inútil. Sem sala, `mayAct` é sempre true.
  const mayAct = useLocalView().mayAct('resolve-pending')

  useEffect(() => {
    // Estado e animação lidos AO VIVO (`getState`): dentro do efeito, o valor capturado
    // pelo render pode estar defasado — é o que segurava a resolução antes do peão chegar.
    const next = advancePolicy(useGameStore.getState().game, {
      animating: useTokenAnim.getState().animating,
      mayAct,
    })
    if (next) dispatch(next)
  }, [state, awaitingChoice, hasResolution, paused, phase, mayRollAgain, animating, mayAct, dispatch])

  return null
}
