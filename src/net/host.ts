// Host = única autoridade (spec 037, D-020). Roda no browser do host, ao lado do `client`
// dele (que é a visão de UI). Recebe comandos de todos via `onSubmit`, valida identidade
// (FR-007) pelos gates JÁ existentes do motor (FR-008), aplica o reducer puro, resolve o
// não-determinismo (FR-011), atribui a sequência (FR-010), persiste o snapshot (FR-013) e
// difunde o comando aceito. Pausa por (des)conexão (FR-016..020). Não cria regra nova.
import type { RNG } from '@/game/turn/dice'
import type { GameState } from '@/game/turn/types'
import type { TurnCtx } from '@/game/turn/turnMachine'
import { actorOf, applyCommand, type GameAction, type PlayerAction } from '@/game/commands'
import { applyOpeningAuction } from '@/game/openingAuction'
import { buildGameCtx, buildInitialGame } from '@/game/setup'
import { matchSummary } from '@/game/summary'
import { recordFinishedMatch } from './roomHistory'
import { nullTelemetry, type Telemetry, type TelemetryEvent } from '@/telemetry/port'
import { matchKey } from '@/telemetry/matchKey'
import { recordingCtx } from './recorder'
import type { BoardId } from '@/lib/mapCatalog'
import { redactAccepted, splitSnapshot } from './perspective'
import {
  anyDisconnected,
  allOpeningBidsLocked,
  finalizeOpeningAuction,
  joinRoom,
  kickSeat,
  lockOpeningBid,
  newReentryCode,
  newHistoryId,
  markConnected,
  markDisconnected,
  normalizeRoom,
  prepareRematch,
  closeOpeningRolls,
  openOpeningAuction,
  OPENING_AUCTION_MS,
  OPENING_ROLL_MS,
  OPENING_ROLL_REVEAL_MS,
  openOpeningRolls,
  playerIdsInOrder,
  requestOpeningRoll,
  resolveOpeningRoll,
  seatByUid,
  selectBoardId,
  selectOpeningMode,
  toPublicRoom,
  type OpeningMode,
  type Room,
} from './room'
import type { AcceptedCommand, CommandEnvelope, JoinRequest, PresenceChange, Transport, Unsubscribe } from './transport'
import { registerFailure } from '@/app/failureRegistry'
import { deadlinePlan } from '@/game/deadlines'

// Ações de sistema nunca carregam carta — `actorOf` (D9/T034) só existe para `PlayerAction`.
const SYSTEM_KINDS = new Set<GameAction['kind']>(['close-auction', 'close-land-lots', 'close-land-auction', 'pause', 'resume'])
function isPlayerAction(action: GameAction): action is PlayerAction {
  return !SYSTEM_KINDS.has(action.kind)
}

export interface HostOptions {
  rng?: RNG // padrão Math.random; injetável nos testes (seed)
  now?: () => number // padrão Date.now; relógio lógico nos testes
  telemetry?: Telemetry // padrão `nullTelemetry` (044, D-040) — emissão é do host, nunca da tela
  openingAuctionMs?: number // padrão 15s; `0` é o seam determinístico de testes legados
  openingRollMs?: number // D-051: janela pública de um arremesso; padrão 1,4s
  openingRollRevealMs?: number // revelação do último arremesso antes do embarque; padrão 2,6s; `0` = seam determinístico
}

export interface Host {
  open(): Promise<void> // abre o LOBBY: escuta pedidos de assento/presença e publica a sala (FR-001/002)
  start(): Promise<void> // cria o estado inicial, persiste como 1º snapshot e publica a sala em 'playing'
  startMatch(): Promise<{ ok: true } | { ok: false; reason: 'too-few' | 'already-started' | 'not-host' }> // lobby → partida (FR-006)
  reopenRoom(): Promise<{ ok: true } | { ok: false; reason: 'not-ended' | 'persistence' }> // 049: fim → mesmo lobby
  setOpeningMode(mode: OpeningMode): { ok: true } | { ok: false; reason: 'not-in-lobby' }
  setBoardId(boardId: BoardId): { ok: true } | { ok: false; reason: 'not-in-lobby' } // D-077: mapa trocável no lobby
  kick(uid: string): { ok: true } | { ok: false; reason: 'not-in-lobby' | 'is-host' | 'unknown-uid' } // remoção no lobby (FR-024)
  stop(): void
  tick(): void // fecha leilões/lotes vencidos pelo prazo (emite comandos de sistema) — browser agenda; testes chamam
  room(): Room
  game(): GameState // inspeção (testes)
  seq(): number
  subscribe(cb: () => void): Unsubscribe // muda a sala (join/presença/início) → notifica a UI do lobby
}

