// Fake in-memory do subconjunto do supabase-js que `supabaseTransport` usa.
//
// Card 6 do review de arquitetura: `supabaseTransport.ts` era o maior `.ts` sem teste do
// repositório — e é o adapter que roda em PRODUÇÃO. `SupabaseLike`/`SupabaseChannelLike`
// (supabaseTransport.ts) já foram desenhadas como interfaces ESTRUTURAIS, justamente para o
// build não depender do pacote. O mesmo desenho torna o adapter testável sem rede.
//
// 041 (D14): ganhou faltas injetáveis — queda/restauração de CANAL, recusa de gravação/leitura
// e a guarda monotônica que o trigger SQL também aplica em produção.
//
// 043 (D2/D3, T014): ganhou ROTEAMENTO POR TÓPICO — antes um `send()`/`track()` alcançava
// TODO canal já assinado no broker, porque só existia um canal por sala. Com três classes de
// tópico (`:lobby`, `:play`, `:s:<uid>`) coexistindo na MESMA sala, isso vazaria mensagem de
// um tópico para outro. Agora cada `FakeChannel` roteia só para quem está no MESMO tópico, e
// simula a POLÍTICA de escrita (policies.md §2): `lobby`/`play` só a autoridade escreve; um
// tópico de assento só o dono ou a autoridade. NÃO é a prova real — é o caminho do código
// exercitado headless; quem prova a política de verdade é `scripts/attack.ts` na Fase 6.
import type { SupabaseChannelLike, SupabaseLike } from '@/net/supabaseTransport'
import { mergeRoomMatchHistory } from '@/net/roomHistory'

type BroadcastCb = (msg: { payload: unknown }) => void
type PresenceCb = (payload: { key: string; newPresences?: unknown[]; leftPresences?: unknown[] }) => void
type SyncCb = () => void

interface Broker {
  channels: Set<FakeChannel>
  rows: Map<string, Record<string, unknown>>
  writeFailures: number | 'always'
  readFails: boolean
}

// Deriva quem é a autoridade (`isHost`) da ÚLTIMA linha upada de `rooms` — espelha a política
// SQL real "update/insert só o uid do assento de anfitrião" (D2). Antes de qualquer upsert,
// `undefined`: nada além de escrita no PRÓPRIO tópico de assento é permitido nesse instante
// (fail-closed), o que basta porque nenhum caminho de produção escreve em `lobby`/`play`
// antes do primeiro `saveRoom` (host.ts `ensureOpen()`).
function hostUidOf(broker: Broker, roomId: string): string | undefined {
  const row = broker.rows.get(`rooms:${roomId}`)
  const seats = row?.seats as { uid: string; isHost: boolean }[] | undefined
  return seats?.find((s) => s.isHost)?.uid
}

// `room:<id>:lobby` | `room:<id>:play` | `room:<id>:s:<uid>` → { roomId, class, seatUid? }
function parseTopic(topic: string): { roomId: string; cls: 'lobby' | 'play' | 'seat'; seatUid?: string } | null {
  const m = /^room:(.+):(lobby|play|s)(?::(.+))?$/.exec(topic)
  if (!m) return null
  const [, roomId, cls, seatUid] = m
  if (cls === 's') return seatUid ? { roomId, cls: 'seat', seatUid } : null
  return { roomId, cls: cls as 'lobby' | 'play' }
}

// Pode `authUid` ESCREVER (send/track) neste tópico? (policies.md §2 — a leitura/`subscribe`
// não é modelada aqui: nenhum caso de T011 depende dela, e a prova real fica para a Fase 6.)
function canWrite(broker: Broker, topic: string, authUid: string): boolean {
  const parsed = parseTopic(topic)
  if (!parsed) return false
  if (parsed.cls === 'seat') return authUid === parsed.seatUid || authUid === hostUidOf(broker, parsed.roomId)
  return authUid === hostUidOf(broker, parsed.roomId) // lobby/play: só a autoridade
}

