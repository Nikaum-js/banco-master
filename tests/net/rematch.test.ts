import { describe, expect, it } from 'vitest'
import { THEME } from '@/game/theme'
import { buildInitialGame } from '@/game/setup'
import { createHost } from '@/net/host'
import { LocalHub, localTransport } from '@/net/localTransport'
import {
  createRoom,
  joinRoom,
  normalizeRoom,
  prepareRematch,
  SEAT_COLORS,
  startGame,
  toPublicRoom,
  type Room,
} from '@/net/room'
import { createRoomSession, type RoomSession, type SessionIdentity } from '@/net/roomSession'
import { splitSnapshot } from '@/net/perspective'
import type { Client } from '@/net/client'
import { mulberry32 } from '../sim/engine/rng'

const ANA: SessionIdentity = { name: 'Ana', color: SEAT_COLORS[0] }
const BRUNO: SessionIdentity = { name: 'Bruno', color: SEAT_COLORS[1] }

function twoSeatRoom(status: Room['status'] = 'lobby'): Room {
  const base = createRoom('sala-revanche', { uid: 'uid-host', ...ANA, reentryCode: 'ANAAAA' })
  const joined = joinRoom(base, { uid: 'uid-guest', ...BRUNO, reentryCode: 'BRUNOO' })
  if (!joined.ok) throw new Error(joined.reason)
  return normalizeRoom({ ...joined.room, status })
}

function endedSnapshot(room: Room, seq = 9) {
  const game = buildInitialGame(room.seats.map((seat) => seat.playerId), mulberry32(8), 1_000)
  game.phase = 'ended'
  game.endedAt = 9_000
  game.players[0].cash = 0
  game.players[1].cash = 7_700
  game.centerPot = 3_200
  const endedRoom = normalizeRoom({
    ...room,
    status: 'ended',
    matchGeneration: room.matchGeneration ?? 0,
    revision: seq,
  })
  const { publicGame, secrets } = splitSnapshot(game, endedRoom)
  return { seq, game: publicGame, secrets, room: endedRoom }
}

function makeSession(hub: LocalHub, uid: string): {
  session: RoomSession
  client: () => Client | null
} {
  let client: Client | null = null
  const session = createRoomSession({
    createTransport: () => localTransport(hub, uid),
    connectStore: (next) => {
      client = next
      return () => {}
    },
    revealMs: 0,
    hostOptions: {
      rng: mulberry32(4),
      now: () => 20_000,
      openingAuctionMs: 0,
      openingRollMs: 0,
      openingRollRevealMs: 0,
    },
  })
  return { session, client: () => client }
}

async function storedEndedHub(): Promise<LocalHub> {
  const hub = new LocalHub()
  const room = twoSeatRoom('ended')
  const transport = localTransport(hub, 'uid-host')
  await transport.saveRoom(room)
  await transport.saveSnapshot(endedSnapshot(room))
  return hub
}

describe('prepareRematch', () => {
  it('preserva a sala e a identidade, avança uma geração e limpa o ritual', () => {
    const ended = normalizeRoom({
      ...twoSeatRoom('ended'),
      matchGeneration: 3,
      revision: 42,
      openingAuction: { closesAt: 12_000 },
      seats: twoSeatRoom('ended').seats.map((seat, index) => ({
        ...seat,
        openingBid: 200 + index,
        bidLocked: true,
        openingRoll: [6, 6] as [number, number],
        openingRollStartedAt: 10_000,
        openingRollResolvesAt: 11_000,
      })),
    })

    const next = prepareRematch(ended)

    expect(next.status).toBe('lobby')
    expect(next.matchGeneration).toBe(4)
    expect(next.revision).toBe(42)
    expect(next.id).toBe(ended.id)
    expect(next.seats.map(({ name, color, avatar, skin, uid, reentryCode, isHost }) => (
      { name, color, avatar, skin, uid, reentryCode, isHost }
    ))).toEqual(ended.seats.map(({ name, color, avatar, skin, uid, reentryCode, isHost }) => (
      { name, color, avatar, skin, uid, reentryCode, isHost }
    )))
    expect(next.openingAuction).toBeNull()
    expect(next.seats.every((seat) => (
      seat.openingBid === null
      && seat.bidLocked === false
      && seat.openingRoll === null
      && seat.openingRollStartedAt === null
      && seat.openingRollResolvesAt === null
    ))).toBe(true)
  })

  it('normaliza salas antigas para geração zero e revisão -1', () => {
    const legacy = normalizeRoom({ id: 'legada', status: 'lobby', seats: [] })
    expect(legacy.matchGeneration).toBe(0)
    expect(legacy.revision).toBe(-1)
  })
})

describe('contrato atômico de reabertura', () => {
  it('limpa o snapshot, preserva seq e persiste o novo lobby numa operação', async () => {
    const hub = await storedEndedHub()
    const transport = localTransport(hub, 'uid-host')
    const before = await transport.loadSnapshot()
    const next = prepareRematch(before!.room)

    await transport.reopenRoom(next)

    expect(await transport.loadSnapshot()).toBeNull()
    expect(await transport.loadRoom()).toMatchObject({
      id: 'sala-revanche',
      status: 'lobby',
      matchGeneration: 1,
      revision: 9,
    })
  })

  it('descarta uma sala publicada de geração anterior', async () => {
    const hub = await storedEndedHub()
    const guest = makeSession(hub, 'uid-guest')
    await guest.session.enter('sala-revanche')
    await guest.session.returnToLobby()

    const host = makeSession(hub, 'uid-host')
    await host.session.enter('sala-revanche')
    const ended = host.session.getState().room!
    await host.session.returnToLobby()
    expect(guest.session.getState().room?.matchGeneration).toBe(1)

    localTransport(hub, 'uid-host').publishRoom(toPublicRoom(ended))

    expect(guest.session.getState().room?.status).toBe('lobby')
    expect(guest.session.getState().room?.matchGeneration).toBe(1)
  })
})

