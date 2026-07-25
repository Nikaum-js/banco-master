// FR-011 — gravação/replay do não-determinismo. O host grava rng/now consumidos ao aplicar um
// comando; o cliente reaplica o MESMO comando com esses valores e chega ao estado idêntico,
// sem tocar `Math.random`/`Date.now`.
import { describe, expect, it } from 'vitest'
import { applyCommand } from '@/game/commands'
import { buildGameCtx, buildInitialGame } from '@/game/ctx'
import { recordingCtx, replayCtx } from '@/net/recorder'
import { mulberry32 } from '../sim/engine/rng'

describe('recorder — determinismo host↔cliente (FR-011)', () => {
  it('replay do `roll` reproduz o estado exato do host sem RNG real', () => {
    const game = buildInitialGame(['p1', 'p2'], mulberry32(1))

    // Host: aplica com RNG real (seedada) gravando os valores consumidos.
    const { ctx: hostCtx, drain } = recordingCtx(buildGameCtx(mulberry32(123), () => 4_000))
    const hostNext = applyCommand(game, { kind: 'roll' }, hostCtx)
    const resolved = drain()
    expect(resolved.rng.length).toBeGreaterThan(0) // dados consumiram RNG

    // Cliente: RNG/relógio reais lançam se tocados — só o replay alimenta os valores.
    const clientCtx = replayCtx(
      buildGameCtx(() => { throw new Error('não deveria tocar RNG') }, () => { throw new Error('não deveria tocar relógio') }),
      resolved,
    )
    const clientNext = applyCommand(game, { kind: 'roll' }, clientCtx)

    expect(JSON.stringify(clientNext)).toBe(JSON.stringify(hostNext))
  })
})
