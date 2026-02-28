// Adapter Supabase da porta `Transport` (spec 037/043, T020). Não importa
// `@supabase/supabase-js` (recebe o cliente por interface estrutural) para o build ficar verde
// sem a dependência: quando for conectar de verdade, faça `bun add @supabase/supabase-js`, crie
// o cliente com `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` e passe-o aqui. A migration
// `supabase/migrations/0001_rooms_snapshots.sql` cria a tabela `rooms`; `0003_attested_identity.sql`
// (043) traz as políticas de tópico que este adapter pressupõe.
//
// TOPOLOGIA DE TRÊS TÓPICOS (043, D2/D3 do plan) — o remetente vem do ENDEREÇO, não do payload:
//   • `room:<id>:lobby` — sala publicada, recusa de entrada, aviso de reanexação. Só a
//     autoridade escreve; qualquer sessão autenticada lê.
//   • `room:<id>:play`  — comando aceito (parte PÚBLICA). Só a autoridade escreve; só quem tem
//     assento lê.
//   • `room:<id>:s:<uid>` — comando do jogador, presença do assento, parte PRIVADA do aceito.
//     Só o dono e a autoridade escrevem/leem. A autoridade assina um tópico destes POR
//     ASSENTO (`watchSeat`/`unwatchSeat`, chamados por `host.ts`) — e nunca chama `track()`
//     nos que não são o seu, para a presença observada ali ser só a do dono (D2).
//
// `onPresenceSync` continua entregando o conjunto COMPLETO (contrato §2), mas essa completude
// agora é uma garantia da AUTORIDADE (que soma `own` + todo assento observado) — um convidado
// só enxerga o próprio tópico, e é assim que deveria ser: ele nunca precisou ver a presença
// alheia, só a autoridade precisa reconciliar `seats[].connected` (FR-021 da 041).
import type { AcceptedCommand, CommandEnvelope, ConnStatus, JoinRequest, PersistedSnapshot, PresenceChange, Transport, Unsubscribe } from './transport'
import { toPublicRoom, type JoinError, type PublicRoom, type Room } from './room'
import { normalizeLog } from '@/game/log'
import type { PauseState } from '@/game/turn/types'

// Migração de dados (041, data-model — Migração de dados): salas persistidas ANTES desta
// spec têm `game.paused` como booleano. `since` recebe o instante da LEITURA, nunca `0` — o
// momento real da pausa não foi gravado, e assumir a época faria a retomada deslocar prazos
// por décadas. É a única perda aceita, e só afeta salas criadas antes do deploy.
function normalizePaused(paused: unknown, readAt: number): PauseState | null {
  if (paused === true) return { causes: ['disconnect'], since: readAt }
  if (paused && typeof paused === 'object') return paused as PauseState // já no formato novo
  return null // `false` ou ausente
}

// Absorve `normalizeLog` (021/040) e a migração de `paused` legado — o mesmo ponto onde
// `loadSnapshot` já normalizava o log agora normaliza o snapshot inteiro.
export function normalizeSnapshot(game: PersistedSnapshot['game'], now: () => number = Date.now): PersistedSnapshot['game'] {
  return {
    ...game,
    log: normalizeLog(game.log ?? []),
    paused: normalizePaused((game as { paused?: unknown }).paused, now()),
  }
}

// Subconjunto estrutural do supabase-js efetivamente usado (evita depender do pacote no build).
export interface SupabaseChannelLike {
  on(type: 'broadcast', filter: { event: string }, cb: (msg: { payload: unknown }) => void): SupabaseChannelLike
  on(type: 'presence', filter: { event: 'join' | 'leave' }, cb: (payload: { key: string; newPresences?: unknown[]; leftPresences?: unknown[] }) => void): SupabaseChannelLike
  on(type: 'presence', filter: { event: 'sync' }, cb: () => void): SupabaseChannelLike
  presenceState(): Record<string, unknown[]>
  send(msg: { type: 'broadcast'; event: string; payload: unknown }): Promise<unknown>
  track(state: Record<string, unknown>): Promise<unknown>
  subscribe(cb?: (status: string) => void): SupabaseChannelLike
  unsubscribe(): Promise<unknown>
}

