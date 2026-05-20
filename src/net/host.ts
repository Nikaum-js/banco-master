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
  reattachByCode,
  shuffleSeatOrder,
  markConnected,
  markDisconnected,
  playerIdsInOrder,
  seatByToken,
  startGame as startGameRoom,
  type Room,
} from './room'
import type { AcceptedCommand, CommandEnvelope, JoinRequest, PresenceChange, Transport, Unsubscribe } from './transport'
import { registerFailure } from '@/app/failureRegistry'

export interface HostOptions {
  rng?: RNG // padrão Math.random; injetável nos testes (seed)
  now?: () => number // padrão Date.now; relógio lógico nos testes
}

export interface Host {
  open(): Promise<void> // abre o LOBBY: escuta pedidos de assento/presença e publica a sala (FR-001/002)
  start(): Promise<void> // cria o estado inicial, persiste como 1º snapshot e publica a sala em 'playing'
  startMatch(): Promise<{ ok: true } | { ok: false; reason: 'too-few' | 'already-started' | 'not-host' }> // lobby → partida (FR-006)
  kick(token: string): { ok: true } | { ok: false; reason: 'not-in-lobby' | 'is-host' | 'unknown-token' } // remoção no lobby (FR-024)
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

  function notify(): void {
    for (const cb of listeners) cb()
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
  // foi aceito. `fromToken` (042, FR-020/022) só existe pra comando DE JOGADOR — comando de
  // sistema (tick, pausa) não tem um remetente único a quem recusar, só registra a falha.
  function accept(action: GameAction, fromToken?: string): boolean {
    if (!game) return false
    const { ctx, drain } = recordingCtx(baseCtx)
    let next: GameState
    try {
      next = applyCommand(game, action, ctx)
    } catch (error) {
      // 042, D5 do plan: `game`/`seq` só são reatribuídos DEPOIS daqui — uma exceção nunca
      // avança o estado pela metade (FR-021 por construção, não por asserção extra).
      const occurrenceId = registerFailure({ where: 'host.accept', phase: room.status, seq, error })
      if (fromToken) transport.rejectCommand(fromToken, { occurrenceId })
      return false
    }
    if (next === game) return false // no-op / inválido → descarta (FR-009)
    game = next
    seq += 1
    const cmd: AcceptedCommand = { seq, action, resolved: drain() }
    void transport.saveSnapshot({ seq, game, room }) // FR-013 (upsert)
    transport.broadcast(cmd) // FR-010/011
    return true
  }

  function handleSubmit(env: CommandEnvelope, fromToken: string): void {
    if (!game) return
    const seat = seatByToken(room, fromToken)
    if (!seat) return // sessão sem assento na sala → descarta (US4-2)
    if (env.senderId !== seat.playerId) return // identidade declarada ≠ assento → anti-spoof (FR-007, US4-1)
    if (game.paused) return // durante a pausa, comando de jogo é rejeitado (FR-017, US3-2)
    const actor = actorOf(game, env.action)
    if (actor === null || actor !== seat.playerId) return // remetente não é o ator do comando (FR-007)
    accept(env.action, fromToken)
  }

  // Pedido de assento no lobby (FR-002/005). A identidade do assento é o token da CONEXÃO —
  // o pedinte só escolhe nome e cor. Recusa (cheia/cor tomada/já iniciada) volta ao pedinte.
  //
  // Com `reentryCode` (041, D-033/contrato §3): é REANEXAÇÃO, não assento novo — o gate de
  // `already-started` não se aplica (perder o aparelho não pode travar a mesa depois do
  // início). `name`/`color`/`piece` são ignorados nesse caminho; a identidade visual
  // pertence ao assento, não a quem está reabrindo. `syncPause` depois de republicar é o que
  // retoma a partida se esta era a última ausência (FR-028).
  function handleJoinRequest(who: JoinRequest, fromToken: string): void {
    if (who.reentryCode) {
      const result = reattachByCode(room, who.reentryCode, fromToken)
      if (!result.ok) {
        transport.rejectJoin(fromToken, result.reason)
        return
      }
      room = result.room
      publishAndPersistRoom()
      syncPause()
      return
    }
    const taken = new Set(room.seats.map((s) => s.reentryCode))
    const result = joinRoom(room, {
      token: fromToken, name: who.name, color: who.color, piece: who.piece,
      reentryCode: newReentryCode(rng, taken), // room.ts não tem RNG (D12) — o host minta
    })
    if (!result.ok) {
      transport.rejectJoin(fromToken, result.reason)
      return
    }
    room = result.room
    publishAndPersistRoom()
  }

  function handlePresence(change: PresenceChange): void {
    if (change.takeover) return // mesma sessão reabrindo → não é desconexão (FR-006a); segue conectado
    // No lobby, entrar/sair do canal só atualiza o estado de conexão (nada pausa).
    if (!seatByToken(room, change.token)) {
      if (change.connected) publishAndPersistRoom() // recém-chegado ainda sem assento: precisa ver a sala
      return
    }
    room = change.connected ? markConnected(room, change.token) : markDisconnected(room, change.token)
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
  function reconcilePresence(tokens: ReadonlySet<string>): void {
    for (const seat of room.seats) {
      const connected = tokens.has(seat.token)
      if (seat.connected === connected) continue
      room = connected ? markConnected(room, seat.token) : markDisconnected(room, seat.token)
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
    subs.push(transport.onSubmit(handleSubmit))
    subs.push(transport.onPresence(handlePresence))
    subs.push(transport.onJoinRequest(handleJoinRequest))
    // FR-021/022: reconcilia presença ANTES de decidir pausa — nunca o contrário.
    subs.push(transport.onPresenceSync((tokens) => {
      reconcilePresence(tokens)
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
    game = buildInitialGame(playerIdsInOrder(room), rng, now()) // 044/D3: mesmo relógio que o recorder grava/replica
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
    kick(token: string) {
      const result = kickSeat(room, token)
      if (!result.ok) return result
      room = result.room
      transport.rejectJoin(token, 'kicked')
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
