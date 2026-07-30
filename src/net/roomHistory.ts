import { normalizeAvatar, type AvatarId } from '@/boards/playerAvatarCatalog'
import { normalizeSkin, type SkinId } from '@/boards/playerSkinCatalog'
import { matchSummary } from '@/game/summary'
import type { GameState } from '@/game/turn/types'
import type { Room } from './room'

export const ROOM_HISTORY_LIMIT = 10

export interface RoomHistoryStanding {
  historyId: string
  playerId: string
  name: string
  color: string
  avatar: AvatarId
  skin: SkinId
  rank: number
  netWorth: number
  properties: number
  eliminatedAtRound: number | null
}

export interface RoomMatchHistoryEntry {
  generation: number
  endedAt: number | null
  durationMs: number | null
  rounds: number
  standings: RoomHistoryStanding[]
}

export interface PlayerRoomStats {
  historyId: string
  name: string
  color: string
  avatar: AvatarId
  skin: SkinId
  matches: number
  wins: number
  winRate: number
  averageRank: number
  bestNetWorth: number
}

export interface RoomStats {
  players: PlayerRoomStats[]
  averageDurationMs: number | null
  averageRounds: number
}

function object(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : null
}

function integer(value: unknown, min = 0): number | null {
  return Number.isSafeInteger(value) && Number(value) >= min ? Number(value) : null
}

function finite(value: unknown, min?: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return min === undefined || value >= min ? value : null
}

function optionalFinite(value: unknown, min = 0): number | null | undefined {
  if (value === null) return null
  const parsed = finite(value, min)
  return parsed === null ? undefined : parsed
}

function normalizeStanding(value: unknown): RoomHistoryStanding | null {
  const row = object(value)
  if (!row) return null
  const rank = integer(row.rank, 1)
  const properties = integer(row.properties)
  const eliminatedAtRound = row.eliminatedAtRound === null
    ? null
    : integer(row.eliminatedAtRound)
  const netWorth = finite(row.netWorth)
  if (
    typeof row.historyId !== 'string' || !row.historyId
    || typeof row.playerId !== 'string' || !row.playerId
    || typeof row.name !== 'string'
    || typeof row.color !== 'string' || !row.color
    || rank === null
    || netWorth === null
    || properties === null
    || eliminatedAtRound === null && row.eliminatedAtRound !== null
  ) return null
  return {
    historyId: row.historyId,
    playerId: row.playerId,
    name: row.name,
    color: row.color,
    avatar: normalizeAvatar(row.avatar),
    skin: normalizeSkin(row.skin),
    rank,
    netWorth,
    properties,
    eliminatedAtRound,
  }
}

function normalizeEntry(value: unknown): RoomMatchHistoryEntry | null {
  const entry = object(value)
  if (!entry || !Array.isArray(entry.standings)) return null
  const generation = integer(entry.generation)
  const rounds = integer(entry.rounds)
  const endedAt = optionalFinite(entry.endedAt)
  const durationMs = optionalFinite(entry.durationMs)
  if (generation === null || rounds === null || endedAt === undefined || durationMs === undefined) return null
  const standings = entry.standings
    .slice(0, 8)
    .map(normalizeStanding)
    .filter((standing): standing is RoomHistoryStanding => standing !== null)
    .sort((a, b) => a.rank - b.rank)
  if (standings.length === 0) return null
  const historyIds = new Set(standings.map((standing) => standing.historyId))
  const ranks = new Set(standings.map((standing) => standing.rank))
  if (historyIds.size !== standings.length || ranks.size !== standings.length) return null
  return { generation, endedAt, durationMs, rounds, standings }
}

export function normalizeMatchHistory(value: unknown): RoomMatchHistoryEntry[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<number>()
  const entries: RoomMatchHistoryEntry[] = []
  for (const candidate of value) {
    const entry = normalizeEntry(candidate)
    if (!entry || seen.has(entry.generation)) continue
    seen.add(entry.generation)
    entries.push(entry)
  }
  return entries
    .sort((a, b) => a.generation - b.generation)
    .slice(-ROOM_HISTORY_LIMIT)
}