export interface SupabaseLike {
  channel(name: string, opts?: unknown): SupabaseChannelLike
  from(table: string): {
    upsert(row: Record<string, unknown>): PromiseLike<{ error: unknown }>
    select(cols: string): { eq(col: string, val: string): { maybeSingle(): PromiseLike<{ data: RoomRow | null; error: unknown }> } }
  }
  // 043, D4 — a escada de entrada por RPC (`request_seat`/`reattach_by_code`, security definer
  // no servidor). `data` é `unknown`: cada chamador conhece o formato da SUA função.
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }>
}

interface RoomRow {
  id: string
  status: string
  seats: Room['seats']
  seq: number
  game: PersistedSnapshot['game'] | null
}

const EVENT = { submit: 'submit', accepted: 'accepted', room: 'room', join: 'join', rejected: 'rejected', reattached: 'reattached' } as const
const seatTopic = (roomId: string, uid: string): string => `room:${roomId}:s:${uid}`

export function supabaseTransport(supabase: SupabaseLike, roomId: string, uid: string): Transport {
  const submitCbs: ((cmd: CommandEnvelope, fromUid: string) => void)[] = []
  const broadcastCbs: ((cmd: AcceptedCommand) => void)[] = []
  const roomCbs: ((room: PublicRoom) => void)[] = []
  const presenceCbs: ((change: PresenceChange) => void)[] = []
  const joinReqCbs: ((who: JoinRequest, fromUid: string) => void)[] = []
  const joinRejCbs: ((target: string, reason: JoinError) => void)[] = []
  const statusCbs: ((status: ConnStatus) => void)[] = []
  const presenceSyncCbs: ((uids: ReadonlySet<string>) => void)[] = []
  const reattachCbs: (() => void)[] = []
  const live = new Map<string, number>() // presenças vivas por uid — base do takeover, somada entre TODOS os canais de assento observados
  const off = <T>(arr: T[], cb: T): Unsubscribe => () => {
    const i = arr.indexOf(cb)
    if (i >= 0) arr.splice(i, 1)
  }

  // — presença: agregada entre `own` e cada assento observado (`watchSeat`) —
  function emitPresenceSyncAll(): void {
    const uids = new Set([...live.entries()].filter(([, n]) => n > 0).map(([k]) => k))
    for (const cb of presenceSyncCbs) cb(uids)
  }
  function onSeatPresenceJoin(key: string, newPresences?: unknown[]): void {
    const before = live.get(key) ?? 0
    live.set(key, before + (newPresences?.length ?? 1))
    for (const cb of presenceCbs) cb({ uid: key, connected: true, takeover: before > 0 })
    emitPresenceSyncAll()
  }
  function onSeatPresenceLeave(key: string, leftPresences?: unknown[]): void {
    const after = (live.get(key) ?? 0) - (leftPresences?.length ?? 1)
    if (after > 0) {
      live.set(key, after)
      // Sobrou conexão viva com este uid: é a ponta antiga de um takeover, não uma queda.
      for (const cb of presenceCbs) cb({ uid: key, connected: false, takeover: true })
    } else {
      live.delete(key)
      for (const cb of presenceCbs) cb({ uid: key, connected: false, takeover: false })
    }
    emitPresenceSyncAll()
  }

  // — status combinado: 'connected' só quando os TRÊS canais-base estão assinados —
  const baseUp = { lobby: false, play: false, own: false }
  let resolveConnect: (() => void) | null = null
  function noteBaseStatus(key: keyof typeof baseUp, up: boolean): void {
    baseUp[key] = up
    const allUp = baseUp.lobby && baseUp.play && baseUp.own
    for (const cb of statusCbs) cb(allUp ? 'connected' : 'reconnecting')
    if (allUp) resolveConnect?.()
  }

  // `broadcast.self: true` é OBRIGATÓRIO nos três: no modelo uniforme todo participante —
  // inclusive o host — submete/difunde pelo canal e aplica só o que volta (UI pessimista).
  const lobby = supabase.channel(`room:${roomId}:lobby`, { config: { broadcast: { self: true }, private: true } })
  const play = supabase.channel(`room:${roomId}:play`, { config: { broadcast: { self: true }, private: true } })
  const own = supabase.channel(seatTopic(roomId, uid), { config: { presence: { key: uid }, broadcast: { self: true }, private: true } })

  lobby
    .on('broadcast', { event: EVENT.join }, ({ payload }) => {
      const p = payload as { who: JoinRequest; uid: string }
      for (const cb of joinReqCbs) cb(p.who, p.uid)
    })
    .on('broadcast', { event: EVENT.rejected }, ({ payload }) => {
      const p = payload as { uid: string; reason: JoinError }
      for (const cb of joinRejCbs) cb(p.uid, p.reason)
    })
    .on('broadcast', { event: EVENT.room }, ({ payload }) => {
      for (const cb of roomCbs) cb(payload as PublicRoom)
    })
    // Aviso de reanexação (043, D4) — carimbado pela RPC `reattach_by_code`, que roda no
    // servidor fora da política normal de escrita de `:lobby`. Nenhum payload a interpretar:
    // é só o sinal para recarregar (`onReattachNotice`).
    .on('broadcast', { event: EVENT.reattached }, () => {
      for (const cb of reattachCbs) cb()
    })

  play.on('broadcast', { event: EVENT.accepted }, ({ payload }) => {
    for (const cb of broadcastCbs) cb(payload as AcceptedCommand)
  })

  own
    .on('broadcast', { event: EVENT.submit }, ({ payload }) => {
      // O remetente é o DONO deste canal — `uid` do closure, nunca do payload (D3).
      for (const cb of submitCbs) cb((payload as { cmd: CommandEnvelope }).cmd, uid)
    })
    .on('broadcast', { event: EVENT.accepted }, ({ payload }) => {
      for (const cb of broadcastCbs) cb(payload as AcceptedCommand) // parte PRIVADA do aceito (D9)
    })
    // TAKEOVER (FR-006a) por CONTAGEM de presenças vivas. Ver `supabaseTransport.ts` da 041
    // para o histórico do defeito 1 — aqui a fonte passa a ser o canal do PRÓPRIO assento.
    .on('presence', { event: 'join' }, ({ key, newPresences }) => onSeatPresenceJoin(key, newPresences))
    .on('presence', { event: 'leave' }, ({ key, leftPresences }) => onSeatPresenceLeave(key, leftPresences))
    .on('presence', { event: 'sync' }, () => emitPresenceSyncAll())

  // — assentos observados pela AUTORIDADE (043, D2) — um canal por assento, sem `track()` —
  const watched = new Map<string, SupabaseChannelLike>()

  return {
    uid,

    // Resolve quando os TRÊS canais-base estiverem 'SUBSCRIBED'. `track()` só no PRÓPRIO —
    // é o que faz uma queda de rede reanunciar presença ao voltar (041, D6), e só a presença
    // do dono, nunca a de quem a autoridade observa por `watchSeat`.
    async connect(): Promise<void> {
      await new Promise<void>((resolve) => {
        resolveConnect = resolve
        lobby.subscribe((status) => noteBaseStatus('lobby', status === 'SUBSCRIBED'))
        play.subscribe((status) => noteBaseStatus('play', status === 'SUBSCRIBED'))
        own.subscribe((status) => {
          const up = status === 'SUBSCRIBED'
          if (up) void own.track({ uid }) // toda vez: reassinatura reanuncia presença (FR-001)
          noteBaseStatus('own', up)
        })
      })
    },

    disconnect(): void {
      void lobby.unsubscribe()
      void play.unsubscribe()
      void own.unsubscribe()
      for (const ch of watched.values()) void ch.unsubscribe()
      watched.clear()
    },

    onStatus(cb): Unsubscribe {
      statusCbs.push(cb)
      return off(statusCbs, cb)
    },

    onPresenceSync(cb): Unsubscribe {
      presenceSyncCbs.push(cb)
      cb(new Set([...live.entries()].filter(([, n]) => n > 0).map(([k]) => k))) // estado inicial (contrato §2.2)
      return off(presenceSyncCbs, cb)
    },

    submit(cmd: CommandEnvelope): void {
      void own.send({ type: 'broadcast', event: EVENT.submit, payload: { cmd } })
    },
    onSubmit(cb): Unsubscribe {
      submitCbs.push(cb)
      return off(submitCbs, cb)
    },

    broadcast(cmd: AcceptedCommand): void {
      void play.send({ type: 'broadcast', event: EVENT.accepted, payload: cmd })
    },
    onBroadcast(cb): Unsubscribe {
      broadcastCbs.push(cb)
      return off(broadcastCbs, cb)
    },

    // Parte PRIVADA (043, D9/D10) — no tópico do PRÓPRIO canal se o alvo sou eu, senão no
    // canal observado daquele assento (`watchSeat` deve ter sido chamado antes; sem ele, a
    // política do servidor recusaria de qualquer forma — aqui, sem canal, não há o que enviar).
    broadcastPrivate(targetUid: string, cmd: AcceptedCommand): void {
      const ch = targetUid === uid ? own : watched.get(targetUid)
      if (!ch) return
      void ch.send({ type: 'broadcast', event: EVENT.accepted, payload: cmd })
    },

    watchSeat(seatUid: string): void {
      if (seatUid === uid || watched.has(seatUid)) return // o próprio já está em `own`
      const ch = supabase.channel(seatTopic(roomId, seatUid), { config: { presence: { key: seatUid }, broadcast: { self: true }, private: true } })
      ch
        .on('broadcast', { event: EVENT.submit }, ({ payload }) => {
          for (const cb of submitCbs) cb((payload as { cmd: CommandEnvelope }).cmd, seatUid)
        })
        .on('presence', { event: 'join' }, ({ key, newPresences }) => onSeatPresenceJoin(key, newPresences))
        .on('presence', { event: 'leave' }, ({ key, leftPresences }) => onSeatPresenceLeave(key, leftPresences))
        .on('presence', { event: 'sync' }, () => emitPresenceSyncAll())
        .subscribe() // SEM `track()` — a presença observada aqui é só a do dono (D2)
      watched.set(seatUid, ch)
    },

    unwatchSeat(seatUid: string): void {
      const ch = watched.get(seatUid)
      if (!ch) return
      watched.delete(seatUid)
      void ch.unsubscribe()
      live.delete(seatUid)
      emitPresenceSyncAll()
    },

    // 043, D4 — RPC (`request_seat`), não mais broadcast em `:lobby`: o pedinte ainda não tem
    // assento, e escrever em `:lobby` é privilégio da autoridade a partir da Fase 2. A função
    // carimba `auth.uid()` no servidor e difunde ao lobby por conta própria (`realtime.send`).
    async requestJoin(who: JoinRequest): Promise<void> {
      const { error } = await supabase.rpc('request_seat', {
        room_id: roomId, name: who.name, color: who.color, piece: who.piece ?? null,
      })
      if (error) throw error
    },
    onJoinRequest(cb): Unsubscribe {
      joinReqCbs.push(cb)
      return off(joinReqCbs, cb)
    },

    rejectJoin(target: string, reason: JoinError): void {
      void lobby.send({ type: 'broadcast', event: EVENT.rejected, payload: { uid: target, reason } })
    },
    onJoinRejected(cb): Unsubscribe {
      joinRejCbs.push(cb)
      return off(joinRejCbs, cb)
    },

    // 043, D4 — `reattach_by_code`: única regra de domínio em SQL. `security definer` bypassa
    // a ausência de `update` para não-autoridade (o ponto inteiro é não precisar de uma).
    async reattach(_roomId: string, code: string): Promise<{ ok: true } | { ok: false; reason: JoinError }> {
      const { data, error } = await supabase.rpc('reattach_by_code', { room_id: roomId, code })
      if (error) throw error
      return data as { ok: true } | { ok: false; reason: JoinError }
    },
    onReattachNotice(cb): Unsubscribe {
      reattachCbs.push(cb)
      return off(reattachCbs, cb)
    },

    // Defesa em profundidade (043, T023) — ver o mesmo ponto em `localTransport.ts`: `Room` é
    // estruturalmente um superconjunto de `PublicRoom`, então o TypeScript não impede alguém
    // de passar a linha inteira aqui por engano. A garantia mora no FIO, não na disciplina de
    // quem chama.
    publishRoom(room: PublicRoom): void {
      const safe = toPublicRoom(room as unknown as Room)
      void lobby.send({ type: 'broadcast', event: EVENT.room, payload: safe })
    },
    onRoom(cb): Unsubscribe {
      roomCbs.push(cb)
      return off(roomCbs, cb)
    },

    // Escreve só as colunas da SALA (upsert parcial): no lobby ainda não há `GameState`, e
    // durante a partida o `game`/`seq` da linha não pode ser sobrescrito por uma mudança de
    // assentos (o `ON CONFLICT DO UPDATE` do supabase-js toca apenas as colunas enviadas).
    async saveRoom(room: Room): Promise<void> {
      const { error } = await supabase.from('rooms').upsert({ id: roomId, status: room.status, seats: room.seats })
      if (error) throw error
    },

    // 043, T025 — a PRÉVIA (`room_preview`, D5): não há mais `select` direto na tabela (a
    // política fecha a partir da Fase 2). Devolve os assentos sem `reentryCode` de ninguém,
    // EXCETO o do assento de quem chamou — é daqui que o dono lê o próprio código.
    async loadRoom(): Promise<Room | null> {
      const { data, error } = await supabase.rpc('room_preview', { room_id: roomId })
      if (error) throw error
      if (!data) return null
      const row = data as { id: string; status: Room['status']; seats: Room['seats'] }
      return { id: row.id, status: row.status, seats: row.seats.map((s) => ({ ...s, reentryCode: s.reentryCode ?? '' })) }
    },

    onPresence(cb): Unsubscribe {
      presenceCbs.push(cb)
      return off(presenceCbs, cb)
    },

    async saveSnapshot(snap: PersistedSnapshot): Promise<void> {
      const { error } = await supabase.from('rooms').upsert({
        id: roomId,
        status: snap.room.status,
        seats: snap.room.seats,
        seq: snap.seq,
        game: snap.game,
      })
      if (error) throw error
    },

    // O adapter CRU não repete sozinho, então nunca esgota — quem sobrescreve isto é o
    // decorator `durableWrites` (041, D8), único ponto de montagem de produção.
    onWriteExhausted: () => () => {},
    onWriteRecovered: () => () => {},

    async loadSnapshot(): Promise<PersistedSnapshot | null> {
      const { data, error } = await supabase.from('rooms').select('id,status,seats,seq,game').eq('id', roomId).maybeSingle()
      if (error) throw error
      if (!data || data.game == null || data.seq < 0) return null
      const room: Room = { id: data.id, status: data.status as Room['status'], seats: data.seats }
      const game = normalizeSnapshot(data.game)
      return { seq: data.seq, game, room }
    },
  }
}
