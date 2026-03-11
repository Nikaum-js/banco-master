// Spec 055 (D-069) — o mapa pertence à sala: gravado na criação, propagado a todos, com
// fallback 'atlas' para salas legadas. D-077 — e é TROCÁVEL pelo host enquanto a sala está
// em lobby; do Ritual de Largada em diante, não. Estes testes cobrem o domínio puro
// (room.ts), a sessão (roomSession) sobre o hub local e o espelho das RPCs do Supabase.
import { describe, expect, it } from 'vitest'
import { LocalHub, localTransport } from '@/net/localTransport'
import {
  createRoom,
  fromPublicRoom,
  joinRoom,
  normalizeRoom,
  prepareRematch,
  SEAT_COLORS,
  selectBoardId,
  startGame,
  toPublicRoom,
  type Room,
} from '@/net/room'
import { createRoomSession, type RoomSessionOptions } from '@/net/roomSession'
import { supabaseTransport } from '@/net/supabaseTransport'
import { fakeSupabase } from './fakeSupabase'

function host(hub: LocalHub, uid: string, extra?: Partial<RoomSessionOptions>) {
  return createRoomSession({
    createTransport: () => localTransport(hub, uid),
    connectStore: () => () => {},
    newRoomId: () => 'sala-mapa',
    mintReentryCode: () => 'ABC234',
    mintHistoryId: () => `hist-${uid}`,
    revealMs: 0,
    ...extra,
  })
}

const ANA = { uid: 'host', name: 'Ana', color: SEAT_COLORS[0], reentryCode: 'ANAAAA' }

describe('boardId — domínio puro (room.ts)', () => {
  it('createRoom grava o mapa pedido e cai em atlas sem opção', () => {
    expect(createRoom('s', ANA).boardId).toBe('atlas')
    expect(createRoom('s', ANA, { boardId: 'fuligem' }).boardId).toBe('fuligem')
    expect(createRoom('s', ANA, { boardId: 'neon' as never }).boardId).toBe('atlas')
  })

  it('normalizeRoom resolve sala legada (sem campo) e valor desconhecido para atlas', () => {
    const legacy = { ...createRoom('s', ANA) }
    delete (legacy as Partial<Room>).boardId
    expect(normalizeRoom(legacy).boardId).toBe('atlas')
    expect(normalizeRoom({ ...legacy, boardId: 'neon' as never }).boardId).toBe('atlas')
    expect(normalizeRoom({ ...legacy, boardId: 'fuligem' }).boardId).toBe('fuligem')
  })

  it('o mapa atravessa publicação, reidratação e revanche', () => {
    const room = createRoom('s', ANA, { boardId: 'fuligem' })
    const published = toPublicRoom(room)
    expect(published.boardId).toBe('fuligem')
    expect(fromPublicRoom(published).boardId).toBe('fuligem')
    expect(prepareRematch(room).boardId).toBe('fuligem')
  })

  it('nenhuma transição de sala altera o mapa por conta própria', () => {
    const room = createRoom('s', ANA, { boardId: 'fuligem' })
    const joined = joinRoom(room, { uid: 'guest', name: 'Bia', color: SEAT_COLORS[1], reentryCode: 'BIAAAA' })
    if (!joined.ok) throw new Error(joined.reason)
    expect(joined.room.boardId).toBe('fuligem')
  })

  // D-077
  it('selectBoardId troca o mapa no lobby e resolve valor desconhecido para atlas', () => {
    const room = createRoom('s', ANA, { boardId: 'atlas' })
    const trocado = selectBoardId(room, 'fuligem')
    if (!trocado.ok) throw new Error(trocado.reason)
    expect(trocado.room.boardId).toBe('fuligem')

    const desconhecido = selectBoardId(trocado.room, 'neon' as never)
    if (!desconhecido.ok) throw new Error(desconhecido.reason)
    expect(desconhecido.room.boardId).toBe('atlas')
  })

  it('selectBoardId não toca em assentos, ritual nem histórico da sala', () => {
    const room = createRoom('s', ANA, { boardId: 'atlas' })
    const joined = joinRoom(room, { uid: 'guest', name: 'Bia', color: SEAT_COLORS[1], reentryCode: 'BIAAAA' })
    if (!joined.ok) throw new Error(joined.reason)
    const antes = { ...joined.room, matchGeneration: 2, matchHistory: [] }

    const trocado = selectBoardId(antes, 'fuligem')
    if (!trocado.ok) throw new Error(trocado.reason)
    expect(trocado.room.seats).toEqual(antes.seats)
    expect(trocado.room.openingMode).toBe(antes.openingMode)
    expect(trocado.room.matchGeneration).toBe(2)
    expect(trocado.room.matchHistory).toEqual([])
  })

  it('selectBoardId recusa fora do lobby — o mapa da partida em curso não muda', () => {
    const room = createRoom('s', ANA, { boardId: 'fuligem' })
    const joined = joinRoom(room, { uid: 'guest', name: 'Bia', color: SEAT_COLORS[1], reentryCode: 'BIAAAA' })
    if (!joined.ok) throw new Error(joined.reason)
    const started = startGame(joined.room)
    if (!started.ok) throw new Error(started.reason)

    expect(selectBoardId(started.room, 'atlas')).toEqual({ ok: false, reason: 'not-in-lobby' })
    expect(selectBoardId({ ...started.room, status: 'ended' }, 'atlas'))
      .toEqual({ ok: false, reason: 'not-in-lobby' })
    expect(selectBoardId({ ...started.room, status: 'bidding' }, 'atlas'))
      .toEqual({ ok: false, reason: 'not-in-lobby' })
  })
})

