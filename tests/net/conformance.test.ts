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
// 041: ganhou `dropChannel`/`restoreChannel` — a queda/restauração de CANAL sem contar como
// takeover (o cenário do defeito 1), uma por adapter, para §1/§2 do contrato novo.
type Fixture = {
  make(token: string): Transport
  dropChannel(token: string): void
  restoreChannel(token: string): void
}

const ADAPTERS: [string, () => Fixture][] = [
  ['localTransport', () => {
    const hub = new LocalHub()
    return {
      make: (token) => localTransport(hub, token),
      dropChannel: (token) => hub.dropChannel(token),
      restoreChannel: (token) => hub.restoreChannel(token),
    }
  }],
  ['supabaseTransport', () => {
    const fake = fakeSupabase()
    return {
      make: (token) => supabaseTransport(fake.client(token), 'sala1', token),
      dropChannel: (token) => fake.channelByToken(token)?.simulateDrop(),
      restoreChannel: (token) => fake.channelByToken(token)?.simulateResubscribe(),
    }
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
    const game = { marcador: 'estado-da-partida', log: [] } as never // log: [] — supabaseTransport normaliza no load (040)
    await t.saveSnapshot({ seq: 7, game, room: { ...ROOM, status: 'playing' } })

    // Uma mudança de ASSENTOS no meio da partida não pode zerar `game`/`seq`.
    await t.saveRoom({ ...ROOM, status: 'playing', seats: [] })

    const snap = await t.loadSnapshot()
    expect(snap?.seq).toBe(7)
    expect(snap?.game).toEqual(game)
  })
})

// 041 — contrato §1/§2: conexão da PRÓPRIA sessão e presença em conjunto. O contrato exige
// que os DOIS adapters cumpram exatamente a mesma semântica; é aqui que o defeito 1 (queda
// reassinada não reanunciava presença em produção) fica provado nos dois, não só no local.
describe.each(ADAPTERS)('contrato de Transport (041) — %s', (_name, fixture) => {
  describe('§1 onStatus — a conexão desta sessão', () => {
    it('queda de canal emite "reconnecting"', async () => {
      const f = fixture()
      const t = f.make('t-host')
      await t.connect()
      const seen: string[] = []
      t.onStatus((s) => seen.push(s))
      f.dropChannel('t-host')
      expect(seen).toContain('reconnecting')
    })

    it('restabelecimento emite "connected" — inclusive numa REASSINATURA', async () => {
      const f = fixture()
      const t = f.make('t-host')
      await t.connect()
      const seen: string[] = []
      t.onStatus((s) => seen.push(s))
      f.dropChannel('t-host')
      f.restoreChannel('t-host')
      expect(seen).toEqual(['reconnecting', 'connected'])
    })

    it('dois assinantes recebem; desassinar um não derruba o outro', async () => {
      const f = fixture()
      const t = f.make('t-host')
      await t.connect()
      const a: string[] = []
      const b: string[] = []
      const offA = t.onStatus((s) => a.push(s))
      t.onStatus((s) => b.push(s))
      f.dropChannel('t-host')
      offA()
      f.restoreChannel('t-host')
      expect(a).toEqual(['reconnecting'])
      expect(b).toEqual(['reconnecting', 'connected'])
    })
  })

  describe('§2 onPresenceSync — quem está no canal, em conjunto', () => {
    it('após connect(), chega um conjunto contendo o próprio token', async () => {
      const f = fixture()
      const t = f.make('t-host')
      await t.connect()
      let latest: ReadonlySet<string> = new Set()
      t.onPresenceSync((tokens) => { latest = tokens })
      expect(latest.has('t-host')).toBe(true)
    })

    it('com dois participantes, ambos os tokens aparecem para os dois', async () => {
      const f = fixture()
      const ta = f.make('t-host')
      const tb = f.make('t-guest')
      await ta.connect()
      await tb.connect()
      let seenByA: ReadonlySet<string> = new Set()
      let seenByB: ReadonlySet<string> = new Set()
      ta.onPresenceSync((tokens) => { seenByA = tokens })
      tb.onPresenceSync((tokens) => { seenByB = tokens })
      expect([...seenByA].sort()).toEqual(['t-guest', 't-host'])
      expect([...seenByB].sort()).toEqual(['t-guest', 't-host'])
    })

    it('após a saída de um, o conjunto vem sem ele', async () => {
      const f = fixture()
      const ta = f.make('t-host')
      const tb = f.make('t-guest')
      await ta.connect()
      await tb.connect()
      let seenByA: ReadonlySet<string> = new Set()
      ta.onPresenceSync((tokens) => { seenByA = tokens })
      tb.disconnect()
      expect([...seenByA]).toEqual(['t-host'])
    })

    it('reassinatura REANUNCIA presença — a queda tira do conjunto, a volta repõe (defeito 1)', async () => {
      const f = fixture()
      const ta = f.make('t-host')
      const tb = f.make('t-guest')
      await ta.connect()
      await tb.connect()
      let seenByB: ReadonlySet<string> = new Set()
      tb.onPresenceSync((tokens) => { seenByB = tokens })
      expect(seenByB.has('t-host')).toBe(true)

      f.dropChannel('t-host')
      expect(seenByB.has('t-host')).toBe(false)

      f.restoreChannel('t-host')
      expect(seenByB.has('t-host')).toBe(true)
    })
  })
})
