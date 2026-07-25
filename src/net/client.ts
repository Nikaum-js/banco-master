// Cliente (spec 037) — a visão local de um jogador. Envia comandos carregando o próprio
// `playerId` (FR-007) e aplica os comandos ACEITOS que chegam pela difusão, com o
// não-determinismo em replay (FR-011) → converge com o host e os demais. NÃO aplica nada
// localmente antes da confirmação (UI pessimista, Clarifications). Lê o snapshot completo só
// ao entrar e ao reconectar (FR-014); detecta lacuna de sequência e se recupera pelo snapshot
// (FR-012). O host, no browser dele, roda um `client` destes ao lado da autoridade.
import type { GameState } from '@/game/turn/types'
import type { TurnCtx } from '@/game/turn/turnMachine'
import { applyCommand, type PlayerAction } from '@/game/commands'
import { buildGameCtx } from '@/game/setup'
import { replayCtx } from './recorder'
import { seatByToken, type JoinError, type Room } from './room'
import type { AcceptedCommand, JoinRequest, Transport, Unsubscribe } from './transport'

export interface Client {
  readonly token: string // token de sessão desta aba — a UI usa para achar o próprio assento
  join(): Promise<void> // conecta, lê o snapshot (entrada/reconexão) e passa a aplicar a difusão
  requestJoin(who: JoinRequest): void // pede assento no lobby (FR-002) — host aceita e publica a sala
  leave(): void
  send(action: PlayerAction): void
  game(): GameState | null
  room(): Room | null
  playerId(): string | null
  joinError(): JoinError | null
  paused(): boolean
  seq(): number
  subscribe(cb: () => void): Unsubscribe // notifica a cada mudança de estado (liga a UI/store)
}

export function createClient(transport: Transport): Client {
  // O cliente nunca consome RNG/relógio reais: o replay injeta os valores gravados pelo host.
  const baseCtx: TurnCtx = buildGameCtx(
    () => { throw new Error('cliente não deve consumir RNG fora do replay') },
    () => { throw new Error('cliente não deve consumir relógio fora do replay') },
  )

  let game: GameState | null = null
  let room: Room | null = null
  let seq = -1
  let playerId: string | null = null
  let joinError: JoinError | null = null
  const pending: AcceptedCommand[] = [] // difusões chegadas antes do snapshot (buffer de corrida)
  const listeners = new Set<() => void>()
  const subs: Unsubscribe[] = []

  function notify(): void {
    for (const cb of listeners) cb()
  }

  function resolvePlayerId(): void {
    if (!room) return
    const seat = seatByToken(room, transport.token)
    if (seat) {
      playerId = seat.playerId
      joinError = null // assento concedido (ou reanexado) → limpa recusa anterior
      return
    }
    // Meu assento sumiu da sala publicada: fui removido pelo anfitrião (spec 038, FR-024).
    // Volto a ser um visitante sem assento — e um novo pedido fica sujeito às regras da sala
    // (FR-026), em vez de o cliente seguir se achando sentado.
    playerId = null
  }

  function applyAccepted(cmd: AcceptedCommand): void {
    if (!game) { pending.push(cmd); return } // ainda sem snapshot → guarda p/ reconciliar
    if (cmd.seq <= seq) return // duplicado/antigo
    if (cmd.seq > seq + 1) { void resync(); return } // lacuna na sequência → recupera via snapshot (FR-012)
    game = applyCommand(game, cmd.action, replayCtx(baseCtx, cmd.resolved))
    seq = cmd.seq
    notify()
  }

  // Reconciliação: aplica em ordem as difusões que ficaram no buffer; lacuna → snapshot.
  function drainPending(): void {
    if (!game) return
    pending.sort((a, b) => a.seq - b.seq)
    for (const cmd of pending.splice(0)) applyAccepted(cmd)
  }

  async function resync(): Promise<void> {
    const snap = await transport.loadSnapshot()
    if (!snap) return
    game = snap.game
    room = snap.room
    seq = snap.seq
    resolvePlayerId()
    notify()
  }

  return {
    token: transport.token,

    async join(): Promise<void> {
      await transport.connect()
      subs.push(transport.onBroadcast(applyAccepted))
      subs.push(transport.onRoom((r) => {
        room = r
        resolvePlayerId()
        // Host iniciou a partida enquanto estávamos no lobby: o 1º snapshot já existe, mas
        // nenhuma difusão o traz (a difusão só carrega comandos) → busca-o agora (FR-006/014).
        if (!game && r.status !== 'lobby') void resync()
        notify()
      }))
      subs.push(transport.onJoinRejected((target, reason) => {
        if (target !== transport.token) return // recusa dirigida a outro pedinte
        joinError = reason
        notify()
      }))
      const snap = await transport.loadSnapshot() // entrada/reconexão: snapshot completo (FR-014/015)
      if (snap) {
        game = snap.game
        room = snap.room
        seq = snap.seq
        resolvePlayerId()
        drainPending()
        notify()
        return
      }
      // Sem partida ainda (lobby): a sala persistida diz se o link é válido e quem já sentou.
      const persisted = await transport.loadRoom()
      if (persisted && !room) {
        room = persisted
        resolvePlayerId()
        notify()
      }
    },

    requestJoin(who: JoinRequest): void {
      if (playerId) return // já assentado (reanexo por token) — nada a pedir (FR-004)
      transport.requestJoin(who)
    },

    leave(): void {
      for (const u of subs) u()
      subs.length = 0
      transport.disconnect()
    },

    send(action: PlayerAction): void {
      if (!playerId) return
      transport.submit({ senderId: playerId, action }) // pessimista: não aplica local; espera a difusão
    },

    game: () => game,
    room: () => room,
    playerId: () => playerId,
    joinError: () => joinError,
    paused: () => game?.paused ?? false,
    seq: () => seq,

    subscribe(cb): Unsubscribe {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
  }
}
