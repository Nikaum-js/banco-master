// Reexecuta 1 partida por seed explícita, para depuração (036/FR-009).
// Uso: bun run sim:replay -- --seed=482913 --players=3 [--rounds=1500]
import { runGame } from '../tests/sim/engine/runGame'

function argNumber(name: string, fallback?: number): number | undefined {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`))
  if (!arg) return fallback
  return Number(arg.slice(name.length + 3))
}

const seed = argNumber('seed')
const players = argNumber('players')
const roundCap = argNumber('rounds', 1500)!

if (seed === undefined || players === undefined || ![2, 3, 6].includes(players)) {
  console.error('Uso: bun run sim:replay -- --seed=<n> --players=<2|3|6> [--rounds=<n>]')
  process.exit(1)
}

const result = runGame(seed, players, roundCap)
console.log(JSON.stringify(result, null, 2))
process.exit(result.outcome === 'ok' ? 0 : 1)
