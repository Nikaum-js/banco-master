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
import { fromPublicRoom, redactRoom, seatByUid, type JoinError, type Room } from './room'
import type { AcceptedCommand, JoinRequest, Transport, Unsubscribe } from './transport'

// Conexão da PRÓPRIA sessão (041, data-model §4) — não é regra de jogo (difere por cliente,
// não trafega por difusão: quem está desconectado não recebe difusão nenhuma). `reconnecting
// → connected` passa PELA ressincronização — declarar-se conectado antes de reconciliar
// mostraria estado velho como atual (FR-005).
export type ConnectionState = 'connected' | 'reconnecting' | 'desynced'

export interface ClientOptions {
  retries?: number // tentativas de ressincronização além da 1ª; padrão 5
  sleep?(ms: number): Promise<void> // injetado — testes não esperam de verdade
  backoff?(attempt: number): number // ms da n-ésima espera; padrão exponencial com teto
}

export interface Client {
  readonly uid: string // ERA `token` (043, D-035) — identidade atestada desta aba, usada p/ achar o próprio assento
  join(): Promise<void> // conecta, lê o snapshot (entrada/reconexão) e passa a aplicar a difusão
  requestJoin(who: JoinRequest): Promise<void> // pede assento no lobby (FR-002) — host aceita e publica a sala
  leave(): void
  send(action: PlayerAction): void
  game(): GameState | null
  room(): Room | null
  playerId(): string | null
  joinError(): JoinError | null
  paused(): boolean
  seq(): number
  connection(): ConnectionState
  // 043, D-036/T024/T026: o PRÓPRIO código de reentrada — só existe aqui porque a prévia
  // (`loadRoom`/`room_preview`) o devolve pra quem chamou; a sala publicada (`room()`) nunca
  // carrega código nenhum, nem o do dono. `null` até a 1ª leitura da prévia resolver.
  myReentryCode(): string | null
  subscribe(cb: () => void): Unsubscribe // notifica a cada mudança de estado (liga a UI/store)
}

