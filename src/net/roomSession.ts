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
import { createRoom, hostSeat, seatByToken, type JoinError, type PieceId, type Room } from './room'
import { newRoomId } from './session'
import type { Transport, Unsubscribe } from './transport'

/** Ritual de início (`order`) é de ENTRADA, nunca de reconexão — ver `isReentry`. */
export type SessionPhase = 'identity' | 'lobby' | 'order' | 'playing' | 'error'

export interface SessionIdentity {
  name: string
  color: string
  piece: PieceId
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
}

export interface RoomSession {
  readonly token: string
  getState(): RoomSessionState
  subscribe(cb: () => void): Unsubscribe

  /** Entrada por link — convidado OU host reabrindo (FR-004/FR-015). */
  enter(roomId: string): Promise<void>
  /** Cria a sala e assume a autoridade. Devolve o id, ou `null` se falhou. */
  create(who: SessionIdentity): Promise<string | null>
  requestSeat(who: SessionIdentity): void
  startMatch(): Promise<void>
  kick(target: string): void
  /** A revelação da ordem terminou (FR-030). */
  orderSeen(): void

  /** Fecha prazos vencidos. O browser agenda; os testes chamam. */
  tick(): void
  /** Solta assinaturas e o store. NÃO derruba a conexão (ver `OnlineGate`). */
  dispose(): void
}

export interface RoomSessionOptions {
  token: string
  /** A seam: qual adapter sobe. Produção passa o Supabase; os testes, o hub in-memory. */
  createTransport(roomId: string, token: string): Transport
  /** Liga o `useGameStore` ao client quando a partida existe. Devolve o desligador. */
  connectStore(client: Client): () => void
  /** Traduz falha de infra em mensagem acionável — específico do adapter. */
  describeError?(e: unknown): string
  /** Gerador de id de sala. Injetável para os testes terem ids determinísticos. */
  newRoomId?(): string
  /** RNG/relógio do host. Injetáveis para o sorteio de ordem ser reprodutível nos testes. */
  hostOptions?: HostOptions
}

export function createRoomSession(opts: RoomSessionOptions): RoomSession {
  const { token, createTransport, connectStore } = opts
  const describeError = opts.describeError ?? ((e: unknown) => String(e))
  const mintRoomId = opts.newRoomId ?? newRoomId

  let transport: Transport | null = null
  let client: Client | null = null
  let host: Host | null = null
  let disconnectStore: (() => void) | null = null
  const subs: Unsubscribe[] = []
  const listeners: (() => void)[] = []

  let state: RoomSessionState = { phase: 'identity', room: null, error: null, busy: false, isHost: false, roomId: null }

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

  // Espelha o client na sessão e liga o store assim que a partida existe.
  function syncFromClient(c: Client): void {
    const room = c.room()
    const joinError = c.joinError()
    const game = c.game()

    if (game) {
      disconnectStore ??= connectStore(c)
      emit({ room, error: joinError, busy: false, phase: isReentry(c) ? 'playing' : 'order' })
      return
    }
    // O pedido de assento é fire-and-forget na porta; a RESPOSTA é o `room` com o nosso
    // assento ou um `joinError`. Antes o `busy` era liberado por um `setTimeout(400)`.
    const answered = c.playerId() !== null || joinError !== null
    emit({
      room,
      error: joinError,
      busy: answered ? false : state.busy,
      phase: c.playerId() ? 'lobby' : state.phase,
    })
  }

  async function openSession(id: string): Promise<Client> {
    const t = createTransport(id, token)
    transport = t
    const c = createClient(t)
    client = c
    subs.push(c.subscribe(() => syncFromClient(c)))
    await c.join()
    emit({ roomId: id })
    return c
  }

  async function takeAuthority(initial: Room): Promise<void> {
    if (host || !transport) return
    const h = createHost(transport, initial, opts.hostOptions)
    host = h
    subs.push(h.subscribe(() => emit({ room: h.room() })))
    await h.open()
    emit({ room: h.room(), isHost: true })
  }

  return {
    token,
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
        if (!current) return fail('Sala não encontrada — confira o link.')
        if (c.game()?.phase === 'ended') return fail('ended') // FR-028: o link não reabre a mesa

        const mine = seatByToken(current, token)
        if (mine && hostSeat(current).token === token) await takeAuthority(current)
        // FR-005: token desconhecido não entra depois do início.
        if (!mine && current.status !== 'lobby') return fail('already-started')

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
        await takeAuthority(createRoom(id, { token, ...who }))
        emit({ phase: 'lobby', busy: false })
        return id
      } catch (e) {
        fail(describeError(e))
        return null
      }
    },

    requestSeat(who: SessionIdentity): void {
      emit({ busy: true, error: null })
      client?.requestJoin(who)
    },

    async startMatch(): Promise<void> {
      emit({ busy: true })
      const result = await host?.startMatch()
      if (result && !result.ok) {
        emit({ error: result.reason === 'too-few' ? 'São necessários ao menos 2 jogadores.' : result.reason })
      }
      emit({ busy: false })
    },

    kick(target: string): void {
      const r = host?.kick(target)
      if (r && !r.ok) emit({ error: r.reason === 'is-host' ? 'O anfitrião não pode se remover.' : String(r.reason) })
    },

    orderSeen: () => emit({ phase: 'playing' }),

    tick: () => host?.tick(),

    dispose(): void {
      for (const un of subs) un()
      subs.length = 0
      listeners.length = 0
      disconnectStore?.()
      disconnectStore = null
    },
  }
}
