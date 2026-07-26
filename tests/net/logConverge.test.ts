// SC-007 (040) — GameState.log é idêntico BYTE A BYTE entre host e clientes, mesmo com o
// evento agora tipado por `kind` (campos aninhados, arrays como `white`, literais como
// `origin`). Comparar o LOG especificamente, não a frase renderizada: a frase depende da
// `Room` de cada cliente (identidade/nome), e isso é o DESENHO — divergiria por motivo
// certo e daria falso-negativo se comparássemos texto (Complexity Tracking do plan).
import { describe, expect, it } from 'vitest'
import { enumerateActions } from '../sim/engine/actions'
import { pickAction } from '../sim/engine/agent'
import type { SimSession } from '../sim/engine/driver'
import { mulberry32 } from '../sim/engine/rng'
import type { PlayerAction } from '@/game/commands'
import { setupGame, settleAuctions, clientOf, type NetGame } from './harness'

function logsOf(net: NetGame): unknown[][] {
  const clientLogs = net.players.map((p) => p.client.game()?.log ?? [])
  return [net.host.game().log, ...clientLogs]
}

function assertLogsConverged(net: NetGame): void {
  const logs = logsOf(net)
  const ref = JSON.stringify(logs[0])
  for (let i = 1; i < logs.length; i++) {
    expect(JSON.stringify(logs[i]), `log do cliente ${i} divergiu do host`).toBe(ref)
  }
}

describe('GameState.log converge byte a byte entre 3 clientes (SC-007)', () => {
  it('log idêntico após uma sequência longa e variada de comandos', async () => {
    const net = await setupGame(3, 20260726)
    const pickRng = mulberry32(20260726 * 7 + 13)
    assertLogsConverged(net) // estado inicial (log vazio) já idêntico

    let applied = 0
    for (let s = 0; s < 400 && net.host.game().phase !== 'ended'; s++) {
      settleAuctions(net)
      if (net.host.game().phase === 'ended') break
      const points = enumerateActions({ game: net.host.game() } as unknown as SimSession)
      if (points.length === 0) break
      const { actorId, action } = pickAction(pickRng, points)
      clientOf(net, actorId).send(action as PlayerAction)
      assertLogsConverged(net) // difusão síncrona: já convergido ao retornar do send
      applied++
    }
    expect(applied).toBeGreaterThan(50) // exercitou comandos o bastante para o log crescer de verdade
    expect(net.host.game().log.length).toBeGreaterThan(0)
  })
})
