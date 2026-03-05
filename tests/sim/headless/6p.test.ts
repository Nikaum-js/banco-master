// Lote padrão headless — 6 jogadores (036/FR-001/FR-008/FR-011).
//
// Este é o lote CARO: ~11,8s por partida em runner compartilhado, contra frações disso nas
// outras contagens. Era ele, sozinho, o caminho crítico do CI inteiro — daí o `SIM_SHARD`.
import { describe, expect, it } from 'vitest'
import { runGame } from '../engine/runGame'
import { buildReport, formatReport } from '../engine/report'
import { writeReport } from '../engine/reportIO'
import { reportPath, resolveBatch } from '../engine/batch'

const PLAYER_COUNT = 6
const BASE_SEED = 2026070506

// Mesmo contrato do lote de 2 jogadores: `SIM_GAMES` é o lote completo, `SIM_SHARD` é a
// fatia deste runner. O porquê de cada um está em `../engine/batch.ts`.
const batch = resolveBatch(BASE_SEED)

describe('simulação headless — 6 jogadores', () => {
  it(
    `roda ${batch.label} sem falha`,
    () => {
      const t0 = Date.now()
      const results = batch.seeds.map((seed) => runGame(seed, PLAYER_COUNT))
      const report = buildReport(results, Date.now() - t0)
      writeReport(report, reportPath('reports/headless-6p'))
      expect(report.failed, formatReport(report)).toBe(0)
    },
    batch.timeoutMs,
  )
})
