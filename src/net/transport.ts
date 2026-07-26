// Porta de transporte (spec 037). Abstrai o canal entre clientes e host, com duas
// implementações: `localTransport` (hub in-memory, determinístico — testes headless) e
// `supabaseTransport` (Realtime + Postgres). A LÓGICA de autoridade/cliente é escrita só
// contra esta interface — trocar de transporte não muda host/cliente.
//
// Modelo uniforme: TODO participante (inclusive o host) `submit`a comandos; o host escuta
// `onSubmit`, valida/aplica e `broadcast`a o comando aceito; TODO participante aplica via
// `onBroadcast`. O remetente (mesmo o host) só reflete o efeito quando o aceito volta —
// UI pessimista (Clarifications) sai por construção.
//
// O CONTRATO É EXECUTÁVEL: `tests/net/conformance.test.ts` roda a mesma suíte contra os
// dois adapters. Semântica de porta que vive só em comentário é semântica que diverge —
// foi assim que `takeover` acabou implementado no adapter local e fixo em `false` no de
// produção. Regra: nada aqui vale sem um caso correspondente naquela suíte.
//
// Garantias que a porta NÃO dá (não construa em cima):
//   • `onRoom` NÃO faz replay do último `room` ao assinar — para o estado atual, `loadRoom()`.
//     (O adapter local entrega por conveniência; o Supabase não tem como.)
//   • `submit`/`broadcast`/`publishRoom`/`requestJoin`/`rejectJoin` são fire-and-forget:
//     falha de envio é silenciosa. Já `saveRoom`/`saveSnapshot` REJEITAM a promise.
//   • Antes de `connect()` resolver, envio nenhum trafega.
import type { GameAction, PlayerAction } from '@/game/commands'
import type { GameState } from '@/game/turn/types'
import type { Resolved } from './recorder'
import type { JoinError, PieceId, Room } from './room'

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
  piece?: PieceId // peça visual escolhida no lobby (spec 038); única por sala
  reentryCode?: string // NOVO (041, D-033) — presente = reanexação, não assento novo
}

// Status de conexão da PRÓPRIA sessão (041, contrato §1). Só dois valores: "conectado
// agora" ou não — mapear os cinco status do Realtime para dois é trabalho do adapter.
export type ConnStatus = 'connected' | 'reconnecting'

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

  // conexão da PRÓPRIA sessão (041, contrato §1) — reassinatura reanuncia 'connected',
  // não só a primeira. Não faz replay do último valor; após `connect()` resolvido, assuma
  // 'connected'.
  onStatus(cb: (status: ConnStatus) => void): Unsubscribe

  // conjunto COMPLETO de tokens presentes no canal (041, contrato §2) — não um delta. É a
  // fonte de verdade para a autoridade que reassume reconciliar presença (FR-021).
  onPresenceSync(cb: (tokens: ReadonlySet<string>) => void): Unsubscribe

  // snapshot (host escreve; qualquer um lê ao entrar/reconectar)
  saveSnapshot(snap: PersistedSnapshot): Promise<void>
  loadSnapshot(): Promise<PersistedSnapshot | null>
}
