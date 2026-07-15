// Lote padrão headless — 3 jogadores (036/FR-001/FR-008/FR-011).
import { describe, expect, it } from 'vitest'
import { runGame } from '../engine/runGame'
import { buildReport, formatReport } from '../engine/report'
import { writeReport } from '../engine/reportIO'

const PLAYER_COUNT = 3
const GAMES = 100
const BASE_SEED = 2026070503

describe('simulação headless — 3 jogadores', () => {
  it(
    `roda ${GAMES} partidas sem falha`,
    () => {
      const t0 = Date.now()
      const results = Array.from({ length: GAMES }, (_, i) => runGame(BASE_SEED + i, PLAYER_COUNT))
      const report = buildReport(results, Date.now() - t0)
      writeReport(report, 'reports/headless-3p')
      expect(report.failed, formatReport(report)).toBe(0)
    },
    180_000, // margem sobre SC-002 (<2min em condições normais) p/ máquina sob carga
  )
})
