// Transporte in-memory (spec 037) — hub determinístico que liga host + N clientes num único
// processo. Entrega SÍNCRONA (sem timers/rede): um `submit` percorre host→broadcast→clientes
// na mesma pilha, tornando os testes headless determinísticos. É o transporte da suíte
// `tests/net/` e prova SC-001/003/004/005 sem infra. O `supabaseTransport` implementa a mesma
// porta sobre Realtime/Postgres.
import type { AcceptedCommand, CommandEnvelope, ConnStatus, JoinRequest, PersistedSnapshot, PresenceChange, Transport, Unsubscribe } from './transport'
import type { JoinError, Room } from './room'

type SubmitCb = (cmd: CommandEnvelope, fromUid: string) => void
type BroadcastCb = (cmd: AcceptedCommand) => void
type RoomCb = (room: Room) => void
type PresenceCb = (change: PresenceChange) => void
type JoinReqCb = (who: JoinRequest, fromUid: string) => void
type JoinRejCb = (uid: string, reason: JoinError) => void
type StatusCb = (status: ConnStatus) => void
type PresenceSyncCb = (uids: ReadonlySet<string>) => void

// LISTAS, não slots. Antes cada callback era um campo único (`conn.onBroadcast = cb`),
// então um segundo assinante silenciosamente derrubava o primeiro — enquanto o adapter
// Supabase mantinha arrays. Divergência de porta que nenhum teste via, porque host e
// cliente hoje assinam conjuntos disjuntos. A suíte de conformidade cobre os dois.
interface Connection {
  id: number
  uid: string
  onBroadcast: BroadcastCb[]
  onRoom: RoomCb[]
  onJoinRejected: JoinRejCb[]
  onStatus: StatusCb[]
  onPresenceSync: PresenceSyncCb[]
  channelUp: boolean // falta injetável (041, D14): canal caído sem contar como takeover
}

function detach<T>(arr: T[], cb: T): Unsubscribe {
  return () => {
    const i = arr.indexOf(cb)
    if (i >= 0) arr.splice(i, 1)
  }
}

// Backend compartilhado de UMA sala. Guarda o snapshot persistido, o último `room` publicado
// e as conexões vivas (por uid). O host é a única conexão que registra `onSubmit`/`onPresence`.
export class LocalHub {
  private nextId = 1
  private conns = new Map<number, Connection>()
  private submitCbs: SubmitCb[] = []
  private presenceCbs: PresenceCb[] = []
  private joinReqCbs: JoinReqCb[] = []
  private snapshot: PersistedSnapshot | null = null
  private storedRoom: Room | null = null // sala persistida (existe já no lobby, sem GameState)
  private lastRoom: Room | null = null
  private dropped = new Set<string>() // uids com difusão suprimida (fault-injection de teste: perda de pacote)

  // — faltas injetáveis de escrita/leitura (041, D14) — só testes; produção não usa isto.
  private writeFailures: number | 'always' = 0
  private readSnapshotFails = false
  private reorderArmed = false // arma a PRÓXIMA gravação para ficar retida
  private held: PersistedSnapshot | null = null // gravação retida — aplicada DEPOIS da seguinte

  // — usado pelo transporte (abaixo) —

  // `preAttached` — 041: `onStatus`/`onPresenceSync` precisam ser assináveis ANTES de
  // `connect()` (o host assina durante `ensureOpen()`, que roda antes do seu PRÓPRIO client
  // chamar `connect()` — mesma ordem que o supabase-js exige: `.on()` antes de `.subscribe()`).
  // O facade (abaixo) cria os arrays e os passa aqui, para a conexão nova escrever nos MESMOS
  // arrays que o chamador já pode ter assinado.
  register(uid: string, preAttached?: { onStatus: StatusCb[]; onPresenceSync: PresenceSyncCb[] }): Connection {
    // Takeover (FR-006a): já existe conexão viva com este uid → a última assume, a antiga cai.
    const prior = [...this.conns.values()].find((c) => c.uid === uid)
    const takeover = prior !== undefined
    if (prior) this.conns.delete(prior.id)
    const conn: Connection = {
      id: this.nextId++, uid, onBroadcast: [], onRoom: [], onJoinRejected: [],
      onStatus: preAttached?.onStatus ?? [], onPresenceSync: preAttached?.onPresenceSync ?? [], channelUp: true,
    }
    this.conns.set(conn.id, conn)
    // Presença: conexão nova. `takeover` NÃO é desconexão (não pausa) — mas ainda sinaliza que
    // o uid está conectado (reconexão após queda também entra por aqui, com takeover=false).
    this.emitPresence({ uid, connected: true, takeover })
    if (this.lastRoom) for (const cb of conn.onRoom) cb(this.lastRoom)
    this.emitPresenceSyncAll()
    return conn
  }

