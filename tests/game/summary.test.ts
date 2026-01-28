// matchSummary (044) — contrato em specs/044-polimento-lancamento/contracts/match-summary.md.
// Função PURA: mesmo GameState → mesmo resultado, sem relógio, sem rede, e NUNCA lança —
// ela roda durante o render da tela de fim de jogo (a lição da 040/042).
import { describe, it, expect } from 'vitest'
import { matchSummary } from '@/game/summary'
import { netWorth } from '@/game/cards/effects'
import { createSeedState } from '@/game/setup'
import type { GameState } from '@/game/turn/types'

function seed(playerCount: number): GameState {
  const ids = Array.from({ length: playerCount }, (_, i) => `p${i + 1}`)
  return createSeedState(ids)
}

describe('matchSummary — ordem inversa de eliminação (teste obrigatório 1)', () => {
  it('mesa de 2: o vencedor é 1º, quem caiu é 2º', () => {
    const g = seed(2)
    g.players[0].eliminated = true
    g.eliminationOrder = [{ playerId: 'p1', round: 3 }]
    g.phase = 'ended'
    const s = matchSummary(g)
    expect(s.standings.map((r) => r.playerId)).toEqual(['p2', 'p1'])
    expect(s.standings.map((r) => r.rank)).toEqual([1, 2])
    expect(s.winnerId).toBe('p2')
  })

  it('mesa de 3: quem caiu por último vem logo depois do vencedor', () => {
    const g = seed(3)
    g.players[0].eliminated = true // p1
    g.players[2].eliminated = true // p3
    g.eliminationOrder = [
      { playerId: 'p3', round: 2 }, // caiu primeiro
      { playerId: 'p1', round: 5 }, // caiu depois
    ]
    g.phase = 'ended'
    const s = matchSummary(g)
    expect(s.standings.map((r) => r.playerId)).toEqual(['p2', 'p1', 'p3'])
    expect(s.standings.map((r) => r.rank)).toEqual([1, 2, 3])
    expect(s.winnerId).toBe('p2')
  })

  it('mesa de 6: três quedas na ordem inversa de eliminação', () => {
    const g = seed(6)
    g.eliminationOrder = [
      { playerId: 'p4', round: 1 },
      { playerId: 'p6', round: 3 },
      { playerId: 'p2', round: 5 },
    ]
    for (const r of g.eliminationOrder) {
      g.players.find((p) => p.id === r.playerId)!.eliminated = true
    }
    const s = matchSummary(g)
    // Os 3 vivos (p1, p3, p5) vêm primeiro (rank 1..3); os eliminados, do último ao primeiro a cair.
    expect(s.standings.slice(3).map((r) => r.playerId)).toEqual(['p2', 'p6', 'p4'])
    expect(s.standings.slice(3).map((r) => r.rank)).toEqual([4, 5, 6])
  })
})

describe('matchSummary — netWorth e properties (teste obrigatório 2)', () => {
  it('conferem com o estado final', () => {
    const g = seed(2)
    g.players[0].eliminated = true
    g.eliminationOrder = [{ playerId: 'p1', round: 1 }]
    g.phase = 'ended'
    g.titles[1].ownerId = 'p2'
    g.titles[3].ownerId = 'p2'
    g.players[1].cash = 1234
    const s = matchSummary(g)
    const winnerRow = s.standings.find((r) => r.playerId === 'p2')!
    expect(winnerRow.netWorth).toBe(netWorth(g, 'p2'))
    expect(winnerRow.properties).toBe(2)
  })

  it('eliminado mostra netWorth 0 (definição de falência, §9.1) — não é caso especial, é o estado final', () => {
    const g = seed(2)
    g.players[0].cash = 0
    g.players[0].eliminated = true
    g.eliminationOrder = [{ playerId: 'p1', round: 1 }]
    g.phase = 'ended'
    const s = matchSummary(g)
    expect(s.standings.find((r) => r.playerId === 'p1')!.netWorth).toBe(0)
    expect(s.standings.find((r) => r.playerId === 'p1')!.properties).toBe(0)
  })
})

describe('matchSummary — eliminatedAtRound (teste obrigatório 3)', () => {
  it('bate com a rodada registrada na queda; null para quem não caiu', () => {
    const g = seed(3)
    g.players[0].eliminated = true
    g.players[2].eliminated = true
    g.eliminationOrder = [
      { playerId: 'p3', round: 2 },
      { playerId: 'p1', round: 7 },
    ]
    const s = matchSummary(g)
    expect(s.standings.find((r) => r.playerId === 'p1')!.eliminatedAtRound).toBe(7)
    expect(s.standings.find((r) => r.playerId === 'p3')!.eliminatedAtRound).toBe(2)
    expect(s.standings.find((r) => r.playerId === 'p2')!.eliminatedAtRound).toBeNull()
  })
})

