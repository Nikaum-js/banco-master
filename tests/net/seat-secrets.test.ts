// SEGREDO DO ASSENTO (043, D-036/T023) — o código de reentrada é credencial PORTADORA
// (policies.md §2): quem o conhece pode reanexar com ele. Por isso ele não pode sobreviver a
// NADA que chegue a um cliente por difusão ou leitura ampla — só à leitura que o próprio dono
// faz de si mesmo (`room_preview`/`loadRoom`).
//
// Varredura no PAYLOAD INTEIRO (`JSON.stringify`), não em campo esperado: um código escondido
// num lugar em que ninguém pensou (ex.: um campo extra que alguém esqueceu de redigir) só
// aparece assim — testar `seat.reentryCode === ''` não pegaria um vazamento em outro caminho.
import { describe, expect, it } from 'vitest'
import { LocalHub, localTransport } from '@/net/localTransport'
import { supabaseTransport } from '@/net/supabaseTransport'
import { createClient } from '@/net/client'
import { fakeSupabase } from './fakeSupabase'
import type { Transport } from '@/net/transport'
import type { Room, Seat } from '@/net/room'

type Fixture = { make(uid: string): Transport }

const ADAPTERS: [string, () => Fixture][] = [
  ['localTransport', () => {
    const hub = new LocalHub()
    return { make: (uid) => localTransport(hub, uid) }
  }],
  ['supabaseTransport', () => {
    const fake = fakeSupabase()
    return { make: (uid) => supabaseTransport(fake.client(uid), 'sala1', uid) }
  }],
]

const seat = (uid: string, code: string, isHost: boolean, i: number): Seat => ({
  uid, playerId: `p${i + 1}`, name: uid, color: '#fff', isHost, connected: true, reentryCode: code,
})

const CODES = { host: 'HOSTCODE1', a: 'ACODE2222', b: 'BCODE3333' }
const ROOM = (): Room => ({
  id: 'sala1',
  status: 'lobby',
  seats: [
    seat('t-host', CODES.host, true, 0),
    seat('t-a', CODES.a, false, 1),
    seat('t-b', CODES.b, false, 2),
  ],
})

function assertNoLeak(payload: unknown, forbidden: string[]): void {
  const json = JSON.stringify(payload)
  for (const code of forbidden) expect(json).not.toContain(code)
}

describe.each(ADAPTERS)('segredo do assento — %s', (_name, fixture) => {
  it('publishRoom/onRoom: nenhum código sobrevive à difusão — nem o do dono', async () => {
    const f = fixture()
    const host = f.make('t-host')
    const guest = f.make('t-a')
    await host.connect()
    await guest.connect()
    await host.saveRoom(ROOM())

    const seen: unknown[] = []
    guest.onRoom((r) => seen.push(r))
    host.publishRoom(ROOM())

    assertNoLeak(seen, [CODES.host, CODES.a, CODES.b])
  })

  it('loadRoom (prévia): cada um lê o PRÓPRIO código, e só o próprio', async () => {
    const f = fixture()
    const host = f.make('t-host')
    const a = f.make('t-a')
    const b = f.make('t-b')
    await host.connect()
    await a.connect()
    await b.connect()
    await host.saveRoom(ROOM())

    const hostView = await host.loadRoom()
    const aView = await a.loadRoom()
    const bView = await b.loadRoom()

    assertNoLeak(hostView, [CODES.a, CODES.b])
    assertNoLeak(aView, [CODES.host, CODES.b])
    assertNoLeak(bView, [CODES.host, CODES.a])

    expect(hostView?.seats.find((s) => s.uid === 't-host')?.reentryCode).toBe(CODES.host)
    expect(aView?.seats.find((s) => s.uid === 't-a')?.reentryCode).toBe(CODES.a)
    expect(bView?.seats.find((s) => s.uid === 't-b')?.reentryCode).toBe(CODES.b)
  })

  it('Client.room()/myReentryCode(): a UI nunca vê código alheio, e o dono obtém o seu', async () => {
    const f = fixture()
    const hostTransport = f.make('t-host')
    await hostTransport.saveRoom(ROOM())

    const aTransport = f.make('t-a')
    const a = createClient(aTransport)
    await a.join()

    assertNoLeak(a.room(), [CODES.host, CODES.a, CODES.b]) // room() nunca carrega código nenhum
    expect(a.myReentryCode()).toBe(CODES.a) // só a prévia devolve o próprio
  })
})
