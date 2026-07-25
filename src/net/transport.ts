// Porta de transporte (spec 037). Abstrai o canal entre clientes e host, com duas
// implementações: `localTransport` (hub in-memory, determinístico — testes headless) e
// `supabaseTransport` (Realtime + Postgres). A LÓGICA de autoridade/cliente é escrita só
// contra esta interface — trocar de transporte não muda host/cliente.
//
// Modelo uniforme: TODO participante (inclusive o host) `submit`a comandos; o host escuta
// `onSubmit`, valida/aplica e `broadcast`a o comando aceito; TODO participante aplica via
// `onBroadcast`. O remetente (mesmo o host) só reflete o efeito quando o aceito volta —
// UI pessimista (Clarifications) sai por construção.
import type { GameAction, PlayerAction } from '@/game/commands'
import type { GameState } from '@/game/turn/types'
import type { Resolved } from './recorder'
import type { JoinError, Room } from './room'

// Comando em trânsito guest→host: carrega o `playerId` DECLARADO pelo remetente. O host
// confere contra a identidade real da conexão (FR-007).
export interface CommandEnvelope {
  senderId: string // playerId declarado (o host valida contra o token da conexão)
  action: PlayerAction
}

// Comando ACEITO difundido host→todos: com o não-determinismo já resolvido (FR-011) e o
// número de sequência monotônico (FR-010). Inclui ações de sistema (pausa/fecho de leilão).
export interface AcceptedCommand {
  seq: number
  action: GameAction
  resolved: Resolved
}

// Snapshot persistido — 1 linha por partida (upsert, FR-013). Lido só ao entrar/reconectar.
export interface PersistedSnapshot {
  seq: number
  game: GameState
  room: Room
}

// Mudança de presença observada pelo host (por token de sessão).
export interface PresenceChange {
  token: string
  connected: boolean
  // Mesma sessão reabrindo nova conexão com a antiga ainda viva: a última assume, a anterior
  // cai — NÃO conta como desconexão para fins de pausa (FR-006a).
  takeover: boolean
}

// Pedido de assento no lobby (FR-002). NÃO carrega token: o host usa o token da CONEXÃO
// (`fromToken`) como identidade do assento — quem pede não escolhe quem é.
export interface JoinRequest {
  name: string
  color: string
}

export type Unsubscribe = () => void

export interface Transport {
  readonly token: string

  connect(): Promise<void>
  disconnect(): void

  // guest/host → host
  submit(cmd: CommandEnvelope): void
  onSubmit(cb: (cmd: CommandEnvelope, fromToken: string) => void): Unsubscribe

  // host → todos
  broadcast(cmd: AcceptedCommand): void
  onBroadcast(cb: (cmd: AcceptedCommand) => void): Unsubscribe

  // lobby: convidado pede assento → host responde publicando a sala (aceito) ou rejeitando
  requestJoin(who: JoinRequest): void
  onJoinRequest(cb: (who: JoinRequest, fromToken: string) => void): Unsubscribe
  rejectJoin(token: string, reason: JoinError): void
  onJoinRejected(cb: (token: string, reason: JoinError) => void): Unsubscribe

  // estado da sala (host publica; todos observam)
  publishRoom(room: Room): void
  onRoom(cb: (room: Room) => void): Unsubscribe

  // sala persistida — existe ANTES da partida (no lobby ainda não há `GameState`, então o
  // snapshot completo não serve): o convidado lê para saber que o link é válido; o host
  // escreve a cada mudança de assentos (FR-001/002).
  saveRoom(room: Room): Promise<void>
  loadRoom(): Promise<Room | null>

  // presença (host observa (des)conexões)
  onPresence(cb: (change: PresenceChange) => void): Unsubscribe

  // snapshot (host escreve; qualquer um lê ao entrar/reconectar)
  saveSnapshot(snap: PersistedSnapshot): Promise<void>
  loadSnapshot(): Promise<PersistedSnapshot | null>
}
