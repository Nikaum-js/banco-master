// Lobby SOBRE A REDE (spec 037, US1/US4 — FR-001..006, 015). O `room.test.ts` prova os
// reducers puros da sala; aqui o pedido de assento passa pelo TRANSPORTE: convidado pede,
// host (autoridade) decide, sala volta publicada a todos. Mesmo hub in-memory da suíte.
import { describe, expect, it } from 'vitest'
import { createClient, type Client } from '@/net/client'
import { createHost, type Host } from '@/net/host'
import { LocalHub, localTransport } from '@/net/localTransport'
import { createRoom, SEAT_COLORS } from '@/net/room'
import { mulberry32 } from '../sim/engine/rng'

const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0))

interface Lobby {
  hub: LocalHub
  host: Host
  hostClient: Client
}

// Host abre a sala e já está conectado (client próprio sobre o mesmo transporte).
async function openLobby(): Promise<Lobby> {
  const hub = new LocalHub()
  const transport = localTransport(hub, 'tok-host')
  const hostClient = createClient(transport)
  await hostClient.join()
  const host = createHost(transport, createRoom('r1', { token: 'tok-host', name: 'Host', color: SEAT_COLORS[0] }), {
    rng: mulberry32(7),
    now: () => 1_000,
  })
  await host.open()
  return { hub, host, hostClient }
}

// Convidado entra no canal e pede assento (nome + cor).
async function guestJoins(hub: LocalHub, token: string, name: string, color: string): Promise<Client> {
  const client = createClient(localTransport(hub, token))
  await client.join()
  client.requestJoin({ name, color })
  await flush()
  return client
}

describe('lobby sobre a rede (FR-001..006)', () => {
  it('convidado pede assento pelo transporte e o host o concede (FR-002)', async () => {
    const { hub, host, hostClient } = await openLobby()
    const guest = await guestJoins(hub, 'tok-a', 'Ana', SEAT_COLORS[1])

    expect(guest.playerId()).toBe('p2')
    expect(guest.joinError()).toBeNull()
    expect(host.room().seats.map((s) => s.name)).toEqual(['Host', 'Ana'])
    // Todos veem a mesma sala — inclusive o host pela própria difusão.
    expect(hostClient.room()?.seats).toHaveLength(2)
  })

  it('a identidade do assento é o token da CONEXÃO, não algo declarado pelo pedinte', async () => {
    const { hub, host } = await openLobby()
    await guestJoins(hub, 'tok-a', 'Ana', SEAT_COLORS[1])

    expect(host.room().seats[1].token).toBe('tok-a')
  })

  it('cor já ocupada é recusada com motivo, sem criar assento (§12.5)', async () => {
    const { hub, host } = await openLobby()
    const guest = await guestJoins(hub, 'tok-a', 'Ana', SEAT_COLORS[0]) // cor do host

    expect(guest.playerId()).toBeNull()
    expect(guest.joinError()).toBe('color-taken')
    expect(host.room().seats).toHaveLength(1)
  })

  it('9º jogador é recusado com sala cheia (§11.1)', async () => {
    const { hub, host } = await openLobby()
    for (let i = 1; i < 8; i++) await guestJoins(hub, `tok-${i}`, `P${i}`, SEAT_COLORS[i])
    expect(host.room().seats).toHaveLength(8)

    const ninth = createClient(localTransport(hub, 'tok-9'))
    await ninth.join()
    ninth.requestJoin({ name: 'Nono', color: '#ffffff' })
    await flush()

    expect(ninth.joinError()).toBe('room-full')
    expect(host.room().seats).toHaveLength(8)
  })

  it('recusa só chega a quem pediu — os demais não veem erro algum', async () => {
    const { hub } = await openLobby()
    const ana = await guestJoins(hub, 'tok-a', 'Ana', SEAT_COLORS[1])
    const bob = await guestJoins(hub, 'tok-b', 'Bob', SEAT_COLORS[1]) // cor da Ana

    expect(bob.joinError()).toBe('color-taken')
    expect(ana.joinError()).toBeNull()
    expect(ana.playerId()).toBe('p2')
  })

  it('host inicia a partida e todos do lobby recebem o mesmo estado inicial (FR-006)', async () => {
    const { hub, host, hostClient } = await openLobby()
    const ana = await guestJoins(hub, 'tok-a', 'Ana', SEAT_COLORS[1])
    const bob = await guestJoins(hub, 'tok-b', 'Bob', SEAT_COLORS[2])

    const started = await host.startMatch()
    expect(started.ok).toBe(true)
    await flush()

    expect(host.room().status).toBe('playing')
    for (const c of [hostClient, ana, bob]) {
      expect(c.game()).not.toBeNull()
      expect(JSON.stringify(c.game())).toBe(JSON.stringify(host.game()))
    }
    // Ordem de turno = ordem de entrada (host primeiro).
    expect(host.game().players.map((p) => p.id)).toEqual(['p1', 'p2', 'p3'])
  })

  it('sozinho o host não consegue iniciar (mínimo 2 — §11.1)', async () => {
    const { host } = await openLobby()
    const started = await host.startMatch()

    expect(started).toEqual({ ok: false, reason: 'too-few' })
    expect(host.room().status).toBe('lobby')
  })

  it('depois do início, token desconhecido é recusado (FR-005)', async () => {
    const { hub, host } = await openLobby()
    await guestJoins(hub, 'tok-a', 'Ana', SEAT_COLORS[1])
    await host.startMatch()
    await flush()

    const late = await guestJoins(hub, 'tok-z', 'Atrasado', SEAT_COLORS[3])

    expect(late.joinError()).toBe('already-started')
    expect(late.playerId()).toBeNull()
    expect(host.room().seats).toHaveLength(2)
  })

  it('reabrir o link com token já assentado re-anexa ao mesmo assento (FR-004)', async () => {
    const { hub, host } = await openLobby()
    await guestJoins(hub, 'tok-a', 'Ana', SEAT_COLORS[1])
    await host.startMatch()
    await flush()

    const again = createClient(localTransport(hub, 'tok-a')) // nova aba, mesmo token
    await again.join()
    await flush()

    expect(again.playerId()).toBe('p2')
    expect(host.room().seats).toHaveLength(2)
    expect(JSON.stringify(again.game())).toBe(JSON.stringify(host.game()))
  })

  it('host que recarrega a página reassume a autoridade pelo snapshot (FR-015)', async () => {
    const { hub, host, hostClient } = await openLobby()
    const ana = await guestJoins(hub, 'tok-a', 'Ana', SEAT_COLORS[1])
    await host.startMatch()
    await flush()

    // Joga um comando antes da queda, para o snapshot não ser o inicial.
    hostClient.send({ kind: 'roll' })
    const before = JSON.stringify(host.game())
    host.stop()

    // F5 do host: transporte novo, mesmo token, sala vinda do armazenamento.
    const revived = createHost(localTransport(hub, 'tok-host'), { id: 'r1', status: 'lobby', seats: [] }, {
      rng: mulberry32(7),
      now: () => 2_000,
    })
    await revived.open()

    expect(revived.seq()).toBe(host.seq())
    expect(JSON.stringify(revived.game())).toBe(before)

    // E a autoridade volta a funcionar: comando da Ana é aceito e difundido.
    const seqBefore = revived.seq()
    ana.send({ kind: 'roll' }) // fora do turno dela → no-op legítimo, não avança seq
    expect(revived.seq()).toBe(seqBefore)
  })
})
