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

  // 043, T043 (D-038): quem NÃO é a autoridade lê o próprio código e só ele. A autoridade lê
  // todos — ela os mintou, ela os grava, e é a partir desta leitura que um anfitrião que deu F5
  // no lobby remonta a sala. Redigir para ela fazia a remontagem apagar o código de todo mundo.
  it('loadRoom (prévia): jogador lê o PRÓPRIO código e só o próprio; a autoridade lê todos', async () => {
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

    assertNoLeak(aView, [CODES.host, CODES.b])
    assertNoLeak(bView, [CODES.host, CODES.a])

    expect(hostView?.seats.map((s) => s.reentryCode).sort()).toEqual([CODES.host, CODES.a, CODES.b].sort())
    expect(aView?.seats.find((s) => s.uid === 't-a')?.reentryCode).toBe(CODES.a)
    expect(bView?.seats.find((s) => s.uid === 't-b')?.reentryCode).toBe(CODES.b)
  })

  // Defesa em profundidade (043, T043 / D-038): o código é IMUTÁVEL depois de mintado, e quem
  // garante isso é a GRAVAÇÃO, não quem chama. Nenhuma escrita — nem a da própria autoridade —
  // pode zerar ou trocar o código de um assento que já tem um. Foi por falta disto que uma
  // sala remontada de uma leitura redigida destruía os códigos em silêncio: o erro tinha um
  // único ponto onde ser barrado, e não era barrado lá.
  it('saveRoom/saveSnapshot não destroem código já gravado — nem vindo da autoridade', async () => {
    const f = fixture()
    const host = f.make('t-host')
    await host.connect()
    await host.saveRoom(ROOM())

    // Regrava a MESMA sala com todos os códigos vazios — o que uma remontagem redigida faria.
    const zeroed = { ...ROOM(), seats: ROOM().seats.map((s) => ({ ...s, reentryCode: '' })) }
    await host.saveRoom(zeroed)

    const afterRoom = await host.loadRoom()
    expect(afterRoom?.seats.map((s) => s.reentryCode).sort()).toEqual([CODES.host, CODES.a, CODES.b].sort())

    const game = { players: [], decks: {}, log: [], paused: null } as never
    await host.saveSnapshot({ seq: 1, game, secrets: { hands: {}, decks: {} }, room: { ...zeroed, status: 'playing' } })

    const afterSnap = await host.loadSnapshot()
    expect(afterSnap?.room.seats.map((s) => s.reentryCode).sort()).toEqual([CODES.host, CODES.a, CODES.b].sort())
  })

  // 043, T043 — a Fase 5 trocou a leitura do snapshot por `read_snapshot`, e a redação que a
  // Fase 4 tinha posto em `room_preview` NÃO veio junto: `seats` vinha cru, com o código de
  // todo mundo. `client.ts` redige de novo ao aplicar, então nada aparecia na UI — mas o
  // segredo já tinha CRUZADO O FIO, e é isso que esta suíte mede (o cliente é do adversário).
  // Não é vazamento decorativo: com `reattach_by_code`, quem lê o código de um assento o toma
  // — inclusive o do anfitrião, levando a autoridade junto.
  it('loadSnapshot: o snapshot lido não carrega código alheio — só o do próprio assento', async () => {
    const f = fixture()
    const host = f.make('t-host')
    const a = f.make('t-a')
    await host.connect()
    await a.connect()

    const room = { ...ROOM(), status: 'playing' as const }
    await host.saveRoom(room)
    const game = { players: [], decks: {}, log: [], paused: null } as never
    await host.saveSnapshot({ seq: 3, game, secrets: { hands: {}, decks: {} }, room })

    const aSnap = await a.loadSnapshot()
    assertNoLeak(aSnap, [CODES.host, CODES.b])
    expect(aSnap?.room.seats.find((s) => s.uid === 't-a')?.reentryCode).toBe(CODES.a)
  })

  // A contrapartida do caso acima, e o motivo de a correção ser SELEÇÃO por chave e não
  // redação cega: quem reassume a autoridade num aparelho novo (reanexou o assento de
  // anfitrião — D4) monta o `room` a partir DESTA leitura, e é ela que passa a gravar a linha.
  // Sem os códigos aqui, a reassunção regravaria a sala apagando o de todo mundo. Mesma regra
  // que `secrets` já segue (D6): anfitrião recebe inteiro, jogador recebe só o seu.
  // `room_preview`/`loadRoom` NÃO ganha exceção — lá a redação vale para todos, inclusive o
  // anfitrião (contrato §4), e é o caso acima que a mantém honesta.
  it('loadSnapshot: a autoridade recebe os assentos íntegros — é ela que os grava de volta', async () => {
    const f = fixture()
    const host = f.make('t-host')
    await host.connect()

    const room = { ...ROOM(), status: 'playing' as const }
    await host.saveRoom(room)
    const game = { players: [], decks: {}, log: [], paused: null } as never
    await host.saveSnapshot({ seq: 3, game, secrets: { hands: {}, decks: {} }, room })

    const hostSnap = await host.loadSnapshot()
    expect(hostSnap?.room.seats.map((s) => s.reentryCode).sort())
      .toEqual([CODES.host, CODES.a, CODES.b].sort())
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
