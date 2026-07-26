// Adapter Supabase da porta `Transport` (spec 037, T020) — CONNECT-READY. Não importa
// `@supabase/supabase-js` (recebe o cliente por interface estrutural) para o build ficar verde
// sem a dependência: quando for conectar de verdade, faça `bun add @supabase/supabase-js`, crie
// o cliente com `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` e passe-o aqui. A migration
// `supabase/migrations/0001_rooms_snapshots.sql` cria a tabela `rooms`.
//
// Mapeamento:
//   • comando guest→host  → Realtime broadcast, evento 'submit'
//   • comando aceito host→todos → broadcast, evento 'accepted'  (FR-010/011)
//   • estado da sala host→todos → broadcast, evento 'room'
//   • pedido de assento guest→host → broadcast, evento 'join'    (FR-002)
//   • recusa de assento host→guest → broadcast, evento 'rejected' (FR-005)
//   • (des)conexão → Realtime Presence (chave = token)          (FR-016/006a)
//   • snapshot → upsert/select em `rooms` (1 linha/sala)         (FR-013/014)
//
// Limitação de MVP (documentada): o broadcast carrega o token auto-declarado do remetente; a
// paridade PLENA de anti-spoof (FR-007) do transporte real exige amarrar identidade à conexão
// (ex.: Edge Function validando um segredo de sessão). A LÓGICA do host já rejeita spoof
// (provado headless, SC-005); resta o endurecimento da identidade de transporte.
import type { AcceptedCommand, CommandEnvelope, ConnStatus, JoinRequest, PersistedSnapshot, PresenceChange, Transport, Unsubscribe } from './transport'
import type { JoinError, Room } from './room'
import { normalizeLog } from '@/game/log'

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
}

interface RoomRow {
  id: string
  status: string
  seats: Room['seats']
  seq: number
  game: PersistedSnapshot['game'] | null
}

const EVENT = { submit: 'submit', accepted: 'accepted', room: 'room', join: 'join', rejected: 'rejected' } as const

