// Matemática da curva de patrimônio (item 3 do backlog). O Gini é conferido contra um ORÁCULO
// INDEPENDENTE — a fórmula por ranks, derivação diferente da soma de diferenças absolutas usada
// na implementação. Duas fórmulas concordando é evidência; uma fórmula concordando consigo mesma
// não é (mesma disciplina dos testes de conservação da 036).
import { describe, expect, it } from 'vitest'
import { gini, leaderIndex, leaderShare, sampleAtDecile, sampleWealth, type WealthSample } from './wealth'
import { buildReport, buildWealthCurve, hadEstateAuction } from './report'
import { runGame } from './runGame'
import { createSeedState } from '@/game/setup'
import type { SimResult } from './types'

/**
 * Oráculo do Gini pela fórmula de ranks:  G = (2·Σ i·xᵢ)/(n·Σxᵢ) − (n+1)/n,  x ordenado asc.
 * Nada aqui compartilha código com `gini()`.
 */
function giniByRanks(values: number[]): number {
  const n = values.length
  const total = values.reduce((a, b) => a + b, 0)
  if (n === 0 || total <= 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  let weighted = 0
  for (const [i, v] of sorted.entries()) weighted += (i + 1) * v
  return (2 * weighted) / (n * total) - (n + 1) / n
}

describe('gini', () => {
  it('mesa igual = 0; um dono só = (n-1)/n', () => {
    expect(gini([500, 500, 500, 500])).toBe(0)
    expect(gini([0, 0, 0, 4000])).toBeCloseTo(3 / 4, 10)
    expect(gini([0, 6000])).toBeCloseTo(1 / 2, 10)
  })

  it('mesa zerada e mesa vazia não viram NaN (divisão por total 0)', () => {
    expect(gini([0, 0, 0])).toBe(0)
    expect(gini([])).toBe(0)
  })

  it('concorda com o oráculo de ranks em casos variados', () => {
    const casos = [
      [1500, 1500, 1500],
      [3000, 1200, 400, 100],
      [10, 20, 30, 40, 50, 60],
      [0, 0, 2500, 7500],
      [1, 1, 1, 1, 1, 1, 1, 9999],
      [742, 3181, 55, 1290, 908, 12],
    ]
    for (const c of casos) expect(gini(c)).toBeCloseTo(giniByRanks(c), 10)
  })

  it('eliminado conta como 0, então eliminar SOBE a concentração', () => {
    // É a decisão documentada em `wealth.ts`: tirar o eliminado da conta faria o Gini CAIR
    // justamente quando a mesa ficou mais desigual.
    const antes = gini([2000, 2000, 100])
    const depois = gini([2100, 2000, 0])
    expect(depois).toBeGreaterThan(antes)
  })
})

describe('leaderShare / leaderIndex', () => {
  it('fatia do líder vai de 1/n (mesa igual) a 1 (monopólio)', () => {
    expect(leaderShare([250, 250, 250, 250])).toBeCloseTo(0.25, 10)
    expect(leaderShare([0, 0, 900])).toBe(1)
  })

  it('mesa zerada devolve 0 e líder -1 — sem líder inventado', () => {
    expect(leaderShare([0, 0])).toBe(0)
    expect(leaderIndex([0, 0])).toBe(-1)
  })

  it('empate resolve pelo primeiro (determinismo)', () => {
    expect(leaderIndex([700, 700, 300])).toBe(0)
  })
})

describe('sampleAtDecile', () => {
  const amostras = (n: number): WealthSample[] =>
    Array.from({ length: n }, (_, i) => ({ round: i + 1, netWorth: [i] }))

  it('decil 10 é sempre a ÚLTIMA amostra — o fim de jogo das duas partidas', () => {
    expect(sampleAtDecile(amostras(10), 10)?.round).toBe(10)
    expect(sampleAtDecile(amostras(873), 10)?.round).toBe(873)
    expect(sampleAtDecile(amostras(1), 10)?.round).toBe(1)
  })

  it('normaliza por progresso: partida curta e longa alinham no mesmo decil', () => {
    expect(sampleAtDecile(amostras(10), 5)?.round).toBe(5)
    expect(sampleAtDecile(amostras(100), 5)?.round).toBe(50)
    expect(sampleAtDecile(amostras(40), 5)?.round).toBe(20)
  })

  it('partida com 1 rodada cai na única amostra em todo decil, sem estourar índice', () => {
    for (const d of [1, 5, 10]) expect(sampleAtDecile(amostras(1), d)?.round).toBe(1)
  })

  it('sem amostra devolve null (não um zero disfarçado de medição)', () => {
    expect(sampleAtDecile([], 5)).toBeNull()
  })
})

describe('sampleWealth', () => {
  it('usa a fórmula do produto e segue a ordem de players', () => {
    const g = createSeedState(['p1', 'p2', 'p3'])
    g.players[1].cash = 999
    const s = sampleWealth(g, 7)
    expect(s.round).toBe(7)
    expect(s.netWorth).toHaveLength(3)
    expect(s.netWorth[1]).toBe(999) // sem propriedade ainda: patrimônio = caixa
  })
})

// Timeout explícito pelo mesmo motivo do `determinism.test.ts`: é uma partida COMPLETA de
// até 1500 rodadas dentro do run generalista, disputando dois vCPUs com ~130 outros arquivos.
// Reprovou no CI por relógio (5s), não por resultado, depois que a 050 alongou as partidas
// sob política aleatória.
describe('runGame — coleta da curva numa partida real', () => {
  it('uma amostra por rodada fechada, e a última é rodada COMPLETA (não o estado de vitória)', { timeout: 60_000 }, () => {
    const r = runGame(20260705 + 300000, 3, 1500)
    expect(r.outcome).toBe('ok')
    // Uma amostra por rodada contada: é o que torna `sampleAtDecile` uma leitura de progresso.
    expect(r.wealth).toHaveLength(r.rounds)
    expect(r.wealth.at(-1)!.round).toBe(r.rounds)
    for (const s of r.wealth) expect(s.netWorth).toHaveLength(3)

    // A última amostra NÃO é o fim de jogo: a partida termina no meio da rodada final, então a
    // mesa amostrada ainda tem mais de um jogador com patrimônio. Se algum dia a coleta passar
    // a incluir o estado terminal, este teste cai — e o decil 10 vira fatia 1,00 trivial.
    const ultima = r.wealth.at(-1)!.netWorth
    expect(ultima.filter((v) => v > 0).length).toBeGreaterThan(1)
    expect(leaderShare(ultima)).toBeLessThan(1)
  })
})

// Fábrica de SimResult mínimo — só os campos que a agregação lê.
function res(over: Partial<SimResult> = {}): SimResult {
  return {
    seed: 1,
    playerCount: 2,
    outcome: 'ok',
    rounds: 2,
    actionsExecuted: 10,
    durationMs: 1,
    coverage: {},
    wealth: [
      { round: 1, netWorth: [1000, 500] },
      { round: 2, netWorth: [1500, 0] },
    ],
    winnerId: 'p1',
    ...over,
  }
}

describe('buildWealthCurve', () => {
  it('líder-venceu casa o índice do patrimônio com o id do assento (p1..pN)', () => {
    // p2 lidera no decil 1 e p1 vence: no decil 1 o líder NÃO venceu; no decil 10, venceu.
    const r = res({ wealth: [{ round: 1, netWorth: [100, 900] }, { round: 2, netWorth: [1500, 0] }] })
    const curva = buildWealthCurve([r])
    expect(curva.find((p) => p.decile === 1)!.leaderWinRate).toBe(0)
    expect(curva.find((p) => p.decile === 10)!.leaderWinRate).toBe(1)
  })

  it('ignora partidas que falharam e as sem amostra', () => {
    const curva = buildWealthCurve([res(), res({ outcome: 'fail', wealth: [] }), res({ wealth: [] })])
    expect(curva.every((p) => p.games === 1)).toBe(true)
  })

  it('lote vazio devolve os 10 decis com games=0, não uma lista vazia', () => {
    const curva = buildWealthCurve([])
    expect(curva).toHaveLength(10)
    expect(curva.every((p) => p.games === 0 && p.gini === 0 && p.leaderWinRate === 0)).toBe(true)
  })
})

describe('buildReport — vencedor e separação por espólio', () => {
  it('conta vitórias por assento', () => {
    const r = buildReport([res({ winnerId: 'p1' }), res({ winnerId: 'p2' }), res({ winnerId: 'p1' })], 5)
    expect(r.winnersBySeat).toEqual({ p1: 2, p2: 1 })
  })

  it('espólio é marcado por declare-bankruptcy-sink, e as duas curvas se separam', () => {
    const com = res({ coverage: { 'declare-bankruptcy-sink': 1 } })
    const sem = res({ coverage: { 'declare-bankruptcy': 1 } })
    expect(hadEstateAuction(com)).toBe(true)
    expect(hadEstateAuction(sem)).toBe(false)

    const r = buildReport([com, sem, sem], 5)
    expect(r.wealthCurveWithEstate[0].games).toBe(1)
    expect(r.wealthCurveWithoutEstate[0].games).toBe(2)
    expect(r.wealthCurve[0].games).toBe(3)
  })
})