export function createClient(transport: Transport, opts: ClientOptions = {}): Client {
  const retries = opts.retries ?? 5
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))
  const backoff = opts.backoff ?? ((attempt: number) => Math.min(500 * 2 ** (attempt - 1), 8_000))
  // O cliente nunca consome RNG/relógio reais: o replay injeta os valores gravados pelo host.
  const baseCtx: TurnCtx = buildGameCtx(
    () => { throw new Error('cliente não deve consumir RNG fora do replay') },
    () => { throw new Error('cliente não deve consumir relógio fora do replay') },
  )

  let game: GameState | null = null
  let room: Room | null = null
  let seq = -1
  // Histórico curto dos últimos comandos aplicados — `{seq, preGame, cmd, origin}` (043,
  // T043). As duas cópias de um `seq` privacidade-sensível (pública redigida + privada
  // completa) trafegam por canais DIFERENTES, sem ordem garantida em rede real; e a defasagem
  // não é sempre "só um passo" — um comando seguinte (ex.: `confirm-card-reveal`, mandado
  // quase junto do `resolve-pending` que ele confirma) pode aplicar ANTES da privada tardia
  // chegar. Quando ela chega, refaz aquele passo a partir do `preGame` guardado e REAPLICA em
  // cadeia tudo que veio depois — puro e local: `applyCommand` clona o estado antes de mutar
  // (`turnMachine.ts`, `clone(state)`), então redo/replay não pisa em nada. Deliberadamente
  // NÃO usa `resync()` pra isto: a escrita de `persistSnapshot()` (host.ts) é fire-and-forget,
  // e um resync podia ler ANTES dela comitar — achado ao depurar T043 contra infra real (o
  // resync corrigia só às vezes, vencendo ou perdendo a corrida contra a própria escrita).
  const HISTORY_LIMIT = 20
  const history: { seq: number; preGame: GameState; cmd: AcceptedCommand; origin: 'public' | 'private' }[] = []
  let playerId: string | null = null
  let joinError: JoinError | null = null
  let myReentryCode: string | null = null
  const pending: { cmd: AcceptedCommand; origin: 'public' | 'private' }[] = [] // difusões chegadas antes do snapshot (buffer de corrida)
  const listeners = new Set<() => void>()
  const subs: Unsubscribe[] = []
  let connection: ConnectionState = 'connected'
  let resyncing = false // no máximo UMA ressincronização em voo por vez (D11 do plan)
  let resyncTarget = -1 // maior `seq` mínimo pedido desde que a ressincronização em voo começou

  function notify(): void {
    for (const cb of listeners) cb()
  }

  function resolvePlayerId(): void {
    if (!room) return
    const seat = seatByUid(room, transport.uid)
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

  function applyAccepted(cmd: AcceptedCommand, origin: 'public' | 'private' = 'public'): void {
    if (!game) { pending.push({ cmd, origin }); return } // ainda sem snapshot → guarda p/ reconciliar
    if (cmd.seq <= seq) {
      // Duplicata (043, T043) — se a que falta é a 'private' e no histórico ela ainda não
      // tinha chegado pra este seq, refaz esse passo a partir do `preGame` guardado e reaplica
      // em cadeia o que veio depois (mesmos `action`/`resolved` já recebidos — replay puro).
      // Fora do histórico (`idx < 0`, mais antigo que `HISTORY_LIMIT`) não há como corrigir
      // localmente: fica a versão já aplicada (raríssimo — exigiria dezenas de comandos entre
      // as duas cópias do mesmo aceito, que partem juntas do host).
      if (origin === 'private') {
        const idx = history.findIndex((h) => h.seq === cmd.seq)
        if (idx >= 0 && history[idx].origin !== 'private') {
          let g = applyCommand(history[idx].preGame, cmd.action, replayCtx(baseCtx, cmd.resolved))
          history[idx] = { ...history[idx], cmd, origin: 'private' }
          for (let i = idx + 1; i < history.length; i++) {
            g = applyCommand(g, history[i].cmd.action, replayCtx(baseCtx, history[i].cmd.resolved))
          }
          game = g
          notify()
        }
      }
      return
    }
    if (cmd.seq > seq + 1) { void resync(cmd.seq); return } // lacuna na sequência → recupera via snapshot (FR-012)
    const preGame = game
    game = applyCommand(game, cmd.action, replayCtx(baseCtx, cmd.resolved))
    seq = cmd.seq
    history.push({ seq, preGame, cmd, origin })
    if (history.length > HISTORY_LIMIT) history.shift()
    notify()
  }

  // Reconciliação: aplica em ordem as difusões que ficaram no buffer; lacuna → snapshot.
  function drainPending(): void {
    if (!game) return
    pending.sort((a, b) => a.cmd.seq - b.cmd.seq)
    for (const { cmd, origin } of pending.splice(0)) applyAccepted(cmd, origin)
  }

  // Ressincroniza pelo snapshot completo, com espera crescente (D11 do plan). Só UMA em voo
  // por vez — cada difusão com lacuna chamava outra antes disso, e era tempestade. Ao esgotar
  // as tentativas, declara-se `'desynced'` em vez do `return` mudo de antes (FR-005) — a UI
  // sabe que a reconciliação parou de tentar, em vez de mostrar estado velho como atual.
  //
  // `minSeq` (043, T043 — achado contra infra real): quem chama por LACUNA sabe qual `seq`
  // precisa alcançar (o do comando que revelou a lacuna). `persistSnapshot()` (host.ts) é
  // fire-and-forget — a escrita pode não ter comitado ainda quando esta leitura chega, e sem
  // este piso o resync aceitava uma leitura mais velha que a própria lacuna, sem nunca
  // convergir. Uma leitura aquém do piso entra no MESMO retry com backoff dos erros de rede —
  // não é falha, é só cedo demais. Chamadas concorrentes (reconexão + lacuna, por exemplo) só
  // sobem o piso; a rodada em voo relê `resyncTarget` antes de terminar.
  async function resync(minSeq = -1): Promise<void> {
    resyncTarget = Math.max(resyncTarget, minSeq)
    if (resyncing) return
    resyncing = true
    try {
      for (let attempt = 0; ; attempt++) {
        try {
          const snap = await transport.loadSnapshot()
          // Snapshot ausente é AMBÍGUO, e a diferença é `resyncTarget` (043, T045 — medido
          // contra infra real). Sem piso (`-1`), quem chamou não sabia se havia partida: aqui
          // "não existe" é a resposta certa, e repetir seria girar à toa no lobby. Com piso,
          // quem chamou JÁ SABE que existe — viu a sala em `playing`, ou viu uma lacuna de
          // `seq` — e "ausente" só pode ser CEDO DEMAIS: `durableWrites` resolve a promessa de
          // `saveSnapshot` quando o pedido entra na fila, não quando a linha commita (D8,
          // contrato §4), então o anfitrião anuncia `playing` antes de o `game` estar gravado.
          // Tratar isso como "não há partida" prendia o convidado no lobby PARA SEMPRE — nada
          // mais o acordaria, porque a difusão de sala já tinha passado. Cai no mesmo retry com
          // backoff dos erros de rede, que é onde este caso sempre pertenceu.
          if (!snap) {
            if (resyncTarget < 0) return // ninguém prometeu partida — não é falha, não repete
            throw new Error('resync: snapshot ainda não gravado — tenta de novo')
          }
          if (snap.seq < resyncTarget) throw new Error('resync: leitura aquém do piso — tenta de novo')
          game = snap.game
          // 043, T023: `loadSnapshot` ainda lê a linha inteira (a leitura por RPC é a Fase 5,
          // `read_snapshot`) — extrai o PRÓPRIO código antes de redigir tudo, para nenhum
          // código alheio sobreviver até lá e `myReentryCode` continuar disponível em partida.
          myReentryCode = snap.room.seats.find((s) => s.uid === transport.uid)?.reentryCode || null
          room = redactRoom(snap.room)
          seq = snap.seq
          // O `game` novo veio pronto do snapshot, não de encadear o histórico local — as
          // entradas antigas (`preGame`/replay em cadeia) não descrevem mais como chegar aqui
          // (043, T043). Mantê-las arriscaria um redo tardio reconstruir a partir de um
          // `preGame` que já não é ancestral do `game` atual.
          history.length = 0
          resolvePlayerId()
          drainPending() // difusões chegadas DURANTE a ressincronização — aplicadas em ordem, não descartadas
          connection = 'connected'
          notify()
          resyncTarget = -1
          return
        } catch {
          if (attempt >= retries) {
            connection = 'desynced'
            notify()
            resyncTarget = -1
            return
          }
          await sleep(backoff(attempt + 1))
        }
      }
    } finally {
      resyncing = false
    }
  }

  return {
    uid: transport.uid,

    async join(): Promise<void> {
      await transport.connect()
      subs.push(transport.onBroadcast(applyAccepted))
      subs.push(transport.onRoom((r) => {
        room = fromPublicRoom(r) // nunca carrega código nenhum — nem o do dono (D-036)
        resolvePlayerId()
        // Host iniciou a partida enquanto estávamos no lobby: o 1º snapshot já existe, mas
        // nenhuma difusão o traz (a difusão só carrega comandos) → busca-o agora (FR-006/014).
        // Piso `0` (043, T045): a sala fora do lobby é a PROMESSA de que existe partida a
        // ler. Sem o piso, um snapshot ainda não commitado era lido como "não há partida" e
        // esta era a ÚNICA chance de descobrir o contrário — o convidado ficava no lobby
        // enquanto a mesa jogava.
        if (!game && r.status !== 'lobby') void resync(0)
        notify()
      }))
      subs.push(transport.onJoinRejected((target, reason) => {
        if (target !== transport.uid) return // recusa dirigida a outro pedinte
        joinError = reason
        notify()
      }))
      // 043, D4: alguém reanexou por código (RPC, fora do caminho normal de comando) — inclusive
      // eu mesmo, se foi este uid que reanexou. Ressincroniza pelo snapshot: é assim que ESTE
      // cliente descobre o próprio assento novo (`resolvePlayerId` roda dentro de `resync`).
      subs.push(transport.onReattachNotice(() => void resync()))
      // Conexão da PRÓPRIA sessão (041, D5/D11): queda vira `'reconnecting'` na hora;
      // restabelecimento — inclusive numa REASSINATURA — ressincroniza para recuperar as
      // difusões perdidas durante a queda (FR-003), e só então volta a `'connected'`.
      subs.push(transport.onStatus((status) => {
        if (status === 'reconnecting') {
          connection = 'reconnecting'
          notify()
          return
        }
        void resync()
      }))
      const snap = await transport.loadSnapshot() // entrada/reconexão: snapshot completo (FR-014/015)
      if (snap) {
        game = snap.game
        myReentryCode = snap.room.seats.find((s) => s.uid === transport.uid)?.reentryCode || null // ver `resync`
        room = redactRoom(snap.room)
        seq = snap.seq
        resolvePlayerId()
        drainPending()
        notify()
        return
      }
      // Sem partida ainda (lobby): a sala persistida diz se o link é válido e quem já sentou.
      // `loadRoom` é a PRÉVIA (043, T025) — devolve o próprio código, e só o próprio (D5); é
      // o único lugar de onde `myReentryCode` pode vir.
      const persisted = await transport.loadRoom()
      if (persisted) {
        myReentryCode = persisted.seats.find((s) => s.uid === transport.uid)?.reentryCode || null
      }
      if (persisted && !room) {
        room = redactRoom(persisted) // room() nunca carrega código nenhum, nem o do dono
        resolvePlayerId()
        notify()
      }
    },

    requestJoin(who: JoinRequest): Promise<void> {
      if (playerId) return Promise.resolve() // já assentado — nada a pedir (FR-004)
      return transport.requestJoin(who)
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
    paused: () => Boolean(game?.paused),
    seq: () => seq,
    connection: () => connection,
    myReentryCode: () => myReentryCode,

    subscribe(cb): Unsubscribe {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
  }
}
