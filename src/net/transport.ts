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
import type { Secrets } from './perspective'
import type { JoinError, PieceId, PublicRoom, Room } from './room'

// Comando em trânsito guest→host: carrega o `playerId` DECLARADO pelo remetente. O host
// confere contra a identidade real da conexão — o `uid` da conexão que entregou o comando,
// nunca de um campo do payload (FR-007, D-042).
export interface CommandEnvelope {
  senderId: string // playerId declarado (o host valida contra o uid da conexão)
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
//
// 043, D6/T034: `game` é a parte PÚBLICA (mãos/decks redigidos, `perspective.splitSnapshot`);
// `secrets` é a parte reservada (`rooms.secrets`). Quem GRAVA (host.ts) sempre manda as duas
// já separadas. Quem LÊ recebe de volta um `game` já REMENTADO para a própria perspectiva — o
// adapter aplica `perspective.mergeSnapshot` internamente antes de devolver (seleção de chave
// no servidor, D6): o dono vê a própria mão, a autoridade vê tudo, e ninguém mais precisa
// saber que a separação existe. `secrets` no valor de retorno é só a fatia usada no merge —
// nenhum chamador de `loadSnapshot()` precisa lê-la.
export interface PersistedSnapshot {
  seq: number
  game: GameState
  secrets: Secrets
  room: Room
}

// Mudança de presença observada pelo host (por identidade de sessão).
export interface PresenceChange {
  uid: string
  connected: boolean
  // Mesma sessão reabrindo nova conexão com a antiga ainda viva: a última assume, a anterior
  // cai — NÃO conta como desconexão para fins de pausa (FR-006a).
  takeover: boolean
}

// Recusa por FALHA no caminho de autoridade (042, FR-020/022) — nunca por regra. Como
// `rejectJoin`, trafega no canal compartilhado (nada sensível nela, só o `occurrenceId`);
// quem filtra pelo próprio uid é o assinante (`client.ts`), não a porta.
export interface CommandFailure {
  occurrenceId: string
}

// Pedido de assento no lobby (FR-002). NÃO carrega identidade: o host usa o `uid` da CONEXÃO
// (`fromUid`) como identidade do assento — quem pede não escolhe quem é.
//
// 043, D4/T019: `reentryCode` SAI daqui — reanexar deixou de ser um tipo de pedido de assento
// e virou caminho próprio (`Transport.reattach`), porque o host não tem como assinar o tópico
// de um assento que ainda não existe (o pedido de um DESCONHECIDO nunca chegaria).
export interface JoinRequest {
  name: string
  color: string
  piece?: PieceId // peça visual escolhida no lobby (spec 038); única por sala
}

// Status de conexão da PRÓPRIA sessão (041, contrato §1). Só dois valores: "conectado
// agora" ou não — mapear os cinco status do Realtime para dois é trabalho do adapter.
export type ConnStatus = 'connected' | 'reconnecting'

export type Unsubscribe = () => void

export interface Transport {
  readonly uid: string // ERA `token` (043, D-042) — emitido pelo servidor, nunca escolhido

  connect(): Promise<void>
  disconnect(): void

  // guest/host → host
  submit(cmd: CommandEnvelope): void
  // `fromUid` vem do CANAL por onde a mensagem chegou (043, D3) — nunca do conteúdo do
  // payload. "A identidade não viaja, ela é o endereço": nenhum campo de identidade
  // sobrevive no `CommandEnvelope`, e nenhuma assinatura é necessária.
  onSubmit(cb: (cmd: CommandEnvelope, fromUid: string) => void): Unsubscribe

  // host → remetente: recusa por FALHA ao aplicar um comando (042, contracts/transport-delta.md)
  rejectCommand(toToken: string, info: CommandFailure): void
  onCommandRejected(cb: (toToken: string, info: CommandFailure) => void): Unsubscribe

  // host → todos
  broadcast(cmd: AcceptedCommand): void
  // `origin` diz por qual canal esta cópia chegou — 'private' é SEMPRE a completa (043, D9/D10;
  // achado ao rodar T043 contra infra real): as duas cópias do mesmo `seq` trafegam por canais
  // DIFERENTES (`:play` vs `:s:<uid>`), então a ordem de CHEGADA não é garantida em rede real
  // (só era no hub in-memory, onde `broadcast`/`broadcastPrivate` são chamadas síncronas na
  // mesma pilha). Se a pública chegar primeiro, o dono aplicaria a versão redigida e a privada
  // — mais completa — seria descartada como duplicata pelo guard de `seq`. `client.ts` usa
  // `origin` pra saber quando precisa se corrigir.
  onBroadcast(cb: (cmd: AcceptedCommand, origin: 'public' | 'private') => void): Unsubscribe
  // host → UM assento (043, D9/D10) — o dono recebe as DUAS cópias (esta e a de `broadcast`)
  // e aplica a privada; o guard de `seq` existente absorve a duplicata. Só tem efeito quando
  // chamada pela autoridade (contrato §3.2) — silenciosa para qualquer outra sessão.
  broadcastPrivate(uid: string, cmd: AcceptedCommand): void