export function createHost(transport: Transport, initialRoom: Room, opts: HostOptions = {}): Host {
  const rng: RNG = opts.rng ?? (() => Math.random())
  const now = opts.now ?? (() => Date.now())
  const telemetry = opts.telemetry ?? nullTelemetry
  const openingAuctionMs = opts.openingAuctionMs ?? OPENING_AUCTION_MS
  const openingRollMs = opts.openingRollMs ?? OPENING_ROLL_MS
  const openingRollRevealMs = opts.openingRollRevealMs ?? OPENING_ROLL_REVEAL_MS

  let room = normalizeRoom(initialRoom)
  let game: GameState | null = null
  let seq = room.revision ?? -1 // global pela vida da sala; a revanche NÃO reinicia em zero
  let opened = false
  let closingOpeningAuction = false
  const subs: Unsubscribe[] = []
  const listeners = new Set<() => void>()
  let watchedUids = new Set<string>() // 043, T015 — assentos cujo tópico privado a autoridade assina
  const baseCtx: TurnCtx = buildGameCtx(rng, now)

  // Hash do id de sala (044, contrato §matchKey) — calculado UMA vez e reusado nos três
  // eventos do host. `roomId` nunca muda depois de criado, e T7 do contrato pede um evento
  // por fato, não um hash novo a cada emissão.
  let cachedMatchKey: string | null = null
  async function ensureMatchKey(): Promise<void> {
    const generation = room.matchGeneration ?? 0
    cachedMatchKey ??= await matchKey(generation === 0 ? room.id : `${room.id}:${generation}`)
  }

  // T1/T2 do contrato: a partida NUNCA sente uma falha de telemetria. O adaptador de
  // produção já engole os próprios erros (`supabaseSink.ts`); isto aqui é a segunda linha
  // de defesa, para um adaptador mal-comportado (ou injetado em teste) não derrubar `accept`.
  function trackSafely(event: TelemetryEvent): void {
    try {
      telemetry.track(event)
    } catch {
      // FR-037: falha de envio não pausa, não bloqueia comando, não repete.
    }
  }

  function notify(): void {
    for (const cb of listeners) cb()
  }

  // Assina o tópico de cada assento NOVO e dessassina o de quem saiu (043, D2/D3) — reanexar
  // troca o `uid` do assento, então o antigo perde o tópico e o novo ganha; kick dessassina;
  // um assento que só mudou de `connected`/posição não move nada aqui.
  function syncWatchedSeats(): void {
    const current = new Set(room.seats.map((s) => s.uid))
    for (const uid of current) if (!watchedUids.has(uid)) transport.watchSeat(uid)
    for (const uid of watchedUids) if (!current.has(uid)) transport.unwatchSeat(uid)
    watchedUids = current
  }

  // Grava o snapshot em duas partes (043, D6/T034): `splitSnapshot` separa o `game` real (só
  // existe aqui, na autoridade) em público (redigido) + segredo (`rooms.secrets`) — o adapter
  // é quem remonta a visão de cada leitor depois (`loadSnapshot`, T037).
  function persistSnapshot(): void {
    if (!game) return
    const { publicGame, secrets } = splitSnapshot(game, room)
    void transport.saveSnapshot({ seq, game: publicGame, secrets, room })
  }

  // Publica a sala para todos e a persiste. Com partida em curso, a sala vive DENTRO do
  // snapshot (uma linha só); no lobby, `saveRoom` escreve apenas as colunas de sala.
  function publishAndPersistRoom(): void {
    transport.publishRoom(toPublicRoom(room))
    if (game) persistSnapshot()
    else void transport.saveRoom(room)
    notify()
  }

  // Aplica um comando (de jogador OU de sistema) pelo caminho de autoridade: grava o
  // não-determinismo, checa no-op (FR-009), incrementa seq, persiste e difunde. Retorna se
  // foi aceito. `fromUid` (042, FR-020/022) só existe pra comando DE JOGADOR — comando de
  // sistema (tick, pausa) não tem um remetente único a quem recusar, só registra a falha.
  function accept(action: GameAction, fromUid?: string): boolean {
    if (!game) return false
    const wasEnded = game.phase === 'ended' // 044/T045: T7 do contrato — só emite na TRANSIÇÃO
    const { ctx, drain } = recordingCtx(baseCtx)
    // ANTES da mutação (043, T034) — quem recebe a cópia privada, se houver uma a recortar.
    const ownerId = isPlayerAction(action) ? actorOf(game, action) : null
    let next: GameState
    try {
      next = applyCommand(game, action, ctx)
    } catch (error) {
      // 042, D5 do plan: `game`/`seq` só são reatribuídos DEPOIS daqui — uma exceção nunca
      // avança o estado pela metade (FR-021 por construção, não por asserção extra).
      const occurrenceId = registerFailure({ where: 'host.accept', phase: room.status, seq, error })
      if (fromUid) transport.rejectCommand(fromUid, { occurrenceId })
      return false
    }
    if (next === game) return false // no-op / inválido → descarta (FR-009)
    game = next
    seq += 1
    room = {
      ...room,
      revision: seq,
      status: !wasEnded && game.phase === 'ended' ? 'ended' : room.status,
    }
    if (!wasEnded && game.phase === 'ended') {
      // D-067: o resumo entra ANTES do snapshot final. Assim a mesma escrita durável que
      // encerra a partida carrega o histórico; render/reload nunca são gatilhos do fato.
      room = recordFinishedMatch(room, game)
    }
    const cmd: AcceptedCommand = { seq, action, resolved: drain() }
    persistSnapshot() // FR-013 (upsert)
    // 043, D9/D10: a cópia PRIVADA (íntegra) vai ANTES da pública (redigida) — o dono aplica a
    // sua primeiro e avança `seq`; a pública que chega depois vira no-op pelo guard de `seq`
    // que `client.ts` já tem. Sem isto, a ordem inverte e o dono fica preso na versão redigida
    // até a próxima ressincronização.
    const pub = redactAccepted(cmd)
    if (pub !== cmd) {
      // O DONO da carta vê a própria — e o HOST vê tudo (SRS §10.3, exceção conhecida:
      // o navegador dele roda a autoridade e por isso já conhece baralho e mãos por inteiro —
      // isto só torna a visão do PRÓPRIO client dele consistente com o que `loadSnapshot` já
      // lhe dá num resync, em vez de ficar redigida até o próximo). Ambas ANTES da pública —
      // mesma ordem/motivo do comentário acima.
      const ownerSeat = ownerId ? room.seats.find((s) => s.playerId === ownerId) : undefined
      if (ownerSeat) transport.broadcastPrivate(ownerSeat.uid, cmd)
      const hostSeat = room.seats.find((s) => s.isHost)
      if (hostSeat && hostSeat.uid !== ownerSeat?.uid) transport.broadcastPrivate(hostSeat.uid, cmd)
    }
    transport.broadcast(pub) // FR-010/011

    // 044/T045 (FR-033/034, T7 do contrato): emitido AQUI, na autoridade — nunca na tela.
    // Oito clientes renderizando o fim de jogo emitiriam oito `match_ended`; só o `accept`
    // que de fato mudou o estado dispara, uma vez por fato.
    const key = cachedMatchKey ?? '' // sempre preenchido a esta altura (ensureMatchKey já rodou em start/open)
    if (action.kind === 'pause') {
      trackSafely({ kind: 'match_paused', matchKey: key, cause: action.cause })
    }
    if (!wasEnded && game.phase === 'ended') {
      const summary = matchSummary(game)
      trackSafely({ kind: 'match_ended', matchKey: key, players: game.players.length, rounds: summary.rounds, durationMs: summary.durationMs })
      transport.publishRoom(toPublicRoom(room))
      notify()
    }
    return true
  }

  function handleSubmit(env: CommandEnvelope, fromUid: string): void {
    if (!game) return
    const seat = seatByUid(room, fromUid)
    if (!seat) return // sessão sem assento na sala → descarta (US4-2)
    if (env.senderId !== seat.playerId) return // identidade declarada ≠ assento → anti-spoof (FR-007, US4-1)
    if (game.paused) return // durante a pausa, comando de jogo é rejeitado (FR-017, US3-2)
    const actor = actorOf(game, env.action)
    if (actor === null || actor !== seat.playerId) return // remetente não é o ator do comando (FR-007)
    accept(env.action, fromUid)
  }

  async function closeOpeningAuction(): Promise<void> {
    if (closingOpeningAuction || room.status !== 'bidding') return
    closingOpeningAuction = true
    try {
      const finalized = finalizeOpeningAuction(room, rng)
      if (!finalized.ok) return
      room = finalized.room
      await startInternal()
      syncPause() // alguém que caiu durante os lances não deixa o 1º turno correr sem ele
    } finally {
      closingOpeningAuction = false
    }
  }

  function handleOpeningBid({ amount }: { amount: number }, fromUid: string): void {
    if (room.status !== 'bidding') return
    if ((room.openingAuction?.closesAt ?? 0) <= now()) {
      void closeOpeningAuction()
      return
    }
    const result = lockOpeningBid(room, fromUid, amount)
    if (!result.ok) return
    room = result.room
    publishAndPersistRoom()
    if (allOpeningBidsLocked(room)) void closeOpeningAuction()
  }

  function handleOpeningRoll(fromUid: string): void {
    const requested = requestOpeningRoll(room, fromUid, now(), openingRollMs)
    if (!requested.ok) return
    room = requested.room
    publishAndPersistRoom()
  }

  // Pedido de assento no lobby (FR-002/005). A identidade do assento é o uid da CONEXÃO —
  // o pedinte só escolhe nome, cor, avatar e skin. Recusa (cheia/cor tomada/já iniciada) volta ao pedinte.
  //
  // 043, D4/T020: a reanexação SAIU daqui — vira `reattach_by_code` no servidor (RPC), porque
  // o host não tem como assinar o tópico de um assento que ainda não existe. Este handler só
  // trata assento NOVO; `onSeatReattached`/`onReattachNotice` (abaixo) é quem aprende que
  // alguém reanexou.
  function handleJoinRequest(who: JoinRequest, fromUid: string): void {
    const taken = new Set(room.seats.map((s) => s.reentryCode))
    const takenHistoryIds = new Set(room.seats.map((s) => s.historyId).filter((id): id is string => Boolean(id)))
    const result = joinRoom(room, {
      uid: fromUid, name: who.name, color: who.color, avatar: who.avatar, skin: who.skin,
      reentryCode: newReentryCode(rng, taken), // room.ts não tem RNG (D12) — o host minta
      historyId: newHistoryId(rng, takenHistoryIds),
    })
    if (!result.ok) {
      transport.rejectJoin(fromUid, result.reason)
      return
    }
    room = result.room
    syncWatchedSeats()
    publishAndPersistRoom()
  }

  // 043, D4/T020: alguém reanexou por CÓDIGO — a RPC já regravou a linha no servidor, fora do
  // controle desta autoridade em memória. Recarrega a sala persistida, reconcilia os tópicos
  // observados e republica; `syncPause` retoma a partida se esta era a última ausência
  // (FR-028 da 041) — o MESMO efeito que o ramo de reanexação tinha aqui antes de sair.
  async function handleSeatReattached(): Promise<void> {
    const fresh = await transport.loadRoom()
    if (!fresh) return
    room = withKnownCodes(fresh, room)
    syncWatchedSeats()
    publishAndPersistRoom()
    syncPause()
  }

  // 043, T043 (D-043): recarregar não pode ser DESAPRENDER. A autoridade grava a sala que
  // acabou de montar, então todo assento que chegar sem `reentryCode` — porque veio de uma
  // difusão (que nunca os carrega, T023) ou de uma leitura feita antes de esta sessão ser a
  // autoridade — precisa recuperá-lo de `source` antes de a sala virar o que se persiste.
  // Casa por `playerId`: é o que a reanexação preserva (ela troca `uid`, FR-027), e o código
  // é imutável depois de mintado. Assento sem código nos dois lados fica vazio e recebe o seu
  // no próximo mint. A rede tem a mesma guarda (`preserve_seat_codes`) — esta aqui é o que
  // mantém a sala EM MEMÓRIA fiel, e é dela que sai o `taken` de `newReentryCode`.
  function withKnownCodes(target: Room, source: Room): Room {
    const known = new Map(source.seats.filter((s) => s.reentryCode).map((s) => [s.playerId, s.reentryCode]))
    return {
      ...target,
      seats: target.seats.map((s) => (s.reentryCode ? s : { ...s, reentryCode: known.get(s.playerId) ?? '' })),
    }
  }

  function handlePresence(change: PresenceChange): void {
    if (change.takeover) return // mesma sessão reabrindo → não é desconexão (FR-006a); segue conectado
    // No lobby, entrar/sair do canal só atualiza o estado de conexão (nada pausa).
    if (!seatByUid(room, change.uid)) {
      if (change.connected) publishAndPersistRoom() // recém-chegado ainda sem assento: precisa ver a sala
      return
    }
    room = change.connected ? markConnected(room, change.uid) : markDisconnected(room, change.uid)
    publishAndPersistRoom()
    syncPause()
  }

  // Ids de quem já saiu da partida — não contam para pausa nem para retomada (D-029).
  function eliminatedIds(): ReadonlySet<string> {
    if (!game) return new Set()
    return new Set(game.players.filter((p) => p.eliminated).map((p) => p.id))
  }

  // Reconciliação de presença (041, FR-021/022): sobrescreve `seats[].connected` pelo
  // conjunto REALMENTE observado no canal — nunca confia no `connected` do snapshot, que é
  // um retrato de antes da queda/reload. Chamar ANTES de `syncPause` é o que evita emitir
  // `pause` seguido de `resume` a cada reassunção (a pausa só é decidida depois de a mesa
  // já refletir quem está de verdade presente).
  function reconcilePresence(uids: ReadonlySet<string>): void {
    for (const seat of room.seats) {
      const connected = uids.has(seat.uid)
      if (seat.connected === connected) continue
      room = connected ? markConnected(room, seat.uid) : markDisconnected(room, seat.uid)
    }
  }

  // Pausa global se algum assento que AINDA JOGA está desconectado; retoma quando todos eles
  // voltam (FR-016/018). Host desconectado entra no mesmo caminho: pausa indefinida, sem
  // transferência (FR-019) — a autoridade É o host, então enquanto ele está fora ninguém
  // aplica nada de qualquer forma. Eliminado que cai NÃO trava a mesa (D-029/FR-018a).
  function syncPause(): void {
    if (!game) return
    const shouldPause = anyDisconnected(room, eliminatedIds())
    const hasDisconnectCause = Boolean(game.paused?.causes.includes('disconnect'))
    if (shouldPause && !hasDisconnectCause) {
      accept({ kind: 'pause', cause: 'disconnect', at: now() })
    } else if (!shouldPause && hasDisconnectCause) {
      accept({ kind: 'resume', cause: 'disconnect', at: now() }) // desloca deadlines em voo (FR-017)
    }
  }

  // Registra os laços de escuta uma única vez — `open()` (lobby) e `start()` (partida direta,
  // usada pelos testes headless) entram pelo mesmo caminho.
  async function ensureOpen(): Promise<void> {
    if (opened) return
    opened = true
    // 043, T043/T045 — achado ao rodar contra infra viva: `room_lobby_insert`/`room_play_select`
    // decidem pela linha JÁ existente em `rooms` (via `room_host_uid()`/`has_seat()`), e o
    // Realtime avalia a permissão de um canal NO JOIN, não por mensagem. Gravar primeiro é o
    // que dá à política algo para autorizar.
    //
    // Isto sozinho NÃO fecha a corrida, e é importante não acreditar que fecha: `saveRoom` é
    // embrulhado por `durableWrites`, cuja promessa resolve no ENFILEIRAMENTO, não na gravação
    // (041, D8/contrato §4) — o `await` aqui volta antes de a linha existir. Quem fecha é o
    // adapter, que reconstrói o canal de lobby e reemite a última sala assim que a escrita de
    // fato acontece (`supabaseTransport.ts`). A ordem daqui é a metade barata da solução.
    await transport.saveRoom(room)
    // 043, T015: assina o tópico de cada assento já existente ANTES de `onPresenceSync` — o
    // "estado inicial" que essa assinatura entrega na hora precisa já refletir todo mundo,
    // senão a 1ª reconciliação vê só o próprio uid, marca os demais desconectados, e a
    // correção que `watchSeat` reemite dispara um `pause`+`resume` espúrio.
    syncWatchedSeats()
    subs.push(transport.onSubmit(handleSubmit))
    subs.push(transport.onOpeningBid(handleOpeningBid))
    subs.push(transport.onOpeningRoll(handleOpeningRoll))
    subs.push(transport.onPresence(handlePresence))
    subs.push(transport.onJoinRequest(handleJoinRequest))
    subs.push(transport.onReattachNotice(() => void handleSeatReattached()))
    // FR-021/022: reconcilia presença ANTES de decidir pausa — nunca o contrário.
    subs.push(transport.onPresenceSync((uids) => {
      reconcilePresence(uids)
      publishAndPersistRoom()
      syncPause()
    }))
    // D8/D10: o adapter cru nunca emite isto — é o decorator `durableWrites` quem sobrescreve
    // `onWriteExhausted`/`onWriteRecovered` (único ponto de montagem em `supabaseClient.ts`).
    // A circularidade é o desenho, não um bug: a PRÓPRIA gravação desta pausa também falha
    // enquanto a persistência estiver fora — o comando vive na memória do host e nas telas de
    // todos por difusão, e a fila drena o estado (que já contém a pausa) quando o banco volta.
    subs.push(transport.onWriteExhausted(() => accept({ kind: 'pause', cause: 'persistence', at: now() })))
    subs.push(transport.onWriteRecovered(() => accept({ kind: 'resume', cause: 'persistence', at: now() })))
  }

  async function startInternal(): Promise<void> {
    await ensureOpen()
    await ensureMatchKey()
    const initialGame = buildInitialGame(playerIdsInOrder(room), rng, now())
    game = room.openingMode === 'sealed-bid'
      ? applyOpeningAuction(initialGame, room)
      : initialGame
    seq += 1
    room = { ...room, revision: seq }
    const { publicGame, secrets } = splitSnapshot(game, room)
    await transport.saveSnapshot({ seq, game: publicGame, secrets, room }) // 1º snapshot (FR-006/013): clientes leem ao entrar
    transport.publishRoom(toPublicRoom(room)) // status já 'playing' (definido por startGame antes de criar o host)
    trackSafely({ kind: 'match_started', matchKey: cachedMatchKey ?? '', players: game.players.length })
    notify()
  }

  return {
    // Abre a sala. Se JÁ existe partida persistida nesta sala (host voltando de um F5), a
    // autoridade é reassumida a partir do snapshot — o estado não se perde (FR-015).
    async open(): Promise<void> {
      const snap = await transport.loadSnapshot()
      if (snap && snap.seq >= 0) {
        game = snap.room.status === 'lobby' ? null : snap.game
        seq = snap.seq
        room = normalizeRoom({ ...snap.room, revision: snap.seq })
        // Sala encerrada antes da 053 (ou cuja escrita 0007 ainda não estava disponível):
        // materializa o resumo a partir do snapshot final, ainda uma vez e só pela autoridade.
        if (game?.phase === 'ended') room = recordFinishedMatch(room, game)
      } else {
        // Sem partida ainda (lobby): a sala com que esta autoridade foi construída pode vir de
        // `Client.room()`, que NUNCA carrega código (T023) — é o caso do host que dá F5
        // antes de iniciar. A prévia é íntegra para a autoridade (T043/D-043), e é dela que os
        // códigos voltam; sem isto o `taken` de `newReentryCode` mintaria contra um conjunto de
        // vazios, e a sala em memória divergiria da linha persistida.
        const stored = await transport.loadRoom()
        if (stored) {
          // Durante qualquer ritual pré-snapshot, a linha persistida é a fonte íntegra:
          // em `bidding` guarda lances; em `rolling`, resultados e a janela do arremesso.
          room = stored.status === 'bidding' || stored.status === 'rolling'
            ? withKnownCodes(stored, room)
            : withKnownCodes(room, stored)
          seq = Math.max(seq, room.revision ?? -1)
        }
      }
      await ensureOpen()
      // Host reassumindo (F5/reload, FR-015): `match_started` já foi emitido na sessão
      // anterior — só precisamos do hash em cache para `accept()` poder emitir
      // `match_paused`/`match_ended` depois, se for o caso.
      if (game) await ensureMatchKey()
      transport.publishRoom(toPublicRoom(room))
      notify()
    },

    start: startInternal,

    async reopenRoom() {
      if (!game && room.status === 'lobby') return { ok: true as const }
      if (!game || game.phase !== 'ended') return { ok: false as const, reason: 'not-ended' as const }
      const next = prepareRematch({ ...room, revision: seq })
      try {
        await transport.reopenRoom(next)
      } catch {
        return { ok: false as const, reason: 'persistence' as const }
      }
      room = next
      game = null
      cachedMatchKey = null
      transport.publishRoom(toPublicRoom(room))
      notify()
      return { ok: true as const }
    },

    // O host inicia o modo já persistido no lobby. Leilão coleta em paralelo; Maior dado
    // abre a sequência pública da D-051. Nos dois casos, a ordem vive no primeiro snapshot.
    async startMatch() {
      if (room.openingMode === 'dice-roll') {
        const openedRolls = openOpeningRolls(room)
        if (!openedRolls.ok) {
          return { ok: false as const, reason: openedRolls.reason === 'wrong-mode' ? 'already-started' as const : openedRolls.reason }
        }
        room = openedRolls.room
        await ensureOpen()
        publishAndPersistRoom()
        return { ok: true as const }
      }
      const openedAuction = openOpeningAuction(room, now() + openingAuctionMs)
      if (!openedAuction.ok) {
        return { ok: false as const, reason: openedAuction.reason === 'wrong-mode' ? 'already-started' as const : openedAuction.reason }
      }
      room = openedAuction.room
      await ensureOpen()
      publishAndPersistRoom()
      if (openingAuctionMs <= 0) await closeOpeningAuction()
      return { ok: true as const }
    },

    setOpeningMode(mode: OpeningMode) {
      const selected = selectOpeningMode(room, mode)
      if (!selected.ok) return selected
      room = selected.room
      publishAndPersistRoom()
      return { ok: true as const }
    },

    // Mapa da sala (D-077). Mesmo caminho do Ritual de Largada: a autoridade decide, publica
    // e persiste — cada cliente aplica o mapa que RECEBE (`roomStore.setRoom`), nunca o que
    // escolheu na home. No lobby não há partida, então `publishAndPersistRoom` cai no
    // `saveRoom`, que é onde a coluna `board_id` é gravável (migration 0010).
    setBoardId(boardId: BoardId) {
      const selected = selectBoardId(room, boardId)
      if (!selected.ok) return selected
      room = selected.room
      publishAndPersistRoom()
      return { ok: true as const }
    },

    // Remoção de jogador pelo host, só no lobby (§11.1 / FR-024). O removido é avisado pelo
    // mesmo canal de recusa de entrada (research D6) e a sala republicada sem o assento.
    kick(uid: string) {
      const result = kickSeat(room, uid)
      if (!result.ok) return result
      room = result.room
      syncWatchedSeats()
      transport.rejectJoin(uid, 'kicked')
      publishAndPersistRoom()
      return { ok: true as const }
    },

    stop(): void {
      for (const u of subs) u()
      subs.length = 0
      opened = false
      listeners.clear()
    },

    tick(): void {
      const t = now()
      if (room.status === 'bidding' && t >= (room.openingAuction?.closesAt ?? Number.POSITIVE_INFINITY)) {
        void closeOpeningAuction()
        return
      }
      if (room.status === 'rolling') {
        // Resolver e fechar são passos separados: o último resultado sai num snapshot ainda
        // 'rolling' (toda tela vê o dado decisivo cair) e o embarque espera a janela de
        // revelação vencer. Com `openingRollRevealMs: 0` (seam de teste) os dois acontecem
        // no mesmo tick.
        const resolved = resolveOpeningRoll(room, rng, t, openingRollRevealMs)
        if (resolved.ok) room = resolved.room
        const closed = closeOpeningRolls(room, rng, t)
        if (closed.ok) {
          room = closed.room
          void startInternal().then(syncPause)
        } else if (resolved.ok) {
          publishAndPersistRoom()
        }
        return
      }
      if (!game) return
      for (const action of deadlinePlan(game, t).due) accept(action)
    },

    room: () => room,
    game: () => game!,
    seq: () => seq,

    subscribe(cb): Unsubscribe {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
  }
}
