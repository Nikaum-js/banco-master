import { describe, expect, it, vi } from 'vitest'
import { LocalHub, localTransport } from '@/net/localTransport'
import { createRoomSession } from '@/net/roomSession'
import { PublicRoomError, type PublicRoomGateway } from '@/net/publicRoomDirectory'
import { SEAT_COLORS } from '@/net/room'
import type { TelemetryEvent } from '@/telemetry/port'

const HOST = {
  name: 'Host',
  color: SEAT_COLORS[0],
  avatar: 'classic-alive' as const,
  skin: 'careca' as const,
}
const GUEST = {
  name: 'Ana',
  color: SEAT_COLORS[1],
  avatar: 'orbital-eyes' as const,
  skin: 'cartola' as const,
}

describe('createRoomSession — entrada por diretório público', () => {
  it('admite antes de abrir o transporte e termina no lobby com roomId privado', async () => {
    const hub = new LocalHub()
    const host = createRoomSession({
      createTransport: () => localTransport(hub, 'uid-host'),
      connectStore: () => () => {},
      newRoomId: () => 'ROOM01',
    })
    await host.create(HOST)

    const joined: string[] = []
    const publicRooms: Pick<PublicRoomGateway, 'join'> = {
      async join(_listingId, identity) {
        joined.push(identity.name)
        const admission = localTransport(hub, 'uid-public')
        await admission.connect()
        await admission.requestJoin(identity)
        admission.disconnect()
        return 'ROOM01'
      },
    }
    const events: TelemetryEvent[] = []
    const guest = createRoomSession({
      createTransport: () => localTransport(hub, 'uid-public'),
      connectStore: () => () => {},
      publicRooms,
      telemetry: { track: (event) => events.push(event) },
    })

    const roomId = await guest.joinPublic(
      '123e4567-e89b-42d3-a456-426614174000',
      GUEST,
    )

    expect(roomId).toBe('ROOM01')
    expect(joined).toEqual(['Ana'])
    expect(guest.getState().phase).toBe('lobby')
    expect(guest.getState().room?.seats.map((seat) => seat.name)).toContain('Ana')
    expect(events).toContainEqual({ kind: 'public_room_joined' })
  })

  it('listagem expirada não abre transporte nem revela sala', async () => {
    const createTransport = vi.fn()
    const guest = createRoomSession({
      createTransport,
      connectStore: () => () => {},
      publicRooms: {
        join: vi.fn().mockRejectedValue(new PublicRoomError('unavailable')),
      },
    })

    const roomId = await guest.joinPublic(
      '123e4567-e89b-42d3-a456-426614174000',
      GUEST,
    )

    expect(roomId).toBeNull()
    expect(createTransport).not.toHaveBeenCalled()
    expect(guest.getState().phase).toBe('error')
    expect(String(guest.getState().error)).toMatch(/não está mais disponível/i)
  })

  it('limite permanece recuperável na identidade', async () => {
    const guest = createRoomSession({
      createTransport: vi.fn(),
      connectStore: () => () => {},
      publicRooms: {
        join: vi.fn().mockRejectedValue(new PublicRoomError('rate-limited', 30_000)),
      },
    })

    await guest.joinPublic('123e4567-e89b-42d3-a456-426614174000', GUEST)

    expect(guest.getState().phase).toBe('identity')
    expect(guest.getState().busy).toBe(false)
    expect(String(guest.getState().error)).toMatch(/muitas tentativas/i)
  })
})
