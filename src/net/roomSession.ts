// ORQUESTRAÇÃO DA SALA — card 5 do review de arquitetura (2026-07-25).
//
// Isto vivia dentro de `net/ui/OnlineGate.tsx`: uma máquina de 6 fases com transições
// espalhadas por dez pontos, a decisão de autoridade, a escada de validade de entrada, a
// regra "isto é reconexão" escondida num `setPhase`, e um `setTimeout(400)` usado como
// correlação de request/response. Nada disso é React — e, pior, o componente instanciava
// `createSupabaseTransport` direto, então a seam de transporte que existe no nível de
// `host`/`client` NÃO alcançava o boot: nada do boot pra baixo rodava sobre o
// `localTransport`, e por isso nada do boot tinha teste headless.
//
// Aqui o transporte entra por PARÂMETRO. `OnlineGate` vira uma assinatura.
import { createClient, type Client } from './client'
import { createHost, type Host, type HostOptions } from './host'
import { createRoom, hostSeat, newHistoryId, newReentryCode, seatByUid, type JoinError, type OpeningMode, type Room } from './room'
import { newRoomId } from './session'
import type { Transport, Unsubscribe } from './transport'
import { nullTelemetry, type Telemetry, type TelemetryEvent } from '@/telemetry/port'
import { matchKey } from '@/telemetry/matchKey'
import type { AvatarId } from '@/boards/playerAvatarCatalog'
import type { SkinId } from '@/boards/playerSkinCatalog'
import type { BoardId } from '@/lib/mapCatalog'
import {
  applyRoomPreset,
  type RoomPreset,
  type RoomPresetId,
} from './roomPresets'

/** Ritual de início (`reveal`) é de ENTRADA, nunca de reconexão — ver `isReentry`.
 * `'reentry'` (041, D-033): partida em curso, sem assento — perder o aparelho não é mais
 * beco (era `fail('already-started')`); o formulário pede o código do próprio assento. */
export type SessionPhase = 'identity' | 'lobby' | 'auction' | 'rolling' | 'reveal' | 'playing' | 'error' | 'reentry'

export interface SessionIdentity {
  name: string
  color: string
  /** O formulário novo sempre envia; opcional para chamadores/testes legados. */
  avatar?: AvatarId
  /** O formulário novo sempre envia; opcional para chamadores/testes legados. */
  skin?: SkinId
}

export interface RoomSessionState {
  readonly phase: SessionPhase
  readonly room: Room | null
  readonly error: JoinError | string | null
  /** Uma ação de rede está em voo (criar sala, pedir assento, iniciar partida). */
  readonly busy: boolean
  /** Esta aba é a autoridade da sala. */
  readonly isHost: boolean
  /** Id da sala, quando já existe. */
  readonly roomId: string | null
  /** Identidade atestada desta sessão (043, D-042) — `null` até o transporte conectar. */
  readonly uid: string | null
  /** 043, D-036/T026: o PRÓPRIO código de reentrada (da prévia — `room` nunca carrega
   * código nenhum, nem o do dono). `null` até a prévia resolver. */
  readonly myReentryCode: string | null
  /** Valor escolhido nesta sessão; segue privado durante `auction`. */
  readonly openingBid: number | null
}

export interface RoomSession {
  getState(): RoomSessionState
  subscribe(cb: () => void): Unsubscribe

  /** Entrada por link — convidado OU host reabrindo (FR-004/FR-015). */
  enter(roomId: string): Promise<void>
  /** Cria a sala e assume a autoridade. Devolve o id, ou `null` se falhou. */
  create(who: SessionIdentity): Promise<string | null>
  requestSeat(who: SessionIdentity): void
  /** Reanexa ao próprio assento por CÓDIGO (041, D-033) — quando o link + uid não bastam. */
  requestReentry(code: string): void
  setOpeningMode(mode: OpeningMode): void
  /** D-077: host troca o mapa da sala, no lobby. Convidado não chama (a UI nem oferece). */
  setBoardId(boardId: BoardId): void
  startMatch(): Promise<void>
  /** 049/D-052: fecha o resumo neste cliente; o host também reabre a sala de forma durável. */
  returnToLobby(): Promise<void>
  submitOpeningBid(amount: number): void
  submitOpeningRoll(): void
  kick(target: string): void

  /** Fecha prazos vencidos. O browser agenda; os testes chamam. */
  tick(): void
  /** Solta assinaturas e o store. NÃO derruba a conexão (ver `OnlineGate`). */
  dispose(): void
  /** Fronteira de último recurso (042, D-035): ao contrário de `dispose()`, ESTE encerra a
   * presença — chama antes de exibir a tela de falha, pra ausência chegar à mesa como
   * desconexão (§11.3), sem causa de pausa nova. Seguro chamar sem sessão iniciada, e seguro
   * chamar mais de uma vez. */
  leaveOnFatalError(): void
}

