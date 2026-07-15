// Lote padrão headless — 2 jogadores (036/FR-001/FR-008/FR-011). Parte da suíte normal:
// toda execução de `bun run test` paga este lote (shard de paralelismo — research.md D8).
import { describe, expect, it } from 'vitest'
import { runGame } from '../engine/runGame'
import { buildReport, formatReport } from '../engine/report'
import { writeReport } from '../engine/reportIO'

const PLAYER_COUNT = 2
const GAMES = 100
const BASE_SEED = 2026070502 // seed-base fixa: reprodutível partida a partida (FR-003)

describe('simulação headless — 2 jogadores', () => {
  it(
    `roda ${GAMES} partidas sem falha`,
    () => {
      const t0 = Date.now()
      const results = Array.from({ length: GAMES }, (_, i) => runGame(BASE_SEED + i, PLAYER_COUNT))
      const report = buildReport(results, Date.now() - t0)
      writeReport(report, 'reports/headless-2p') // inspecionável depois de `bun run test`, sem rodar sim:batch à parte
      expect(report.failed, formatReport(report)).toBe(0)
    },
    180_000, // margem sobre SC-002 (<2min em condições normais) p/ máquina sob carga
  )
})
