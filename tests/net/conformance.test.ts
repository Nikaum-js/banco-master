// SUÍTE DE CONFORMIDADE da porta `Transport` — card 6 do review de arquitetura.
//
// Dois adapters justificam a seam, e a seam está pagando: `host.ts` são 232 linhas de
// autoridade que rodam sem alteração sobre um hub in-memory e sobre Realtime+Postgres.
// O que faltava era o CONTRATO: a semântica da porta vivia em prosa (`transport.ts`),
// só o adapter local era testado, e o não-testado é o que roda em produção.
//
// Resultado da divergência, encontrada por este arquivo: `supabaseTransport` emitia
// `takeover: false` fixo, então `if (change.takeover) return` (host.ts:110) nunca
// disparava online — um F5 do convidado gerava `join`+`leave` com a mesma chave e o
// `leave` derrubava o assento, pausando a partida sem motivo.
import { describe, expect, it } from 'vitest'
import type { Transport, PresenceChange, AcceptedCommand } from '@/net/transport'
import { LocalHub, localTransport } from '@/net/localTransport'
import { supabaseTransport } from '@/net/supabaseTransport'
import { fakeSupabase } from './fakeSupabase'
import type { Room } from '@/net/room'

// Fábrica de N transportes ligados na MESMA sala — a única coisa que difere entre adapters.
type Fixture = { make(token: string): Transport }

const ADAPTERS: [string, () => Fixture][] = [
  ['localTransport', () => {
    const hub = new LocalHub()
    return { make: (token) => localTransport(hub, token) }
  }],
  ['supabaseTransport', () => {
    const fake = fakeSupabase()
    return { make: (token) => supabaseTransport(fake.client(token), 'sala1', token) }
  }],
]

const ROOM: Room = { id: 'sala1', status: 'lobby', seats: [] }
const ACCEPTED: AcceptedCommand = { seq: 1, action: { kind: 'roll' }, resolved: { rng: [], now: [] } }