/** Histórico persistido é monotônico por geração. Uma janela mais nova pode podar a 11ª
 * entrada; escrita de geração igual/antiga nunca apaga nem reescreve o que já consolidou. */
export function mergeRoomMatchHistory(stored: unknown, requested: unknown): RoomMatchHistoryEntry[] {
  const current = normalizeMatchHistory(stored)
  const next = normalizeMatchHistory(requested)
  if (current.length === 0) return next
  if (next.length === 0) return current
  return next.at(-1)!.generation > current.at(-1)!.generation ? next : current
}

export function recordFinishedMatch(room: Room, game: GameState): Room {
  if (game.phase !== 'ended') return room
  const generation = room.matchGeneration ?? 0
  const current = normalizeMatchHistory(room.matchHistory)
  if (current.some((entry) => entry.generation === generation)) return room

  const summary = matchSummary(game)
  const standings = summary.standings.flatMap<RoomHistoryStanding>((row) => {
    const seat = room.seats.find((candidate) => candidate.playerId === row.playerId)
    if (!seat) return []
    return [{
      historyId: seat.historyId ?? seat.uid,
      playerId: row.playerId,
      name: seat.name,
      color: seat.color,
      avatar: normalizeAvatar(seat.avatar),
      skin: normalizeSkin(seat.skin),
      rank: row.rank,
      netWorth: row.netWorth,
      properties: row.properties,
      eliminatedAtRound: row.eliminatedAtRound,
    }]
  })
  if (standings.length === 0) return room

  const entry: RoomMatchHistoryEntry = {
    generation,
    endedAt: typeof game.endedAt === 'number' && Number.isFinite(game.endedAt) ? game.endedAt : null,
    durationMs: summary.durationMs,
    rounds: summary.rounds,
    standings,
  }
  return {
    ...room,
    matchHistory: normalizeMatchHistory([...current, entry]),
  }
}

export function deriveRoomStats(history: readonly RoomMatchHistoryEntry[]): RoomStats {
  const entries = normalizeMatchHistory(history)
  const aggregates = new Map<string, {
    identity: Pick<RoomHistoryStanding, 'historyId' | 'name' | 'color' | 'avatar' | 'skin'>
    matches: number
    wins: number
    rankTotal: number
    bestNetWorth: number
  }>()

  for (const entry of entries) {
    for (const standing of entry.standings) {
      const prior = aggregates.get(standing.historyId)
      aggregates.set(standing.historyId, {
        identity: {
          historyId: standing.historyId,
          name: standing.name,
          color: standing.color,
          avatar: standing.avatar,
          skin: standing.skin,
        },
        matches: (prior?.matches ?? 0) + 1,
        wins: (prior?.wins ?? 0) + (standing.rank === 1 ? 1 : 0),
        rankTotal: (prior?.rankTotal ?? 0) + standing.rank,
        bestNetWorth: Math.max(prior?.bestNetWorth ?? Number.NEGATIVE_INFINITY, standing.netWorth),
      })
    }
  }

  const durations = entries
    .map((entry) => entry.durationMs)
    .filter((duration): duration is number => duration !== null)
  const players = [...aggregates.values()]
    .map(({ identity, matches, wins, rankTotal, bestNetWorth }) => ({
      ...identity,
      matches,
      wins,
      winRate: matches === 0 ? 0 : wins / matches,
      averageRank: matches === 0 ? 0 : rankTotal / matches,
      bestNetWorth: Number.isFinite(bestNetWorth) ? bestNetWorth : 0,
    }))
    .sort((a, b) => (
      b.wins - a.wins
      || a.averageRank - b.averageRank
      || a.name.localeCompare(b.name, 'pt-BR')
    ))

  return {
    players,
    averageDurationMs: durations.length === 0
      ? null
      : durations.reduce((total, duration) => total + duration, 0) / durations.length,
    averageRounds: entries.length === 0
      ? 0
      : entries.reduce((total, entry) => total + entry.rounds, 0) / entries.length,
  }
}
