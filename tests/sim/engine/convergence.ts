/**
 * CONVERGÊNCIA HOST × CLIENTE dentro da simulação — o segundo furo estrutural do harness.
 *
 * O harness rodava **um** estado autoritativo. Nenhuma partida simulada passava pelo caminho de
 * produção do multiplayer (`recordingCtx` no host → `replayCtx` no cliente), e por construção
 * nenhum bug de divergência podia ser encontrado por ele: `tests/net/convergence.test.ts` cobria
 * o mecanismo com um roteiro curto e escrito à mão, não com 3.000 rodadas de jogo real.
 *
 * "As contas oscilam" (CARD 04) é a descrição exata do que uma divergência produz na tela: o
 * cliente mostra um valor, o estado autoritativo chega e corrige. Um harness que só roda a
 * autoridade não consegue nem formular a pergunta.
 *
 * Isto fecha essa lacuna: cada despacho é aplicado DUAS vezes — pelo host, com gravação do
 * não-determinismo, e por um cliente, com replay dos valores gravados — e os dois estados têm de
 * ser idênticos. Não é uma reimplementação do transporte: é o `applyCommand` do produto com os
 * dois `ctx` do produto.
 */
import { applyCommand } from '@/game/commands'
import { recordingCtx, replayCtx } from '@/net/recorder'
import type { GameState } from '@/game/turn/types'
import type { TurnCtx } from '@/game/turn/turnMachine'
import type { SimAction } from './types'
import type { Violation } from './invariants'

export interface ConvergenceStep {
  /** Estado do HOST depois do comando — é ele que a simulação segue usando. */
  host: GameState
  violations: Violation[]
}

/**
 * Aplica `action` como o host (gravando) e como um cliente (reproduzindo), e compara.
 *
 * O cliente parte do MESMO `prev` — que é o que a produção faz: cliente e host aplicam o mesmo
 * comando aceito sobre o mesmo estado anterior, e é a igualdade do resultado que sustenta a
 * ausência de reconciliação (`client.ts` é pessimista, não aplica nada antes da difusão).
 *
 * Divergência que o `replayCtx` detecta sozinho (underflow de rng/relógio/saque) chega aqui como
 * exceção, e ela também é uma violação — não deixamos escapar como falha de harness.
 */
export function stepWithConvergence(prev: GameState, action: SimAction, base: TurnCtx): ConvergenceStep {
  const { ctx, drain } = recordingCtx(base)
  const host = applyCommand(prev, action, ctx)
  const resolved = drain()

  let guest: GameState
  try {
    guest = applyCommand(prev, action, replayCtx(base, resolved))
  } catch (e) {
    return {
      host,
      violations: [{
        code: 'v',
        detail: `replay do cliente falhou em '${action.kind}': ${e instanceof Error ? e.message : String(e)}`,
      }],
    }
  }

  const violations: Violation[] = []

  // Caixa primeiro, e nomeado: é a divergência que o jogador VÊ, e a mensagem tem de dizer de
  // quem, não só "os estados diferem".
  for (const h of host.players) {
    const g = guest.players.find((p) => p.id === h.id)
    if (g && g.cash !== h.cash) {
      violations.push({
        code: 'v',
        detail: `divergência de caixa em '${action.kind}': ${h.id} host=${h.cash} cliente=${g.cash}`,
      })
    }
  }

  if (violations.length === 0) {
    const hostKey = JSON.stringify(host)
    const guestKey = JSON.stringify(guest)
    if (hostKey !== guestKey) {
      violations.push({ code: 'v', detail: `estado divergiu em '${action.kind}' sem diferença de caixa (${firstDiff(host, guest)})` })
    }
  }

  return { host, violations }
}

// Primeiro campo de topo que difere — a mensagem "os JSON diferem" não ajuda ninguém a depurar.
function firstDiff(a: GameState, b: GameState): string {
  for (const key of Object.keys(a) as (keyof GameState)[]) {
    if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) return `campo divergente: ${String(key)}`
  }
  return 'diferença fora dos campos de topo'
}
