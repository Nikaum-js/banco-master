// Rolagem de dados — pura, com RNG injetável (determinismo nos testes).
import type { Roll, SpeedFace, SpecialMove } from './types'

export type RNG = () => number // [0, 1)

export function rollDie(rng: RNG): number {
  return Math.floor(rng() * 6) + 1
}

export interface RollOptions {
  speedDie: boolean // ativo após a 1ª volta (FR-005)
}

// Speed Die — 6 faces: 1/2/3 (3 faces), Mr. Banco Master (2 faces), Ônibus (1 face). SRS §13.2.
function rollSpeedFace(rng: RNG): SpeedFace {
  const idx = Math.floor(rng() * 6) // 0..5
  if (idx <= 2) return (idx + 1) as SpeedFace // 1, 2, 3
  if (idx <= 4) return 'mr-banco'
  return 'onibus'
}

export function roll(rng: RNG, opts: RollOptions): Roll {
  const white: [number, number] = [rollDie(rng), rollDie(rng)]
  const isDouble = white[0] === white[1] // só os brancos (FR-014)
  let move = white[0] + white[1]
  let speed: SpeedFace | null = null
  let special: SpecialMove = null

  if (opts.speedDie) {
    speed = rollSpeedFace(rng)
    if (typeof speed === 'number') {
      move += speed
      // Triple = os três dados iguais (só possível com face numérica igual aos brancos).
      if (isDouble && white[0] === speed) special = 'triple'
    } else {
      special = speed // 'mr-banco' | 'onibus'
    }
  }

  return { white, speed, isDouble, move, special }
}
