// Host = única autoridade (spec 037, D-020). Roda no browser do host, ao lado do `client`
// dele (que é a visão de UI). Recebe comandos de todos via `onSubmit`, valida identidade
// (FR-007) pelos gates JÁ existentes do motor (FR-008), aplica o reducer puro, resolve o
// não-determinismo (FR-011), atribui a sequência (FR-010), persiste o snapshot (FR-013) e
// difunde o comando aceito. Pausa por (des)conexão (FR-016..020). Não cria regra nova.
import type { RNG } from '@/game/turn/dice'
import type { GameState } from '@/game/turn/types'
import type { TurnCtx } from '@/game/turn/turnMachine'
import { actorOf, applyCommand, type GameAction, type SystemAction } from '@/game/commands'
import { buildGameCtx, buildInitialGame } from '@/game/setup'
import { recordingCtx } from './recorder'
import {
  anyDisconnected,
  joinRoom,
  kickSeat,
  newReentryCode,
  shuffleSeatOrder,
  markConnected,
  markDisconnected,
  playerIdsInOrder,
  seatByUid,
  startGame as startGameRoom,
  type Room,
} from './room'
import type { AcceptedCommand, CommandEnvelope, JoinRequest, PresenceChange, Transport, Unsubscribe } from './transport'

export interface HostOptions {
  rng?: RNG // padrão Math.random; injetável nos testes (seed)
  now?: () => number // padrão Date.now; relógio lógico nos testes
}

export interface Host {
  open(): Promise<void> // abre o LOBBY: escuta pedidos de assento/presença e publica a sala (FR-001/002)
  start(): Promise<void> // cria o estado inicial, persiste como 1º snapshot e publica a sala em 'playing'
  startMatch(): Promise<{ ok: true } | { ok: false; reason: 'too-few' | 'already-started' | 'not-host' }> // lobby → partida (FR-006)
  kick(uid: string): { ok: true } | { ok: false; reason: 'not-in-lobby' | 'is-host' | 'unknown-uid' } // remoção no lobby (FR-024)
  stop(): void
  tick(): void // fecha leilões/lotes vencidos pelo prazo (emite comandos de sistema) — browser agenda; testes chamam
  room(): Room
  game(): GameState // inspeção (testes)
  seq(): number
  subscribe(cb: () => void): Unsubscribe // muda a sala (join/presença/início) → notifica a UI do lobby
}

