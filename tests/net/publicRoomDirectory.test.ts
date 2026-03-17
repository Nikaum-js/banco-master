import { describe, expect, it, vi } from 'vitest'
import {
  PublicRoomError,
  createPublicRoomGateway,
  type PublicRoomsRpc,
} from '@/net/publicRoomDirectory'

const LISTING = {
  listingId: '123e4567-e89b-42d3-a456-426614174000',
  label: 'Mesa 123E',
  availableSeats: 5,
  capacity: 8,
  openingMode: 'sealed-bid',
  createdMinutesAgo: 3,
}

function rpcWith(data: unknown, error: unknown = null): PublicRoomsRpc {
  return { rpc: vi.fn().mockResolvedValue({ data, error }) }
}

describe('gateway do diretório público', () => {
  it('aceita somente a allowlist exata do item', async () => {
    const gateway = createPublicRoomGateway(async () => rpcWith({
      ok: true,
      listings: [LISTING],
    }))
    await expect(gateway.list()).resolves.toEqual([LISTING])

    const unsafe = createPublicRoomGateway(async () => rpcWith({
      ok: true,
      listings: [{ ...LISTING, roomId: 'segredo' }],
    }))
    await expect(unsafe.list()).rejects.toMatchObject({ code: 'invalid-response' })

    const unsafeEnvelope = createPublicRoomGateway(async () => rpcWith({
      ok: true,
      listings: [LISTING],
      roomId: 'segredo',
    }))
    await expect(unsafeEnvelope.list()).rejects.toMatchObject({ code: 'invalid-response' })
  })

  it('recusa formas inválidas sem aproveitar resultado parcial', async () => {
    const gateway = createPublicRoomGateway(async () => rpcWith({
      ok: true,
      listings: [{ ...LISTING, availableSeats: 9 }],
    }))
    await expect(gateway.list()).rejects.toBeInstanceOf(PublicRoomError)
  })

  it('traduz limite com espera e não devolve listagens antigas', async () => {
    const gateway = createPublicRoomGateway(async () => rpcWith({
      ok: false,
      reason: 'rate-limited',
      retryAfterMs: 4_200,
    }))
    await expect(gateway.list()).rejects.toMatchObject({
      code: 'rate-limited',
      retryAfterMs: 4_200,
    })
  })

  it('só aceita roomId em admissão bem-sucedida', async () => {
    const success = createPublicRoomGateway(async () => rpcWith({
      ok: true,
      roomId: 'sala-secreta',
    }))
    await expect(success.join(LISTING.listingId, {
      name: 'Ana',
      color: '#d9a650',
      avatar: 'classic-alive',
      skin: 'careca',
    })).resolves.toBe('sala-secreta')

    const refused = createPublicRoomGateway(async () => rpcWith({
      ok: false,
      reason: 'unavailable',
      roomId: 'nao-pode-vazar',
    }))
    await expect(refused.join(LISTING.listingId, {
      name: 'Ana',
      color: '#d9a650',
      avatar: 'classic-alive',
      skin: 'careca',
    })).rejects.toMatchObject({ code: 'invalid-response' })
  })

  it('usa somente as RPCs públicas e preserva os argumentos autorizados', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { ok: true, published: false, visible: false, listingId: null, hiddenReason: null },
      error: null,
    })
    const gateway = createPublicRoomGateway(async () => ({ rpc }))

    await gateway.publication('ROOM01')
    await gateway.publish('ROOM01')
    await gateway.unpublish('ROOM01')
    await gateway.heartbeat('ROOM01')

    expect(rpc.mock.calls.map(([name]) => name)).toEqual([
      'public_room_publication',
      'publish_public_room',
      'unpublish_public_room',
      'heartbeat_public_room',
    ])
    expect(rpc.mock.calls.every(([, args]) => args.room_id === 'ROOM01')).toBe(true)

    const unsafe = createPublicRoomGateway(async () => rpcWith({
      ok: true,
      published: false,
      visible: false,
      listingId: null,
      hiddenReason: null,
      roomId: 'segredo',
    }))
    await expect(unsafe.publication('ROOM01')).rejects.toMatchObject({
      code: 'invalid-response',
    })
  })

  it('propaga falha de transporte sem tentar ler rooms como fallback', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'rede fora' } })
    const gateway = createPublicRoomGateway(async () => ({ rpc }))

    await expect(gateway.list()).rejects.toThrow('rede fora')
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('list_public_rooms', undefined)
  })
})
