// Gravação/replay do não-determinismo (spec 037, FR-011).
//
// Os reducers do motor consomem `ctx.rng()` (dados brancos + Fiscal/Tax Man) e `ctx.now()`
// (deadlines de leilão). Nada mais é não-determinístico: cartas saem de decks JÁ embaralhados
// (ordem determinística no `GameState`); o embaralho inicial acontece na criação da partida
// (snapshot), não num comando.
//
// O HOST aplica cada comando com um `recordingCtx`, que embrulha `rng`/`now` e GRAVA cada
// valor consumido, em ordem. O comando aceito difundido carrega esses valores (`Resolved`).
// Cada CLIENTE aplica o mesmo comando com um `replayCtx`, que devolve os valores gravados na
// ordem — sem jamais chamar `Math.random()`/`Date.now()`. Como o reducer é determinístico
// dado o estado e as saídas de `ctx`, host e clientes convergem exatamente.
import type { TurnCtx } from '@/game/turn/turnMachine'

export interface Resolved {
  rng: number[] // valores de `ctx.rng()` consumidos, em ordem
  now: number[] // valores de `ctx.now()` consumidos, em ordem
}

export const EMPTY_RESOLVED: Resolved = { rng: [], now: [] }

// Embrulha `base` gravando cada `rng()`/`now()` consumido. `drain()` devolve uma cópia dos
// valores gravados até então.
export function recordingCtx(base: TurnCtx): { ctx: TurnCtx; drain: () => Resolved } {
  const rng: number[] = []
  const now: number[] = []
  const baseNow = base.now ?? (() => 0)
  const ctx: TurnCtx = {
    ...base,
    rng: () => {
      const v = base.rng()
      rng.push(v)
      return v
    },
    now: () => {
      const v = baseNow()
      now.push(v)
      return v
    },
  }
  return { ctx, drain: () => ({ rng: rng.slice(), now: now.slice() }) }
}

// Embrulha `base` devolvendo os valores gravados na ordem. Underflow (mais consumo que o
// gravado) é bug de convergência — falha alto em vez de escorregar para o RNG real.
export function replayCtx(base: TurnCtx, resolved: Resolved): TurnCtx {
  const rng = [...resolved.rng]
  const now = [...resolved.now]
  return {
    ...base,
    rng: () => {
      if (rng.length === 0) throw new Error('replayCtx: RNG underflow — divergência host/cliente')
      return rng.shift()!
    },
    now: () => {
      if (now.length === 0) throw new Error('replayCtx: relógio underflow — divergência host/cliente')
      return now.shift()!
    },
  }
}