describe.each(ADAPTERS)('contrato de Transport — %s', (_name, fixture) => {
  it('submit chega ao host com o token da CONEXÃO', async () => {
    const f = fixture()
    const host = f.make('t-host')
    const guest = f.make('t-guest')
    await host.connect()
    await guest.connect()

    const seen: { senderId: string; from: string }[] = []
    host.onSubmit((cmd, fromToken) => seen.push({ senderId: cmd.senderId, from: fromToken }))
    guest.submit({ senderId: 'p2', action: { kind: 'roll' } })

    expect(seen).toEqual([{ senderId: 'p2', from: 't-guest' }])
  })

  it('broadcast alcança TODOS, inclusive o próprio host (modelo uniforme)', async () => {
    const f = fixture()
    const host = f.make('t-host')
    const guest = f.make('t-guest')
    await host.connect()
    await guest.connect()

    const atHost: number[] = []
    const atGuest: number[] = []
    host.onBroadcast((c) => atHost.push(c.seq))
    guest.onBroadcast((c) => atGuest.push(c.seq))
    host.broadcast(ACCEPTED)

    // Sem eco do próprio envio, o host nunca aplicaria os próprios comandos.
    expect(atHost).toEqual([1])
    expect(atGuest).toEqual([1])
  })

  it('DOIS assinantes de onBroadcast recebem — não é um slot único', async () => {
    const f = fixture()
    const host = f.make('t-host')
    const guest = f.make('t-guest')
    await host.connect()
    await guest.connect()

    const a: number[] = []
    const b: number[] = []
    guest.onBroadcast((c) => a.push(c.seq))
    guest.onBroadcast((c) => b.push(c.seq))
    host.broadcast(ACCEPTED)

    expect(a).toEqual([1])
    expect(b).toEqual([1])
  })

  it('o desassinante desliga só o seu callback', async () => {
    const f = fixture()
    const host = f.make('t-host')
    const guest = f.make('t-guest')
    await host.connect()
    await guest.connect()

    const a: number[] = []
    const b: number[] = []
    const offA = guest.onBroadcast((c) => a.push(c.seq))
    guest.onBroadcast((c) => b.push(c.seq))
    offA()
    host.broadcast(ACCEPTED)

    expect(a).toEqual([])
    expect(b).toEqual([1])
  })

  it('publishRoom alcança os participantes', async () => {
    const f = fixture()
    const host = f.make('t-host')
    const guest = f.make('t-guest')
    await host.connect()
    await guest.connect()

    const seen: Room[] = []
    guest.onRoom((r) => seen.push(r))
    host.publishRoom({ ...ROOM, status: 'playing' })

    expect(seen.at(-1)?.status).toBe('playing')
  })

  it('requestJoin chega com o token da conexão; rejectJoin volta ao pedinte', async () => {
    const f = fixture()
    const host = f.make('t-host')
    const guest = f.make('t-guest')
    await host.connect()
    await guest.connect()

    const pedidos: string[] = []
    host.onJoinRequest((_who, fromToken) => pedidos.push(fromToken))
    const recusas: string[] = []
    guest.onJoinRejected((token, reason) => recusas.push(`${token}:${reason}`))

    guest.requestJoin({ name: 'Ana', color: '#fff' })
    expect(pedidos).toEqual(['t-guest'])

    host.rejectJoin('t-guest', 'already-started')
    expect(recusas).toEqual(['t-guest:already-started'])
  })

  // — PRESENÇA: onde os adapters divergiam —

  it('conectar emite presença sem takeover', async () => {
    const f = fixture()
    const host = f.make('t-host')
    await host.connect()

    const seen: PresenceChange[] = []
    host.onPresence((c) => seen.push(c))
    const guest = f.make('t-guest')
    await guest.connect()

    expect(seen).toContainEqual({ token: 't-guest', connected: true, takeover: false })
  })

  it('desconectar de verdade emite queda sem takeover', async () => {
    const f = fixture()
    const host = f.make('t-host')
    const guest = f.make('t-guest')
    await host.connect()
    await guest.connect()

    const seen: PresenceChange[] = []
    host.onPresence((c) => seen.push(c))
    guest.disconnect()

    expect(seen).toContainEqual({ token: 't-guest', connected: false, takeover: false })
  })

  it('FR-006a: reabrir a MESMA sessão é takeover, e não vira desconexão', async () => {
    const f = fixture()
    const host = f.make('t-host')
    const antiga = f.make('t-guest')
    await host.connect()
    await antiga.connect()

    const seen: PresenceChange[] = []
    host.onPresence((c) => seen.push(c))

    // F5 do convidado: a nova conexão sobe com a antiga ainda viva, e só depois a antiga cai.
    const nova = f.make('t-guest')
    await nova.connect()
    antiga.disconnect()

    // O host ignora tudo que vem com `takeover` (host.ts:110). Nenhum evento pode
    // apresentar-se como queda limpa da sessão — senão a partida pausa sozinha.
    const quedaLimpa = seen.filter((c) => c.token === 't-guest' && !c.connected && !c.takeover)
    expect(quedaLimpa).toEqual([])
  })

  // — PERSISTÊNCIA —

  it('loadSnapshot é null antes de qualquer escrita', async () => {
    const f = fixture()
    const t = f.make('t-host')
    await t.connect()
    expect(await t.loadSnapshot()).toBeNull()
  })

  it('saveRoom/loadRoom faz round-trip', async () => {
    const f = fixture()
    const t = f.make('t-host')
    await t.connect()
    const room: Room = { id: 'sala1', status: 'lobby', seats: [{ token: 't-host', playerId: 'p1', name: 'Ana', color: '#fff', connected: true, isHost: true }] }
    await t.saveRoom(room)
    expect(await t.loadRoom()).toEqual(room)
  })

  it('saveRoom NÃO apaga a partida em andamento (upsert parcial)', async () => {
    const f = fixture()
    const t = f.make('t-host')
    await t.connect()
    const game = { marcador: 'estado-da-partida' } as never
    await t.saveSnapshot({ seq: 7, game, room: { ...ROOM, status: 'playing' } })

    // Uma mudança de ASSENTOS no meio da partida não pode zerar `game`/`seq`.
    await t.saveRoom({ ...ROOM, status: 'playing', seats: [] })

    const snap = await t.loadSnapshot()
    expect(snap?.seq).toBe(7)
    expect(snap?.game).toEqual(game)
  })
})
