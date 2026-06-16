// Spec 055 (D-069) — o mapa pertence à sala: gravado na criação, imutável, propagado a
// todos, com fallback 'atlas' para salas legadas. Estes testes cobrem o domínio puro
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

  it('não existe mutador de mapa: nenhuma transição de sala o altera', () => {
    const room = createRoom('s', ANA, { boardId: 'fuligem' })
    const joined = joinRoom(room, { uid: 'guest', name: 'Bia', color: SEAT_COLORS[1], reentryCode: 'BIAAAA' })
    if (!joined.ok) throw new Error(joined.reason)
    expect(joined.room.boardId).toBe('fuligem')
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

describe('boardId — espelho das RPCs do Supabase (migration 0008)', () => {
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

  it('escrita posterior nunca troca o mapa gravado (imutável no upsert)', async () => {
    const fake = fakeSupabase()
    const transport = supabaseTransport(fake.client('uid-host'), 'sala-rpc', 'uid-host')
    const room = createRoom('sala-rpc', { ...ANA, uid: 'uid-host' }, { boardId: 'fuligem' })
    await transport.saveRoom(room)

    await transport.saveRoom({ ...room, boardId: 'atlas' as Room['boardId'] })
    expect(fake.rows.get('rooms:sala-rpc')).toMatchObject({ boardId: 'fuligem' })
  })
})
