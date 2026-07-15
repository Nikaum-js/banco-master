// Monta o SimReport (FR-008) a partir de uma lista de SimResult — reusado pelos shards
// headless e pelo script sim-batch.
import type { SimResult, SimReport } from './types'
import { KNOWN_MECHANISMS } from './conservation'

export function buildReport(results: SimResult[], durationMs: number): SimReport {
  const roundsHistogram: Record<number, number> = {}
  const coverage: Record<string, number> = {}
  for (const r of results) {
    if (r.outcome === 'ok') roundsHistogram[r.rounds] = (roundsHistogram[r.rounds] ?? 0) + 1
    for (const [mech, count] of Object.entries(r.coverage)) coverage[mech] = (coverage[mech] ?? 0) + count
  }
  return {
    total: results.length,
    ok: results.filter((r) => r.outcome === 'ok').length,
    failed: results.filter((r) => r.outcome === 'fail').length,
    durationMs,
    roundsHistogram,
    coverage,
    failures: results.filter((r): r is SimResult & { failure: NonNullable<SimResult['failure']> } => !!r.failure).map((r) => r.failure),
  }
}

// Mecanismos do catálogo (conservation.ts) que ficaram em ZERO ocorrências neste lote — sinal
// de gap real de cobertura (o fuzzer não visitou esse mecanismo nenhuma vez), não suposição.
export function coverageGaps(report: SimReport): string[] {
  return KNOWN_MECHANISMS.filter((m) => !report.coverage[m])
}

export function formatReport(report: SimReport): string {
  const lines = [`total=${report.total} ok=${report.ok} failed=${report.failed} durationMs=${Math.round(report.durationMs)}`]
  for (const f of report.failures.slice(0, 5)) {
    lines.push(`  FAIL seed=${f.seed} players=${f.playerCount} round=${f.round} reason=${f.reason} action=${JSON.stringify(f.action)} detail=${f.detail}`)
  }
  if (report.failures.length > 5) lines.push(`  ...e mais ${report.failures.length - 5} falha(s)`)

  lines.push('cobertura de mecanismos (ocorrências no lote):')
  for (const [mech, count] of Object.entries(report.coverage).sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(`  ${mech}: ${count}`)
  }
  const gaps = coverageGaps(report)
  if (gaps.length > 0) lines.push(`  ZERO ocorrências (gap de cobertura): ${gaps.join(', ')}`)

  return lines.join('\n')
}

// Markdown legível — mesmo conteúdo de formatReport, tabela em vez de texto plano.
export function formatReportMarkdown(report: SimReport): string {
  const lines = [
    '# Relatório de simulação (036)',
    '',
    `- total: ${report.total}`,
    `- ok: ${report.ok}`,
    `- failed: ${report.failed}`,
    `- duração: ${Math.round(report.durationMs)}ms`,
    '',
  ]
  if (report.failures.length > 0) {
    lines.push('## Falhas', '', '| seed | jogadores | rodada | motivo | detalhe |', '|---|---|---|---|---|')
    for (const f of report.failures) {
      lines.push(`| ${f.seed} | ${f.playerCount} | ${f.round} | ${f.reason} | ${f.detail.replace(/\|/g, '\\|')} |`)
    }
    lines.push('')
  }
  lines.push('## Cobertura de mecanismos', '', '| mecanismo | ocorrências |', '|---|---|')
  for (const [mech, count] of Object.entries(report.coverage).sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(`| ${mech} | ${count} |`)
  }
  const gaps = coverageGaps(report)
  if (gaps.length > 0) {
    lines.push('', `**Gap de cobertura (0 ocorrências):** ${gaps.map((g) => `\`${g}\``).join(', ')}`)
  }
  return lines.join('\n')
}
