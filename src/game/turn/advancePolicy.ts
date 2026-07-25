// POLÍTICA DE AUTO-AVANÇO do turno (022.1) — "o que o jogo faz sozinho, e quando".
//
// Card 2 do review de arquitetura (2026-07-25): isto era um `useEffect` dentro de
// `src/game/ui/GameDriver.tsx`. Regra de turno morando num componente React tem três
// custos: o host autoritativo não consegue avançar uma partida sem um browser, a
// simulação teve que re-derivar a mesma decisão, e nada disso é testável num ambiente
// `node` (que é o único que este projeto tem).
//
// Pura: recebe o estado e os PORTÕES do chamador, devolve o próximo comando automático
// ou `null`. Não conhece React, Zustand nem transporte.
import type { GameState } from './types'
import type { GameAction } from '../commands'

export interface AdvanceGates {
  /**
   * O peão ainda está andando casa a casa. A UI segura a resolução até ele chegar —
   * senão o modal de compra abre no meio da caminhada. Chamadores headless (host,
   * simulação) não têm animação e deixam `false`.
   */
  animating?: boolean
  /**
   * A vez é deste dispositivo. Online, o auto-avanço é do cliente do ATOR (spec 038,
   * research D5): sem este portão, N clientes emitiriam o mesmo comando para o host
   * descartar N-1. Não protege nada — o FR-007 protege —, só evita tráfego inútil.
   */
  mayAct?: boolean
}

/**
 * Próximo comando que o jogo emite por conta própria, ou `null` quando cabe ao jogador
 * decidir. Só PAUSA em decisão real: modal central (compra/leilão/descarte/atalho),
 * prompt do HUD (dívida/prisão/reação) ou escolha de Speed Die (triple/ônibus).
 *
 * Não inventa regra: os dois comandos que devolve já existiam e já são validados pelos
 * reducers. Se a política errar, o comando é no-op (FR-009).
 */
export function advancePolicy(game: GameState, gates: AdvanceGates = {}): GameAction | null {
  const { animating = false, mayAct = true } = gates

  if (game.paused || game.phase !== 'playing') return null
  if (!mayAct) return null // a vez é de outro dispositivo — ele conduz o próprio turno

  const turn = game.turn

  // Resolve a casa sozinho — a menos que haja escolha de Speed Die pendente
  // (triple/ônibus), um modal/decisão aberto (leilão/descarte/atalho/dívida) ou a
  // compra inline pendente.
  if (turn.state === 'casa-a-resolver' && turn.awaitingChoice === null && game.resolution === null) {
    if (animating) return null // espera o peão terminar de andar
    return { kind: 'resolve-pending' }
  }

  // DUPLA: re-rola sozinho (`finalize` devolve a rolagem ao MESMO jogador) — sem clique
  // redundante. Passar a vez (não-dupla) segue MANUAL via "Finalizar turno" (D-015).
  if (turn.state === 'aguardando-finalizacao' && turn.mayRollAgain) {
    return { kind: 'finalize' }
  }

  return null
}