export function createHost(transport: Transport, initialRoom: Room, opts: HostOptions = {}): Host {
  const rng: RNG = opts.rng ?? (() => Math.random())
  const now = opts.now ?? (() => Date.now())
  const baseCtx: TurnCtx = buildGameCtx(rng, now)

  let room = initialRoom
  let game: GameState | null = null
  let seq = -1 // -1 = ainda não iniciado; o snapshot inicial fica em seq 0
  let opened = false
  const subs: Unsubscribe[] = []
  const listeners = new Set<() => void>()
  let watchedUids = new Set<string>() // 043, T015 — assentos cujo tópico privado a autoridade assina

  function notify(): void {
    for (const cb of listeners) cb()
  }

  // Assina o tópico de cada assento NOVO e dessassina o de quem saiu (043, D2/D3) — reanexar
  // troca o `uid` do assento, então o antigo perde o tópico e o novo ganha; kick dessassina;
  // um assento que só mudou de `connected`/posição não move nada aqui.
  function syncWatchedSeats(): void {
    const current = new Set(room.seats.map((s) => s.uid))
    for (const uid of current) if (!watchedUids.has(uid)) transport.watchSeat(uid)
    for (const uid of watchedUids) if (!current.has(uid)) transport.unwatchSeat(uid)
    watchedUids = current
  }

  // Publica a sala para todos e a persiste. Com partida em curso, a sala vive DENTRO do
  // snapshot (uma linha só); no lobby, `saveRoom` escreve apenas as colunas de sala.
  function publishAndPersistRoom(): void {
    transport.publishRoom(room)
    if (game) void transport.saveSnapshot({ seq, game, room })
    else void transport.saveRoom(room)
    notify()
  }

  // Aplica um comando (de jogador OU de sistema) pelo caminho de autoridade: grava o
  // não-determinismo, checa no-op (FR-009), incrementa seq, persiste e difunde. Retorna se
  // foi aceito.
  function accept(action: GameAction): boolean {
    if (!game) return false
    const { ctx, drain } = recordingCtx(baseCtx)
    const next = applyCommand(game, action, ctx)
    if (next === game) return false // no-op / inválido → descarta (FR-009)
    game = next
    seq += 1
    const cmd: AcceptedCommand = { seq, action, resolved: drain() }
    void transport.saveSnapshot({ seq, game, room }) // FR-013 (upsert)
    transport.broadcast(cmd) // FR-010/011
    return true
  }

  function handleSubmit(env: CommandEnvelope, fromUid: string): void {
    if (!game) return
    const seat = seatByUid(room, fromUid)
    if (!seat) return // sessão sem assento na sala → descarta (US4-2)
    if (env.senderId !== seat.playerId) return // identidade declarada ≠ assento → anti-spoof (FR-007, US4-1)
    if (game.paused) return // durante a pausa, comando de jogo é rejeitado (FR-017, US3-2)
    const actor = actorOf(game, env.action)
    if (actor === null || actor !== seat.playerId) return // remetente não é o ator do comando (FR-007)
    accept(env.action)
  }

  // Pedido de assento no lobby (FR-002/005). A identidade do assento é o uid da CONEXÃO —
  // o pedinte só escolhe nome e cor. Recusa (cheia/cor tomada/já iniciada) volta ao pedinte.
  //
  // 043, D4/T020: a reanexação SAIU daqui — vira `reattach_by_code` no servidor (RPC), porque
  // o host não tem como assinar o tópico de um assento que ainda não existe. Este handler só
  // trata assento NOVO; `onSeatReattached`/`onReattachNotice` (abaixo) é quem aprende que
  // alguém reanexou.
  function handleJoinRequest(who: JoinRequest, fromUid: string): void {
    const taken = new Set(room.seats.map((s) => s.reentryCode))
    const result = joinRoom(room, {
      uid: fromUid, name: who.name, color: who.color, piece: who.piece,
      reentryCode: newReentryCode(rng, taken), // room.ts não tem RNG (D12) — o host minta
    })
    if (!result.ok) {
      transport.rejectJoin(fromUid, result.reason)
      return
    }
    room = result.room
    syncWatchedSeats()
    publishAndPersistRoom()
  }

  // 043, D4/T020: alguém reanexou por CÓDIGO — a RPC já regravou a linha no servidor, fora do
  // controle desta autoridade em memória. Recarrega a sala persistida, reconcilia os tópicos
  // observados e republica; `syncPause` retoma a partida se esta era a última ausência
  // (FR-028 da 041) — o MESMO efeito que o ramo de reanexação tinha aqui antes de sair.
  async function handleSeatReattached(): Promise<void> {
    const fresh = await transport.loadRoom()
    if (!fresh) return
    room = fresh
    syncWatchedSeats()
    publishAndPersistRoom()
    syncPause()
  }

  function handlePresence(change: PresenceChange): void {
    if (change.takeover) return // mesma sessão reabrindo → não é desconexão (FR-006a); segue conectado
    // No lobby, entrar/sair do canal só atualiza o estado de conexão (nada pausa).
    if (!seatByUid(room, change.uid)) {
      if (change.connected) publishAndPersistRoom() // recém-chegado ainda sem assento: precisa ver a sala
      return
    }
    room = change.connected ? markConnected(room, change.uid) : markDisconnected(room, change.uid)
    publishAndPersistRoom()
    syncPause()
  }

  // Ids de quem já saiu da partida — não contam para pausa nem para retomada (D-029).
  function eliminatedIds(): ReadonlySet<string> {
    if (!game) return new Set()
    return new Set(game.players.filter((p) => p.eliminated).map((p) => p.id))
  }

  // Reconciliação de presença (041, FR-021/022): sobrescreve `seats[].connected` pelo
  // conjunto REALMENTE observado no canal — nunca confia no `connected` do snapshot, que é
  // um retrato de antes da queda/reload. Chamar ANTES de `syncPause` é o que evita emitir
  // `pause` seguido de `resume` a cada reassunção (a pausa só é decidida depois de a mesa
  // já refletir quem está de verdade presente).
  function reconcilePresence(uids: ReadonlySet<string>): void {
    for (const seat of room.seats) {
      const connected = uids.has(seat.uid)
      if (seat.connected === connected) continue
      room = connected ? markConnected(room, seat.uid) : markDisconnected(room, seat.uid)
    }
  }

  // Pausa global se algum assento que AINDA JOGA está desconectado; retoma quando todos eles
  // voltam (FR-016/018). Host desconectado entra no mesmo caminho: pausa indefinida, sem
  // transferência (FR-019) — a autoridade É o host, então enquanto ele está fora ninguém
  // aplica nada de qualquer forma. Eliminado que cai NÃO trava a mesa (D-029/FR-018a).
  function syncPause(): void {
    if (!game) return
    const shouldPause = anyDisconnected(room, eliminatedIds())
    const hasDisconnectCause = Boolean(game.paused?.causes.includes('disconnect'))
    if (shouldPause && !hasDisconnectCause) {
      accept({ kind: 'pause', cause: 'disconnect', at: now() })
    } else if (!shouldPause && hasDisconnectCause) {
      accept({ kind: 'resume', cause: 'disconnect', at: now() }) // desloca deadlines em voo (FR-017)
    }
  }

  // Registra os laços de escuta uma única vez — `open()` (lobby) e `start()` (partida direta,
  // usada pelos testes headless) entram pelo mesmo caminho.
  async function ensureOpen(): Promise<void> {
    if (opened) return
    opened = true
    // 043, T015: assina o tópico de cada assento já existente ANTES de `onPresenceSync` — o
    // "estado inicial" que essa assinatura entrega na hora precisa já refletir todo mundo,
    // senão a 1ª reconciliação vê só o próprio uid, marca os demais desconectados, e a
    // correção que `watchSeat` reemite dispara um `pause`+`resume` espúrio.
    syncWatchedSeats()
    subs.push(transport.onSubmit(handleSubmit))
    subs.push(transport.onPresence(handlePresence))
    subs.push(transport.onJoinRequest(handleJoinRequest))
    subs.push(transport.onReattachNotice(() => void handleSeatReattached()))
    // FR-021/022: reconcilia presença ANTES de decidir pausa — nunca o contrário.
    subs.push(transport.onPresenceSync((uids) => {
      reconcilePresence(uids)
      publishAndPersistRoom()
      syncPause()
    }))
    // D8/D10: o adapter cru nunca emite isto — é o decorator `durableWrites` quem sobrescreve
    // `onWriteExhausted`/`onWriteRecovered` (único ponto de montagem em `supabaseClient.ts`).
    // A circularidade é o desenho, não um bug: a PRÓPRIA gravação desta pausa também falha
    // enquanto a persistência estiver fora — o comando vive na memória do host e nas telas de
    // todos por difusão, e a fila drena o estado (que já contém a pausa) quando o banco volta.
    subs.push(transport.onWriteExhausted(() => accept({ kind: 'pause', cause: 'persistence', at: now() })))
    subs.push(transport.onWriteRecovered(() => accept({ kind: 'resume', cause: 'persistence', at: now() })))
    await transport.saveRoom(room)
  }

  async function startInternal(): Promise<void> {
    await ensureOpen()
    game = buildInitialGame(playerIdsInOrder(room), rng)
    seq = 0
    await transport.saveSnapshot({ seq, game, room }) // 1º snapshot (FR-006/013): clientes leem ao entrar
    transport.publishRoom(room) // status já 'playing' (definido por startGame antes de criar o host)
    notify()
  }

  return {
    // Abre a sala. Se JÁ existe partida persistida nesta sala (host voltando de um F5), a
    // autoridade é reassumida a partir do snapshot — o estado não se perde (FR-015).
    async open(): Promise<void> {
      const snap = await transport.loadSnapshot()
      if (snap && snap.seq >= 0) {
        game = snap.game
        seq = snap.seq
        room = snap.room
      }
      await ensureOpen()
      transport.publishRoom(room)
      notify()
    },

    start: startInternal,

    // Fecha o lobby e inicia a partida (FR-006). A ordem da mesa é SORTEADA aqui (spec 038,
    // FR-030) com o RNG do host — o resultado vive no snapshot, então os clientes o recebem
    // por leitura, sem replay (mesmo padrão do embaralho das cartas).
    async startMatch() {
      const started = startGameRoom(room)
      if (!started.ok) return started
      room = shuffleSeatOrder(started.room, rng)
      await startInternal()
      return { ok: true as const }
    },

    // Remoção de jogador pelo host, só no lobby (§11.1 / FR-024). O removido é avisado pelo
    // mesmo canal de recusa de entrada (research D6) e a sala republicada sem o assento.
    kick(uid: string) {
      const result = kickSeat(room, uid)
      if (!result.ok) return result
      room = result.room
      syncWatchedSeats()
      transport.rejectJoin(uid, 'kicked')
      publishAndPersistRoom()
      return { ok: true as const }
    },

    stop(): void {
      for (const u of subs) u()
      subs.length = 0
      opened = false
      listeners.clear()
    },

    tick(): void {
      if (!game || game.paused) return // prazos congelam durante a pausa (FR-017)
      const t = now()
      const sys: SystemAction[] = []
      if (game.resolution?.kind === 'auction' && t >= game.resolution.auction.deadline) {
        sys.push({ kind: 'close-auction' })
      }
      if (game.landAuction && game.landAuction.lots.some((l) => t >= l.deadline)) {
        sys.push({ kind: 'close-land-lots', now: t })
      }
      for (const a of sys) accept(a)
    },

    room: () => room,
    game: () => game!,
    seq: () => seq,

    subscribe(cb): Unsubscribe {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
  }
}
