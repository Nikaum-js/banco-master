// Lote padrão headless — 6 jogadores (036/FR-001/FR-008/FR-011).
import { describe, expect, it } from 'vitest'
import { runGame } from '../engine/runGame'
import { buildReport, formatReport } from '../engine/report'
import { writeReport } from '../engine/reportIO'

const PLAYER_COUNT = 6
// Tamanho do lote. 100 é o lote COMPLETO e continua sendo o default — é ele que dá confiança
// antes de release. `SIM_GAMES` reduz para o CI de cada push, onde 17 minutos de espera custa mais
// que a cauda de seeds que o lote grande cobre.
//
// O custo dessa redução é MEDIDO, não suposto: o falso positivo do invariante de não-truncagem
// (corrigido em `card-collect.due`) apareceu na seed **76 de 100**. Um lote de 30 não o teria
// pegado na primeira tentativa — teria pegado na terceira, num push seguinte. É esse o trade.
const GAMES = Number(process.env.SIM_GAMES) || 100
const BASE_SEED = 2026070506

describe('simulação headless — 6 jogadores', () => {
  it(
    `roda ${GAMES} partidas sem falha`,
    () => {
      const t0 = Date.now()
      const results = Array.from({ length: GAMES }, (_, i) => runGame(BASE_SEED + i, PLAYER_COUNT))
      const report = buildReport(results, Date.now() - t0)
      writeReport(report, 'reports/headless-6p')
      expect(report.failed, formatReport(report)).toBe(0)
    },
    // Teto PROPORCIONAL ao lote, não fixo. É guarda contra trava, nunca medida de desempenho
    // (SC-002 pede <2min em condições normais; 180s reprovava um lote SADIO em runner
    // compartilhado). Os 600_000 fixos vinham de quando o CI só rodava `SIM_GAMES=30`: o lote
    // COMPLETO de 6 jogadores mede ~1.182.000ms num runner, então o caminho `full_simulation`
    // e o schedule noturno reprovavam por relógio, sempre, sem nada de errado com o motor.
    Math.max(600_000, GAMES * 15_000),
  )
})