describe('boardId — sessão sobre o hub local', () => {
  it('create() usa initialBoardId; convidado que entra recebe o mapa da sala', async () => {
    const hub = new LocalHub()
    const h = host(hub, 'host', { initialBoardId: 'fuligem' })
    await h.create({ name: 'Ana', color: SEAT_COLORS[0] })
    expect(h.getState().room?.boardId).toBe('fuligem')

    const guest = host(hub, 'guest')
    await guest.enter('sala-mapa')
    expect(guest.getState().room?.boardId).toBe('fuligem')
  })

  it('reload do host: enter() recupera o mapa persistido, nunca a preferência local', async () => {
    const hub = new LocalHub()
    const stored = createRoom('sala-mapa', ANA, { boardId: 'fuligem' })
    await localTransport(hub, 'host').saveRoom(stored)

    // A "preferência local" desta sessão é atlas — a sala publicada vence.
    const reloaded = host(hub, 'host', { initialBoardId: 'atlas' })
    await reloaded.enter('sala-mapa')
    expect(reloaded.getState().room?.boardId).toBe('fuligem')
  })

  // D-077 — a troca no lobby chega a quem já está sentado, e sobrevive a um reload.
  it('host troca o mapa no lobby: convidado recebe e a sala persiste trocada', async () => {
    const hub = new LocalHub()
    const h = host(hub, 'host', { initialBoardId: 'atlas' })
    await h.create({ name: 'Ana', color: SEAT_COLORS[0] })
    const guest = host(hub, 'guest')
    await guest.enter('sala-mapa')
    guest.requestSeat({ name: 'Bia', color: SEAT_COLORS[1] })

    h.setBoardId('fuligem')

    expect(h.getState().room?.boardId).toBe('fuligem')
    expect(guest.getState().room?.boardId).toBe('fuligem')
    expect(guest.getState().room?.seats).toHaveLength(2)
    expect(await localTransport(hub, 'host').loadRoom()).toMatchObject({ boardId: 'fuligem' })
  })

  it('com a partida em curso, setBoardId não muda o mapa da mesa', async () => {
    const hub = new LocalHub()
    const h = host(hub, 'host', { initialBoardId: 'fuligem' })
    await h.create({ name: 'Ana', color: SEAT_COLORS[0] })
    const guest = host(hub, 'guest')
    await guest.enter('sala-mapa')
    guest.requestSeat({ name: 'Bia', color: SEAT_COLORS[1] })
    await h.startMatch()

    h.setBoardId('atlas')

    expect(h.getState().room?.boardId).toBe('fuligem')
  })

  it('sala legada persistida sem boardId entra como atlas', async () => {
    const hub = new LocalHub()
    const stored = createRoom('sala-mapa', ANA)
    delete (stored as Partial<Room>).boardId
    await localTransport(hub, 'host').saveRoom(stored)

    const reloaded = host(hub, 'host')
    await reloaded.enter('sala-mapa')
    expect(reloaded.getState().room?.boardId).toBe('atlas')
  })
})

describe('boardId — espelho das RPCs do Supabase (migration 0009)', () => {
  it('write_room → room_preview faz o mapa sobreviver ao ciclo completo', async () => {
    const fake = fakeSupabase()
    const transport = supabaseTransport(fake.client('uid-host'), 'sala-rpc', 'uid-host')
    const room = createRoom('sala-rpc', { ...ANA, uid: 'uid-host' }, { boardId: 'fuligem' })

    await transport.saveRoom(room)
    expect(fake.rows.get('rooms:sala-rpc')).toMatchObject({ boardId: 'fuligem' })

    const loaded = await transport.loadRoom()
    expect(loaded?.boardId).toBe('fuligem')
  })

  it('linha antiga sem board_id resolve para atlas na leitura', async () => {
    const fake = fakeSupabase()
    const transport = supabaseTransport(fake.client('uid-host'), 'sala-legada', 'uid-host')
    const room = createRoom('sala-legada', { ...ANA, uid: 'uid-host' })
    await transport.saveRoom(room)
    const row = fake.rows.get('rooms:sala-legada')!
    delete (row as Record<string, unknown>).boardId

    const loaded = await transport.loadRoom()
    expect(loaded?.boardId).toBe('atlas')
  })

  // D-077 / migration 0010: em lobby a coluna se move; fora dele, não.
  it('escrita em lobby troca o mapa gravado', async () => {
    const fake = fakeSupabase()
    const transport = supabaseTransport(fake.client('uid-host'), 'sala-rpc', 'uid-host')
    const room = createRoom('sala-rpc', { ...ANA, uid: 'uid-host' }, { boardId: 'fuligem' })
    await transport.saveRoom(room)

    await transport.saveRoom({ ...room, boardId: 'atlas' as Room['boardId'] })
    expect(fake.rows.get('rooms:sala-rpc')).toMatchObject({ boardId: 'atlas' })
  })

  it('escrita fora do lobby preserva o mapa gravado', async () => {
    const fake = fakeSupabase()
    const transport = supabaseTransport(fake.client('uid-host'), 'sala-rpc', 'uid-host')
    const room = createRoom('sala-rpc', { ...ANA, uid: 'uid-host' }, { boardId: 'fuligem' })
    await transport.saveRoom(room)

    await transport.saveRoom({ ...room, status: 'playing', boardId: 'atlas' as Room['boardId'] })
    expect(fake.rows.get('rooms:sala-rpc')).toMatchObject({ boardId: 'fuligem', status: 'playing' })
  })
})
