import { describe, expect, it } from 'vitest'
import { buildInitialGame } from '@/game/setup'
import {
  deriveRoomStats,
  mergeRoomMatchHistory,
  normalizeMatchHistory,
  recordFinishedMatch,
  type RoomMatchHistoryEntry,
} from '@/net/roomHistory'
import { createRoom, joinRoom, normalizeRoom, prepareRematch, SEAT_COLORS, type Room } from '@/net/room'
import { mulberry32 } from '../sim/engine/rng'

function room(generation = 0): Room {
  const host = createRoom('sala-historica', {
    uid: 'uid-host',
    historyId: 'hist-ana',
    name: 'Ana',
    color: SEAT_COLORS[0],
    reentryCode: 'SEGREDO-A',
  })
  const joined = joinRoom(host, {
    uid: 'uid-guest',
    historyId: 'hist-bruno',
    name: 'Bruno',
    color: SEAT_COLORS[1],
    reentryCode: 'SEGREDO-B',
  })
  if (!joined.ok) throw new Error(joined.reason)
  return normalizeRoom({ ...joined.room, status: 'ended', matchGeneration: generation })
}

function finished(roomState: Room, endedAt = 11_000) {
  const game = buildInitialGame(roomState.seats.map((seat) => seat.playerId), mulberry32(7), 1_000)
  game.phase = 'ended'
  game.endedAt = endedAt
  game.round = 8
  game.players[0].cash = 4_500
  game.players[1].cash = 0
  game.players[1].eliminated = true
  game.eliminationOrder = [{ playerId: game.players[1].id, round: 8 }]
  game.titles[1].ownerId = game.players[0].id
  return game
}

function historyEntry(
  generation: number,
  standings: Array<{ historyId: string; name: string; rank: number; netWorth: number }>,
  durationMs: number | null = 1_000,
  rounds = 10,
): RoomMatchHistoryEntry {
  return {
    generation,
    endedAt: generation * 10_000,
    durationMs,
    rounds,
    standings: standings.map((standing, index) => ({
      ...standing,
      playerId: `p${index + 1}`,
      color: index === 0 ? SEAT_COLORS[0] : SEAT_COLORS[1],
      avatar: 'classic-alive',
      skin: 'careca',
      properties: standing.rank === 1 ? 4 : 0,
      eliminatedAtRound: standing.rank === 1 ? null : rounds,
    })),
  }
}

