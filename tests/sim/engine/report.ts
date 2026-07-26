// Monta o SimReport (FR-008) a partir de uma lista de SimResult — reusado pelos shards
// headless e pelo script sim-batch.
import type { SimResult, SimReport, WealthCurvePoint } from './types'
import { KNOWN_MECHANISMS } from './conservation'
import { gini, leaderIndex, leaderShare, sampleAtDecile } from './wealth'

const DECILES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

// Marcador de que o espólio (039/D-031) rodou nesta partida: falência devendo AO BANCO é o
// único gatilho, e é exatamente o que este mecanismo conta.
const ESTATE_MECHANISM = 'declare-bankruptcy-sink'

export function hadEstateAuction(r: SimResult): boolean {
  return (r.coverage[ESTATE_MECHANISM] ?? 0) > 0
}

/**
 * Curva média de patrimônio de um conjunto de partidas, em decis de progresso.
 *
 * Só partidas `ok` entram: uma partida que estourou o teto de rodadas não tem fim de jogo, e é
 * justamente o fim que a curva quer descrever. Decil sem nenhuma amostra sai com `games: 0` em
 * vez de zero disfarçado de medição.
 */
export function buildWealthCurve(results: SimResult[]): WealthCurvePoint[] {
  const usable = results.filter((r) => r.outcome === 'ok' && r.wealth.length > 0)
  return DECILES.map((decile) => {
    let games = 0
    let giniSum = 0
    let shareSum = 0
    let leaderWins = 0
    for (const r of usable) {
      const s = sampleAtDecile(r.wealth, decile)
      if (!s) continue
      games++
      giniSum += gini(s.netWorth)
      shareSum += leaderShare(s.netWorth)
      const li = leaderIndex(s.netWorth)
      // `netWorth` segue a ordem de `game.players`, que é p1..pN — o mesmo id do `winnerId`.
      if (li >= 0 && r.winnerId === `p${li + 1}`) leaderWins++
    }
    return {
      decile,
      games,
      gini: games > 0 ? giniSum / games : 0,
      leaderShare: games > 0 ? shareSum / games : 0,
      leaderWinRate: games > 0 ? leaderWins / games : 0,
    }
  })
}

export function buildReport(results: SimResult[], durationMs: number): SimReport {
  const roundsHistogram: Record<number, number> = {}
  const coverage: Record<string, number> = {}
  const winnersBySeat: Record<string, number> = {}
  for (const r of results) {
    if (r.outcome === 'ok') roundsHistogram[r.rounds] = (roundsHistogram[r.rounds] ?? 0) + 1
    if (r.winnerId) winnersBySeat[r.winnerId] = (winnersBySeat[r.winnerId] ?? 0) + 1
    for (const [mech, count] of Object.entries(r.coverage)) coverage[mech] = (coverage[mech] ?? 0) + count
  }
  return {
    total: results.length,
    ok: results.filter((r) => r.outcome === 'ok').length,
    failed: results.filter((r) => r.outcome === 'fail').length,
    durationMs,
    roundsHistogram,
    coverage,
    winnersBySeat,
    wealthCurve: buildWealthCurve(results),
    wealthCurveWithEstate: buildWealthCurve(results.filter(hadEstateAuction)),
    wealthCurveWithoutEstate: buildWealthCurve(results.filter((r) => !hadEstateAuction(r))),
    failures: results.filter((r): r is SimResult & { failure: NonNullable<SimResult['failure']> } => !!r.failure).map((r) => r.failure),
  }
}

// Mecanismos do catálogo (conservation.ts) que ficaram em ZERO ocorrências neste lote — sinal
// de gap real de cobertura (o fuzzer não visitou esse mecanismo nenhuma vez), não suposição.
export function coverageGaps(report: SimReport): string[] {
  return KNOWN_MECHANISMS.filter((m) => !report.coverage[m])
}

