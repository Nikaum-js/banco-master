// Transporte in-memory (spec 037) — hub determinístico que liga host + N clientes num único
// processo. Entrega SÍNCRONA (sem timers/rede): um `submit` percorre host→broadcast→clientes
// na mesma pilha, tornando os testes headless determinísticos. É o transporte da suíte
// `tests/net/` e prova SC-001/003/004/005 sem infra. O `supabaseTransport` implementa a mesma
// porta sobre Realtime/Postgres.
import type { AcceptedCommand, CommandEnvelope, CommandFailure, ConnStatus, JoinRequest, OpeningBidMessage, PersistedSnapshot, PresenceChange, Transport, Unsubscribe } from './transport'
import { mergeSnapshot, type Secrets } from './perspective'
import { normalizeRoom, reattachByCode, toPublicRoom, type JoinError, type PublicRoom, type Room } from './room'

type SubmitCb = (cmd: CommandEnvelope, fromUid: string) => void
type OpeningBidCb = (message: OpeningBidMessage, fromUid: string) => void
type BroadcastCb = (cmd: AcceptedCommand, origin: 'public' | 'private') => void
type RoomCb = (room: PublicRoom) => void
type PresenceCb = (change: PresenceChange) => void
type JoinReqCb = (who: JoinRequest, fromUid: string) => void
type CommandRejCb = (toUid: string, info: CommandFailure) => void
type JoinRejCb = (uid: string, reason: JoinError) => void
type StatusCb = (status: ConnStatus) => void
type PresenceSyncCb = (uids: ReadonlySet<string>) => void
type ReattachCb = () => void

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
  onCommandRejected: CommandRejCb[]
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
  private openingBidCbs: OpeningBidCb[] = []
  private presenceCbs: PresenceCb[] = []
  private joinReqCbs: JoinReqCb[] = []
  private reattachCbs: ReattachCb[] = []
  private snapshot: PersistedSnapshot | null = null
  private storedRoom: Room | null = null // sala persistida (existe já no lobby, sem GameState)
  private lastRoom: PublicRoom | null = null
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
      id: this.nextId++, uid, onBroadcast: [], onRoom: [], onJoinRejected: [], onCommandRejected: [],
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
    const room = this.preserveSeatCodes(snap.room)
    this.snapshot = { ...snap, room }
    this.storedRoom = room
  }

  // Paridade com `preserve_seat_codes` (043, T043/D-043): o código é imutável depois de
  // mintado, e é a gravação que garante — casando por `playerId`, que a reanexação preserva
  // (FR-027). Nenhuma escrita, nem a da autoridade, apaga um código já guardado.
  private preserveSeatCodes(room: Room): Room {
    const stored = this.storedRoom
    if (!stored) return room
    const known = new Map(stored.seats.filter((s) => s.reentryCode).map((s) => [s.playerId, s.reentryCode]))
    return { ...room, seats: room.seats.map((s) => (s.reentryCode ? s : { ...s, reentryCode: known.get(s.playerId) ?? '' })) }
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

  addOpeningBid(cb: OpeningBidCb): Unsubscribe {
    this.openingBidCbs.push(cb)
    return () => { this.openingBidCbs = this.openingBidCbs.filter((c) => c !== cb) }
  }

  openingBid(message: OpeningBidMessage, fromUid: string): void {
    for (const cb of this.openingBidCbs) cb(message, fromUid)
  }

  addJoinRequest(cb: JoinReqCb): Unsubscribe {
    this.joinReqCbs.push(cb)
    return () => { this.joinReqCbs = this.joinReqCbs.filter((c) => c !== cb) }
  }

  requestJoin(who: JoinRequest, fromUid: string): void {
    for (const cb of this.joinReqCbs) cb(who, fromUid)
  }

  addReattachNotice(cb: ReattachCb): Unsubscribe {
    this.reattachCbs.push(cb)
    return () => { this.reattachCbs = this.reattachCbs.filter((c) => c !== cb) }
  }

  // Espelho local da RPC `reattach_by_code` (043, D4) — mesmo reducer PURO de `room.ts` que a
  // SQL replica no servidor. Sem checagem de autoridade: é a ÚNICA regra de domínio que roda
  // sem depender de quem está online, de propósito (o caso que justifica é o host FORA).
  reattachByCodeRpc(code: string, uid: string): { ok: true } | { ok: false; reason: 'bad-code' } {
    if (!this.storedRoom) return { ok: false, reason: 'bad-code' }
    const result = reattachByCode(this.storedRoom, code, uid)
    if (!result.ok) return result
    this.storedRoom = result.room
    this.lastRoom = toPublicRoom(result.room)
    if (this.snapshot) this.snapshot = { ...this.snapshot, room: result.room }
    for (const cb of this.reattachCbs) cb()
    return { ok: true }
  }

  // Autoridade da sala = dono do assento `isHost` na ÚLTIMA sala persistida (043, D2/D3 —
  // espelha a política SQL "update só o uid do assento de host"). Por `isHost`, não por
  // posição: `shuffleSeatOrder` reordena o array para a ordem de turno e não garante que o
  // host fique em `seats[0]`. `null` antes de qualquer `saveRoom`/`saveSnapshot` — nesse
  // instante NINGUÉM é autoridade, e a checagem abaixo recusa por padrão (fail-closed).
  private currentHostUid(): string | null {
    const room = this.storedRoom ?? this.lastRoom
    return room?.seats.find((s) => s.isHost)?.uid ?? null
  }

  // Rejeição é dirigida ao uid pedinte, mas trafega no mesmo canal (todos podem ver; nada
  // sensível). Cada conexão filtra o que é seu. Paridade de recusa (043, D12/T013): só a
  // autoridade consegue — o que a política de `room:<id>:lobby` faria no Supabase.
  rejectJoin(uid: string, reason: JoinError, fromUid: string): void {
    if (fromUid !== this.currentHostUid()) return
    for (const conn of this.conns.values()) for (const cb of conn.onJoinRejected) cb(uid, reason)
  }

  // Recusa por FALHA (042) — mesmo desenho de `rejectJoin`: trafega a todos, cada conexão
  // filtra o que é seu pelo uid-alvo.
  rejectCommand(toUid: string, info: CommandFailure): void {
    for (const conn of this.conns.values()) for (const cb of conn.onCommandRejected) cb(toUid, info)
  }

  // Paridade de recusa: só a autoridade difunde (043, T013) — espelha a política de
  // `room:<id>:play`, escrevível só pelo uid do assento de host.
  broadcast(cmd: AcceptedCommand, fromUid: string): void {
    if (fromUid !== this.currentHostUid()) return
    for (const conn of this.conns.values()) {
      if (this.dropped.has(conn.uid)) continue // simula lacuna na sequência (FR-012)
      for (const cb of conn.onBroadcast) cb(cmd, 'public')
    }
  }

  // Parte PRIVADA do aceito (043, D9/D10) — alcança só o(s) conexão(ões) do assento alvo, e
  // só quando quem chama é a autoridade (mesma regra de `broadcast`). Alimenta o MESMO
  // `onBroadcast` do destinatário, marcada como 'private' — `client.ts` usa essa marca pra
  // saber que ESTA cópia é sempre a completa, mesmo que chegue DEPOIS da pública (043, T043:
  // no adapter Supabase as duas trafegam por canais diferentes, sem ordem garantida — só aqui,
  // síncrono na mesma pilha, a ordem de chamada é a ordem de entrega).
  broadcastPrivate(targetUid: string, cmd: AcceptedCommand, fromUid: string): void {
    if (fromUid !== this.currentHostUid()) return
    for (const conn of this.conns.values()) {
      if (conn.uid !== targetUid || this.dropped.has(conn.uid)) continue
      for (const cb of conn.onBroadcast) cb(cmd, 'private')
    }
  }

  // Fault-injection (só testes): suprime/retoma a difusão para um uid, simulando rede
  // instável. O caminho de produção (Supabase) não usa isto.
  setDropBroadcast(uid: string, drop: boolean): void {
    if (drop) this.dropped.add(uid)
    else this.dropped.delete(uid)
  }

  // Paridade de recusa: só a autoridade publica (043, T013) — espelha `room:<id>:lobby`.
  //
  // Defesa em profundidade (T023): `toPublicRoom` roda AQUI, não só na disciplina de quem
  // chama — `Room` é estruturalmente um superconjunto de `PublicRoom` (mais campos, não
  // menos), então o TypeScript não barra alguém passando uma `Room` completa por engano. O
  // FIO é o lugar onde a garantia vira estrutural, não convenção.
  publishRoom(room: PublicRoom, fromUid: string): void {
    if (fromUid !== this.currentHostUid()) return
    const safe = toPublicRoom(room as unknown as Room)
    this.lastRoom = safe
    for (const conn of this.conns.values()) for (const cb of conn.onRoom) cb(safe)
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
    const kept = this.preserveSeatCodes(room)
    this.storedRoom = kept
    if (this.snapshot) this.snapshot = { ...this.snapshot, room: kept }
  }

  async loadRoom(): Promise<Room | null> {
    return this.storedRoom
  }

  currentRoom(): PublicRoom | null {
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
  // Paridade com os três tópicos do Supabase (043, D2/T013): o hub é UM barramento só, mas
  // cada facade só "ouve" submit/presença do PRÓPRIO uid e de quem `watchSeat` observa — o
  // mesmo recorte que um canal `s:<uid>` impõe de verdade. Começa com o próprio, como o canal
  // `own` do adapter real.
  const watched = new Set<string>([uid])

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
      return hub.addSubmit((cmd, fromUid) => { if (watched.has(fromUid)) cb(cmd, fromUid) })
    },

    submitOpeningBid(amount: number): void {
      hub.openingBid({ amount }, uid)
    },

    onOpeningBid(cb): Unsubscribe {
      return hub.addOpeningBid((message, fromUid) => {
        if (watched.has(fromUid)) cb(message, fromUid)
      })
    },

    broadcast(cmd: AcceptedCommand): void {
      hub.broadcast(cmd, uid)
    },

    onBroadcast(cb): Unsubscribe {
      if (!conn) return () => {}
      conn.onBroadcast.push(cb)
      return detach(conn.onBroadcast, cb)
    },

    broadcastPrivate(targetUid: string, cmd: AcceptedCommand): void {
      hub.broadcastPrivate(targetUid, cmd, uid)
    },

    // Assina/dessassina o recorte de submit/presença de outro assento (043, D2/D3) — é o que
    // permite à autoridade observar cada assento sem um canal único compartilhado. O PRÓPRIO
    // uid nunca sai (equivalente ao canal `own`, sempre assinado). Muda o recorte AGORA, então
    // reemite `onPresenceSync` — sem isto, quem já assinou só veria o efeito na PRÓXIMA
    // mudança de presença do hub, não nesta chamada (o `supabaseTransport` reemite igual).
    watchSeat(seatUid: string): void {
      watched.add(seatUid)
      for (const cb of presenceSyncCbs) cb(hub.presentUids())
    },
    unwatchSeat(seatUid: string): void {
      if (seatUid === uid) return
      watched.delete(seatUid)
      for (const cb of presenceSyncCbs) cb(hub.presentUids())
    },

    requestJoin(who): Promise<void> {
      hub.requestJoin(who, uid)
      return Promise.resolve()
    },

    onJoinRequest(cb): Unsubscribe {
      return hub.addJoinRequest(cb)
    },

    reattach(_roomId: string, code: string) {
      return Promise.resolve(hub.reattachByCodeRpc(code, uid))
    },

    onReattachNotice(cb): Unsubscribe {
      return hub.addReattachNotice(cb)
    },

    rejectJoin(target, reason): void {
      hub.rejectJoin(target, reason, uid)
    },

    rejectCommand(toUid, info): void {
      hub.rejectCommand(toUid, info)
    },

    onCommandRejected(cb): Unsubscribe {
      if (!conn) return () => {}
      conn.onCommandRejected.push(cb)
      return detach(conn.onCommandRejected, cb)
    },

    onJoinRejected(cb): Unsubscribe {
      if (!conn) return () => {}
      conn.onJoinRejected.push(cb)
      return detach(conn.onJoinRejected, cb)
    },

    publishRoom(room: PublicRoom): void {
      hub.publishRoom(room, uid)
    },

    saveRoom(room: Room): Promise<void> {
      return hub.saveRoom(room)
    },

    // Paridade com `room_preview` (043, T022/T025): redige o código de todo mundo, EXCETO o
    // do próprio uid — é daqui que `Client.myReentryCode()` lê o dono, e só o dono (D5).
    // A AUTORIDADE recebe todos (T043/D-043): no lobby não há snapshot, então esta é a única
    // leitura de onde ela remonta a sala que vai gravar em seguida.
    async loadRoom(): Promise<Room | null> {
      const r = await hub.loadRoom()
      if (!r) return null
      const normalized = normalizeRoom(r)
      if (normalized.seats.find((s) => s.uid === uid)?.isHost) return normalized
      return {
        ...normalized,
        seats: normalized.seats.map((s) => (s.uid === uid
          ? s
          : { ...s, reentryCode: '', openingBid: normalized.status === 'bidding' ? null : s.openingBid })),
      }
    },

    onRoom(cb): Unsubscribe {
      if (!conn) return () => {}
      conn.onRoom.push(cb)
      const current = hub.currentRoom()
      if (current) cb(current) // conveniência local; a PORTA não garante replay (ver transport.ts)
      return detach(conn.onRoom, cb)
    },

    onPresence(cb): Unsubscribe {
      return hub.addPresence((change) => { if (watched.has(change.uid)) cb(change) })
    },

    onStatus(cb): Unsubscribe {
      // NÃO faz replay (contrato §1.4) — só o valor corrente a partir de agora. Assinável
      // ANTES de `connect()` — os arrays vivem no facade, não em `conn`.
      statusCbs.push(cb)
      return detach(statusCbs, cb)
    },

    // Recorte pelo `watched` (043) — o conjunto "completo" é completo PARA QUEM OBSERVA
    // (a autoridade, via `watchSeat`); quem não observa mais ninguém só se vê a si mesmo,
    // como um canal `s:<uid>` sozinho.
    onPresenceSync(cb): Unsubscribe {
      const wrapped = (uids: ReadonlySet<string>): void => cb(new Set([...uids].filter((u) => watched.has(u))))
      presenceSyncCbs.push(wrapped)
      wrapped(hub.presentUids()) // conveniência local: estado inicial logo após assinar (contrato §2.2)
      return detach(presenceSyncCbs, wrapped)
    },

    saveSnapshot(snap: PersistedSnapshot): Promise<void> {
      return hub.saveSnapshot(snap)
    },

    // 043, D6/T037: espelha `read_snapshot` — seleção de chave por uid. A autoridade (uid do
    // assento `isHost` NA SALA DO PRÓPRIO SNAPSHOT — não a `currentHostUid()` do hub, que
    // reflete a sala mais recente e pode já ter avançado) recebe `secrets` inteiro; qualquer
    // outro recebe só a própria entrada de `hands`, nunca o deck.
    // Paridade com `read_snapshot` (043, T036/T043): `secrets` E `seats` pela MESMA seleção de
    // chave. A autoridade recebe tudo — é ela quem regrava a linha, e quem reassume num
    // aparelho novo monta a sala daqui; qualquer outro recebe só a própria mão e só o PRÓPRIO
    // `reentryCode`, porque o código é credencial portadora (`reattach_by_code` o converte em
    // posse do assento).
    async loadSnapshot(): Promise<PersistedSnapshot | null> {
      const snap = await hub.loadSnapshot()
      if (!snap) return null
      const isHost = snap.room.seats.find((s) => s.uid === uid)?.isHost ?? false
      const mySecrets: Secrets = isHost
        ? snap.secrets
        : { hands: uid in snap.secrets.hands ? { [uid]: snap.secrets.hands[uid] } : {}, decks: {} }
      const room: Room = isHost
        ? snap.room
        : {
            ...snap.room,
            seats: snap.room.seats.map((s) => (s.uid === uid
              ? s
              : { ...s, reentryCode: '', openingBid: snap.room.status === 'bidding' ? null : s.openingBid })),
          }
      return { ...snap, room, game: mergeSnapshot(snap.game, mySecrets, snap.room) }
    },

    // O adapter CRU não repete sozinho, então nunca esgota — quem sobrescreve isto é o
    // decorator `durableWrites` (041, D8), único ponto de montagem de produção.
    onWriteExhausted: () => () => {},
    onWriteRecovered: () => () => {},
  }
}