  drop(conn: Connection): void {
    if (!this.conns.has(conn.id)) return // já substituída por takeover — não reemite desconexão
    this.conns.delete(conn.id)
    this.emitPresence({ uid: conn.uid, connected: false, takeover: false })
    this.emitPresenceSyncAll()
  }

  // Queda/restauração de CANAL (041, contrato §1) — a MESMA conexão reassina, sem contar
  // como takeover (diferente de `register` com um uid já vivo). É o cenário do defeito 1:
  // reassinatura precisa reanunciar presença e emitir 'connected'.
  dropChannel(uid: string): void {
    for (const conn of this.conns.values()) {
      if (conn.uid !== uid || !conn.channelUp) continue
      conn.channelUp = false
      for (const cb of conn.onStatus) cb('reconnecting')
    }
    this.emitPresenceSyncAll()
  }

  restoreChannel(uid: string): void {
    for (const conn of this.conns.values()) {
      if (conn.uid !== uid || conn.channelUp) continue
      conn.channelUp = true
      for (const cb of conn.onStatus) cb('connected')
    }
    this.emitPresenceSyncAll()
  }

  presentUids(): ReadonlySet<string> {
    return new Set([...this.conns.values()].filter((c) => c.channelUp).map((c) => c.uid))
  }

  private emitPresenceSyncAll(): void {
    const uids = this.presentUids()
    for (const conn of this.conns.values()) for (const cb of conn.onPresenceSync) cb(uids)
  }

  // Recusa gravação `n` vezes (ou sempre, com `'always'`) — o próximo `saveSnapshot`/`saveRoom`
  // rejeita a promessa em vez de aplicar (FR-012/013, SC-003).
  failWrites(n: number | 'always'): void {
    this.writeFailures = n
  }

  failReadSnapshot(fail: boolean): void {
    this.readSnapshotFails = fail
  }

  // Arma a PRÓXIMA gravação de snapshot para ficar retida (simula o pacote atrasado de rede);
  // a gravação SEGUINTE a ela é aplicada primeiro, e só depois a retida — entregues fora de
  // ordem (FR-011, SC-004). A guarda monotônica de `applySnapshot` decide quem sobrevive.
  reorderWrites(): void {
    this.reorderArmed = true
  }

  private consumeWriteFailure(): boolean {
    if (this.writeFailures === 'always') return true
    if (this.writeFailures > 0) {
      this.writeFailures -= 1
      return true
    }
    return false
  }

  // Guarda monotônica (041, D9) — espelha o trigger SQL: escrita com `seq` menor que o já
  // aplicado é NO-OP silencioso. `saveRoom` (que não envia `seq`) não é afetado por esta guarda.
  private applySnapshot(snap: PersistedSnapshot): void {
    if (this.snapshot && snap.seq < this.snapshot.seq) return
    this.snapshot = snap
    this.storedRoom = snap.room
  }

  addSubmit(cb: SubmitCb): Unsubscribe {
    this.submitCbs.push(cb)
    return () => { this.submitCbs = this.submitCbs.filter((c) => c !== cb) }
  }

  addPresence(cb: PresenceCb): Unsubscribe {
    this.presenceCbs.push(cb)
    return () => { this.presenceCbs = this.presenceCbs.filter((c) => c !== cb) }
  }

  submit(cmd: CommandEnvelope, fromUid: string): void {
    for (const cb of this.submitCbs) cb(cmd, fromUid)
  }

  addJoinRequest(cb: JoinReqCb): Unsubscribe {
    this.joinReqCbs.push(cb)
    return () => { this.joinReqCbs = this.joinReqCbs.filter((c) => c !== cb) }
  }

