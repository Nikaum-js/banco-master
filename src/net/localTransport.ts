// Transporte in-memory (spec 037) — hub determinístico que liga host + N clientes num único
// processo. Entrega SÍNCRONA (sem timers/rede): um `submit` percorre host→broadcast→clientes
// na mesma pilha, tornando os testes headless determinísticos. É o transporte da suíte
// `tests/net/` e prova SC-001/003/004/005 sem infra. O `supabaseTransport` implementa a mesma
// porta sobre Realtime/Postgres.
import type { AcceptedCommand, CommandEnvelope, JoinRequest, PersistedSnapshot, PresenceChange, Transport, Unsubscribe } from './transport'
import type { JoinError, Room } from './room'

type SubmitCb = (cmd: CommandEnvelope, fromToken: string) => void
type BroadcastCb = (cmd: AcceptedCommand) => void
type RoomCb = (room: Room) => void
type PresenceCb = (change: PresenceChange) => void
type JoinReqCb = (who: JoinRequest, fromToken: string) => void
type JoinRejCb = (token: string, reason: JoinError) => void

// LISTAS, não slots. Antes cada callback era um campo único (`conn.onBroadcast = cb`),
// então um segundo assinante silenciosamente derrubava o primeiro — enquanto o adapter
// Supabase mantinha arrays. Divergência de porta que nenhum teste via, porque host e
// cliente hoje assinam conjuntos disjuntos. A suíte de conformidade cobre os dois.
interface Connection {
  id: number
  token: string
  onBroadcast: BroadcastCb[]
  onRoom: RoomCb[]
  onJoinRejected: JoinRejCb[]
}

function detach<T>(arr: T[], cb: T): Unsubscribe {
  return () => {
    const i = arr.indexOf(cb)
    if (i >= 0) arr.splice(i, 1)
  }
}

// Backend compartilhado de UMA sala. Guarda o snapshot persistido, o último `room` publicado
// e as conexões vivas (por token). O host é a única conexão que registra `onSubmit`/`onPresence`.
export class LocalHub {
  private nextId = 1
  private conns = new Map<number, Connection>()
  private submitCbs: SubmitCb[] = []
  private presenceCbs: PresenceCb[] = []
  private joinReqCbs: JoinReqCb[] = []
  private snapshot: PersistedSnapshot | null = null
  private storedRoom: Room | null = null // sala persistida (existe já no lobby, sem GameState)
  private lastRoom: Room | null = null
  private dropped = new Set<string>() // tokens com difusão suprimida (fault-injection de teste: perda de pacote)

  // — usado pelo transporte (abaixo) —

  register(token: string): Connection {
    // Takeover (FR-006a): já existe conexão viva com este token → a última assume, a antiga cai.
    const prior = [...this.conns.values()].find((c) => c.token === token)
    const takeover = prior !== undefined
    if (prior) this.conns.delete(prior.id)
    const conn: Connection = { id: this.nextId++, token, onBroadcast: [], onRoom: [], onJoinRejected: [] }
    this.conns.set(conn.id, conn)
    // Presença: conexão nova. `takeover` NÃO é desconexão (não pausa) — mas ainda sinaliza que
    // o token está conectado (reconexão após queda também entra por aqui, com takeover=false).
    this.emitPresence({ token, connected: true, takeover })
    if (this.lastRoom) for (const cb of conn.onRoom) cb(this.lastRoom)
    return conn
  }

  drop(conn: Connection): void {
    if (!this.conns.has(conn.id)) return // já substituída por takeover — não reemite desconexão
    this.conns.delete(conn.id)
    this.emitPresence({ token: conn.token, connected: false, takeover: false })
  }

  addSubmit(cb: SubmitCb): Unsubscribe {
    this.submitCbs.push(cb)
    return () => { this.submitCbs = this.submitCbs.filter((c) => c !== cb) }
  }

  addPresence(cb: PresenceCb): Unsubscribe {
    this.presenceCbs.push(cb)
    return () => { this.presenceCbs = this.presenceCbs.filter((c) => c !== cb) }
  }

  submit(cmd: CommandEnvelope, fromToken: string): void {
    for (const cb of this.submitCbs) cb(cmd, fromToken)
  }

  addJoinRequest(cb: JoinReqCb): Unsubscribe {
    this.joinReqCbs.push(cb)
    return () => { this.joinReqCbs = this.joinReqCbs.filter((c) => c !== cb) }
  }

