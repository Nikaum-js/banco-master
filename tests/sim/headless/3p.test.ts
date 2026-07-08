// Lote padrão headless — 3 jogadores (036/FR-001/FR-008/FR-011).
import { describe, expect, it } from 'vitest'
import { runGame } from '../engine/runGame'
import { buildReport, formatReport } from '../engine/report'

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
      expect(report.failed, formatReport(report)).toBe(0)
    },
    110_000, // SC-002: lote completo (3 shards em paralelo) < 2 min
  )
})