class FakeChannel implements SupabaseChannelLike {
  private broadcastCbs = new Map<string, BroadcastCb[]>()
  private joinCbs: PresenceCb[] = []
  private leaveCbs: PresenceCb[] = []
  private syncCbs: SyncCb[] = []
  private statusCb: ((status: string) => void) | undefined
  subscribed = false
  private tracked = false

  private readonly broker: Broker
  readonly topic: string // nome do canal — o roteamento é por ele, NUNCA pela identidade de quem criou
  readonly authUid: string // identidade AUTENTICADA do cliente dono deste objeto — base da política
  /** `broadcast.self` — o Realtime só ecoa o próprio envio quando ligado. */
  private readonly selfEcho: boolean

  constructor(broker: Broker, topic: string, authUid: string, selfEcho: boolean) {
    this.broker = broker
    this.topic = topic
    this.authUid = authUid
    this.selfEcho = selfEcho
  }

  private sameTopic(): FakeChannel[] {
    return [...this.broker.channels].filter((ch) => ch.topic === this.topic)
  }

  on(type: 'broadcast', filter: { event: string }, cb: (msg: { payload: unknown }) => void): SupabaseChannelLike
  on(type: 'presence', filter: { event: 'join' | 'leave' }, cb: PresenceCb): SupabaseChannelLike
  on(type: 'presence', filter: { event: 'sync' }, cb: SyncCb): SupabaseChannelLike
  on(type: 'broadcast' | 'presence', filter: { event: string }, cb: BroadcastCb | PresenceCb | SyncCb): SupabaseChannelLike {
    if (type === 'broadcast') {
      const list = this.broadcastCbs.get(filter.event) ?? []
      list.push(cb as BroadcastCb)
      this.broadcastCbs.set(filter.event, list)
    } else if (filter.event === 'join') {
      this.joinCbs.push(cb as PresenceCb)
    } else if (filter.event === 'leave') {
      this.leaveCbs.push(cb as PresenceCb)
    } else {
      this.syncCbs.push(cb as SyncCb)
    }
    return this
  }

  presenceState(): Record<string, unknown[]> {
    const state: Record<string, unknown[]> = {}
    for (const ch of this.sameTopic()) {
      if (ch.tracked) state[ch.authUid] = [{ uid: ch.authUid }]
    }
    return state
  }

  private emitSyncAll(): void {
    for (const ch of this.sameTopic()) {
      if (!ch.subscribed) continue
      for (const cb of ch.syncCbs) cb()
    }
  }

  // Difusão PRIVILEGIADA (043, D4) — o equivalente de `realtime.send()` chamado de DENTRO de
  // uma função `security definer` (RPC). Ao contrário de `send()`, não passa por `canWrite`:
  // é exatamente o ponto da RPC existir (`request_seat` fala em nome de quem ainda não tem
  // assento; `reattach_by_code` fala sem o anfitrião estar vivo).
  static deliverBroadcast(channels: Set<FakeChannel>, topic: string, event: string, payload: unknown): void {
    for (const ch of channels) {
      if (ch.topic !== topic || !ch.subscribed) continue
      for (const cb of ch.broadcastCbs.get(event) ?? []) cb({ payload })
    }
  }

  send(msg: { type: 'broadcast'; event: string; payload: unknown }): Promise<unknown> {
    if (!this.subscribed) return Promise.resolve({ status: 'not_subscribed' }) // igual ao real: cai no chão
    if (!canWrite(this.broker, this.topic, this.authUid)) return Promise.resolve({ status: 'error' }) // política recusa (D2)
    for (const ch of this.sameTopic()) {
      if (ch === this && !this.selfEcho) continue
      if (!ch.subscribed) continue
      for (const cb of ch.broadcastCbs.get(msg.event) ?? []) cb({ payload: msg.payload })
    }
    return Promise.resolve({ status: 'ok' })
  }

  track(): Promise<unknown> {
    if (!canWrite(this.broker, this.topic, this.authUid)) return Promise.resolve({}) // política recusa (D2)
    if (this.tracked) return Promise.resolve({})
    this.tracked = true
    for (const ch of this.sameTopic()) {
      if (!ch.subscribed) continue
      for (const cb of ch.joinCbs) cb({ key: this.authUid, newPresences: [{ uid: this.authUid }] })
    }
    this.emitSyncAll()
    return Promise.resolve({})
  }

