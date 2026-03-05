// Lote padrão headless — 2 jogadores (036/FR-001/FR-008/FR-011). Parte da suíte normal:
// toda execução de `bun run test` paga este lote (shard de paralelismo — research.md D8).
import { describe, expect, it } from 'vitest'
import { runGame } from '../engine/runGame'
import { buildReport, formatReport } from '../engine/report'
import { writeReport } from '../engine/reportIO'
import { reportPath, resolveBatch } from '../engine/batch'

const PLAYER_COUNT = 2
const BASE_SEED = 2026070502 // seed-base fixa: reprodutível partida a partida (FR-003)

// Tamanho do lote e fatia deste processo. 100 é o lote COMPLETO e continua sendo o default —
// é ele que dá confiança antes de release. `SIM_GAMES` reduz para o CI de cada push, onde a
// espera custa mais que a cauda de seeds que o lote grande cobre; `SIM_SHARD` divide o lote
// entre runners sem mexer em quais seeds o conjunto cobre (ver `../engine/batch.ts`).
//
// O custo da REDUÇÃO é MEDIDO, não suposto: o falso positivo do invariante de não-truncagem
// (corrigido em `card-collect.due`) apareceu na seed **76 de 100**. Um lote de 30 não o teria
// pegado na primeira tentativa — teria pegado na terceira, num push seguinte. É esse o trade.
// O SHARD não tem esse custo: as seeds continuam todas cobertas, em três runners.
const batch = resolveBatch(BASE_SEED)

describe('simulação headless — 2 jogadores', () => {
  it(
    `roda ${batch.label} sem falha`,
    () => {
      const t0 = Date.now()
      const results = batch.seeds.map((seed) => runGame(seed, PLAYER_COUNT))
      const report = buildReport(results, Date.now() - t0)
      writeReport(report, reportPath('reports/headless-2p')) // inspecionável depois de `bun run test`, sem rodar sim:batch à parte
      expect(report.failed, formatReport(report)).toBe(0)
    },
    batch.timeoutMs,
  )
})
