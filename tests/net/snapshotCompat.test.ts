// Compatibilidade de snapshot antigo (044, data-model — Compatibilidade com snapshot
// antigo). Salas persistidas ANTES desta spec não têm `eliminationOrder`/`round`/
// `startedAt`/`endedAt` — `normalizeGame` (game/log.ts) e `normalizeSnapshot`
// (net/supabaseTransport.ts, mesmo ponto que já normaliza log/paused) dão o default
// seguro. Uma partida antiga carrega, é jogável, termina, e `matchSummary` diz a verdade
// (`partial: true`) em vez de inventar uma classificação que o estado não guardou.
import { describe, it, expect } from 'vitest'
import { normalizeGame } from '@/game/log'
import { normalizeSnapshot } from '@/net/supabaseTransport'
import { matchSummary } from '@/game/summary'
import { createSeedState, defaultPorts } from '@/game/setup'
import { declareBankruptcy } from '@/game/falencia/falencia'
import type { GameState } from '@/game/turn/types'
import type { TurnCtx } from '@/game/turn/turnMachine'
import type { PersistedSnapshot } from '@/net/transport'

// Simula uma sala persistida ANTES da 044: p3 já tinha caído (o campo `eliminated` em
// `Player` não é novo), mas os quatro campos novos do `GameState` simplesmente não existem
// no JSON gravado.
function legacySnapshotGame(): PersistedSnapshot['game'] {
  const g = createSeedState(['p1', 'p2', 'p3']) as unknown as Record<string, unknown>
  const players = (g.players as GameState['players']).map((p, i) => (i === 2 ? { ...p, eliminated: true } : p))
  g.players = players
  delete g.eliminationOrder
  delete g.round
  delete g.startedAt
  delete g.endedAt
  return g as unknown as PersistedSnapshot['game']
}

describe('normalizeGame (044) — defaults dos 4 campos ausentes', () => {
  it('eliminationOrder ausente → []', () => {
    expect(normalizeGame(legacySnapshotGame()).eliminationOrder).toEqual([])
  })

  it('round ausente → 0', () => {
    expect(normalizeGame(legacySnapshotGame()).round).toBe(0)
  })

  it('startedAt ausente → 0', () => {
    expect(normalizeGame(legacySnapshotGame()).startedAt).toBe(0)
  })

  it('endedAt ausente → null', () => {
    expect(normalizeGame(legacySnapshotGame()).endedAt).toBeNull()
  })

  it('campos já presentes passam intactos (não regride 044)', () => {
    const g = createSeedState(['p1', 'p2'])
    g.round = 4
    g.eliminationOrder = [{ playerId: 'p1', round: 2 }]
    const out = normalizeGame(g)
    expect(out.round).toBe(4)
    expect(out.eliminationOrder).toEqual([{ playerId: 'p1', round: 2 }])
  })
})

describe('normalizeSnapshot — os 4 campos entram junto de log/paused (mesmo ponto, 041/044)', () => {
  it('snapshot legado carrega com os defaults dos 4 campos novos', () => {
    const out = normalizeSnapshot(legacySnapshotGame())
    expect(out.eliminationOrder).toEqual([])
    expect(out.round).toBe(0)
    expect(out.startedAt).toBe(0)
    expect(out.endedAt).toBeNull()
    // não regride o que a 021/040/041 já garantem
    expect(out.log).toEqual([])
    expect(out.paused).toBeNull()
  })

  it('migra pendingTrade legado para uma proposta identificada', () => {
    const legacy = legacySnapshotGame() as unknown as Record<string, unknown>
    delete legacy.tradeProposals
    delete legacy.nextTradeProposalId
    legacy.pendingTrade = {
      fromId: 'p1',
      toId: 'p2',
      fromProps: [],
      fromCash: 100,
      toProps: [],
      toCash: 0,
    }

    const out = normalizeSnapshot(legacy as unknown as PersistedSnapshot['game'])

    expect(out.tradeProposals).toEqual([{ id: 1, trade: legacy.pendingTrade }])
    expect(out.nextTradeProposalId).toBe(2)
    expect('pendingTrade' in out).toBe(false)
  })

  it('preserva ids atuais e corrige contador defasado', () => {
    const game = createSeedState(['p1', 'p2'])
    game.tradeProposals = [{
      id: 8,
      trade: {
        fromId: 'p1',
        toId: 'p2',
        fromProps: [],
        fromCash: 100,
        toProps: [],
        toCash: 0,
      },
    }]
    game.nextTradeProposalId = 3

    const out = normalizeSnapshot(game)

    expect(out.tradeProposals).toEqual(game.tradeProposals)
    expect(out.nextTradeProposalId).toBe(9)
  })
})

describe('snapshot antigo — jogável, termina, matchSummary não lança (T010)', () => {
  it('carrega, continua pelos mesmos reducers, chega a "ended", e matchSummary devolve partial: true', () => {
    const normalized = normalizeSnapshot(legacySnapshotGame()) as GameState
    expect(normalized.phase).toBe('playing') // ainda jogável — p3 já tinha caído, restam 2
    expect(normalized.players.filter((p) => !p.eliminated)).toHaveLength(2)

    // Continua a partida pelo MESMO reducer de falência: força a queda do penúltimo (p2).
    const ctx: TurnCtx = { rng: () => 0, ports: defaultPorts }
    const s: GameState = structuredClone(normalized)
    s.activeSeat = 1 // p2
    s.turn = { ...s.turn, state: 'casa-a-resolver', pendingResolve: true }
    s.resolution = { kind: 'debt', amount: 999_999, creditorId: null }
    s.players[1].cash = 0

    let after: GameState | undefined
    expect(() => {
      after = declareBankruptcy(s, ctx)
    }).not.toThrow()
    expect(after!.phase).toBe('ended')
    expect(after!.players.filter((p) => !p.eliminated)).toHaveLength(1)
    // A queda de p2, ocorrida DEPOIS da migração, foi registrada normalmente.
    expect(after!.eliminationOrder).toEqual([{ playerId: 'p2', round: 0 }])

    let summary: ReturnType<typeof matchSummary> | undefined
    expect(() => {
      summary = matchSummary(after!)
    }).not.toThrow()
    expect(summary!.winnerId).toBe('p1')
    expect(summary!.standings).toHaveLength(3) // ninguém some, nem quem caiu antes da 044
    expect(summary!.partial).toBe(true) // p3 (queda pré-044) não tem registro correspondente
  })
})