  subscribe(cb?: (status: string) => void): SupabaseChannelLike {
    this.subscribed = true
    this.statusCb = cb
    this.broker.channels.add(this)
    cb?.('SUBSCRIBED')
    // Catch-up de presença: quem já está `tracked` no MESMO tópico dispara 'join' para o
    // recém-assinado — espelha o 'sync' inicial do Realtime (presença JÁ existente chega ao
    // assinar, não só deltas futuros). Sem isto, `watchSeat` num assento cujo dono já estava
    // presente nunca aprenderia dessa presença — e uma queda dele pareceria uma desconexão
    // "limpa" (sem par de join anterior) em vez do takeover que de fato é.
    for (const ch of this.sameTopic()) {
      if (ch === this || !ch.tracked) continue
      for (const cb2 of this.joinCbs) cb2({ key: ch.authUid, newPresences: [{ uid: ch.authUid }] })
    }
    this.emitSyncAll()
    return this
  }

  unsubscribe(): Promise<unknown> {
    const wasTracked = this.tracked
    this.subscribed = false
    this.tracked = false
    this.broker.channels.delete(this)
    if (wasTracked) {
      for (const ch of this.sameTopic()) {
        if (!ch.subscribed) continue
        for (const cb of ch.leaveCbs) cb({ key: this.authUid, leftPresences: [{ uid: this.authUid }] })
      }
      this.emitSyncAll()
    }
    return Promise.resolve({})
  }

  // Falta injetável (041, D14): queda de CANAL — não uma saída de sala. O canal permanece
  // no broker (para `simulateResubscribe` reconectar o MESMO objeto), a presença cai e o
  // status vira 'CHANNEL_ERROR'. É o cenário do defeito 1: reassinatura precisa reanunciar
  // presença, e só a `track()` seguinte (disparada pela produção ao ver 'SUBSCRIBED') faz isso.
  simulateDrop(): void {
    if (!this.subscribed) return
    const wasTracked = this.tracked
    this.subscribed = false
    this.tracked = false
    if (wasTracked) {
      for (const ch of this.sameTopic()) {
        if (ch === this || !ch.subscribed) continue
        for (const cb of ch.leaveCbs) cb({ key: this.authUid, leftPresences: [{ uid: this.authUid }] })
      }
      this.emitSyncAll()
    }
    this.statusCb?.('CHANNEL_ERROR')
  }

  simulateResubscribe(): void {
    if (this.subscribed) return
    this.subscribed = true
    this.statusCb?.('SUBSCRIBED')
  }
}

export interface FakeSupabase {
  client(uid: string): SupabaseLike
  /** Linhas da tabela `rooms` — para asserir upsert parcial. */
  rows: Map<string, Record<string, unknown>>
  /** O canal MAIS RECENTE assinado por este uid AUTENTICADO — para simular queda/restauração
   * (041, D14). Com três tópicos por sala (043), "mais recente" tende a ser o canal do
   * PRÓPRIO assento (`s:<uid>`), o último que `connect()` assina. */
  channelByUid(uid: string): { simulateDrop(): void; simulateResubscribe(): void } | undefined
  /** Recusa a próxima gravação `n` vezes (ou sempre, com `'always'`) — FR-012/013, SC-003. */
  failWrites(n: number | 'always'): void
  /** Recusa a próxima leitura de snapshot/sala — FR-004/005. */
  failRead(fail: boolean): void
}

