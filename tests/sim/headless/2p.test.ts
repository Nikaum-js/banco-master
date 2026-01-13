// Lote padrão headless — 2 jogadores (036/FR-001/FR-008/FR-011). Parte da suíte normal:
// toda execução de `bun run test` paga este lote (shard de paralelismo — research.md D8).
import { describe, expect, it } from 'vitest'
import { runGame } from '../engine/runGame'
import { buildReport, formatReport } from '../engine/report'
import { writeReport } from '../engine/reportIO'

const PLAYER_COUNT = 2
// Tamanho do lote. 100 é o lote COMPLETO e continua sendo o default — é ele que dá confiança
// antes de release. `SIM_GAMES` reduz para o CI de cada push, onde 17 minutos de espera custa mais
// que a cauda de seeds que o lote grande cobre.
//
// O custo dessa redução é MEDIDO, não suposto: o falso positivo do invariante de não-truncagem
// (corrigido em `card-collect.due`) apareceu na seed **76 de 100**. Um lote de 30 não o teria
// pegado na primeira tentativa — teria pegado na terceira, num push seguinte. É esse o trade.
const GAMES = Number(process.env.SIM_GAMES) || 100
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
    600_000, // SC-002 pede <2min em condições normais; o teto é guarda contra trava, não
             // medida de desempenho. 180s reprovava um lote SADIO em runner compartilhado.
  )
})
