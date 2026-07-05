// Monta o SimReport (FR-008) a partir de uma lista de SimResult — reusado pelos shards
// headless e pelo script sim-batch.
import type { SimResult, SimReport } from './types'

export function buildReport(results: SimResult[], durationMs: number): SimReport {
  const roundsHistogram: Record<number, number> = {}
  for (const r of results) {
    if (r.outcome === 'ok') roundsHistogram[r.rounds] = (roundsHistogram[r.rounds] ?? 0) + 1
  }
  return {
    total: results.length,
    ok: results.filter((r) => r.outcome === 'ok').length,
    failed: results.filter((r) => r.outcome === 'fail').length,
    durationMs,
    roundsHistogram,
    failures: results.filter((r): r is SimResult & { failure: NonNullable<SimResult['failure']> } => !!r.failure).map((r) => r.failure),
  }
}

export function formatReport(report: SimReport): string {
  const lines = [`total=${report.total} ok=${report.ok} failed=${report.failed} durationMs=${Math.round(report.durationMs)}`]
  for (const f of report.failures.slice(0, 5)) {
    lines.push(`  FAIL seed=${f.seed} players=${f.playerCount} round=${f.round} reason=${f.reason} action=${JSON.stringify(f.action)} detail=${f.detail}`)
  }
  if (report.failures.length > 5) lines.push(`  ...e mais ${report.failures.length - 5} falha(s)`)
  return lines.join('\n')
}
