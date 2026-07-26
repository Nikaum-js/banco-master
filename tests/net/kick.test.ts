// Remoção de jogador pelo anfitrião (spec 038, US4 — FR-024/025/026, SRS §11.1).
// Só no LOBBY: expulsar mid-game colidiria com D-016/princípio VII (desconexão não pune,
// propriedades não voltam ao banco) e exigiria ADR próprio.
import { describe, expect, it } from 'vitest'
import { createHost } from '@/net/host'
import { createClient, type Client } from '@/net/client'
import { LocalHub, localTransport } from '@/net/localTransport'
import { availableColors, createRoom, kickSeat, SEAT_COLORS } from '@/net/room'
import { availablePieces } from '@/net/identity'
import { mulberry32 } from '../sim/engine/rng'

const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0))

async function lobbyCom(convidados: number): Promise<{ hub: LocalHub; host: ReturnType<typeof createHost>; guests: Client[] }> {
  const hub = new LocalHub()
  const transport = localTransport(hub, 'tok-host')
  const hostClient = createClient(transport)
  await hostClient.join()
  const host = createHost(transport, createRoom('r1', { token: 'tok-host', name: 'Host', color: SEAT_COLORS[0], piece: 'aviao' }), {
    rng: mulberry32(4),
    now: () => 1_000,
  })
  await host.open()

  const guests: Client[] = []
  for (let i = 0; i < convidados; i++) {
    const c = createClient(localTransport(hub, `tok-${i}`))
    await c.join()
    c.requestJoin({ name: `P${i + 1}`, color: SEAT_COLORS[i + 1], piece: (['navio', 'trem', 'taxi'] as const)[i] })
    await flush()
    guests.push(c)
  }
  return { hub, host, guests }
}

describe('kick no lobby (FR-024/025)', () => {
  it('remove o assento e avisa o removido', async () => {
    const { host, guests } = await lobbyCom(1)
    expect(host.room().seats).toHaveLength(2)

    const r = host.kick('tok-0')
    await flush()

    expect(r.ok).toBe(true)
    expect(host.room().seats).toHaveLength(1)
    expect(guests[0].joinError()).toBe('kicked')
    expect(guests[0].playerId()).toBeNull()
  })

  it('cor e peça do removido voltam a ficar disponíveis', async () => {
    const { host } = await lobbyCom(1)
    expect(availableColors(host.room())).not.toContain(SEAT_COLORS[1])
    expect(availablePieces(host.room())).not.toContain('navio')

    host.kick('tok-0')
    await flush()

    expect(availableColors(host.room())).toContain(SEAT_COLORS[1])
    expect(availablePieces(host.room())).toContain('navio')
  })

  it('o anfitrião não remove a si mesmo (FR-025)', async () => {
    const { host } = await lobbyCom(1)
    expect(host.kick('tok-host')).toEqual({ ok: false, reason: 'is-host' })
    expect(host.room().seats).toHaveLength(2)
  })

  it('token desconhecido não derruba ninguém', async () => {
    const { host } = await lobbyCom(1)
    expect(host.kick('tok-fantasma')).toEqual({ ok: false, reason: 'unknown-token' })
    expect(host.room().seats).toHaveLength(2)
  })

  it('depois do início não há remoção — colidiria com D-016 (FR-024)', async () => {
    const { host } = await lobbyCom(1)
    await host.startMatch()
    await flush()

    expect(host.kick('tok-0')).toEqual({ ok: false, reason: 'not-in-lobby' })
    expect(host.room().seats).toHaveLength(2)
  })

  it('assentos restantes são reindexados sem buracos', () => {
    // 3 convidados; sai o do meio → os ids seguem 'p1','p2','p3' (o motor conta com isso).
    let room = createRoom('r', { token: 'h', name: 'H', color: SEAT_COLORS[0] })
    for (const [i, t] of ['a', 'b', 'c'].entries()) {
      const r = { ...room, seats: [...room.seats, { playerId: `p${i + 2}`, token: t, name: t, color: SEAT_COLORS[i + 1], isHost: false, connected: true }] }
      room = r
    }
    const out = kickSeat(room, 'b')
    expect(out.ok).toBe(true)
    if (out.ok) {
      expect(out.room.seats.map((s) => s.playerId)).toEqual(['p1', 'p2', 'p3'])
      expect(out.room.seats.map((s) => s.token)).toEqual(['h', 'a', 'c'])
    }
  })

  it('reabrir o link depois de removido não devolve o assento sozinho (FR-026)', async () => {
    const { hub, host } = await lobbyCom(1)
    host.kick('tok-0')
    await flush()

    const devolta = createClient(localTransport(hub, 'tok-0'))
    await devolta.join()
    await flush()

    expect(devolta.playerId()).toBeNull() // volta a ser um pedido novo
    expect(host.room().seats).toHaveLength(1)
  })
})
