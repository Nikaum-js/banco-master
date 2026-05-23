// Embaralhamento de deck — Fisher-Yates com RNG injetável (determinístico nos testes).
import type { RNG } from '../turn/dice'

export function shuffle(ids: string[], rng: RNG): string[] {
  const a = ids.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = a[i]
    a[i] = a[j]
    a[j] = tmp
  }
  return a
}
