// Persistência do relatório em disco (036, extensão) — JSON completo (máquina) + Markdown
// resumido (humano) em reports/ (gitignorado, artefato gerado). Só usado por scripts/CLI e
// pelos shards headless; nunca importado por `src/`.
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { SimReport } from './types'
import { formatReportMarkdown } from './report'

export function writeReport(report: SimReport, basePath: string): { jsonPath: string; mdPath: string } {
  mkdirSync(dirname(basePath), { recursive: true })
  const jsonPath = `${basePath}.json`
  const mdPath = `${basePath}.md`
  writeFileSync(jsonPath, JSON.stringify(report, null, 2))
  writeFileSync(mdPath, formatReportMarkdown(report))
  return { jsonPath, mdPath }
}