  requestJoin(who: JoinRequest, fromToken: string): void {
    for (const cb of this.joinReqCbs) cb(who, fromToken)
  }

  // Rejeição é dirigida ao token pedinte, mas trafega no mesmo canal (todos podem ver; nada
  // sensível). Cada conexão filtra o que é seu.
  rejectJoin(token: string, reason: JoinError): void {
    for (const conn of this.conns.values()) for (const cb of conn.onJoinRejected) cb(token, reason)
  }

  broadcast(cmd: AcceptedCommand): void {
    for (const conn of this.conns.values()) {
      if (this.dropped.has(conn.token)) continue // simula lacuna na sequência (FR-012)
      for (const cb of conn.onBroadcast) cb(cmd)
    }
  }

  // Fault-injection (só testes): suprime/retoma a difusão para um token, simulando rede
  // instável. O caminho de produção (Supabase) não usa isto.
  setDropBroadcast(token: string, drop: boolean): void {
    if (drop) this.dropped.add(token)
    else this.dropped.delete(token)
  }

  publishRoom(room: Room): void {
    this.lastRoom = room
    for (const conn of this.conns.values()) for (const cb of conn.onRoom) cb(room)
  }

  saveSnapshot(snap: PersistedSnapshot): void {
    this.snapshot = snap
    this.storedRoom = snap.room
  }

  loadSnapshot(): PersistedSnapshot | null {
    return this.snapshot
  }

  saveRoom(room: Room): void {
    this.storedRoom = room
    if (this.snapshot) this.snapshot = { ...this.snapshot, room }
  }

  loadRoom(): Room | null {
    return this.storedRoom
  }

  currentRoom(): Room | null {
    return this.lastRoom
  }

  private emitPresence(change: PresenceChange): void {
    for (const cb of this.presenceCbs) cb(change)
  }
}

// Facade por-conexão. Cada chamada representa UMA aba/dispositivo. `disconnect()` derruba só
// esta conexão; reconectar = novo `localTransport(...).connect()` com o mesmo token.
export function localTransport(hub: LocalHub, token: string): Transport {
  let conn: Connection | null = null

  return {
    token,

    connect(): Promise<void> {
      conn = hub.register(token)
      return Promise.resolve()
    },

    disconnect(): void {
      if (conn) hub.drop(conn)
      conn = null
    },

    submit(cmd: CommandEnvelope): void {
      hub.submit(cmd, token)
    },

    onSubmit(cb): Unsubscribe {
      return hub.addSubmit(cb)
    },

    broadcast(cmd: AcceptedCommand): void {
      hub.broadcast(cmd)
    },

    onBroadcast(cb): Unsubscribe {
      if (!conn) return () => {}
      conn.onBroadcast.push(cb)
      return detach(conn.onBroadcast, cb)
    },

    requestJoin(who): void {
      hub.requestJoin(who, token)
    },

    onJoinRequest(cb): Unsubscribe {
      return hub.addJoinRequest(cb)
    },

    rejectJoin(target, reason): void {
      hub.rejectJoin(target, reason)
    },

    onJoinRejected(cb): Unsubscribe {
      if (!conn) return () => {}
      conn.onJoinRejected.push(cb)
      return detach(conn.onJoinRejected, cb)
    },

    publishRoom(room: Room): void {
      hub.publishRoom(room)
    },

    saveRoom(room: Room): Promise<void> {
      hub.saveRoom(room)
      return Promise.resolve()
    },

    loadRoom(): Promise<Room | null> {
      return Promise.resolve(hub.loadRoom())
    },

    onRoom(cb): Unsubscribe {
      if (!conn) return () => {}
      conn.onRoom.push(cb)
      const current = hub.currentRoom()
      if (current) cb(current) // conveniência local; a PORTA não garante replay (ver transport.ts)
      return detach(conn.onRoom, cb)
    },

    onPresence(cb): Unsubscribe {
      return hub.addPresence(cb)
    },

    saveSnapshot(snap: PersistedSnapshot): Promise<void> {
      hub.saveSnapshot(snap)
      return Promise.resolve()
    },

    loadSnapshot(): Promise<PersistedSnapshot | null> {
      return Promise.resolve(hub.loadSnapshot())
    },
  }
}
