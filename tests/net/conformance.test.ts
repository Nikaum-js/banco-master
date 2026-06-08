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
import { normalizeRoom, type PublicRoom, type Room, type Seat } from '@/net/room'

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

const ROOM: Room = { id: 'sala1', status: 'lobby', openingMode: 'sealed-bid', seats: [] }
const ACCEPTED: AcceptedCommand = { seq: 1, action: { kind: 'roll' }, resolved: { rng: [], now: [], draws: [], reactions: [] } }
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
    // Sala gravada ANTES de conectar (043, T045): `room_play_select` decide pela linha
    // PERSISTIDA, e o adapter Supabase só assina `:play` depois de confirmar ali o próprio
    // assento — bater na porta sem assento derruba a conexão inteira, então ele não bate. Em
    // produção quem reaviva essa checagem é a sala difundida (ou a própria gravação, no caso
    // da autoridade); aqui, onde não há difusão nenhuma, a montagem tem de dar o assento antes.
    await asHost(host, ['t-guest'])
    await host.connect()
    await guest.connect()
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
    // Sala gravada ANTES de conectar (043, T045): `room_play_select` decide pela linha
    // PERSISTIDA, e o adapter Supabase só assina `:play` depois de confirmar ali o próprio
    // assento — bater na porta sem assento derruba a conexão inteira, então ele não bate. Em
    // produção quem reaviva essa checagem é a sala difundida (ou a própria gravação, no caso
    // da autoridade); aqui, onde não há difusão nenhuma, a montagem tem de dar o assento antes.
    await asHost(host, ['t-guest'])
    await host.connect()
    await guest.connect()
    // Sem `host.watchSeat('t-guest')` — a autoridade não assinou aquele tópico.

    const seen: unknown[] = []
    host.onSubmit((cmd, fromUid) => seen.push({ cmd, fromUid }))
    guest.submit({ senderId: 'p2', action: { kind: 'roll' } })

    expect(seen).toEqual([])
  })

  it('opening-bid chega lacrado à autoridade com uid do tópico privado', async () => {
    const f = fixture()
    const host = f.make('t-host')
    const guest = f.make('t-guest')
    await asHost(host, ['t-guest'])
    await host.connect()
    await guest.connect()
    host.watchSeat('t-guest')

    const seen: { amount: number; fromUid: string }[] = []
    host.onOpeningBid((message, fromUid) => seen.push({ amount: message.amount, fromUid }))
    guest.submitOpeningBid(350)

    expect(seen).toEqual([{ amount: 350, fromUid: 't-guest' }])
  })

  it('opening-bid não chega sem watchSeat e não é difundido a outro convidado', async () => {
    const f = fixture()
    const host = f.make('t-host')
    const guest = f.make('t-guest')
    const other = f.make('t-other')
    await asHost(host, ['t-guest', 't-other'])
    await host.connect()
    await guest.connect()
    await other.connect()

    const atHost: number[] = []
    const atOther: number[] = []
    host.onOpeningBid((message) => atHost.push(message.amount))
    other.onOpeningBid((message) => atOther.push(message.amount))
    guest.submitOpeningBid(500)

    expect(atHost).toEqual([])
    expect(atOther).toEqual([])
  })

  it('broadcast alcança TODOS, inclusive o próprio host (modelo uniforme)', async () => {
    const f = fixture()
    const host = f.make('t-host')
    const guest = f.make('t-guest')
    // Sala gravada ANTES de conectar (043, T045): `room_play_select` decide pela linha
    // PERSISTIDA, e o adapter Supabase só assina `:play` depois de confirmar ali o próprio
    // assento — bater na porta sem assento derruba a conexão inteira, então ele não bate. Em
    // produção quem reaviva essa checagem é a sala difundida (ou a própria gravação, no caso
    // da autoridade); aqui, onde não há difusão nenhuma, a montagem tem de dar o assento antes.
    await asHost(host, ['t-guest'])
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
    // Sala gravada ANTES de conectar (043, T045): `room_play_select` decide pela linha
    // PERSISTIDA, e o adapter Supabase só assina `:play` depois de confirmar ali o próprio
    // assento — bater na porta sem assento derruba a conexão inteira, então ele não bate. Em
    // produção quem reaviva essa checagem é a sala difundida (ou a própria gravação, no caso
    // da autoridade); aqui, onde não há difusão nenhuma, a montagem tem de dar o assento antes.
    await asHost(host, ['t-guest'])
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
    // Sala gravada ANTES de conectar (043, T045): `room_play_select` decide pela linha
    // PERSISTIDA, e o adapter Supabase só assina `:play` depois de confirmar ali o próprio
    // assento — bater na porta sem assento derruba a conexão inteira, então ele não bate. Em
    // produção quem reaviva essa checagem é a sala difundida (ou a própria gravação, no caso
    // da autoridade); aqui, onde não há difusão nenhuma, a montagem tem de dar o assento antes.
    await asHost(host, ['t-guest'])
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
    // Sala gravada ANTES de conectar (043, T045): `room_play_select` decide pela linha
    // PERSISTIDA, e o adapter Supabase só assina `:play` depois de confirmar ali o próprio
    // assento — bater na porta sem assento derruba a conexão inteira, então ele não bate. Em
    // produção quem reaviva essa checagem é a sala difundida (ou a própria gravação, no caso
    // da autoridade); aqui, onde não há difusão nenhuma, a montagem tem de dar o assento antes.
    await asHost(host, ['t-guest'])
    await host.connect()
    await guest.connect()

    const seen: PublicRoom[] = []
    guest.onRoom((r) => seen.push(r))
    host.publishRoom({ ...ROOM, status: 'playing' })

    expect(seen.at(-1)?.status).toBe('playing')
  })

  it('publishRoom/rejectJoin por NÃO-AUTORIDADE não alcançam ninguém (043, D2)', async () => {
    const f = fixture()
    const host = f.make('t-host')
    const guest = f.make('t-guest')
    // Sala gravada ANTES de conectar (043, T045): `room_play_select` decide pela linha
    // PERSISTIDA, e o adapter Supabase só assina `:play` depois de confirmar ali o próprio
    // assento — bater na porta sem assento derruba a conexão inteira, então ele não bate. Em
    // produção quem reaviva essa checagem é a sala difundida (ou a própria gravação, no caso
    // da autoridade); aqui, onde não há difusão nenhuma, a montagem tem de dar o assento antes.
    await asHost(host, ['t-guest'])
    await host.connect()
    await guest.connect()

    const seenRoom: PublicRoom[] = []
    guest.onRoom((r) => seenRoom.push(r))
    const seenRejects: string[] = []
    host.onJoinRejected((uid) => seenRejects.push(uid)) // host também "recebe" (mesmo canal)

    guest.publishRoom({ ...ROOM, status: 'playing' })
    guest.rejectJoin('t-host', 'already-started')

    expect(seenRoom).toEqual([])
    expect(seenRejects).toEqual([])
  })

  // 043, D4: `requestJoin` é RPC (`request_seat`) — carimba `auth.uid()` no servidor e difunde
  // ao lobby por conta própria. No adapter local (sem RPC de verdade) o espelho é o mesmo
  // broadcast de sempre, só que agora `Promise`-shaped nos dois lados do port.
  it('requestJoin chega com o uid da conexão', async () => {
    const f = fixture()
    const host = f.make('t-host')
    const guest = f.make('t-guest')
    await host.connect()
    await guest.connect()
    await asHost(host)

    const pedidos: { fromUid: string; avatar?: string; skin?: string }[] = []
    host.onJoinRequest((who, fromUid) => pedidos.push({
      fromUid,
      avatar: who.avatar,
      skin: who.skin,
    }))
    const recusas: string[] = []
    guest.onJoinRejected((uid, reason) => recusas.push(`${uid}:${reason}`))

    await guest.requestJoin({
      name: 'Ana',
      color: '#fff',
      avatar: 'totem-face',
      skin: 'astronauta',
    })
    expect(pedidos).toEqual([{
      fromUid: 't-guest',
      avatar: 'totem-face',
      skin: 'astronauta',
    }])

    host.rejectJoin('t-guest', 'already-started')
    expect(recusas).toEqual(['t-guest:already-started'])
  })

  it('§3: recusa por código inválido ("bad-code") chega, e o pedinte a reconhece como sua', async () => {
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

  // — RECUSA POR FALHA (042, contracts/transport-delta.md) — mesma semântica de `rejectJoin`:
  // trafega no canal compartilhado (nada sensível, só `occurrenceId`); quem filtra pelo
  // próprio token é o assinante (`client.ts`), não a porta. —

  it('rejectCommand: o payload carrega o toToken/occurrenceId exatos, pra quem assina filtrar', async () => {
    const f = fixture()
    const host = f.make('t-host')
    const alvo = f.make('t-alvo')
    // 043: `rejectCommand` viaja no `:lobby`, onde só a AUTORIDADE escreve — e autoridade é
    // quem consta como anfitrião na linha persistida. Em produção isso é dado (só `host.accept`
    // recusa, e a essa altura a sala existe há muito); aqui a montagem precisa estabelecê-lo.
    await asHost(host, ['t-alvo'])
    await host.connect()
    await alvo.connect()

    const recebido: { toToken: string; occurrenceId: string }[] = []
    alvo.onCommandRejected((toToken, info) => recebido.push({ toToken, occurrenceId: info.occurrenceId }))

    host.rejectCommand('t-alvo', { occurrenceId: 'ABC123' })

    expect(recebido).toEqual([{ toToken: 't-alvo', occurrenceId: 'ABC123' }])
  })

  it('rejectCommand: duas recusas seguidas para o mesmo token chegam as duas', async () => {
    const f = fixture()
    const host = f.make('t-host')
    const alvo = f.make('t-alvo')
    // 043: `rejectCommand` viaja no `:lobby`, onde só a AUTORIDADE escreve — e autoridade é
    // quem consta como anfitrião na linha persistida. Em produção isso é dado (só `host.accept`
    // recusa, e a essa altura a sala existe há muito); aqui a montagem precisa estabelecê-lo.
    await asHost(host, ['t-alvo'])
    await host.connect()
    await alvo.connect()

    const recebidos: string[] = []
    alvo.onCommandRejected((_toToken, info) => recebidos.push(info.occurrenceId))

    host.rejectCommand('t-alvo', { occurrenceId: 'PRIMEIRO' })
    host.rejectCommand('t-alvo', { occurrenceId: 'SEGUNDO' })

    expect(recebidos).toEqual(['PRIMEIRO', 'SEGUNDO'])
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
    // Sala gravada ANTES de conectar (043, T045): `room_play_select` decide pela linha
    // PERSISTIDA, e o adapter Supabase só assina `:play` depois de confirmar ali o próprio
    // assento — bater na porta sem assento derruba a conexão inteira, então ele não bate. Em
    // produção quem reaviva essa checagem é a sala difundida (ou a própria gravação, no caso
    // da autoridade); aqui, onde não há difusão nenhuma, a montagem tem de dar o assento antes.
    await asHost(host, ['t-guest'])
    await host.connect()
    await guest.connect()
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
    expect(await t.loadRoom()).toEqual(normalizeRoom(room))
  })

  it('preferência e rolagens do Ritual de Largada fazem round-trip', async () => {
    const f = fixture()
    const host = f.make('t-host')
    await host.connect()
    const room: Room = {
      ...ROOM,
      openingMode: 'dice-roll',
      seats: [{ ...seat('t-host', true), openingRoll: [6, 4] }],
    }
    await host.saveRoom(room)

    expect(await host.loadRoom()).toMatchObject({
      openingMode: 'dice-roll',
      seats: [{ openingRoll: [6, 4] }],
    })
  })

  it('persistência preserva prazo e lance lacrado durante o Leilão da Largada', async () => {
    const f = fixture()
    const t = f.make('t-host')
    await t.connect()
    const hostSeat = { ...seat('t-host', true), openingBid: 350, bidLocked: true }
    const room: Room = {
      id: 'sala1',
      status: 'bidding',
      openingAuction: { closesAt: 45_000 },
      seats: [hostSeat],
    }
    await t.saveRoom(room)

    expect(await t.loadRoom()).toEqual(normalizeRoom(room))
  })

  it('saveRoom NÃO apaga a partida em andamento (upsert parcial)', async () => {
    const f = fixture()
    const t = f.make('t-host')
    await t.connect()
    // 043, T043/T044: `write_snapshot`/`write_room` só aceitam quem já é o anfitrião da linha
    // — precisa existir via `saveRoom` antes de qualquer `saveSnapshot` (é a ordem real de
    // `host.ts`: `ensureOpen()` sempre grava a sala antes do 1º snapshot).
    await t.saveRoom({ ...ROOM, status: 'playing', seats: [seat('t-host', true)] })
    // `log: []` e `paused: null` — supabaseTransport normaliza os dois no load (040/041).
    const game = { marcador: 'estado-da-partida', log: [], paused: null } as never
    await t.saveSnapshot({ seq: 7, game, secrets: { hands: {}, decks: {} }, room: { ...ROOM, status: 'playing', seats: [seat('t-host', true)] } })

    // Uma mudança de ASSENTOS no meio da partida não pode zerar `game`/`seq`. `seats: []` de
    // propósito — o anfitrião ATUAL da linha (já estabelecida acima) pode reescrever com
    // QUALQUER conteúdo; a exigência de "estar marcado host DENTRO do payload" vale só pra
    // sala NOVA (write_room, T043/T044), não pra quem já é o dono da linha existente.
    await t.saveRoom({ ...ROOM, status: 'playing', seats: [] })

    const snap = await t.loadSnapshot()
    expect(snap?.seq).toBe(7)
    // O adapter remoto pode acrescentar defaults compatíveis ao normalizar snapshots
    // legados (paused/log e, desde 047, coleção de propostas).
    expect(snap?.game).toMatchObject(game)
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
    // 043, T043/T044: `write_snapshot` exige o chamador (`t-host`) declarado host DENTRO do
    // payload pra sala nova — vale só o suficiente pra passar na autorização, o resto destes
    // testes é sobre a fila de gravação (`durableWrites`)/guarda monotônica, não sobre sala.
    const ROOM_STUB: Room = { id: 'sala1', status: 'playing', seats: [seat('t-host', true)] }
    const snap = (seq: number): PersistedSnapshot => ({ seq, game: { marcador: seq } as never, secrets: { hands: {}, decks: {} }, room: ROOM_STUB })

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