  requestJoin(who: JoinRequest, fromUid: string): void {
    for (const cb of this.joinReqCbs) cb(who, fromUid)
  }

  // Rejeição é dirigida ao uid pedinte, mas trafega no mesmo canal (todos podem ver; nada
  // sensível). Cada conexão filtra o que é seu.
  rejectJoin(uid: string, reason: JoinError): void {
    for (const conn of this.conns.values()) for (const cb of conn.onJoinRejected) cb(uid, reason)
  }

  broadcast(cmd: AcceptedCommand): void {
    for (const conn of this.conns.values()) {
      if (this.dropped.has(conn.uid)) continue // simula lacuna na sequência (FR-012)
      for (const cb of conn.onBroadcast) cb(cmd)
    }
  }

  // Fault-injection (só testes): suprime/retoma a difusão para um uid, simulando rede
  // instável. O caminho de produção (Supabase) não usa isto.
  setDropBroadcast(uid: string, drop: boolean): void {
    if (drop) this.dropped.add(uid)
    else this.dropped.delete(uid)
  }

  publishRoom(room: Room): void {
    this.lastRoom = room
    for (const conn of this.conns.values()) for (const cb of conn.onRoom) cb(room)
  }

  async saveSnapshot(snap: PersistedSnapshot): Promise<void> {
    if (this.consumeWriteFailure()) throw new Error('injected write failure (saveSnapshot)')
    if (this.reorderArmed) {
      this.reorderArmed = false
      this.held = snap
      return
    }
    this.applySnapshot(snap)
    if (this.held) {
      const late = this.held
      this.held = null
      this.applySnapshot(late) // chega DEPOIS da mais nova — a guarda monotônica descarta
    }
  }

  async loadSnapshot(): Promise<PersistedSnapshot | null> {
    if (this.readSnapshotFails) throw new Error('injected read failure (loadSnapshot)')
    return this.snapshot
  }

  async saveRoom(room: Room): Promise<void> {
    if (this.consumeWriteFailure()) throw new Error('injected write failure (saveRoom)')
    this.storedRoom = room
    if (this.snapshot) this.snapshot = { ...this.snapshot, room }
  }

  async loadRoom(): Promise<Room | null> {
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
// esta conexão; reconectar = novo `localTransport(...).connect()` com o mesmo uid.
export function localTransport(hub: LocalHub, uid: string): Transport {
  let conn: Connection | null = null
  // Vivem no facade, não na `Connection` — assináveis ANTES de `connect()` (ver `register`).
  const statusCbs: StatusCb[] = []
  const presenceSyncCbs: PresenceSyncCb[] = []

  return {
    uid,

    connect(): Promise<void> {
      conn = hub.register(uid, { onStatus: statusCbs, onPresenceSync: presenceSyncCbs })
      return Promise.resolve()
    },

    disconnect(): void {
      if (conn) hub.drop(conn)
      conn = null
    },

    submit(cmd: CommandEnvelope): void {
      hub.submit(cmd, uid)
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
      hub.requestJoin(who, uid)
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
      return hub.saveRoom(room)
    },

    loadRoom(): Promise<Room | null> {
      return hub.loadRoom()
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

    onStatus(cb): Unsubscribe {
      // NÃO faz replay (contrato §1.4) — só o valor corrente a partir de agora. Assinável
      // ANTES de `connect()` — os arrays vivem no facade, não em `conn`.
      statusCbs.push(cb)
      return detach(statusCbs, cb)
    },

    onPresenceSync(cb): Unsubscribe {
      presenceSyncCbs.push(cb)
      cb(hub.presentUids()) // conveniência local: estado inicial logo após assinar (contrato §2.2)
      return detach(presenceSyncCbs, cb)
    },

    saveSnapshot(snap: PersistedSnapshot): Promise<void> {
      return hub.saveSnapshot(snap)
    },

    // O adapter CRU não repete sozinho, então nunca esgota — quem sobrescreve isto é o
    // decorator `durableWrites` (041, D8), único ponto de montagem de produção.
    onWriteExhausted: () => () => {},
    onWriteRecovered: () => () => {},

    loadSnapshot(): Promise<PersistedSnapshot | null> {
      return hub.loadSnapshot()
    },
  }
}
