// SUÍTE DE CONFORMIDADE da porta `Transport` — card 6 do review de arquitetura.
//
// Dois adapters justificam a seam, e a seam está pagando: `host.ts` são centenas de linhas de
// autoridade que rodam sem alteração sobre um hub in-memory e sobre Realtime+Postgres.
// O que faltava era o CONTRATO: a semântica da porta vivia em prosa (`transport.ts`),
// só o adapter local era testado, e o não-testado é o que roda em produção.
//
// Resultado da divergência, encontrada por este arquivo: `supabaseTransport` emitia
// `takeover: false` fixo, então `if (change.takeover) return` (host.ts:110) nunca
// disparava online — um F5 do convidado gerava `join`+`leave` com a mesma chave e o
// `leave` derrubava o assento, pausando a partida sem motivo.
//
// 043 (D2/D3, T011): a topologia virou três tópicos e o remetente passou a vir do ENDEREÇO —
// `broadcast`/`publishRoom`/`rejectJoin` só têm efeito quando quem chama é a autoridade (o
// uid do assento `isHost` na ÚLTIMA sala persistida), e a autoridade só observa
// `onSubmit`/`onPresence` de um assento depois de `watchSeat(uid)`. `asHost()` abaixo
// estabelece essa sala mínima ANTES de exercitar as garantias — sem ela, "ninguém é
// autoridade" (fail-closed) é o comportamento correto, não um bug do teste.
import { describe, expect, it, vi } from 'vitest'
import type { Transport, PresenceChange, AcceptedCommand, PersistedSnapshot } from '@/net/transport'
import { LocalHub, localTransport } from '@/net/localTransport'
import { supabaseTransport } from '@/net/supabaseTransport'
import { durableWrites } from '@/net/durableWrites'
import { fakeSupabase } from './fakeSupabase'
import type { Room, Seat } from '@/net/room'

// Fábrica de N transportes ligados na MESMA sala — a única coisa que difere entre adapters.
// 041: ganhou `dropChannel`/`restoreChannel` — a queda/restauração de CANAL sem contar como
// takeover (o cenário do defeito 1) — e `failWrites`/`failRead`, as faltas de persistência
// que §4 do contrato cobra nos dois adapters.
type Fixture = {
  make(uid: string): Transport
  dropChannel(uid: string): void
  restoreChannel(uid: string): void
  failWrites(n: number | 'always'): void
  failRead(fail: boolean): void
}

const ADAPTERS: [string, () => Fixture][] = [
  ['localTransport', () => {
    const hub = new LocalHub()
    return {
      make: (uid) => localTransport(hub, uid),
      dropChannel: (uid) => hub.dropChannel(uid),
      restoreChannel: (uid) => hub.restoreChannel(uid),
      failWrites: (n) => hub.failWrites(n),
      failRead: (fail) => hub.failReadSnapshot(fail),
    }
  }],
  ['supabaseTransport', () => {
    const fake = fakeSupabase()
    return {
      make: (uid) => supabaseTransport(fake.client(uid), 'sala1', uid),
      dropChannel: (uid) => fake.channelByUid(uid)?.simulateDrop(),
      restoreChannel: (uid) => fake.channelByUid(uid)?.simulateResubscribe(),
      failWrites: (n) => fake.failWrites(n),
      failRead: (fail) => fake.failRead(fail),
    }
  }],
]

const ROOM: Room = { id: 'sala1', status: 'lobby', seats: [] }
const ACCEPTED: AcceptedCommand = { seq: 1, action: { kind: 'roll' }, resolved: { rng: [], now: [] } }
const seat = (uid: string, isHost: boolean, i = 0): Seat => ({
  uid, playerId: `p${i + 1}`, name: uid, color: '#fff', isHost, connected: true, reentryCode: '',
})

// Estabelece `t` como a AUTORIDADE da sala (043) — persiste uma sala mínima com `t` no
// assento `isHost`. Sem isto, `broadcast`/`publishRoom`/`rejectJoin` são recusados por
// construção (fail-closed): "quem é a autoridade" vem da sala persistida, nunca de quem
// chamou primeiro `make()`.
async function asHost(t: Transport, others: string[] = []): Promise<void> {
  const seats = [seat(t.uid, true), ...others.map((uid, i) => seat(uid, false, i + 1))]
  await t.saveRoom({ ...ROOM, seats })
}

