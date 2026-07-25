// Host = única autoridade (spec 037, D-020). Roda no browser do host, ao lado do `client`
// dele (que é a visão de UI). Recebe comandos de todos via `onSubmit`, valida identidade
// (FR-007) pelos gates JÁ existentes do motor (FR-008), aplica o reducer puro, resolve o
// não-determinismo (FR-011), atribui a sequência (FR-010), persiste o snapshot (FR-013) e
// difunde o comando aceito. Pausa por (des)conexão (FR-016..020). Não cria regra nova.
import type { RNG } from '@/game/turn/dice'
import type { GameState } from '@/game/turn/types'
import type { TurnCtx } from '@/game/turn/turnMachine'
import { actorOf, applyCommand, type GameAction, type SystemAction } from '@/game/commands'
import { buildGameCtx, buildInitialGame } from '@/game/ctx'
import { recordingCtx } from './recorder'
import {
  anyDisconnected,
  joinRoom,
  markConnected,
  markDisconnected,
  playerIdsInOrder,
  seatByToken,
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
  let pausedAt: number | null = null
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

  function handleSubmit(env: CommandEnvelope, fromToken: string): void {
    if (!game) return
    const seat = seatByToken(room, fromToken)
    if (!seat) return // sessão sem assento na sala → descarta (US4-2)
    if (env.senderId !== seat.playerId) return // identidade declarada ≠ assento → anti-spoof (FR-007, US4-1)
    if (game.paused) return // durante a pausa, comando de jogo é rejeitado (FR-017, US3-2)
    const actor = actorOf(game, env.action)
    if (actor === null || actor !== seat.playerId) return // remetente não é o ator do comando (FR-007)
    accept(env.action)
  }

  // Pedido de assento no lobby (FR-002/005). A identidade do assento é o token da CONEXÃO —
  // o pedinte só escolhe nome e cor. Recusa (cheia/cor tomada/já iniciada) volta ao pedinte.
  function handleJoinRequest(who: JoinRequest, fromToken: string): void {
    const result = joinRoom(room, { token: fromToken, name: who.name, color: who.color })
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

  // Pausa global se QUALQUER assento está desconectado; retoma quando TODOS voltam (FR-016/018).
  // Host desconectado entra no mesmo caminho: pausa indefinida, sem transferência (FR-019) — a
  // autoridade É o host, então enquanto ele está fora ninguém aplica nada de qualquer forma.
  function syncPause(): void {
    if (!game) return
    const shouldPause = anyDisconnected(room)
    if (shouldPause && !game.paused) {
      pausedAt = now()
      accept({ kind: 'pause' })
    } else if (!shouldPause && game.paused) {
      const pausedMs = pausedAt === null ? 0 : Math.max(0, now() - pausedAt)
      pausedAt = null
      accept({ kind: 'resume', pausedMs }) // desloca deadlines em voo (FR-017)
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

    // Fecha o lobby e inicia a partida com os assentos atuais (FR-006). Ordem = entrada.
    async startMatch() {
      const started = startGameRoom(room)
      if (!started.ok) return started
      room = started.room
      await startInternal()
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