export function fakeSupabase(): FakeSupabase {
  const broker: Broker = { channels: new Set(), rows: new Map(), writeFailures: 0, readFails: false }

  function consumeWriteFailure(): boolean {
    if (broker.writeFailures === 'always') return true
    if (broker.writeFailures > 0) {
      broker.writeFailures -= 1
      return true
    }
    return false
  }

  return {
    rows: broker.rows,
    channelByUid(uid: string) {
      return [...broker.channels].findLast((ch) => ch.authUid === uid)
    },
    failWrites(n: number | 'always'): void {
      broker.writeFailures = n
    },
    failRead(fail: boolean): void {
      broker.readFails = fail
    },
    client(uid: string): SupabaseLike {
      return {
        channel(name: string, opts?: unknown): SupabaseChannelLike {
          const cfg = opts as { config?: { broadcast?: { self?: boolean } } } | undefined
          return new FakeChannel(broker, name, uid, cfg?.config?.broadcast?.self === true)
        },
        from(table: string) {
          return {
            upsert(row: Record<string, unknown>) {
              if (consumeWriteFailure()) return Promise.resolve({ error: new Error('injected write failure') })
              const id = String(row.id)
              const key = `${table}:${id}`
              const existing = broker.rows.get(key)
              // Guarda monotônica (041, D9) — espelha `0002_snapshot_monotonic.sql`: escrita
              // com `seq` MENOR que o já gravado é NO-OP silencioso, não erro. Estritamente
              // `<`, para não bloquear o upsert parcial de `saveRoom` (que não envia `seq`).
              if (existing && typeof row.seq === 'number' && typeof existing.seq === 'number' && row.seq < existing.seq) {
                return Promise.resolve({ error: null })
              }
              broker.rows.set(key, { ...(existing ?? {}), ...row })
              return Promise.resolve({ error: null })
            },
            select(_cols: string) {
              return {
                eq(_col: string, val: string) {
                  return {
                    maybeSingle() {
                      if (broker.readFails) return Promise.resolve({ data: null as never, error: new Error('injected read failure') })
                      const row = broker.rows.get(`${table}:${val}`)
                      return Promise.resolve({ data: (row ?? null) as never, error: null })
                    },
                  }
                },
              }
            },
          }
        },
        // 043, D4 — espelho das duas `security definer` de `0003_attested_identity.sql`. Não
        // é a prova real (isso é a Fase 6, contra Postgres de verdade): é o suficiente para o
        // adapter rodar headless pelo MESMO caminho de código que a produção usa.
        rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }> {
          const roomId = String(args.room_id)
          if (fn === 'request_seat') {
            FakeChannel.deliverBroadcast(broker.channels, `room:${roomId}:lobby`, 'join', {
              who: { name: args.name, color: args.color, piece: args.piece },
              uid,
            })
            return Promise.resolve({ data: null, error: null })
          }
          if (fn === 'reattach_by_code') {
            const key = `rooms:${roomId}`
            const row = broker.rows.get(key)
            const seats = (row?.seats as { playerId: string; reentryCode: string }[] | undefined) ?? []
            const normalize = (s: string): string => s.replace(/\s+/g, '').toUpperCase()
            const target = seats.find((s) => normalize(s.reentryCode ?? '') === normalize(String(args.code)))
            if (!target) return Promise.resolve({ data: { ok: false, reason: 'bad-code' }, error: null })
            const newSeats = seats.map((s) => (s.playerId === target.playerId ? { ...s, uid, connected: true } : s))
            broker.rows.set(key, { ...(row ?? {}), seats: newSeats })
            FakeChannel.deliverBroadcast(broker.channels, `room:${roomId}:lobby`, 'reattached', {})
            return Promise.resolve({ data: { ok: true }, error: null })
          }
          // 043, T022 — espelho de `room_preview`: sem `reentryCode` de ninguém, EXCETO o do
          // assento de quem chamou (D5). A AUTORIDADE recebe todos (T043/D-043): no lobby não
          // há snapshot, e é desta leitura que ela remonta a sala que grava em seguida.
          if (fn === 'room_preview') {
            const row = broker.rows.get(`rooms:${roomId}`)
            if (!row) return Promise.resolve({ data: null, error: null })
            const seats = (row.seats as { uid: string; isHost?: boolean; reentryCode?: string; openingBid?: number | null }[]) ?? []
            const scoped = seats.find((s) => s.uid === uid)?.isHost
              ? seats
              : seats.map((s) => (s.uid === uid
                ? s
                : { ...s, reentryCode: undefined, openingBid: row.status === 'bidding' ? undefined : s.openingBid }))
            return Promise.resolve({
              data: {
                id: row.id,
                status: row.status,
                matchGeneration: row.matchGeneration ?? 0,
                revision: row.seq ?? -1,
                openingMode: row.openingMode,
                openingAuction: row.openingAuction,
                matchHistory: row.matchHistory ?? [],
                boardId: row.boardId ?? 'atlas',
                seats: scoped,
              },
              error: null,
            })
          }
          // 043, T036/T037 — espelho de `read_snapshot`: `secrets` E `seats` filtrados pela
          // MESMA chave (D6). A autoridade (uid do assento `isHost`) recebe tudo — inclusive os
          // códigos, que é ela quem regrava; qualquer outro só a própria entrada de
          // `secrets.hands` (nunca `decks`) e só o PRÓPRIO `reentryCode` (T043).
          if (fn === 'read_snapshot') {
            if (broker.readFails) return Promise.resolve({ data: null, error: new Error('injected read failure') })
            const row = broker.rows.get(`rooms:${roomId}`)
            if (!row) return Promise.resolve({ data: null, error: null })
            const seats = (row.seats as { uid: string; isHost: boolean; reentryCode?: string }[]) ?? []
            const isHost = seats.find((s) => s.uid === uid)?.isHost ?? false
            const secrets = (row.secrets as { hands?: Record<string, unknown>; decks?: Record<string, unknown> } | undefined) ?? { hands: {}, decks: {} }
            const scoped = isHost
              ? secrets
              : { hands: uid in (secrets.hands ?? {}) ? { [uid]: secrets.hands![uid] } : {}, decks: {} }
            const scopedSeats = isHost
              ? row.seats
              : seats.map((s) => (s.uid === uid ? s : { ...s, reentryCode: undefined }))
            return Promise.resolve({
              data: {
                id: row.id,
                status: row.status,
                matchGeneration: row.matchGeneration ?? 0,
                revision: row.seq ?? -1,
                openingMode: row.openingMode,
                openingAuction: row.openingAuction,
                matchHistory: row.matchHistory ?? [],
                boardId: row.boardId ?? 'atlas',
                seats: scopedSeats,
                seq: row.seq,
                game: row.game,
                secrets: scoped,
              },
              error: null,
            })
          }
          // 043, T043/T044 — espelho de `write_room`/`write_snapshot`: sala NOVA exige o
          // chamador declarado host DENTRO do payload (impede criar em nome de outro uid);
          // sala EXISTENTE exige ser o anfitrião ATUAL da linha, com QUALQUER seats novo
          // (inclusive vazio — ex.: limpeza). Faz o MESMO upsert parcial que
          // `.from('rooms').upsert()` fazia antes. Achado em produção (não no headless): RLS
          // sem select policy faz UPDATE direto sempre afetar 0 linhas — daí a RPC existir.
          function authorizedToWrite(currentHost: string | undefined, claimedSeats: unknown): boolean {
            if (currentHost !== undefined) return currentHost === uid
            const seats = (claimedSeats as { uid: string; isHost: boolean }[]) ?? []
            return seats.some((s) => s.isHost && s.uid === uid)
          }
          // Espelho de `preserve_seat_codes` (043, T043/D-043): o código já gravado sobrevive a
          // qualquer escrita, casando por `playerId` — nem a autoridade o apaga.
          type SeatRow = { playerId: string; reentryCode?: string }
          function preserveSeatCodes(claimedSeats: unknown): unknown {
            const existing = broker.rows.get(`rooms:${roomId}`)
            const stored = (existing?.seats as SeatRow[] | undefined) ?? []
            if (stored.length === 0) return claimedSeats
            const known = new Map(stored.filter((s) => s.reentryCode).map((s) => [s.playerId, s.reentryCode]))
            return ((claimedSeats as SeatRow[]) ?? []).map((s) => (s.reentryCode ? s : { ...s, reentryCode: known.get(s.playerId) ?? s.reentryCode }))
          }
          function mergeMatchHistory(stored: unknown, requested: unknown): unknown {
            return mergeRoomMatchHistory(stored, requested)
          }
          if (fn === 'write_room') {
            if (consumeWriteFailure()) return Promise.resolve({ data: null, error: new Error('injected write failure') })
            const key = `rooms:${roomId}`
            if (!authorizedToWrite(hostUidOf(broker, roomId), args.seats)) {
              return Promise.resolve({ data: null, error: new Error('not authorized to write this room') })
            }
            const existing = broker.rows.get(key)
            broker.rows.set(key, {
              ...(existing ?? {}),
              id: roomId,
              status: args.status,
              seats: preserveSeatCodes(args.seats),
              matchGeneration: args.match_generation ?? 0,
              openingMode: args.opening_mode,
              openingAuction: args.opening_auction,
              matchHistory: mergeMatchHistory(existing?.matchHistory, args.match_history),
              // Espelho da 0008: a coluna tem default 'atlas' e o valor gravado nunca muda
              // depois de existir (o CHECK real valida; aqui basta preservar/defaultar).
              boardId: existing?.boardId ?? args.board_id ?? 'atlas',
            })
            return Promise.resolve({ data: null, error: null })
          }
          // Guarda monotônica (041, D9) igual ao trigger SQL.
          if (fn === 'write_snapshot') {
            if (consumeWriteFailure()) return Promise.resolve({ data: null, error: new Error('injected write failure') })
            const key = `rooms:${roomId}`
            if (!authorizedToWrite(hostUidOf(broker, roomId), args.seats)) {
              return Promise.resolve({ data: null, error: new Error('not authorized to write this room') })
            }
            const existing = broker.rows.get(key)
            const incomingGeneration = Number(args.match_generation ?? 0)
            const storedGeneration = Number(existing?.matchGeneration ?? 0)
            if (existing && incomingGeneration < storedGeneration) {
              return Promise.resolve({ data: null, error: null })
            }
            if (
              existing
              && incomingGeneration === storedGeneration
              && typeof args.seq === 'number'
              && typeof existing.seq === 'number'
              && args.seq < existing.seq
            ) {
              return Promise.resolve({ data: null, error: null }) // no-op silencioso, como o trigger real
            }
            broker.rows.set(key, {
              ...(existing ?? {}),
              id: roomId,
              status: args.status,
              seats: preserveSeatCodes(args.seats),
              matchGeneration: incomingGeneration,
              openingMode: args.opening_mode,
              openingAuction: args.opening_auction,
              matchHistory: mergeMatchHistory(existing?.matchHistory, args.match_history),
              boardId: existing?.boardId ?? args.board_id ?? 'atlas',
              seq: args.seq,
              game: args.game,
              secrets: args.secrets,
            })
            return Promise.resolve({ data: null, error: null })
          }
          if (fn === 'reopen_room') {
            if (consumeWriteFailure()) return Promise.resolve({ data: null, error: new Error('injected write failure') })
            const key = `rooms:${roomId}`
            const existing = broker.rows.get(key)
            if (hostUidOf(broker, roomId) !== uid) {
              return Promise.resolve({ data: null, error: new Error('not authorized to reopen this room') })
            }
            const requested = Number(args.match_generation ?? 0)
            const current = Number(existing?.matchGeneration ?? 0)
            if (existing?.status === 'lobby' && requested === current && existing.game == null) {
              return Promise.resolve({ data: null, error: null })
            }
            if (existing?.status !== 'ended' || requested !== current + 1) {
              return Promise.resolve({ data: null, error: new Error('room is not ready for rematch') })
            }
            broker.rows.set(key, {
              ...(existing ?? {}),
              status: 'lobby',
              seats: preserveSeatCodes(args.seats),
              matchGeneration: requested,
              openingMode: args.opening_mode,
              openingAuction: null,
              boardId: existing?.boardId ?? args.board_id ?? 'atlas',
              game: null,
              secrets: {},
            })
            return Promise.resolve({ data: null, error: null })
          }
          return Promise.resolve({ data: null, error: new Error(`rpc desconhecida no fake: ${fn}`) })
        },
      }
    },
  }
}
