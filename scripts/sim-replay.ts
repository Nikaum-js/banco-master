// Reexecuta 1 partida por seed explícita, para depuração (036/FR-009).
// Uso: bun run sim:replay -- --seed=482913 --players=3 [--rounds=1500]
import { runGame } from '../tests/sim/engine/runGame'
import { buildReport } from '../tests/sim/engine/report'
import { writeReport } from '../tests/sim/engine/reportIO'

function argNumber(name: string, fallback?: number): number | undefined {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`))
  if (!arg) return fallback
  return Number(arg.slice(name.length + 3))
}

function argString(name: string, fallback?: string): string | undefined {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`))
  return arg ? arg.slice(name.length + 3) : fallback
}

const seed = argNumber('seed')
const players = argNumber('players')
const roundCap = argNumber('rounds', 1500)!
const reportPath = argString('report', seed !== undefined ? `reports/sim-replay-${seed}` : undefined)

if (seed === undefined || players === undefined || ![2, 3, 6].includes(players)) {
  console.error('Uso: bun run sim:replay -- --seed=<n> --players=<2|3|6> [--rounds=<n>] [--report=<path>]')
  process.exit(1)
}

const result = runGame(seed, players, roundCap)
console.log(JSON.stringify(result, null, 2))
if (reportPath) {
  const { jsonPath, mdPath } = writeReport(buildReport([result], result.durationMs), reportPath)
  console.log(`relatório escrito em ${jsonPath} e ${mdPath}`)
}
process.exit(result.outcome === 'ok' ? 0 : 1)
