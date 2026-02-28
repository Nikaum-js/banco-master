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
import type { AcceptedCommand, CommandEnvelope, CommandFailure, ConnStatus, JoinRequest, OpeningBidMessage, PersistedSnapshot, PresenceChange, Transport, Unsubscribe } from './transport'
import { mergeSnapshot, type Secrets } from './perspective'
import { normalizeRoom, toPublicRoom, type JoinError, type PublicRoom, type Room } from './room'
import { normalizeGame, normalizeLog } from '@/game/log'
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

// Absorve `normalizeLog` (021/040), a migração de `paused` legado e os quatro campos de
// fim de jogo (044, `normalizeGame`) — o mesmo ponto onde
// `loadSnapshot` já normalizava o log agora normaliza o snapshot inteiro.
export function normalizeSnapshot(game: PersistedSnapshot['game'], now: () => number = Date.now): PersistedSnapshot['game'] {
  return {
    ...game,
    ...normalizeGame(game),
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
  openingAuction?: Room['openingAuction']
  seq: number
  game: PersistedSnapshot['game'] | null
}

const EVENT = { submit: 'submit', openingBid: 'opening-bid', accepted: 'accepted', room: 'room', join: 'join', rejected: 'rejected', reattached: 'reattached', commandRejected: 'command-rejected' } as const
const seatTopic = (roomId: string, uid: string): string => `room:${roomId}:s:${uid}`

export function supabaseTransport(supabase: SupabaseLike, roomId: string, uid: string): Transport {
  const submitCbs: ((cmd: CommandEnvelope, fromUid: string) => void)[] = []
  const openingBidCbs: ((message: OpeningBidMessage, fromUid: string) => void)[] = []
  const broadcastCbs: ((cmd: AcceptedCommand, origin: 'public' | 'private') => void)[] = []
  const roomCbs: ((room: PublicRoom) => void)[] = []
  const presenceCbs: ((change: PresenceChange) => void)[] = []
  const joinReqCbs: ((who: JoinRequest, fromUid: string) => void)[] = []
  const joinRejCbs: ((target: string, reason: JoinError) => void)[] = []
  const commandRejCbs: ((toUid: string, info: CommandFailure) => void)[] = []
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

  // — status combinado: 'connected' quando `lobby`+`own` estão assinados. `play` SAI daqui —
  // 043, achado ao rodar contra infra real (T043): `room_play_select` exige assento já
  // existente na sala, e um convidado sem assento ainda (só entrou, ainda não pediu — ou
  // acabou de entrar e o pedido está em voo) nunca teria a autorização na hora de assinar.
  // Se `play` tivesse voto aqui, `connect()` travaria para sempre pra esse convidado — o
  // canal nunca chega a 'SUBSCRIBED', e sem essa entrada `noteBaseStatus` nunca resolve
  // (não há caminho de rejeição). `play` vira concern PRÓPRIO, resolvido por
  // `ensurePlaySubscribed` — sem bloquear `connect()` nem aparecer como 'reconnecting' pra
  // quem só ainda não tem assento (não é queda de rede, é autorização — 041 contrato §1.4 é
  // sobre a PRÓPRIA conexão, não sobre isto).
  const baseUp = { lobby: false, own: false }
  let resolveConnect: (() => void) | null = null
  function noteBaseStatus(key: keyof typeof baseUp, up: boolean): void {
    baseUp[key] = up
    const allUp = baseUp.lobby && baseUp.own
    for (const cb of statusCbs) cb(allUp ? 'connected' : 'reconnecting')
    if (allUp) resolveConnect?.()
  }

  // `play` — assinado SÓ depois de o assento estar na linha PERSISTIDA, nunca antes.
  //
  // Uma assinatura recusada num canal privado não é de graça: o Realtime derruba a CONEXÃO
  // inteira ("Unauthorized: You do not have permissions to read from this Channel topic"), e
  // junto vão `:lobby` e `:s:<uid>`, que estavam saudáveis. Enquanto o socket se restabelece,
  // tudo o que o host difunde se perde — o convidado ficava para sempre em "Conectando…"
  // esperando a resposta que já tinha passado. Medido em navegador: com `:play` fora do ar, o
  // convidado entra na sala normalmente; com ele batendo na porta, não entra. Era mais caro
  // insistir do que esperar.
  //
  // Então a autorização é conferida ANTES, por LEITURA (`room_preview`, barata e sem efeito
  // sobre o socket): só quando a linha gravada já mostra o próprio assento é que o canal
  // sobe — e aí sobe de primeira. A leitura é o que fecha a corrida real de
  // `publishAndPersistRoom` (host.ts), que DIFUNDE a sala antes de gravá-la enquanto a
  // política decide pela linha GRAVADA: o aviso "você ganhou assento" chega antes de o
  // assento existir para o Postgres, e insistir na leitura custa uma consulta, não o socket.
  //
  // Reautorizar exige um canal NOVO (043, T043): o supabase-js guarda o resultado do join, e
  // `.subscribe()` de novo no MESMO objeto recusado não refaz nada — por isso o holder é
  // mutável, para o caso raro de uma recusa acontecer mesmo assim.
  let play = makePlayChannel()
  let playUp = false
  let playAttemptInFlight = false

  function makePlayChannel(): SupabaseChannelLike {
    const ch = supabase.channel(`room:${roomId}:play`, { config: { broadcast: { self: true }, private: true } })
    ch.on('broadcast', { event: EVENT.accepted }, ({ payload }) => {
      for (const cb of broadcastCbs) cb(payload as AcceptedCommand, 'public')
    })
    return ch
  }

  const SEAT_LOOKUPS = 6 // ~9s de espera pela gravação, em leituras baratas
  const SEAT_LOOKUP_MS = 1_500

  async function seatIsPersisted(): Promise<boolean> {
    const { data, error } = await supabase.rpc('room_preview', { room_id: roomId })
    if (error || !data) return false
    const row = data as { seats?: { uid: string }[] }
    return (row.seats ?? []).some((s) => s.uid === uid)
  }

  async function ensurePlaySubscribed(lookupsLeft = SEAT_LOOKUPS): Promise<void> {
    if (playUp || playAttemptInFlight) return
    playAttemptInFlight = true
    try {
      if (!(await seatIsPersisted())) {
        playAttemptInFlight = false
        // Sem assento gravado ainda. Se ESTE cliente já se vê sentado (a sala difundida trouxe
        // o assento), é só a gravação em trânsito — relê daqui a pouco. Se nem isso, não há o
        // que esperar: quem der assento a ele vai difundir a sala, e a difusão chama de novo.
        if (seated && lookupsLeft > 1) setTimeout(() => void ensurePlaySubscribed(lookupsLeft - 1), SEAT_LOOKUP_MS)
        return
      }
    } catch {
      playAttemptInFlight = false
      if (lookupsLeft > 1) setTimeout(() => void ensurePlaySubscribed(lookupsLeft - 1), SEAT_LOOKUP_MS)
      return
    }
    const attempt = play
    attempt.subscribe((status) => {
      if (attempt !== play) return // tentativa obsoleta — outra já a substituiu
      playAttemptInFlight = false
      playUp = status === 'SUBSCRIBED'
      if (playUp || status === 'CLOSED') return
      // Recusa apesar da leitura ter dito que sim — descarta o canal (que fica `errored` para
      // sempre) e tenta de novo mais tarde, do zero.
      void attempt.unsubscribe()
      play = makePlayChannel()
      if (lookupsLeft > 1) setTimeout(() => void ensurePlaySubscribed(lookupsLeft - 1), SEAT_LOOKUP_MS)
    })
  }

  let seated = false

  // `broadcast.self: true` é OBRIGATÓRIO nos três: no modelo uniforme todo participante —
  // inclusive o host — submete/difunde pelo canal e aplica só o que volta (UI pessimista).
  const own = supabase.channel(seatTopic(roomId, uid), { config: { presence: { key: uid }, broadcast: { self: true }, private: true } })

  // A permissão de ESCRITA de um canal privado é decidida no JOIN, não por mensagem — e fica
  // como está pelo resto da vida daquele canal (043, T045; medido contra infra real, e o
  // defeito mais escondido da spec). O host assina `:lobby` dentro de `connect()`, que
  // roda ANTES de `host.open()` gravar a linha da sala; naquele instante `room_host_uid()` é
  // NULL, a política de insert nega, e a negativa é cacheada. A partir daí TODO `publishRoom`
  // é descartado em silêncio — `send()` continua resolvendo "ok", nenhum log de erro sai, e o
  // convidado espera para sempre por uma sala que nunca é difundida.
  //
  // Por isso o canal é reconstruído uma vez, logo após a PRIMEIRA gravação bem-sucedida da
  // sala: é exatamente o instante em que a permissão passa a existir, e um join novo é a única
  // forma de reavaliá-la. Reconstruir, não reassinar: o supabase-js guarda o resultado do join
  // no objeto, então `.subscribe()` de novo no mesmo canal não refaz nada.
  //
  // Isto esteve MASCARADO o tempo todo: a recusa de leitura do `:play` (sem assento) derrubava
  // a conexão inteira, os canais re-entravam já com a linha gravada, e a permissão era
  // reavaliada por acidente. Ao fechar o `:play`, o defeito real apareceu.
  let lobby = makeLobbyChannel()
  let lobbyReauthorized = false
  let lastPublishedRoom: PublicRoom | null = null

  function makeLobbyChannel(): SupabaseChannelLike {
    const ch = supabase.channel(`room:${roomId}:lobby`, { config: { broadcast: { self: true }, private: true } })
    bindLobby(ch)
    return ch
  }

  // Só a AUTORIDADE escreve em `:lobby`, e só ela chama `saveRoom` — então este é o gatilho
  // certo e não custa nada a quem nunca vai escrever.
  // Devolve promessa e o chamador ESPERA: quem grava a sala publica logo em seguida
  // (`ensureOpen`, host.ts), e publicar num canal ainda em join perde a mensagem — inclusive o
  // auto-eco de que a própria tela do host depende para saber que a sala existe.
  async function reauthorizeLobbyAfterFirstWrite(): Promise<void> {
    if (lobbyReauthorized) return
    lobbyReauthorized = true
    // Solta o canal velho ANTES de montar o novo, e ESPERA: os dois têm o MESMO tópico, e um
    // `unsubscribe()` que chega depois do join do substituto faz o servidor tratar a saída
    // como saída do tópico — o canal novo fica joined do lado do cliente e não recebe mais
    // nada. Foi assim que o host parou de enxergar os pedidos de assento: a difusão da
    // sala saía, mas o `join` do convidado nunca voltava.
    const stale = lobby
    await stale.unsubscribe().catch(() => {})
    lobby = makeLobbyChannel()
    await subscribeLobby()
    // Reemite a última sala publicada. Ela QUASE CERTAMENTE se perdeu: `durableWrites` resolve
    // `saveRoom` no enfileiramento, não na gravação (041, D8/contrato §4), então `ensureOpen`
    // publica bem antes de a linha existir — e naquele instante a autoridade ainda não tinha
    // permissão de escrita neste canal. Sem esta reemissão, a primeira sala do host some
    // para sempre: não há nada que a publique de novo, e o convidado espera indefinidamente
    // por uma difusão que já aconteceu no vazio.
    if (lastPublishedRoom) lobby.send({ type: 'broadcast', event: EVENT.room, payload: lastPublishedRoom }).catch(() => {})
  }

  // O status do canal ANTIGO não pode votar: ele ainda emite ao ser descartado, e um
  // `'CLOSED'` atrasado derrubava o `connect()` do host para 'reconnecting' — a tela dele
  // nem chegava a abrir a sala. Só a tentativa CORRENTE fala pelo `:lobby`.
  function subscribeLobby(): Promise<void> {
    const attempt = lobby
    return new Promise<void>((resolve) => {
      let settled = false
      const done = (): void => { if (!settled) { settled = true; resolve() } }
      // Teto: um canal que não sobe não pode travar o boot para sempre. `noteBaseStatus` já
      // conta a história do status para a UI; aqui a espera é só para não publicar cedo demais.
      setTimeout(done, 5_000)
      attempt.subscribe((status) => {
        if (attempt !== lobby) return // canal já substituído — ignora o eco do velho
        noteBaseStatus('lobby', status === 'SUBSCRIBED')
        if (status === 'SUBSCRIBED') done()
      })
    })
  }

  function bindLobby(ch: SupabaseChannelLike): void {
    ch
    .on('broadcast', { event: EVENT.join }, ({ payload }) => {
      const p = payload as { who: JoinRequest; uid: string }
      for (const cb of joinReqCbs) cb(p.who, p.uid)
    })
    .on('broadcast', { event: EVENT.rejected }, ({ payload }) => {
      const p = payload as { uid: string; reason: JoinError }
      for (const cb of joinRejCbs) cb(p.uid, p.reason)
    })
    // Recusa por FALHA na autoridade (042, FR-020/022). Viaja no lobby pelo mesmo motivo da
    // recusa de entrada: é dirigida a um uid, mas não carrega nada sensível — quem filtra o
    // que é seu é o assinante. `:lobby` é também o único canal que TODO participante lê,
    // inclusive quem ainda não tem assento.
    .on('broadcast', { event: EVENT.commandRejected }, ({ payload }) => {
      const p = payload as { toUid: string; info: CommandFailure }
      for (const cb of commandRejCbs) cb(p.toUid, p.info)
    })
    .on('broadcast', { event: EVENT.room }, ({ payload }) => {
      const r = payload as PublicRoom
      for (const cb of roomCbs) cb(r)
      // A sala publicada é a fonte de "eu tenho assento" que chega sozinha — e é ela que
      // libera a rajada de retentativas do canal público (ver `ensurePlaySubscribed`).
      seated = r.seats.some((s) => s.uid === uid)
      void ensurePlaySubscribed() // sala mudou (ex.: acabei de ganhar assento) — reautoriza `:play`
    })
    // Aviso de reanexação (043, D4) — carimbado pela RPC `reattach_by_code`, que roda no
    // servidor fora da política normal de escrita de `:lobby`. Nenhum payload a interpretar:
    // é só o sinal para recarregar (`onReattachNotice`).
    .on('broadcast', { event: EVENT.reattached }, () => {
      for (const cb of reattachCbs) cb()
    })
  }

  own
    .on('broadcast', { event: EVENT.submit }, ({ payload }) => {
      // O remetente é o DONO deste canal — `uid` do closure, nunca do payload (D3).
      for (const cb of submitCbs) cb((payload as { cmd: CommandEnvelope }).cmd, uid)
    })
    .on('broadcast', { event: EVENT.openingBid }, ({ payload }) => {
      for (const cb of openingBidCbs) cb(payload as OpeningBidMessage, uid)
    })
    .on('broadcast', { event: EVENT.accepted }, ({ payload }) => {
      // Parte PRIVADA do aceito (D9) — SEMPRE a cópia completa, mesmo quando chega depois da
      // pública (043, T043: `:play` e `:s:<uid>` são canais diferentes, sem ordem garantida
      // entre si em rede real). `client.ts` usa a marca 'private' pra se corrigir se aplicou a
      // redigida primeiro.
      for (const cb of broadcastCbs) cb(payload as AcceptedCommand, 'private')
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

    // Resolve quando `lobby`+`own` estiverem 'SUBSCRIBED' — os dois que qualquer sessão
    // autenticada consegue, com ou sem assento (043, T043). `play` sai da espera (ver
    // `ensurePlaySubscribed`): uma tentativa aqui, sem bloquear e sem insistir — quem ainda não
    // tem assento gravado será recusado, e quem reentra numa sala já em curso entra de primeira.
    // `track()` só no PRÓPRIO — é o que faz uma queda de rede reanunciar presença ao voltar
    // (041, D6), e só a presença do dono, nunca a de quem a autoridade observa por `watchSeat`.
    async connect(): Promise<void> {
      await new Promise<void>((resolve) => {
        resolveConnect = resolve
        void subscribeLobby()
        void ensurePlaySubscribed()
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

    submitOpeningBid(amount: number): void {
      void own.send({ type: 'broadcast', event: EVENT.openingBid, payload: { amount } })
    },
    onOpeningBid(cb): Unsubscribe {
      openingBidCbs.push(cb)
      return off(openingBidCbs, cb)
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
        .on('broadcast', { event: EVENT.openingBid }, ({ payload }) => {
          for (const cb of openingBidCbs) cb(payload as OpeningBidMessage, seatUid)
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
        room_id: roomId, name: who.name, color: who.color,
      })
      if (error) throw error
    },
    onJoinRequest(cb): Unsubscribe {
      joinReqCbs.push(cb)
      return off(joinReqCbs, cb)
    },

    rejectCommand(toUid: string, info: CommandFailure): void {
      void lobby.send({ type: 'broadcast', event: EVENT.commandRejected, payload: { toUid, info } })
    },
    onCommandRejected(cb): Unsubscribe {
      commandRejCbs.push(cb)
      return off(commandRejCbs, cb)
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
      lastPublishedRoom = safe // guardado para a reemissão pós-reautorização (ver abaixo)
      void lobby.send({ type: 'broadcast', event: EVENT.room, payload: safe })
    },
    onRoom(cb): Unsubscribe {
      roomCbs.push(cb)
      return off(roomCbs, cb)
    },

    // Por RPC (`write_room`), não mais `.upsert()` direto (achado em produção, T043/T044):
    // UPDATE sob RLS precisa de política de SELECT pra decidir quais linhas são candidatas
    // (Postgres combina SELECT+UPDATE — "quais linhas você vê" AND "quais dessas você
    // atualiza"), e `rooms` nunca teve select policy (D5). Sem RPC, TODO upsert contra uma
    // linha JÁ existente afetava 0 linhas, em silêncio — a sala nunca era realmente salva.
    // `write_room` valida "é o host" por dentro e grava bypassando RLS (mesmo padrão de
    // `request_seat`/`reattach_by_code`). Upsert PARCIAL preservado: só toca `status`/`seats`,
    // nunca `game`/`seq`/`secrets` — a função só declara essas duas colunas no `do update set`.
    async saveRoom(room: Room): Promise<void> {
      const { error } = await supabase.rpc('write_room', {
        room_id: roomId,
        status: room.status,
        seats: room.seats,
        opening_mode: room.openingMode ?? 'sealed-bid',
        opening_auction: room.openingAuction ?? null,
      })
      if (error) throw error
      // A linha agora existe — e é ela que as políticas dos dois canais consultam. `:lobby`
      // reavalia a ESCRITA (só a autoridade escreve lá); `:play` reavalia a LEITURA, que exige
      // assento. Gravar é o instante exato em que as duas podem passar a valer, e depender da
      // difusão da sala para isso deixaria o contrato refém de um efeito colateral.
      await reauthorizeLobbyAfterFirstWrite()
      await ensurePlaySubscribed() // aguardado: quem grava difunde logo em seguida
    },

    // 043, T025 — a PRÉVIA (`room_preview`, D5): não há mais `select` direto na tabela (a
    // política fecha a partir da Fase 2). Devolve os assentos sem `reentryCode` de ninguém,
    // EXCETO o do assento de quem chamou — é daqui que o dono lê o próprio código.
    async loadRoom(): Promise<Room | null> {
      const { data, error } = await supabase.rpc('room_preview', { room_id: roomId })
      if (error) throw error
      if (!data) return null
      const row = data as {
        id: string
        status: Room['status']
        seats: Room['seats']
        openingMode?: Room['openingMode']
        openingAuction?: Room['openingAuction']
      }
      return normalizeRoom({
        id: row.id,
        status: row.status,
        seats: row.seats.map((s) => ({ ...s, reentryCode: s.reentryCode ?? '' })),
        openingMode: row.openingMode,
        openingAuction: row.openingAuction ?? null,
      })
    },

    onPresence(cb): Unsubscribe {
      presenceCbs.push(cb)
      return off(presenceCbs, cb)
    },

    // Por RPC (`write_snapshot`) — mesmo motivo de `saveRoom` acima: `.upsert()` direto contra
    // `rooms` nunca afeta uma linha já existente sob RLS sem select policy.
    async saveSnapshot(snap: PersistedSnapshot): Promise<void> {
      const { error } = await supabase.rpc('write_snapshot', {
        room_id: roomId,
        seq: snap.seq,
        game: snap.game, // 043, T034/T037: já a parte PÚBLICA (host.ts separa via `splitSnapshot`)
        secrets: snap.secrets,
        status: snap.room.status,
        seats: snap.room.seats,
        opening_mode: snap.room.openingMode ?? 'sealed-bid',
        opening_auction: snap.room.openingAuction ?? null,
      })
      if (error) throw error
    },

    // O adapter CRU não repete sozinho, então nunca esgota — quem sobrescreve isto é o
    // decorator `durableWrites` (041, D8), único ponto de montagem de produção.
    onWriteExhausted: () => () => {},
    onWriteRecovered: () => () => {},

    // 043, T037 — leitura por RPC (D6): `read_snapshot` já filtra `secrets` por chave no
    // servidor (íntegro para a autoridade, só a própria entrada de `hands` para os demais).
    // `mergeSnapshot` aqui é o mesmo TypeScript puro que remonta a visão local — nenhum
    // `select` direto na tabela sobrevive para o snapshot (D5).
    async loadSnapshot(): Promise<PersistedSnapshot | null> {
      const { data, error } = await supabase.rpc('read_snapshot', { room_id: roomId })
      if (error) throw error
      if (!data) return null
      const row = data as {
        id: string
        status: Room['status']
        seats: Room['seats']
        openingMode?: Room['openingMode']
        openingAuction?: Room['openingAuction']
        seq: number
        game: unknown
        secrets: Secrets
      }
      if (row.game == null || row.seq < 0) return null
      const room = normalizeRoom({
        id: row.id,
        status: row.status,
        seats: row.seats,
        openingMode: row.openingMode,
        openingAuction: row.openingAuction ?? null,
      })
      const publicGame = normalizeSnapshot(row.game as PersistedSnapshot['game'])
      const game = mergeSnapshot(publicGame, row.secrets, room)
      return { seq: row.seq, game, secrets: row.secrets, room }
    },
  }
}
