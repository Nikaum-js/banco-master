// US1 / SC-001 — dois+ clientes convergem sobre a MESMA partida. Dirige uma partida em rede
// com o agente aleatório do harness 036 (`enumerateActions`/`pickAction`): a cada ação, o
// remetente legítimo envia o comando; o host valida/aplica/difunde; e TODAS as visões (host +
// clientes) devem ficar byte-a-byte idênticas após cada difusão.
import { describe, expect, it } from 'vitest'
import { enumerateActions } from '../sim/engine/actions'
import { pickAction } from '../sim/engine/agent'
import type { SimSession } from '../sim/engine/driver'
import { mulberry32 } from '../sim/engine/rng'
import type { PlayerAction } from '@/game/commands'
import { setupGame, settleAuctions, clientOf, type NetGame } from './harness'

function assertConverged(net: NetGame): void {
  const views = net.serialized()
  const ref = views[0]
  for (let i = 1; i < views.length; i++) {
    // Comparação do GameState serializado (SC-001): idêntico entre host e cada cliente.
    expect(views[i], `visão ${i} divergiu do host`).toBe(ref)
  }
}

async function playConverging(playerCount: number, seed: number, steps: number): Promise<number> {
  const net = await setupGame(playerCount, seed)
  const pickRng = mulberry32(seed * 7 + 13)
  assertConverged(net) // estado inicial já idêntico
  let applied = 0

  for (let s = 0; s < steps && net.host.game().phase !== 'ended'; s++) {
    settleAuctions(net)
    if (net.host.game().phase === 'ended') break
    const points = enumerateActions({ game: net.host.game() } as unknown as SimSession)
    if (points.length === 0) break
    const { actorId, action } = pickAction(pickRng, points)
    clientOf(net, actorId).send(action as PlayerAction)
    assertConverged(net) // difusão síncrona: já convergido ao retornar do send
    applied++
  }
  return applied
}

describe('convergência host↔clientes (SC-001)', () => {
  it('2 jogadores convergem por uma sequência longa e variada', async () => {
    const applied = await playConverging(2, 20260724, 400)
    expect(applied).toBeGreaterThan(50) // exercitou muitos comandos, não parou de cara
  })

  it('3 jogadores convergem', async () => {
    const applied = await playConverging(3, 424242, 400)
    expect(applied).toBeGreaterThan(50)
  })

  it('8 jogadores convergem (sala cheia)', async () => {
    const applied = await playConverging(8, 987654, 400)
    expect(applied).toBeGreaterThan(50)
  })
})