export interface RoomSessionOptions {
  /** A seam: qual adapter sobe. Produção passa o Supabase — assíncrona: obtém a sessão
   * atestada (`ensureSession()`) antes de conectar (043, D1). Os testes passam o hub
   * in-memory, síncrono; `await` funciona igual nos dois. */
  createTransport(roomId: string): Transport | Promise<Transport>
  /** Liga o `useGameStore` ao client quando a partida existe. Devolve o desligador. */
  connectStore(client: Client): () => void
  /** Traduz falha de infra em mensagem acionável — específico do adapter. */
  describeError?(e: unknown): string
  /** Gerador de id de sala. Injetável para os testes terem ids determinísticos. */
  newRoomId?(): string
  /** Gerador do código de reentrada do PRÓPRIO assento ao criar a sala (041, D-033/D12) —
   * `room.ts` não tem RNG. Injetável para os testes terem códigos determinísticos. */
  mintReentryCode?(): string
  /** D-067: id público, sem poder de reentrada, usado somente no histórico desta sala. */
  mintHistoryId?(): string
  /** RNG/relógio do host. Injetáveis para o sorteio de ordem ser reprodutível nos testes. */
  hostOptions?: HostOptions
  /** Padrão `nullTelemetry` (044, D-040). Emite `room_created` aqui e é repassado ao host
   * (`match_started`/`match_ended`/`match_paused`) — a MESMA instância, um destino só. */
  telemetry?: Telemetry
  /** Duração da revelação automática; injetável para testes headless. */
  revealMs?: number
  /** Preferência local: consultada SOMENTE por `create()`, nunca por `enter()`. */
  initialRoomPreset?: RoomPreset
  /** Chamado somente depois de a autoridade aceitar a mudança publicada. */
  onRoomPresetSelected?(id: RoomPresetId): void
  /** 055/D-069: mapa escolhido na home ANTES da criação. Consultado somente por
   * `create()` — `enter()` sempre recebe o mapa da sala publicada. */
  initialBoardId?: BoardId
}

