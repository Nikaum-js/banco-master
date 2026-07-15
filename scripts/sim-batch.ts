// Lote configurável, maior que o padrão da suíte (036/FR-008, execuções noturnas).
// Uso: bun run sim:batch -- --games=1000 [--counts=2,3,6] [--base-seed=20260705] [--rounds=1500]
import { runGame } from '../tests/sim/engine/runGame'
import { buildReport, formatReport } from '../tests/sim/engine/report'
import { writeReport } from '../tests/sim/engine/reportIO'

function argNumber(name: string, fallback: number): number {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`))
  return arg ? Number(arg.slice(name.length + 3)) : fallback
}

function argList(name: string, fallback: number[]): number[] {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`))
  if (!arg) return fallback
  return arg
    .slice(name.length + 3)
    .split(',')
    .map(Number)
}

function argString(name: string, fallback?: string): string | undefined {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`))
  return arg ? arg.slice(name.length + 3) : fallback
}

const games = argNumber('games', 100)
const counts = argList('counts', [2, 3, 6])
const baseSeed = argNumber('base-seed', 20260705)
const roundCap = argNumber('rounds', 1500)
const reportPath = argString('report', `reports/sim-batch-${baseSeed}`)

const t0 = Date.now()
const results = counts.flatMap((playerCount) =>
  Array.from({ length: games }, (_, i) => runGame(baseSeed + playerCount * 100000 + i, playerCount, roundCap)),
)
const report = buildReport(results, Date.now() - t0)
console.log(formatReport(report))
if (reportPath) {
  const { jsonPath, mdPath } = writeReport(report, reportPath)
  console.log(`relatório escrito em ${jsonPath} e ${mdPath}`)
}
process.exit(report.failed === 0 ? 0 : 1)
