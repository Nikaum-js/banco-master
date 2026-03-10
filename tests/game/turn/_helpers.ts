// Utilidades de teste: RNG determinístico e portas espiãs.
import { vi } from 'vitest'
import type { RNG } from '@/game/turn/dice'
import type { TurnPorts } from '@/game/turn/resolution'
import type { TurnCtx } from '@/game/turn/turnMachine'

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

export function mockPorts(): TurnPorts {
  return {
    onPassGo: vi.fn(() => 200),
    onPayToCenter: vi.fn(),
    onCollectCenter: vi.fn(() => 0),
    isEliminated: vi.fn(() => false),
  }
}

export function ctxWith(values: number[], ports?: TurnPorts): TurnCtx {
  return { rng: rngFromDice(values), ports: ports ?? mockPorts() }
}