  // host → assina/dessassina o tópico PRIVADO de um assento (043, D2/D3) — é o que permite
  // à autoridade observar `onSubmit`/`onPresence`/receber `broadcastPrivate` de CADA assento
  // sem um canal único compartilhado. Chamado ao aceitar entrada/reanexar e no kick (host.ts).
  // Sem efeito garantido para quem não é a autoridade daquela sala.
  watchSeat(uid: string): void
  unwatchSeat(uid: string): void

  // lobby: convidado pede assento → host responde publicando a sala (aceito) ou rejeitando.
  // 043, D4: por RPC (`request_seat`) — carimba `auth.uid()` no servidor e difunde ao lobby;
  // NÃO valida regra de sala (cheia/cor tomada/já iniciada continua sendo o host, com
  // `joinRoom`). A promise resolve quando a RPC é aceita pelo servidor, não quando o host
  // decide — a resposta de verdade continua chegando por `onJoinRequest`/`onRoom`.
  requestJoin(who: JoinRequest): Promise<void>
  onJoinRequest(cb: (who: JoinRequest, fromUid: string) => void): Unsubscribe
  rejectJoin(uid: string, reason: JoinError): void
  onJoinRejected(cb: (uid: string, reason: JoinError) => void): Unsubscribe

  // Reanexação por CÓDIGO (041, D-033 → 043, D4) — não passa pela autoridade: vale para
  // TODOS os assentos, inclusive o do anfitrião, porque o caso que justifica existir é
  // exatamente aquele em que não há autoridade viva para autorizar (celular sem bateria).
  // Único ponto do port com uma regra de domínio implementada no SERVIDOR (`reattach_by_code`,
  // security definer) — o espelho puro continua em `room.ts` para o adapter local e os testes.
  reattach(roomId: string, code: string): Promise<{ ok: true } | { ok: false; reason: JoinError }>
  // Aviso de que ALGUÉM reanexou nesta sala (043, D4) — carimbado no tópico de lobby pela
  // própria RPC (roda no servidor, fora da política de escrita normal). `client.ts` reage
  // ressincronizando (é assim que o próprio reanexado descobre o assento novo); `host.ts`
  // recarrega a sala e reconcilia os tópicos observados (T020).
  onReattachNotice(cb: () => void): Unsubscribe

  // estado da sala (host publica; todos observam). 043, D-036/T024: a projeção PÚBLICA — sem
  // `reentryCode` de ninguém (data-model §3). Uma difusão não tem "exceto quem chamou".
  publishRoom(room: PublicRoom): void
  onRoom(cb: (room: PublicRoom) => void): Unsubscribe

  // sala persistida — existe ANTES da partida (no lobby ainda não há `GameState`, então o
  // snapshot completo não serve): o convidado lê para saber que o link é válido; o host
  // escreve a cada mudança de assentos (FR-001/002). `saveRoom` grava a linha inteira (com
  // códigos — é onde eles moram). `loadRoom` lê pela prévia (`room_preview`, T025): cada
  // assento sem código, EXCETO o de quem chamou — é assim que o dono lê o próprio (D5).
  saveRoom(room: Room): Promise<void>
  loadRoom(): Promise<Room | null>

  // presença (host observa (des)conexões)
  onPresence(cb: (change: PresenceChange) => void): Unsubscribe

  // conexão da PRÓPRIA sessão (041, contrato §1) — reassinatura reanuncia 'connected',
  // não só a primeira. Não faz replay do último valor; após `connect()` resolvido, assuma
  // 'connected'.
  onStatus(cb: (status: ConnStatus) => void): Unsubscribe

  // conjunto COMPLETO de uids presentes no canal (041, contrato §2) — não um delta. É a
  // fonte de verdade para a autoridade que reassume reconciliar presença (FR-021).
  onPresenceSync(cb: (uids: ReadonlySet<string>) => void): Unsubscribe

  // snapshot (host escreve; qualquer um lê ao entrar/reconectar)
  saveSnapshot(snap: PersistedSnapshot): Promise<void>
  loadSnapshot(): Promise<PersistedSnapshot | null>

  // Esgotamento/recuperação da gravação (041, D8/D10) — o adapter CRU nunca emite (ele não
  // repete sozinho); é o decorator `durableWrites` quem sobrescreve estes dois ao embrulhar.
  // O host liga isto à pausa por persistência sem precisar conhecer o decorator.
  onWriteExhausted(cb: () => void): Unsubscribe
  onWriteRecovered(cb: () => void): Unsubscribe
}