export function createRoomSession(opts: RoomSessionOptions): RoomSession {
  const { createTransport, connectStore } = opts
  const describeError = opts.describeError ?? ((e: unknown) => String(e))
  const mintRoomId = opts.newRoomId ?? newRoomId
  const mintReentryCode = opts.mintReentryCode ?? (() => newReentryCode(Math.random))
  const mintHistoryId = opts.mintHistoryId ?? (() => newHistoryId(Math.random))
  const telemetry = opts.telemetry ?? nullTelemetry
  const revealMs = opts.revealMs ?? 4_200

  // T1/T2 do contrato: a sessão não pode sentir uma falha de telemetria — mesma segunda
  // linha de defesa de `host.ts` (o adaptador de produção já engole os próprios erros).
  function trackSafely(event: TelemetryEvent): void {
    try {
      telemetry.track(event)
    } catch {
      // FR-037
    }
  }

  let transport: Transport | null = null
  let client: Client | null = null
  let host: Host | null = null
  let disconnectStore: (() => void) | null = null
  let revealTimer: ReturnType<typeof setTimeout> | null = null
  let postgameLobby = false
  const subs: Unsubscribe[] = []
  const listeners: (() => void)[] = []

  let state: RoomSessionState = {
    phase: 'identity', room: null, error: null, busy: false, isHost: false, roomId: null, uid: null, myReentryCode: null, openingBid: null,
  }

  function emit(patch: Partial<RoomSessionState>): void {
    state = { ...state, ...patch }
    for (const cb of listeners) cb()
  }

  function fail(error: JoinError | string): void {
    emit({ phase: 'error', error, busy: false })
  }

  /**
   * Isto é RECONEXÃO no meio da partida, e não uma entrada nova?
   *
   * Regra de domínio (FR-030: a ordem sorteada é ritual de início), não detalhe de UI —
   * era um `client.seq() > 0` cru dentro de um atualizador de `setPhase`.
   */
  function isReentry(c: Client): boolean {
    return state.phase === 'playing' || c.seq() > 0
  }

  function revealThenPlay(fromOpeningFlow = false): void {
    if (!fromOpeningFlow && isReentry(client!)) {
      emit({ phase: 'playing' })
      return
    }
    emit({ phase: 'reveal' })
    if (revealMs <= 0) {
      emit({ phase: 'playing' })
      return
    }
    revealTimer ??= setTimeout(() => {
      revealTimer = null
      emit({ phase: 'playing' })
    }, revealMs)
  }

  // Espelha o client na sessão e liga o store assim que a partida existe.
  function syncFromClient(c: Client): void {
    const room = c.room()
    const joinError = c.joinError()
    const game = c.game()
    const myReentryCode = c.myReentryCode()
    const openingBid = c.openingBid()

    // A geração seguinte já entrou no Ritual de Largada. Isto prevalece sobre um resumo
    // encerrado que este cliente ainda mantinha aberto localmente (049/FR-020).
    if (c.playerId() && room?.status === 'bidding') {
      postgameLobby = false
      emit({ room, error: joinError, busy: false, phase: 'auction', myReentryCode, openingBid })
      return
    }
    if (c.playerId() && room?.status === 'rolling') {
      postgameLobby = false
      emit({ room, error: joinError, busy: false, phase: 'rolling', myReentryCode, openingBid })
      return
    }

    // Partida em curso mas AINDA sem assento (041, D-033): reentrada pendente ou recusada
    // por código inválido. Fica no formulário — NUNCA pula para 'playing'/'order' sem
    // assento, mesmo com o `GameState` já carregado (é o mesmo `game` de todo mundo).
    if (game && !c.playerId()) {
      emit({ room, error: joinError, busy: false, phase: 'reentry', myReentryCode, openingBid })
      return
    }
    if (game) {
      if (game.phase === 'ended' && postgameLobby) {
        emit({ room, error: joinError, busy: false, phase: 'lobby', myReentryCode, openingBid })
        return
      }
      // Um comando sistêmico pode avançar `seq` durante o próprio start (por exemplo,
      // ausência detectada logo após o snapshot). Quem já estava no lobby/leilão continua
      // no ritual de abertura; `seq > 0` só caracteriza reentrada fora desse fluxo.
      const fromOpeningFlow = state.phase === 'lobby' || state.phase === 'auction' || state.phase === 'rolling'
      disconnectStore ??= connectStore(c)
      emit({ room, error: joinError, busy: false, myReentryCode, openingBid })
      if (state.phase !== 'reveal' && state.phase !== 'playing') revealThenPlay(fromOpeningFlow)
      return
    }
    // O pedido de assento é fire-and-forget na porta; a RESPOSTA é o `room` com o nosso
    // assento ou um `joinError`. Antes o `busy` era liberado por um `setTimeout(400)`.
    const answered = c.playerId() !== null || joinError !== null
    emit({
      // `room ?? state.room` (043, T045): o client só conhece a sala DEPOIS de recebê-la por
      // difusão ou prévia; a autoridade a conhece desde que a criou. Deixar o `null` do client
      // sobrescrever apagava a sala recém-criada e a tela do host voltava para
      // "Conectando…" — a sessão não pode desaprender o que já sabe.
      room: room ?? state.room,
      error: joinError,
      busy: answered ? false : state.busy,
      phase: c.playerId()
        ? room?.status === 'bidding'
          ? 'auction'
          : room?.status === 'rolling'
            ? 'rolling'
            : 'lobby'
        : state.phase,
      myReentryCode,
      openingBid,
    })
  }

  async function openSession(id: string): Promise<Client> {
    const t = await createTransport(id)
    transport = t
    emit({ uid: t.uid }) // 043, D1: a identidade só existe depois do transporte resolver
    const c = createClient(t)
    client = c
    subs.push(c.subscribe(() => syncFromClient(c)))
    await c.join()
    emit({ roomId: id })
    return c
  }

  async function takeAuthority(initial: Room): Promise<void> {
    if (host || !transport) return
    // A MESMA instância de telemetria da sessão desce ao host (044): `room_created` sai
    // daqui, `match_started`/`match_ended`/`match_paused` saem de lá — um destino só.
    const h = createHost(transport, initial, { ...opts.hostOptions, telemetry })
    host = h
    subs.push(h.subscribe(() => emit({ room: h.room() })))
    await h.open()
    emit({ room: h.room(), isHost: true })
  }

  return {
    getState: () => state,
    subscribe(cb) {
      listeners.push(cb)
      return () => {
        const i = listeners.indexOf(cb)
        if (i >= 0) listeners.splice(i, 1)
      }
    },

    async enter(roomId: string): Promise<void> {
      try {
        const c = await openSession(roomId)
        const current = c.room()
        if (!current) return fail('Sala não encontrada. Confira o link.')

        const myUid = transport!.uid
        const mine = seatByUid(current, myUid)
        if (mine && hostSeat(current).uid === myUid) await takeAuthority(current)
        // Uid desconhecido depois do início (041, D-033): não é mais beco — oferece o
        // formulário de reentrada por código, em vez de recusar com 'already-started'.
        if (!mine && current.status !== 'lobby') {
          emit({ room: current, phase: 'reentry', error: null })
          return
        }

        // 049/FR-018: quem tem assento recupera a classificação encerrada; visitante continua
        // na escada de reentrada e não recebe uma tela privada só por conhecer o link.
        if (mine && c.game()?.phase === 'ended') {
          postgameLobby = false
          emit({ room: current, phase: 'playing' })
          syncFromClient(c)
          return
        }

        emit({ room: current, phase: mine ? 'lobby' : 'identity' })
        syncFromClient(c)
      } catch (e) {
        fail(describeError(e))
      }
    },

    async create(who: SessionIdentity): Promise<string | null> {
      emit({ busy: true, error: null })
      try {
        const id = mintRoomId()
        await openSession(id)
        const created = createRoom(id, {
          uid: transport!.uid,
          ...who,
          reentryCode: mintReentryCode(),
          historyId: mintHistoryId(),
        }, { boardId: opts.initialBoardId })
        const preferred = opts.initialRoomPreset
          ? applyRoomPreset(created, opts.initialRoomPreset)
          : { ok: true as const, room: created }
        await takeAuthority(preferred.ok ? preferred.room : created)
        // 044/T045: só AQUI, na criação de verdade — `enter()` também chama `takeAuthority`
        // quando o host reassume a própria sala (F5), e isso não é "sala criada" de novo.
        trackSafely({ kind: 'room_created', matchKey: await matchKey(id) })
        emit({ phase: 'lobby', busy: false })
        return id
      } catch (e) {
        fail(describeError(e))
        return null
      }
    },

    requestSeat(who: SessionIdentity): void {
      emit({ busy: true, error: null })
      void client?.requestJoin(who).catch((e) => emit({ busy: false, error: describeError(e) }))
    },

    // 043, D4: por RPC (`transport.reattach`), não mais um `JoinRequest` com código — reanexar
    // deixou de ser um tipo de pedido de assento. `name`/`color` ficam de fora (contrato
    // §3.2): nome/cor/avatar/skin pertencem ao assento, não a quem está reabrindo. Sucesso não
    // precisa tocar `phase`/`room` aqui — `client.ts` reage sozinho ao aviso de reanexação
    // (ressincroniza, descobre o próprio assento) e `syncFromClient` segue a fase dali. Recusa
    // por 'bad-code' volta ao formulário — `syncFromClient` mantém 'reentry' porque `playerId`
    // continua null.
    requestReentry(code: string): void {
      emit({ busy: true, error: null })
      void (async () => {
        if (!transport || !state.roomId) return
        try {
          const result = await transport.reattach(state.roomId, code)
          if (!result.ok) { emit({ busy: false, error: result.reason }); return }
          emit({ busy: false })
        } catch (e) {
          emit({ busy: false, error: describeError(e) })
        }
      })()
    },

    setOpeningMode(mode: OpeningMode): void {
      const result = host?.setOpeningMode(mode)
      if (result?.ok) opts.onRoomPresetSelected?.(mode)
      else if (result) emit({ error: result.reason })
    },

    setBoardId(boardId: BoardId): void {
      const result = host?.setBoardId(boardId)
      if (result && !result.ok) emit({ error: result.reason })
    },

    async startMatch(): Promise<void> {
      emit({ busy: true })
      const result = await host?.startMatch()
      if (result && !result.ok) {
        emit({ error: result.reason === 'too-few' ? 'São necessários ao menos 2 jogadores.' : result.reason })
      }
      emit({ busy: false })
    },

    async returnToLobby(): Promise<void> {
      const ended = client?.game()?.phase === 'ended'
      if (!ended && state.room?.status !== 'lobby') return
      if (state.isHost) {
        emit({ busy: true, error: null })
        const result = await host?.reopenRoom()
        if (!result || !result.ok) {
          emit({
            busy: false,
            error: result?.reason === 'persistence'
              ? 'Não foi possível reabrir a sala. A classificação continua preservada.'
              : 'A partida ainda não terminou.',
          })
          return
        }
        postgameLobby = true
        emit({ phase: 'lobby', room: host?.room() ?? state.room, busy: false, error: null })
        return
      }
      postgameLobby = true
      emit({ phase: 'lobby', busy: false, error: null })
    },

    submitOpeningBid(amount: number): void {
      client?.submitOpeningBid(amount)
    },

    submitOpeningRoll(): void {
      client?.submitOpeningRoll()
    },

    kick(target: string): void {
      const r = host?.kick(target)
      if (r && !r.ok) emit({ error: r.reason === 'is-host' ? 'O host não pode se remover.' : String(r.reason) })
    },

    tick: () => host?.tick(),

    dispose(): void {
      for (const un of subs) un()
      subs.length = 0
      listeners.length = 0
      disconnectStore?.()
      disconnectStore = null
      if (revealTimer) clearTimeout(revealTimer)
      revealTimer = null
    },

    leaveOnFatalError(): void {
      host?.stop()
      client?.leave()
      client = null
      host = null
      for (const un of subs) un()
      subs.length = 0
      listeners.length = 0
      disconnectStore?.()
      disconnectStore = null
      if (revealTimer) clearTimeout(revealTimer)
      revealTimer = null
    },
  }
}
