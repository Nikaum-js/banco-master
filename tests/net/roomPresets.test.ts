import { describe, expect, it, vi } from 'vitest'
import { LocalHub, localTransport } from '@/net/localTransport'
import {
  ROOM_PRESETS,
  applyRoomPreset,
  presetForOpeningMode,
  recallRoomPreset,
  rememberRoomPreset,
  type RoomPreset,
} from '@/net/roomPresets'
import { createRoom, joinRoom, SEAT_COLORS, startGame } from '@/net/room'
import { createRoomSession } from '@/net/roomSession'

function memoryStorage(initial?: string): Storage {
  const values = new Map<string, string>()
  if (initial !== undefined) values.set('bm.room-preset', initial)
  return {
    get length() { return values.size },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => { values.delete(key) },
    setItem: (key, value) => { values.set(key, value) },
  }
}

function session(hub: LocalHub, uid: string, preset: RoomPreset = ROOM_PRESETS[1], selected = vi.fn()) {
  return {
    selected,
    session: createRoomSession({
      createTransport: () => localTransport(hub, uid),
      connectStore: () => () => {},
      newRoomId: () => 'sala-preset',
      mintReentryCode: () => 'ABC234',
      mintHistoryId: () => `hist-${uid}`,
      initialRoomPreset: preset,
      onRoomPresetSelected: selected,
      revealMs: 0,
    }),
  }
}

describe('catálogo de presets', () => {
  it('mapeia somente as configurações já existentes', () => {
    expect(ROOM_PRESETS).toEqual([
      expect.objectContaining({ id: 'sealed-bid', label: 'Leilão secreto', settings: { openingMode: 'sealed-bid' } }),
      expect.objectContaining({ id: 'dice-roll', label: 'Maior dado', settings: { openingMode: 'dice-roll' } }),
    ])
    expect(ROOM_PRESETS.every((preset) => Object.keys(preset.settings).join(',') === 'openingMode')).toBe(true)
    expect(presetForOpeningMode(undefined).id).toBe('sealed-bid')
  })

  it('lembra valor válido e absorve storage ausente/inválido', () => {
    const storage = memoryStorage()
    expect(recallRoomPreset(storage).id).toBe('sealed-bid')
    rememberRoomPreset('dice-roll', storage)
    expect(recallRoomPreset(storage).id).toBe('dice-roll')
    expect(recallRoomPreset(memoryStorage('velocidade')).id).toBe('sealed-bid')
  })

  it('aplica o preset pelo reducer existente e recusa depois do início', () => {
    const room = createRoom('s', {
      uid: 'host',
      name: 'Host',
      color: SEAT_COLORS[0],
      reentryCode: 'HOST23',
    })
    const selected = applyRoomPreset(room, ROOM_PRESETS[1])
    expect(selected).toMatchObject({ ok: true, room: { openingMode: 'dice-roll' } })
    if (!selected.ok) throw new Error(selected.reason)
    const joined = joinRoom(selected.room, {
      uid: 'guest',
      name: 'Guest',
      color: SEAT_COLORS[1],
      reentryCode: 'GUEST2',
    })
    if (!joined.ok) throw new Error(joined.reason)
    const started = startGame(joined.room)
    if (!started.ok) throw new Error(started.reason)
    expect(applyRoomPreset(started.room, ROOM_PRESETS[0])).toEqual({ ok: false, reason: 'not-in-lobby' })
  })
})

describe('autoridade e preferência local', () => {
  it('usa a preferência somente ao criar uma sala nova', async () => {
    const hub = new LocalHub()
    const host = session(hub, 'host')
    await host.session.create({ name: 'Host', color: SEAT_COLORS[0] })

    expect(host.session.getState().room?.openingMode).toBe('dice-roll')
  })

  it('sala publicada vence a preferência local ao entrar', async () => {
    const hub = new LocalHub()
    const stored = createRoom('sala-preset', {
      uid: 'host',
      name: 'Host',
      color: SEAT_COLORS[0],
      reentryCode: 'HOST23',
    })
    await localTransport(hub, 'host').saveRoom(stored)

    const reloaded = session(hub, 'host', ROOM_PRESETS[1])
    await reloaded.session.enter('sala-preset')

    expect(reloaded.session.getState().room?.openingMode).toBe('sealed-bid')
  })

  it('convidado não altera nem grava preferência; host grava após sucesso', async () => {
    const hub = new LocalHub()
    const hostRoom = createRoom('sala-preset', {
      uid: 'host',
      name: 'Host',
      color: SEAT_COLORS[0],
      reentryCode: 'HOST23',
    })
    const joined = joinRoom(hostRoom, {
      uid: 'guest',
      name: 'Guest',
      color: SEAT_COLORS[1],
      reentryCode: 'GUEST2',
    })
    if (!joined.ok) throw new Error(joined.reason)
    await localTransport(hub, 'host').saveRoom(joined.room)

    const host = session(hub, 'host', ROOM_PRESETS[0])
    const guest = session(hub, 'guest', ROOM_PRESETS[1])
    await host.session.enter('sala-preset')
    await guest.session.enter('sala-preset')

    guest.session.setOpeningMode('dice-roll')
    expect(guest.selected).not.toHaveBeenCalled()
    expect(guest.session.getState().room?.openingMode).toBe('sealed-bid')

    host.session.setOpeningMode('dice-roll')
    expect(host.selected).toHaveBeenCalledWith('dice-roll')
    expect(guest.session.getState().room?.openingMode).toBe('dice-roll')
  })
})
