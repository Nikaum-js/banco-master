// RNG determinística seedada (036/D3) — mesmo tipo `RNG = () => number` do motor
// (src/game/turn/dice.ts), para poder alimentar diretamente `ctx.rng`. mulberry32:
// gerador de 32 bits, período longo o bastante p/ uma partida, sem dependência nova.
import type { RNG } from '@/game/turn/dice'

export function mulberry32(seed: number): RNG {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
