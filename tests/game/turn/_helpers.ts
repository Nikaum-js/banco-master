// Utilidades de teste: RNG determinístico e portas espiãs.
import { vi } from 'vitest'
import type { RNG } from '@/game/turn/dice'
import type { TurnPorts } from '@/game/turn/resolution'
import type { TurnCtx } from '@/game/turn/turnMachine'
import { THEME } from '@/game/theme'

// Cada valor v (1..6) é mapeado para o meio do "bucket" do dado: floor(rng*6)+1 === v.
// Para a face do Speed Die: idx = floor(rng*6) = v-1 → 1/2/3 = faces, 4/5 = mr-banco, 6 = ônibus.
export function rngFromDice(values: number[]): RNG {
  let i = 0
  return () => {
    const v = values[i % values.length]
    i += 1
    return (v - 0.5) / 6
  }
}

// Portas espiãs: substituem o balanceamento real por valores fixos para isolar o
// que a máquina de turno faz. Quem quer as portas do PRODUTO usa `buildPorts()` de
// `@/game/setup`.
export function mockPorts(): TurnPorts {
  return {
    onPassGo: vi.fn(() => 200),
    onPayToCenter: vi.fn(),
    onCollectCenter: vi.fn(() => 0),
    isEliminated: vi.fn(() => false),
  }
}

export interface CtxOptions {
  ports?: TurnPorts
  /**
   * Speed Die. Default = `THEME.SPEED_DIE_ENABLED` — a MESMA configuração que roda em
   * produção (hoje `false`, D-003). Antes o default era `true` por acidente: `ctxWith`
   * não definia o campo e `turnMachine` fazia `ctx.speedDie ?? true`, então a suíte
   * inteira exercitava um jogo de 3 dados que ninguém joga. Os testes do Speed Die
   * (preservados pela D-003) pedem `{ speedDie: true }` explicitamente.
   */
  speedDie?: boolean
}

export function ctxWith(values: number[], portsOrOpts?: TurnPorts | CtxOptions): TurnCtx {
  const opts: CtxOptions = portsOrOpts && 'onPassGo' in portsOrOpts ? { ports: portsOrOpts } : (portsOrOpts ?? {})
  return {
    rng: rngFromDice(values),
    ports: opts.ports ?? mockPorts(),
    speedDie: opts.speedDie ?? THEME.SPEED_DIE_ENABLED,
  }
}