describe.each(ADAPTERS)('contrato de Transport — %s', (_name, fixture) => {
  it('submit chega ao host com o uid da CONEXÃO, depois de watchSeat', async () => {
    const f = fixture()
    const host = f.make('t-host')
    const guest = f.make('t-guest')
    await host.connect()
    await guest.connect()
    await asHost(host, ['t-guest'])
    host.watchSeat('t-guest') // 043, D2 — a autoridade só ouve quem observa

    const seen: { senderId: string; from: string }[] = []
    host.onSubmit((cmd, fromUid) => seen.push({ senderId: cmd.senderId, from: fromUid }))
    guest.submit({ senderId: 'p2', action: { kind: 'roll' } })

    expect(seen).toEqual([{ senderId: 'p2', from: 't-guest' }])
  })

  it('sem watchSeat, o submit do assento não observado não chega (043, D2/D3)', async () => {
    const f = fixture()
    const host = f.make('t-host')
    const guest = f.make('t-guest')
    await host.connect()
    await guest.connect()
    await asHost(host, ['t-guest'])
    // Sem `host.watchSeat('t-guest')` — a autoridade não assinou aquele tópico.

    const seen: unknown[] = []
    host.onSubmit((cmd, fromUid) => seen.push({ cmd, fromUid }))
    guest.submit({ senderId: 'p2', action: { kind: 'roll' } })

    expect(seen).toEqual([])
  })

  it('broadcast alcança TODOS, inclusive o próprio host (modelo uniforme)', async () => {
    const f = fixture()
    const host = f.make('t-host')
    const guest = f.make('t-guest')
    await host.connect()
    await guest.connect()
    await asHost(host, ['t-guest'])

    const atHost: number[] = []
    const atGuest: number[] = []
    host.onBroadcast((c) => atHost.push(c.seq))
    guest.onBroadcast((c) => atGuest.push(c.seq))
    host.broadcast(ACCEPTED)

    // Sem eco do próprio envio, o host nunca aplicaria os próprios comandos.
    expect(atHost).toEqual([1])
    expect(atGuest).toEqual([1])
  })

  it('broadcast por NÃO-AUTORIDADE não alcança ninguém (043, D2)', async () => {
    const f = fixture()
    const host = f.make('t-host')
    const guest = f.make('t-guest')
    await host.connect()
    await guest.connect()
    await asHost(host, ['t-guest']) // t-host é a autoridade; t-guest não é

    const atHost: number[] = []
    const atGuest: number[] = []
    host.onBroadcast((c) => atHost.push(c.seq))
    guest.onBroadcast((c) => atGuest.push(c.seq))
    guest.broadcast(ACCEPTED) // guest tentando se fazer passar pela autoridade

    expect(atHost).toEqual([])
    expect(atGuest).toEqual([])
  })

  it('DOIS assinantes de onBroadcast recebem — não é um slot único', async () => {
    const f = fixture()
    const host = f.make('t-host')
    const guest = f.make('t-guest')
    await host.connect()
    await guest.connect()
    await asHost(host, ['t-guest'])

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
    await asHost(host, ['t-guest'])

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
    await asHost(host, ['t-guest'])

    const seen: Room[] = []
    guest.onRoom((r) => seen.push(r))
    host.publishRoom({ ...ROOM, status: 'playing' })

    expect(seen.at(-1)?.status).toBe('playing')
  })

  it('publishRoom/rejectJoin por NÃO-AUTORIDADE não alcançam ninguém (043, D2)', async () => {
    const f = fixture()
    const host = f.make('t-host')
    const guest = f.make('t-guest')
    await host.connect()
    await guest.connect()
    await asHost(host, ['t-guest'])

    const seenRoom: Room[] = []
    guest.onRoom((r) => seenRoom.push(r))
    const seenRejects: string[] = []
    host.onJoinRejected((uid) => seenRejects.push(uid)) // host também "recebe" (mesmo canal)

    guest.publishRoom({ ...ROOM, status: 'playing' })
    guest.rejectJoin('t-host', 'already-started')

    expect(seenRoom).toEqual([])
    expect(seenRejects).toEqual([])
  })

  // 043, D4: o pedido de assento sai do canal e vira RPC na Fase 3 (`request_seat`) — o host
  // não tem como assinar o tópico de um assento que ainda não existe. Até lá, `requestJoin`
  // funciona só no adapter local (que não modela essa restrição); no Supabase é
  // intencionalmente surdo — cobrado por `reentry.test.ts`/`lobby.test.ts` a partir da 3.
  it.skipIf(_name === 'supabaseTransport')('requestJoin chega com o uid da conexão (localTransport) — Supabase migra para RPC na Fase 3', async () => {
    const f = fixture()
    const host = f.make('t-host')
    const guest = f.make('t-guest')
    await host.connect()
    await guest.connect()
    await asHost(host)

    const pedidos: string[] = []
    host.onJoinRequest((_who, fromUid) => pedidos.push(fromUid))
    const recusas: string[] = []
    guest.onJoinRejected((uid, reason) => recusas.push(`${uid}:${reason}`))

    guest.requestJoin({ name: 'Ana', color: '#fff' })
    expect(pedidos).toEqual(['t-guest'])

    host.rejectJoin('t-guest', 'already-started')
    expect(recusas).toEqual(['t-guest:already-started'])
  })

  // 041 — contrato §3: reentrada por código não é uma mensagem nova na porta, é o MESMO
  // `JoinRequest` com `reentryCode` presente. Mesma restrição de Fase acima (043, D4).
  it.skipIf(_name === 'supabaseTransport')('§3: pedido com reentryCode chega ao host com o uid da CONEXÃO', async () => {
    const f = fixture()
    const host = f.make('t-host')
    const guest = f.make('t-guest')
    await host.connect()
    await guest.connect()

    const pedidos: { fromUid: string; reentryCode?: string }[] = []
    host.onJoinRequest((who, fromUid) => pedidos.push({ fromUid, reentryCode: who.reentryCode }))

    guest.requestJoin({ name: '', color: '', reentryCode: 'ABC123' })
    expect(pedidos).toEqual([{ fromUid: 't-guest', reentryCode: 'ABC123' }])
  })

  it.skipIf(_name === 'supabaseTransport')('§3: recusa por código inválido ("bad-code") chega, e o pedinte a reconhece como sua', async () => {
    const f = fixture()
    const host = f.make('t-host')
    const guest = f.make('t-a')
    await host.connect()
    await guest.connect()
    await asHost(host)

    const recusas: { uid: string; reason: string }[] = []
    guest.onJoinRejected((uid, reason) => recusas.push({ uid, reason }))

    host.rejectJoin('t-a', 'bad-code')
    expect(recusas).toEqual([{ uid: 't-a', reason: 'bad-code' }])
  })

  // — PRESENÇA: onde os adapters divergiam —

  it('conectar emite presença sem takeover — a autoridade observando o assento', async () => {
    const f = fixture()
    const host = f.make('t-host')
    await host.connect()
    await asHost(host, ['t-guest'])
    host.watchSeat('t-guest')

    const seen: PresenceChange[] = []
    host.onPresence((c) => seen.push(c))
    const guest = f.make('t-guest')
    await guest.connect()

    expect(seen).toContainEqual({ uid: 't-guest', connected: true, takeover: false })
  })

  it('desconectar de verdade emite queda sem takeover', async () => {
    const f = fixture()
    const host = f.make('t-host')
    const guest = f.make('t-guest')
    await host.connect()
    await guest.connect()
    await asHost(host, ['t-guest'])
    host.watchSeat('t-guest')

    const seen: PresenceChange[] = []
    host.onPresence((c) => seen.push(c))
    guest.disconnect()

    expect(seen).toContainEqual({ uid: 't-guest', connected: false, takeover: false })
  })

  it('FR-006a: reabrir a MESMA sessão é takeover, e não vira desconexão', async () => {
    const f = fixture()
    const host = f.make('t-host')
    const antiga = f.make('t-guest')
    await host.connect()
    await antiga.connect()
    await asHost(host, ['t-guest'])
    host.watchSeat('t-guest')

    const seen: PresenceChange[] = []
    host.onPresence((c) => seen.push(c))

    // F5 do convidado: a nova conexão sobe com a antiga ainda viva, e só depois a antiga cai.
    const nova = f.make('t-guest')
    await nova.connect()
    antiga.disconnect()

    // O host ignora tudo que vem com `takeover` (host.ts:110). Nenhum evento pode
    // apresentar-se como queda limpa da sessão — senão a partida pausa sozinha.
    const quedaLimpa = seen.filter((c) => c.uid === 't-guest' && !c.connected && !c.takeover)
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
    const room: Room = { id: 'sala1', status: 'lobby', seats: [seat('t-host', true)] }
    await t.saveRoom(room)
    expect(await t.loadRoom()).toEqual(room)
  })

  it('saveRoom NÃO apaga a partida em andamento (upsert parcial)', async () => {
    const f = fixture()
    const t = f.make('t-host')
    await t.connect()
    // `log: []` e `paused: null` — supabaseTransport normaliza os dois no load (040/041).
    const game = { marcador: 'estado-da-partida', log: [], paused: null } as never
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
describe.each(ADAPTERS)('contrato de Transport (041/043) — %s', (_name, fixture) => {
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

  // 043: a completude do conjunto é uma garantia da AUTORIDADE (que observa cada assento por
  // `watchSeat`) — não de qualquer participante. Um convidado, que só tem o próprio tópico,
  // só se vê a si mesmo — e é assim que deveria ser (policies.md §2: presença segue a
  // política do TÓPICO DE ASSENTO, e ninguém além do dono e da autoridade o assina).
  describe('§2 onPresenceSync — quem está no canal, em conjunto (visão da autoridade)', () => {
    it('após connect(), chega um conjunto contendo o próprio uid', async () => {
      const f = fixture()
      const t = f.make('t-host')
      await t.connect()
      let latest: ReadonlySet<string> = new Set()
      t.onPresenceSync((uids) => { latest = uids })
      expect(latest.has('t-host')).toBe(true)
    })

    it('a autoridade que observa os dois assentos vê os dois uids; o convidado só vê o próprio', async () => {
      const f = fixture()
      const ta = f.make('t-host')
      const tb = f.make('t-guest')
      await ta.connect()
      await tb.connect()
      await asHost(ta, ['t-guest'])
      ta.watchSeat('t-guest')
      let seenByA: ReadonlySet<string> = new Set()
      let seenByB: ReadonlySet<string> = new Set()
      ta.onPresenceSync((uids) => { seenByA = uids })
      tb.onPresenceSync((uids) => { seenByB = uids })
      expect([...seenByA].sort()).toEqual(['t-guest', 't-host'])
      expect([...seenByB]).toEqual(['t-guest'])
    })

    it('após a saída de um, o conjunto da autoridade vem sem ele', async () => {
      const f = fixture()
      const ta = f.make('t-host')
      const tb = f.make('t-guest')
      await ta.connect()
      await tb.connect()
      await asHost(ta, ['t-guest'])
      ta.watchSeat('t-guest')
      let seenByA: ReadonlySet<string> = new Set()
      ta.onPresenceSync((uids) => { seenByA = uids })
      tb.disconnect()
      expect([...seenByA]).toEqual(['t-host'])
    })

    it('reassinatura REANUNCIA presença — a queda tira do conjunto, a volta repõe (defeito 1)', async () => {
      const f = fixture()
      const ta = f.make('t-host')
      const tb = f.make('t-guest')
      await ta.connect()
      await tb.connect()
      await asHost(tb, ['t-host']) // aqui quem observa é tb — a autoridade deste cenário
      tb.watchSeat('t-host')
      let seenByB: ReadonlySet<string> = new Set()
      tb.onPresenceSync((uids) => { seenByB = uids })
      expect(seenByB.has('t-host')).toBe(true)

      f.dropChannel('t-host')
      expect(seenByB.has('t-host')).toBe(false)

      f.restoreChannel('t-host')
      expect(seenByB.has('t-host')).toBe(true)
    })

    it('desassinar (`unwatchSeat`) tira o assento do conjunto observado', async () => {
      const f = fixture()
      const ta = f.make('t-host')
      const tb = f.make('t-guest')
      await ta.connect()
      await tb.connect()
      await asHost(ta, ['t-guest'])
      ta.watchSeat('t-guest')
      let seenByA: ReadonlySet<string> = new Set()
      ta.onPresenceSync((uids) => { seenByA = uids })
      expect(seenByA.has('t-guest')).toBe(true)

      ta.unwatchSeat('t-guest')
      expect(seenByA.has('t-guest')).toBe(false)
    })
  })

  describe('§3 broadcastPrivate — só o dono (e a autoridade) recebem', () => {
    it('a parte privada chega só ao alvo, não a terceiros', async () => {
      const f = fixture()
      const host = f.make('t-host')
      const guest = f.make('t-guest')
      const terceiro = f.make('t-terceiro')
      await host.connect()
      await guest.connect()
      await terceiro.connect()
      await asHost(host, ['t-guest', 't-terceiro'])
      host.watchSeat('t-guest')
      host.watchSeat('t-terceiro')

      const atGuest: number[] = []
      const atTerceiro: number[] = []
      guest.onBroadcast((c) => atGuest.push(c.seq))
      terceiro.onBroadcast((c) => atTerceiro.push(c.seq))
      host.broadcastPrivate('t-guest', ACCEPTED)

      expect(atGuest).toEqual([1])
      expect(atTerceiro).toEqual([])
    })
  })

  describe('§4 gravação — durabilidade, ordem e monotonia', () => {
    const ROOM_STUB: Room = { id: 'sala1', status: 'playing', seats: [] }
    const snap = (seq: number): PersistedSnapshot => ({ seq, game: { marcador: seq } as never, room: ROOM_STUB })

    async function tick(n = 15): Promise<void> {
      for (let i = 0; i < n; i++) await Promise.resolve()
    }

    it('falha transitória se recupera na repetição', async () => {
      const f = fixture()
      const raw = f.make('t-host')
      await raw.connect()
      f.failWrites(1) // a 1ª tentativa falha; a repetição deve suceder
      const onExhausted = vi.fn()
      const wrapped = durableWrites(raw, { retries: 3, sleep: () => Promise.resolve(), backoff: () => 0, onExhausted, onRecovered: vi.fn() })

      await wrapped.saveSnapshot(snap(1))
      await tick()

      expect(onExhausted).not.toHaveBeenCalled()
      expect((await raw.loadSnapshot())?.seq).toBe(1)
    })

    it('falha persistente chama onExhausted UMA vez', async () => {
      const f = fixture()
      const raw = f.make('t-host')
      await raw.connect()
      f.failWrites('always')
      const onExhausted = vi.fn()
      const wrapped = durableWrites(raw, { retries: 2, sleep: () => Promise.resolve(), backoff: () => 0, onExhausted, onRecovered: vi.fn() })

      await wrapped.saveSnapshot(snap(1))
      await tick(20)

      expect(onExhausted).toHaveBeenCalledTimes(1)
    })

    it('a volta chama onRecovered', async () => {
      const f = fixture()
      const raw = f.make('t-host')
      await raw.connect()
      f.failWrites('always')
      const onExhausted = vi.fn()
      const onRecovered = vi.fn()
      const wrapped = durableWrites(raw, { retries: 0, sleep: () => Promise.resolve(), backoff: () => 0, onExhausted, onRecovered })

      await wrapped.saveSnapshot(snap(1))
      await tick(15)
      expect(onExhausted).toHaveBeenCalledTimes(1)

      f.failWrites(0)
      await wrapped.saveSnapshot(snap(2))
      await tick(15)
      expect(onRecovered).toHaveBeenCalledTimes(1)
    })

    it('escrita com seq menor NÃO regride o que loadSnapshot devolve (guarda monotônica, D9)', async () => {
      const f = fixture()
      const raw = f.make('t-host')
      await raw.connect()
      await raw.saveSnapshot(snap(5))
      await raw.saveSnapshot(snap(3)) // regressiva — a guarda de armazenamento descarta

      expect((await raw.loadSnapshot())?.seq).toBe(5)
    })

    it('SC-004: duas escritas cruzadas deixam gravada a MAIS RECENTE', async () => {
      const f = fixture()
      const raw = f.make('t-host')
      await raw.connect()
      // "Cruzadas": a de seq maior chega primeiro (rede embaralhou); a mais velha aterrissa
      // depois e não pode vencer.
      await raw.saveSnapshot(snap(2))
      await raw.saveSnapshot(snap(1))

      expect((await raw.loadSnapshot())?.seq).toBe(2)
    })
  })
})