// LEIA ASSIM: a amostragem é por rodada FECHADA, e a partida termina no meio da rodada final
// (a última eliminação encerra o laço antes do fecho). Então o decil 10 é a última rodada
// COMPLETA — não o estado de vitória, que seria fatia 1,00 trivial (um sobrevivente, eliminados
// com patrimônio 0). É por isso que a fatia no decil 10 aparece bem abaixo de 1: ela ainda
// descreve uma mesa com jogadores vivos, que é o que interessa medir.
function curveLines(curve: WealthCurvePoint[], label: string): string[] {
  const lines = [`${label}:`, '  decil  partidas  gini  fatia-do-líder  líder-venceu']
  for (const p of curve) {
    if (p.games === 0) {
      lines.push(`  ${String(p.decile).padStart(5)}         0     —               —             —`)
      continue
    }
    lines.push(
      `  ${String(p.decile).padStart(5)}  ${String(p.games).padStart(8)}  ${p.gini.toFixed(2)}  ${p.leaderShare.toFixed(2).padStart(14)}  ${(p.leaderWinRate * 100).toFixed(0).padStart(11)}%`,
    )
  }
  return lines
}

export function formatReport(report: SimReport): string {
  const lines = [`total=${report.total} ok=${report.ok} failed=${report.failed} durationMs=${Math.round(report.durationMs)}`]
  for (const f of report.failures.slice(0, 5)) {
    lines.push(`  FAIL seed=${f.seed} players=${f.playerCount} round=${f.round} reason=${f.reason} action=${JSON.stringify(f.action)} detail=${f.detail}`)
  }
  if (report.failures.length > 5) lines.push(`  ...e mais ${report.failures.length - 5} falha(s)`)

  const seats = Object.entries(report.winnersBySeat).sort(([a], [b]) => a.localeCompare(b))
  if (seats.length > 0) lines.push(`vitórias por assento: ${seats.map(([s, n]) => `${s}=${n}`).join(' ')}`)

  lines.push(...curveLines(report.wealthCurve, 'curva de patrimônio (lote inteiro)'))
  const withEstate = report.wealthCurveWithEstate[0]?.games ?? 0
  const withoutEstate = report.wealthCurveWithoutEstate[0]?.games ?? 0
  if (withEstate > 0 && withoutEstate > 0) {
    lines.push(...curveLines(report.wealthCurveWithEstate, `curva COM espólio (${withEstate} partidas)`))
    lines.push(...curveLines(report.wealthCurveWithoutEstate, `curva SEM espólio (${withoutEstate} partidas)`))
  } else {
    lines.push(`separação por espólio indisponível: ${withEstate} partida(s) com espólio, ${withoutEstate} sem — precisa das duas.`)
  }

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
  const seats = Object.entries(report.winnersBySeat).sort(([a], [b]) => a.localeCompare(b))
  if (seats.length > 0) {
    lines.push('## Vitórias por assento', '', '| assento | vitórias |', '|---|---|')
    for (const [seat, n] of seats) lines.push(`| ${seat} | ${n} |`)
    lines.push('')
  }

  lines.push(
    '## Curva de patrimônio',
    '',
    'Decis de **progresso** da partida (1 = começo, 10 = fim), média das partidas `ok`.',
    'Amostra por rodada FECHADA: o decil 10 é a última rodada completa, não o estado de vitória',
    '(que seria fatia 1,00 trivial, com um sobrevivente e eliminados em patrimônio 0).',
    '',
  )
  const curves: [string, WealthCurvePoint[]][] = [['lote inteiro', report.wealthCurve]]
  if ((report.wealthCurveWithEstate[0]?.games ?? 0) > 0 && (report.wealthCurveWithoutEstate[0]?.games ?? 0) > 0) {
    curves.push(['com espólio (039)', report.wealthCurveWithEstate], ['sem espólio', report.wealthCurveWithoutEstate])
  }
  for (const [label, curve] of curves) {
    lines.push(`### ${label}`, '', '| decil | partidas | gini | fatia do líder | líder venceu |', '|---|---|---|---|---|')
    for (const p of curve) {
      if (p.games === 0) {
        lines.push(`| ${p.decile} | 0 | — | — | — |`)
        continue
      }
      lines.push(`| ${p.decile} | ${p.games} | ${p.gini.toFixed(2)} | ${p.leaderShare.toFixed(2)} | ${(p.leaderWinRate * 100).toFixed(0)}% |`)
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