describe('histórico da sala', () => {
  it('primeira finalização cria uma entrada allowlist sem dados privados', () => {
    const current = room()
    const next = recordFinishedMatch(current, finished(current))

    expect(next.matchHistory).toHaveLength(1)
    expect(next.matchHistory?.[0]).toMatchObject({
      generation: 0,
      endedAt: 11_000,
      durationMs: 10_000,
      rounds: 8,
      standings: [
        { historyId: 'hist-ana', name: 'Ana', rank: 1, properties: 1 },
        { historyId: 'hist-bruno', name: 'Bruno', rank: 2, eliminatedAtRound: 8 },
      ],
    })

    const json = JSON.stringify(next.matchHistory)
    for (const forbidden of ['uid-host', 'uid-guest', 'SEGREDO-A', 'SEGREDO-B', 'reentryCode', 'hands', 'cards', 'tradeProposals', 'log', 'secrets']) {
      expect(json).not.toContain(forbidden)
    }
  })

  it('mesma geração é idempotente e a primeira entrada não é reescrita', () => {
    const current = room(3)
    const once = recordFinishedMatch(current, finished(current, 5_000))
    const twice = recordFinishedMatch(once, finished(current, 99_000))

    expect(twice).toBe(once)
    expect(twice.matchHistory).toHaveLength(1)
    expect(twice.matchHistory?.[0].endedAt).toBe(5_000)
  })

  it('revanche preserva entradas e mantém somente as 10 gerações recentes', () => {
    let current = room(0)
    for (let generation = 0; generation < 11; generation += 1) {
      current = normalizeRoom({ ...current, status: 'ended', matchGeneration: generation })
      current = recordFinishedMatch(current, finished(current, 10_000 + generation))
      if (generation < 10) current = prepareRematch(current)
    }

    expect(current.matchHistory).toHaveLength(10)
    expect(current.matchHistory?.map((entry) => entry.generation)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  })

  it('normaliza sala legada, duplicatas e entrada malformada sem lançar', () => {
    expect(normalizeRoom({ id: 'legada', status: 'lobby', seats: [] }).matchHistory).toEqual([])
    expect(normalizeMatchHistory([
      historyEntry(2, [{ historyId: 'a', name: 'A', rank: 1, netWorth: 10 }]),
      historyEntry(2, [{ historyId: 'b', name: 'B', rank: 1, netWorth: 99 }]),
      { generation: -1, standings: [] },
      null,
    ])).toEqual([
      historyEntry(2, [{ historyId: 'a', name: 'A', rank: 1, netWorth: 10 }]),
    ])
  })

  it('mensagem antiga ausente pode ser incorporada sem remover gerações novas', () => {
    const history = normalizeMatchHistory([
      historyEntry(5, [{ historyId: 'a', name: 'A', rank: 1, netWorth: 50 }]),
      historyEntry(3, [{ historyId: 'a', name: 'A', rank: 1, netWorth: 30 }]),
      historyEntry(4, [{ historyId: 'a', name: 'A', rank: 1, netWorth: 40 }]),
    ])
    expect(history.map((entry) => entry.generation)).toEqual([3, 4, 5])
  })

  it('persistência monotônica preserva a janela nova contra escrita atrasada', () => {
    const stored = [
      historyEntry(0, [{ historyId: 'a', name: 'A', rank: 1, netWorth: 10 }]),
      historyEntry(1, [{ historyId: 'a', name: 'A', rank: 1, netWorth: 20 }]),
    ]
    const delayed = [
      historyEntry(0, [{ historyId: 'a', name: 'A antiga', rank: 1, netWorth: 1 }]),
    ]
    const advanced = [
      ...stored,
      historyEntry(2, [{ historyId: 'a', name: 'A', rank: 1, netWorth: 30 }]),
    ]

    expect(mergeRoomMatchHistory(stored, delayed)).toEqual(stored)
    expect(mergeRoomMatchHistory(stored, [])).toEqual(stored)
    expect(mergeRoomMatchHistory(stored, advanced)).toEqual(advanced)
  })
})

describe('estatísticas derivadas', () => {
  it('bate com um oráculo simples e usa a identidade visual mais recente', () => {
    const history = [
      historyEntry(0, [
        { historyId: 'ana', name: 'Ana', rank: 1, netWorth: 4_000 },
        { historyId: 'bia', name: 'Bia', rank: 2, netWorth: 2_000 },
      ], 10_000, 8),
      historyEntry(1, [
        { historyId: 'bia', name: 'Beatriz', rank: 1, netWorth: 5_000 },
        { historyId: 'ana', name: 'Ana', rank: 2, netWorth: 3_000 },
      ], null, 12),
      historyEntry(2, [
        { historyId: 'ana', name: 'Ana', rank: 1, netWorth: 6_000 },
        { historyId: 'bia', name: 'Beatriz', rank: 2, netWorth: 1_000 },
      ], 20_000, 10),
    ]

    const stats = deriveRoomStats(history)

    expect(stats.averageDurationMs).toBe(15_000)
    expect(stats.averageRounds).toBe(10)
    expect(stats.players).toEqual([
      expect.objectContaining({
        historyId: 'ana',
        name: 'Ana',
        matches: 3,
        wins: 2,
        winRate: 2 / 3,
        averageRank: 4 / 3,
        bestNetWorth: 6_000,
      }),
      expect.objectContaining({
        historyId: 'bia',
        name: 'Beatriz',
        matches: 3,
        wins: 1,
        winRate: 1 / 3,
        averageRank: 5 / 3,
        bestNetWorth: 5_000,
      }),
    ])
  })

  it('não muta o histórico e devolve duração desconhecida quando necessário', () => {
    const history = [historyEntry(0, [{ historyId: 'a', name: 'A', rank: 1, netWorth: 1 }], null, 4)]
    const before = structuredClone(history)
    expect(deriveRoomStats(history)).toMatchObject({ averageDurationMs: null, averageRounds: 4 })
    expect(history).toEqual(before)
  })
})