describe('matchSummary — durationMs (teste obrigatório 4)', () => {
  it('null com startedAt: 0 (sem relógio), mesmo com endedAt presente', () => {
    const g = seed(2)
    g.startedAt = 0
    g.endedAt = 5000
    expect(matchSummary(g).durationMs).toBeNull()
  })

  it('endedAt - startedAt quando os dois estão presentes', () => {
    const g = seed(2)
    g.startedAt = 1000
    g.endedAt = 9500
    expect(matchSummary(g).durationMs).toBe(8500)
  })

  it('null enquanto endedAt for null (partida em curso)', () => {
    const g = seed(2)
    g.startedAt = 1000
    g.endedAt = null
    expect(matchSummary(g).durationMs).toBeNull()
  })
})

describe('matchSummary — snapshot antigo (teste obrigatório 5)', () => {
  it('sem os campos novos (pré-044) → partial: true, sem exceção, sem posição inventada', () => {
    const g = seed(3)
    g.players[0].eliminated = true // marcado eliminado, mas sem registro (snapshot legado)
    // Mesmo default que normalizeGame aplicaria (data-model §1 — compatibilidade).
    g.eliminationOrder = []
    g.round = 0
    g.startedAt = 0
    g.endedAt = null
    const s = matchSummary(g)
    expect(s.partial).toBe(true)
    expect(s.standings).toHaveLength(3) // ninguém some (G2)
    expect(s.standings.find((r) => r.playerId === 'p1')!.eliminatedAtRound).toBeNull() // não inventa rodada
    expect(s.durationMs).toBeNull()
  })
})

describe('matchSummary — pureza (teste obrigatório 6)', () => {
  it('não muta o estado: structuredClone antes/depois é idêntico', () => {
    const g = seed(3)
    g.players[0].eliminated = true
    g.eliminationOrder = [{ playerId: 'p1', round: 2 }]
    const before = structuredClone(g)
    matchSummary(g)
    expect(structuredClone(g)).toEqual(before)
  })

  it('determinística: duas chamadas com o mesmo estado dão o mesmo resultado', () => {
    const g = seed(3)
    g.players[0].eliminated = true
    g.eliminationOrder = [{ playerId: 'p1', round: 2 }]
    expect(matchSummary(g)).toEqual(matchSummary(g))
  })
})

describe('matchSummary — id órfão (teste obrigatório 7)', () => {
  it('em eliminationOrder é ignorado; partial: true; sem exceção', () => {
    const g = seed(2)
    g.eliminationOrder = [{ playerId: 'fantasma', round: 1 }]
    expect(() => matchSummary(g)).not.toThrow()
    const s = matchSummary(g)
    expect(s.partial).toBe(true)
    expect(s.standings.map((r) => r.playerId)).toEqual(['p1', 'p2'])
    expect(s.standings.every((r) => r.playerId !== 'fantasma')).toBe(true)
  })
})

describe('matchSummary — garantias gerais (G1-G7) e casos de borda', () => {
  it('G2/G3: standings.length === players.length; ranks 1..n sem buraco nem repetição', () => {
    const g = seed(6)
    const s = matchSummary(g)
    expect(s.standings).toHaveLength(6)
    expect(s.standings.map((r) => r.rank)).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('G4: phase !== "ended" → winnerId null mesmo com 1 só sobrevivente', () => {
    const g = seed(2)
    g.players[0].eliminated = true
    g.eliminationOrder = [{ playerId: 'p1', round: 1 }]
    // phase permanece 'playing' — cenário artificial pra provar a guarda de G4
    expect(matchSummary(g).winnerId).toBeNull()
  })

  it('partida ainda em curso: winnerId null; ninguém inventa posição de vencedor', () => {
    const g = seed(3)
    const s = matchSummary(g)
    expect(s.winnerId).toBeNull()
    expect(s.standings).toHaveLength(3)
  })

  it('todos eliminados (estado inconsistente): winnerId null; classificação pela ordem registrada; partial false', () => {
    const g = seed(2)
    g.players[0].eliminated = true
    g.players[1].eliminated = true
    g.eliminationOrder = [
      { playerId: 'p1', round: 1 },
      { playerId: 'p2', round: 2 },
    ]
    g.phase = 'ended'
    const s = matchSummary(g)
    expect(s.winnerId).toBeNull()
    expect(s.partial).toBe(false)
    expect(s.standings.map((r) => r.playerId)).toEqual(['p2', 'p1']) // último a cair primeiro
  })

  it('nunca lança mesmo com estado gravemente corrompido', () => {
    const garbage = { players: null, eliminationOrder: null, titles: null } as unknown as GameState
    expect(() => matchSummary(garbage)).not.toThrow()
    const s = matchSummary(garbage)
    expect(s.standings).toEqual([])
    expect(s.winnerId).toBeNull()
  })
})