export function supabaseTransport(supabase: SupabaseLike, roomId: string, token: string): Transport {
  // `broadcast.self: true` é OBRIGATÓRIO: no modelo uniforme da spec todo participante —
  // inclusive o host — submete comandos pelo canal e aplica só o que volta difundido (UI
  // pessimista). Sem eco do próprio envio, o host nunca veria os próprios comandos.
  const channel = supabase.channel(`room:${roomId}`, {
    config: { presence: { key: token }, broadcast: { self: true } },
  })
  const submitCbs: ((cmd: CommandEnvelope, fromToken: string) => void)[] = []
  const broadcastCbs: ((cmd: AcceptedCommand) => void)[] = []
  const roomCbs: ((room: Room) => void)[] = []
  const presenceCbs: ((change: PresenceChange) => void)[] = []
  const joinReqCbs: ((who: JoinRequest, fromToken: string) => void)[] = []
  const joinRejCbs: ((target: string, reason: JoinError) => void)[] = []
  const statusCbs: ((status: ConnStatus) => void)[] = []
  const presenceSyncCbs: ((tokens: ReadonlySet<string>) => void)[] = []
  const live = new Map<string, number>() // presenças vivas por token — base do takeover
  let resolved = false // guarda SEPARADA de `track()` (041, D6) — resolve() roda uma vez; track(), a cada reassinatura

  channel
    .on('broadcast', { event: EVENT.submit }, ({ payload }) => {
      const p = payload as { cmd: CommandEnvelope; token: string }
      for (const cb of submitCbs) cb(p.cmd, p.token)
    })
    .on('broadcast', { event: EVENT.join }, ({ payload }) => {
      const p = payload as { who: JoinRequest; token: string }
      for (const cb of joinReqCbs) cb(p.who, p.token)
    })
    .on('broadcast', { event: EVENT.rejected }, ({ payload }) => {
      const p = payload as { token: string; reason: JoinError }
      for (const cb of joinRejCbs) cb(p.token, p.reason)
    })
    .on('broadcast', { event: EVENT.accepted }, ({ payload }) => {
      for (const cb of broadcastCbs) cb(payload as AcceptedCommand)
    })
    .on('broadcast', { event: EVENT.room }, ({ payload }) => {
      for (const cb of roomCbs) cb(payload as Room)
    })
    // TAKEOVER (FR-006a) por CONTAGEM de presenças vivas por token. Antes este adapter
    // emitia `takeover: false` fixo, então o `if (change.takeover) return` do host
    // (`host.ts:110`) nunca disparava em produção: um F5 do convidado gera um `join` e um
    // `leave` com a MESMA chave, e o `leave` derrubava o assento → pausa espúria. O
    // `localTransport` acertava, e nenhum teste via a diferença porque a suíte headless só
    // exercita o adapter local. É o que a suíte de conformidade agora cobre nos dois.
    .on('presence', { event: 'join' }, ({ key, newPresences }) => {
      const before = live.get(key) ?? 0
      live.set(key, before + (newPresences?.length ?? 1))
      for (const cb of presenceCbs) cb({ token: key, connected: true, takeover: before > 0 })
    })
    .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
      const after = (live.get(key) ?? 0) - (leftPresences?.length ?? 1)
      if (after > 0) {
        live.set(key, after)
        // Sobrou conexão viva com este token: é a ponta antiga de um takeover, não uma queda.
        for (const cb of presenceCbs) cb({ token: key, connected: false, takeover: true })
        return
      }
      live.delete(key)
      for (const cb of presenceCbs) cb({ token: key, connected: false, takeover: false })
    })
    // Conjunto COMPLETO de presença (041, contrato §2) — fonte de verdade para a autoridade
    // que reassume reconciliar `seats[].connected` (FR-021). Push, não pull: um `presenceState()`
    // logo após `SUBSCRIBED` perderia a corrida do estado ainda chegando (D7 do plan).
    .on('presence', { event: 'sync' }, () => {
      const tokens = new Set(Object.keys(channel.presenceState()))
      for (const cb of presenceSyncCbs) cb(tokens)
    })

  const off = <T>(arr: T[], cb: T): Unsubscribe => () => {
    const i = arr.indexOf(cb)
    if (i >= 0) arr.splice(i, 1)
  }

  return {
    token,

    // O conserto do defeito 1 (041, D6): `resolve()` da promessa e `track()` de presença são
    // DUAS garantias, não uma. `resolve()` roda uma vez; `track()` roda em TODA reassinatura —
    // é o que faz uma queda de rede reanunciar presença ao voltar, em vez de ficar invisível.
    async connect(): Promise<void> {
      await new Promise<void>((resolve) => {
        channel.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            void channel.track({ token }) // toda vez: reassinatura reanuncia presença (FR-001)
            for (const cb of statusCbs) cb('connected')
            if (!resolved) { resolved = true; resolve() }
            return
          }
          for (const cb of statusCbs) cb('reconnecting')
        })
      })
    },

    disconnect(): void {
      void channel.unsubscribe()
    },

    onStatus(cb): Unsubscribe {
      statusCbs.push(cb)
      return off(statusCbs, cb)
    },

    onPresenceSync(cb): Unsubscribe {
      presenceSyncCbs.push(cb)
      cb(new Set(Object.keys(channel.presenceState()))) // estado inicial (contrato §2.2)
      return off(presenceSyncCbs, cb)
    },

    submit(cmd: CommandEnvelope): void {
      void channel.send({ type: 'broadcast', event: EVENT.submit, payload: { cmd, token } })
    },
    onSubmit(cb): Unsubscribe {
      submitCbs.push(cb)
      return off(submitCbs, cb)
    },

    broadcast(cmd: AcceptedCommand): void {
      void channel.send({ type: 'broadcast', event: EVENT.accepted, payload: cmd })
    },
    onBroadcast(cb): Unsubscribe {
      broadcastCbs.push(cb)
      return off(broadcastCbs, cb)
    },

    requestJoin(who: JoinRequest): void {
      void channel.send({ type: 'broadcast', event: EVENT.join, payload: { who, token } })
    },
    onJoinRequest(cb): Unsubscribe {
      joinReqCbs.push(cb)
      return off(joinReqCbs, cb)
    },

    rejectJoin(target: string, reason: JoinError): void {
      void channel.send({ type: 'broadcast', event: EVENT.rejected, payload: { token: target, reason } })
    },
    onJoinRejected(cb): Unsubscribe {
      joinRejCbs.push(cb)
      return off(joinRejCbs, cb)
    },

    publishRoom(room: Room): void {
      void channel.send({ type: 'broadcast', event: EVENT.room, payload: room })
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

    async loadRoom(): Promise<Room | null> {
      const { data, error } = await supabase.from('rooms').select('id,status,seats,seq,game').eq('id', roomId).maybeSingle()
      if (error) throw error
      if (!data) return null
      return { id: data.id, status: data.status as Room['status'], seats: data.seats }
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

    async loadSnapshot(): Promise<PersistedSnapshot | null> {
      const { data, error } = await supabase.from('rooms').select('id,status,seats,seq,game').eq('id', roomId).maybeSingle()
      if (error) throw error
      if (!data || data.game == null || data.seq < 0) return null
      const room: Room = { id: data.id, status: data.status as Room['status'], seats: data.seats }
      const game = { ...data.game, log: normalizeLog(data.game.log ?? []) }
      return { seq: data.seq, game, room }
    },
  }
}