describe('RoomSession — revanche', () => {
  it('convidado volta localmente sem fechar a classificação do host; host reabre a sala', async () => {
    const hub = await storedEndedHub()
    const host = makeSession(hub, 'uid-host')
    const guest = makeSession(hub, 'uid-guest')
    await host.session.enter('sala-revanche')
    await guest.session.enter('sala-revanche')

    expect(host.session.getState()).toMatchObject({ phase: 'playing', isHost: true })
    expect(guest.session.getState()).toMatchObject({ phase: 'playing', isHost: false })
    expect(host.session.getState().room?.matchHistory).toHaveLength(1)
    expect(guest.session.getState().room?.matchHistory).toEqual(host.session.getState().room?.matchHistory)

    await guest.session.returnToLobby()
    expect(guest.session.getState()).toMatchObject({ phase: 'lobby' })
    expect(guest.session.getState().room?.status).toBe('ended')
    expect(host.session.getState().phase).toBe('playing')

    await host.session.returnToLobby()
    expect(host.session.getState()).toMatchObject({ phase: 'lobby', isHost: true })
    expect(host.session.getState().room).toMatchObject({ status: 'lobby', matchGeneration: 1 })
    expect(guest.session.getState()).toMatchObject({ phase: 'lobby' })
    expect(guest.session.getState().room?.seats.map((seat) => seat.name)).toEqual(['Ana', 'Bruno'])
    expect(guest.session.getState().room?.matchHistory).toHaveLength(1)
  })

  it('recarrega o lobby reaberto sem ressuscitar a partida encerrada', async () => {
    const hub = await storedEndedHub()
    const host = makeSession(hub, 'uid-host')
    await host.session.enter('sala-revanche')
    await host.session.returnToLobby()

    const reloaded = makeSession(hub, 'uid-guest')
    await reloaded.session.enter('sala-revanche')

    expect(reloaded.session.getState()).toMatchObject({ phase: 'lobby', roomId: 'sala-revanche' })
    expect(reloaded.client()).toBeNull()
    expect(reloaded.session.getState().room?.matchHistory).toHaveLength(1)
  })

  it('inicia uma segunda partida limpa, mantendo identidade e seq monotônico', async () => {
    const hub = await storedEndedHub()
    const host = makeSession(hub, 'uid-host')
    const guest = makeSession(hub, 'uid-guest')
    await host.session.enter('sala-revanche')
    await guest.session.enter('sala-revanche')
    await guest.session.returnToLobby()
    await host.session.returnToLobby()

    await host.session.startMatch()

    const next = host.client()!.game()!
    expect(host.client()!.seq()).toBeGreaterThan(9)
    expect(next.phase).toBe('playing')
    expect(next.players.map((player) => player.cash)).toEqual([THEME.INITIAL_CASH, THEME.INITIAL_CASH])
    expect(Object.values(next.titles).every((title) => title.ownerId === null)).toBe(true)
    expect(next.centerPot).toBe(THEME.PARKING_SEED)
    expect(next.loans).toEqual([])
    expect(next.tempEffects).toEqual([])
    expect(host.session.getState().room?.matchHistory).toHaveLength(1)
    expect(host.session.getState().room?.seats.map((seat) => [seat.name, seat.color])).toEqual([
      ['Ana', SEAT_COLORS[0]],
      ['Bruno', SEAT_COLORS[1]],
    ])
  })

  it('acrescenta a revanche finalizada sem apagar ou duplicar a primeira', async () => {
    const hub = await storedEndedHub()
    const first = makeSession(hub, 'uid-host')
    await first.session.enter('sala-revanche')
    await first.session.returnToLobby()
    const nextLobby = first.session.getState().room!
    first.session.leaveOnFatalError()

    await localTransport(hub, 'uid-host').saveSnapshot(endedSnapshot({
      ...nextLobby,
      status: 'ended',
    }, 15))

    const second = makeSession(hub, 'uid-host')
    await second.session.enter('sala-revanche')
    expect(second.session.getState().room?.matchHistory?.map((entry) => entry.generation)).toEqual([0, 1])

    await second.session.returnToLobby()
    expect(second.session.getState().room?.matchHistory?.map((entry) => entry.generation)).toEqual([0, 1])
  })
})

describe('Host.reopenRoom', () => {
  it('é idempotente depois do primeiro sucesso', async () => {
    const hub = new LocalHub()
    const started = startGame(twoSeatRoom())
    if (!started.ok) throw new Error(started.reason)
    const host = createHost(localTransport(hub, 'uid-host'), started.room, {
      rng: mulberry32(2),
      now: () => 1_000,
    })
    await host.start()
    host.game().phase = 'ended'

    expect(await host.reopenRoom()).toEqual({ ok: true })
    expect(await host.reopenRoom()).toEqual({ ok: true })
    expect(host.room().matchGeneration).toBe(1)
  })
})
