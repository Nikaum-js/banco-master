// Estado da sala e identidade (spec 037/043, FR-001..006a, 019).
//
// A sala é o estado LADO-SERVIDOR que amarra assentos↔identidade de sessão. Ela vive fora do
// `GameState` (que nunca ganha PII nem uid — D-019): o `GameState` só conhece `playerId`s
// serializáveis ('p1'..'p8'). Todos os reducers aqui são PUROS (não mutam o argumento).
//
import { normalizeAvatar, type AvatarId } from '@/boards/playerAvatarCatalog'
import { normalizeSkin, type SkinId } from '@/boards/playerSkinCatalog'

// Identidade visual: a COR é única por sala (§12.5); NOME, AVATAR e SKIN podem repetir. A
// composição pública acompanha o assento (D-047) e nunca vira regra competitiva. Ordem de turno = ordem
// de entrada (host = 1º assento); a rolagem de ordem inicial pertence ao 038+ (FR-006).

// Paleta de assentos — espelha `PLAYER_COLORS` de `game/ui/panels/playersView.ts` (mantida
// aqui para não acoplar a casca de rede à UI). 8 cores → no máximo 8 assentos (§11.1).
//
// A PEÇA (avião, navio, trem…) foi removida em D-044. A D-047 trouxe de volta apenas a forma
// visual do próprio `PlayerFace`, sem unicidade: a COR continua sendo o distintivo obrigatório
// entre jogadores. Por isso a paleta deixou de ser escolhida a olho (D-045): as oito nascem
// em OKLCH com croma coeso (~0,13) e claridade escalonada
// (0,62–0,82), e a ORDEM é por ponto-mais-distante — as mesas pequenas ficam com os pares
// mais separados que a paleta permite (2 jogadores: ΔE 0,26; 4: 0,11; 8: 0,07, medidos no
// PIOR caso entre visão típica, deuteranopia e protanopia).
export const SEAT_COLORS = ['#d9a650', '#3b8bd0', '#36dde7', '#00bca5', '#e77376', '#7b9d41', '#b665a2', '#b0a5ff'] as const

export const MIN_SEATS = 2
export const MAX_SEATS = 8
export const OPENING_BID_MIN = 0
export const OPENING_BID_MAX = 500
export const OPENING_BID_STEP = 50
export const OPENING_AUCTION_MS = 15_000

export type RoomStatus = 'lobby' | 'bidding' | 'playing' | 'paused' | 'ended'
export type OpeningMode = 'sealed-bid' | 'dice-roll'

export interface OpeningAuction {
  closesAt: number
}

export interface Seat {
  playerId: string // id serializável usado pelo GameState ('p1'..'p8')
  uid: string // ERA `token` (043, D-042) — identidade atestada pelo servidor, chave de reconexão
  name: string // nome exibido (livre)
  color: string // cor (única por sala)
  /** D-047: forma visual pública; opcional apenas para absorver salas anteriores à 046. */
  avatar?: AvatarId
  /** D-047: camada visual pública; opcional apenas para absorver salas anteriores à 046. */
  skin?: SkinId
  isHost: boolean
  connected: boolean
  /** D-046: privado enquanto `Room.status === 'bidding'`; público na revelação. Opcional
   * apenas para absorver salas persistidas antes da spec 045. */
  openingBid?: number | null
  /** Estado público do compromisso. $0 também é lance lacrado, por isso não se deriva por
   * truthiness de `openingBid`. Opcional para compatibilidade com salas legadas. */
  bidLocked?: boolean
  /** D-046: dois dados brancos atestados pela autoridade no modo Maior dado. */
  openingRoll?: [number, number] | null
  /** Código de reentrada (041, D-033) — estável pela vida do assento; sobrevive à perda do
   * uid (celular sem bateria, dados do navegador limpos). `kickSeat`/`shuffleSeatOrder`
   * preservam por construção (nunca reescrevem o campo). */
  reentryCode: string
}

export interface Room {
  id: string
  status: RoomStatus
  seats: Seat[] // ordem de entrada; host = seats[0]
  /** Escolha pública do host; opcional apenas para absorver salas anteriores à 045. */
  openingMode?: OpeningMode
  /** Prazo da rodada pré-partida. Opcional só para shapes legados. */
  openingAuction?: OpeningAuction | null
}

// Sala PUBLICADA (043, D-036/data-model §3) — o que trafega em `publishRoom`/`onRoom`. Sem
// `reentryCode` de NINGUÉM, nem do dono: código é credencial PORTADORA (§2 de policies.md),
// e a difusão alcança todo mundo igual — não há "exceto quem chamou" numa transmissão. O
// `uid` permanece: não é credencial, conhecê-lo não permite usá-lo (D-042).
export type PublicSeat = Omit<Seat, 'reentryCode' | 'openingBid' | 'bidLocked'> & {
  /** O fio novo sempre envia os dois campos; opcionais aqui para aceitar fixtures/salas
   * produzidas antes da 045 sem espalhar casts. */
  openingBid?: number | null
  bidLocked?: boolean
}
export interface PublicRoom {
  id: string
  status: RoomStatus
  seats: PublicSeat[]
  openingMode?: OpeningMode
  openingAuction?: OpeningAuction | null
}

export function toPublicRoom(room: Room): PublicRoom {
  const normalized = normalizeRoom(room)
  const reveal = normalized.status !== 'bidding'
  return {
    id: normalized.id,
    status: normalized.status,
    openingMode: normalized.openingMode,
    openingAuction: normalized.openingAuction,
    seats: normalized.seats.map(({ reentryCode: _reentryCode, openingBid, bidLocked, ...rest }) => ({
      ...rest,
      openingBid: reveal ? (openingBid ?? null) : null,
      bidLocked: bidLocked ?? false,
    })),
  }
}

// Reidrata para o shape que o resto da app já conhece — `reentryCode` SINTÉTICO vazio, nunca
// o real. Quem precisa do PRÓPRIO código lê `Client.myReentryCode()` (da prévia, `loadRoom`),
// nunca daqui — este helper existe só para não espalhar `PublicRoom` pela UI inteira.
export function fromPublicRoom(room: PublicRoom): Room {
  return normalizeRoom({ ...room, seats: room.seats.map((s) => ({ ...s, reentryCode: '' })) })
}

// Redige TODO `reentryCode` de `room`, sem exceção — nem o do dono (mesma garantia de
// `toPublicRoom`, mas partindo de uma `Room` já em mãos em vez de uma volta pela rede).
// `Client.room()` nunca carrega código nenhum; quem quer o PRÓPRIO lê `myReentryCode()`.
export function redactRoom(room: Room): Room {
  return normalizeRoom({ ...room, seats: room.seats.map((s) => ({ ...s, reentryCode: '' })) })
}

/** Compatibilidade aditiva da 045: salas anteriores não têm fase/lance. */
export function normalizeRoom(room: Room): Room {
  return {
    ...room,
    openingMode: room.openingMode === 'dice-roll' ? 'dice-roll' : 'sealed-bid',
    openingAuction: room.openingAuction ?? null,
    seats: room.seats.map((seat) => ({
      ...seat,
      avatar: normalizeAvatar(seat.avatar),
      skin: normalizeSkin(seat.skin),
      openingBid: seat.openingBid ?? null,
      bidLocked: seat.bidLocked ?? false,
      openingRoll: seat.openingRoll ?? null,
    })),
  }
}

export type JoinResult = { ok: true; room: Room; seat: Seat } | { ok: false; reason: JoinError }
export type JoinError = 'room-full' | 'color-taken' | 'invalid-color' | 'already-started' | 'unknown-uid' | 'kicked' | 'bad-code'

export interface Identity {
  uid: string // ERA `token` (043, D-042) — emitido pelo servidor, nunca escolhido pelo participante
  name: string
  color: string
  /** O adapter aceita ausência/valor legado; a autoridade sempre normaliza ao catálogo. */
  avatar?: AvatarId | string
  /** O adapter aceita ausência/valor legado; a autoridade sempre normaliza ao catálogo. */
  skin?: SkinId | string
  /** Código de reentrada PRONTO (041, D-033/D12) — `room.ts` não tem RNG e não deveria
   * ganhar um; quem minta é quem já tem RNG (host) ou o `roomSession` na criação. Vazio nos
   * chamadores que não exercitam reentrada (determinístico, sem mock). */
  reentryCode?: string
}

function seatIdFor(index: number): string {
  return `p${index + 1}`
}

export function seatByUid(room: Room, uid: string): Seat | undefined {
  return room.seats.find((s) => s.uid === uid)
}

export function hostSeat(room: Room): Seat {
  return room.seats.find((seat) => seat.isHost) ?? room.seats[0]
}

// Cria a sala com o host ocupando o 1º assento (FR-001). Cor livre entre as da paleta.
export function createRoom(id: string, host: Identity): Room {
  if (!isSeatColor(host.color)) throw new Error('invalid-color')
  return {
    id,
    status: 'lobby',
    openingMode: 'sealed-bid',
    openingAuction: null,
    seats: [{
      playerId: seatIdFor(0), uid: host.uid, name: host.name, color: host.color,
      avatar: normalizeAvatar(host.avatar),
      skin: normalizeSkin(host.skin),
      isHost: true, connected: true, openingBid: null, bidLocked: false, openingRoll: null,
      reentryCode: host.reentryCode ?? '',
    }],
  }
}

/** A cor pedida é uma das oito da paleta? Comparação exata — a paleta é fechada (D-045). */
export function isSeatColor(c: string): boolean {
  return (SEAT_COLORS as readonly string[]).includes(c)
}

// Entrada por link (FR-002/005). Uid já assentado → reconexão (use `reattach`), não join.
// Regras: sala cheia recusa; cor fora da paleta recusa; cor duplicada recusa; após o início,
// uid novo é recusado.
export function joinRoom(room: Room, who: Identity): JoinResult {
  const current = normalizeRoom(room)
  const existing = seatByUid(current, who.uid)
  if (existing) return { ok: true, room: markConnected(current, who.uid), seat: seatByUid(markConnected(current, who.uid), who.uid)! }
  if (current.status !== 'lobby') return { ok: false, reason: 'already-started' } // sem novos assentos após o início (FR-005, §11.2)
  if (current.seats.length >= MAX_SEATS) return { ok: false, reason: 'room-full' } // §11.1
  // A cor precisa ser da PALETA antes de precisar ser única. Sem esta linha, a unicidade
  // é só igualdade exata de string: `''` passa (e cai no fallback por índice de
  // `identityOf`, que pode colidir com a cor de outro assento), e `#d9a651` passa ao lado
  // do ouro `#d9a650` — indistinguíveis na mesa, distintos pro `===`. Como a paleta é
  // fechada e derivada (D-045), aceitar cor de fora invalidaria a separação medida sob
  // dicromacia que é a razão de ela existir. O lobby já só oferece as oito; esta é a
  // guarda da AUTORIDADE, pro caso do pedido não vir do lobby.
  if (!isSeatColor(who.color)) return { ok: false, reason: 'invalid-color' }
  if (current.seats.some((s) => s.color === who.color)) return { ok: false, reason: 'color-taken' } // cor única (§12.5)
  const seat: Seat = {
    playerId: seatIdFor(current.seats.length),
    uid: who.uid,
    name: who.name,
    color: who.color,
    avatar: normalizeAvatar(who.avatar),
    skin: normalizeSkin(who.skin),
    isHost: false,
    connected: true,
    openingBid: null,
    bidLocked: false,
    openingRoll: null,
    reentryCode: who.reentryCode ?? '',
  }
  return { ok: true, room: { ...current, seats: [...current.seats, seat] }, seat }
}

// Cores ainda disponíveis para escolha no lobby mínimo.
export function availableColors(room: Room): string[] {
  const taken = new Set(room.seats.map((s) => s.color))
  return SEAT_COLORS.filter((c) => !taken.has(c))
}

// Reabrir o link com uid JÁ assentado re-anexa ao MESMO assento — antes ou depois do início
// (FR-004). Marca conectado; a leitura do snapshot é responsabilidade do cliente/host.
export function reattach(room: Room, uid: string): { ok: true; room: Room; seat: Seat } | { ok: false; reason: 'unknown-uid' } {
  const seat = seatByUid(room, uid)
  if (!seat) return { ok: false, reason: 'unknown-uid' }
  const next = markConnected(room, uid)
  return { ok: true, room: next, seat: seatByUid(next, uid)! }
}

// Host remove um jogador ANTES do início (§11.1 / spec 038 FR-024). Libera a cor. O
// host não se remove (FR-025), e depois do início ninguém é removido — expulsar mid-game
// colidiria com D-016/princípio VII e exigiria ADR próprio.
export function kickSeat(
  room: Room,
  uid: string,
): { ok: true; room: Room } | { ok: false; reason: 'not-in-lobby' | 'is-host' | 'unknown-uid' } {
  if (room.status !== 'lobby') return { ok: false, reason: 'not-in-lobby' }
  const seat = seatByUid(room, uid)
  if (!seat) return { ok: false, reason: 'unknown-uid' }
  if (seat.isHost) return { ok: false, reason: 'is-host' }
  // Reindexa os assentos restantes: `playerId` é posicional ('p1'..'p8') e o motor conta com
  // uma sequência sem buracos. Como isto só roda no LOBBY, nenhuma partida está em curso.
  const seats = room.seats
    .filter((s) => s.uid !== uid)
    .map((s, i) => ({ ...s, playerId: seatIdFor(i), isHost: i === 0 }))
  return { ok: true, room: { ...room, seats } }
}

// Sorteia a ordem da mesa (spec 038, FR-030) — substitui a ordem de entrada usada como
// padrão pela 037. Fisher-Yates com o RNG do host (o mesmo padrão do embaralho das cartas):
// o resultado vive no snapshot e chega aos clientes por leitura, sem precisar de replay.
// O host continua sendo `seats[0]` como DONO da sala; o que muda é a ordem de JOGO.
export function shuffleSeatOrder(room: Room, rng: () => number): Room {
  const order = [...room.seats]
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  // `playerId` é reatribuído pela nova posição: 'p1' é quem joga primeiro.
  const seats = order.map((s, i) => ({ ...s, playerId: seatIdFor(i) }))
  return { ...room, seats }
}

export function selectOpeningMode(
  room: Room,
  mode: OpeningMode,
): { ok: true; room: Room } | { ok: false; reason: 'not-in-lobby' } {
  if (room.status !== 'lobby') return { ok: false, reason: 'not-in-lobby' }
  const normalized = normalizeRoom(room)
  return {
    ok: true,
    room: {
      ...normalized,
      openingMode: mode,
      openingAuction: null,
      seats: normalized.seats.map((seat) => ({
        ...seat,
        openingBid: null,
        bidLocked: false,
        openingRoll: null,
      })),
    },
  }
}

export type OpenOpeningAuctionResult =
  | { ok: true; room: Room }
  | { ok: false; reason: 'too-few' | 'already-started' | 'wrong-mode' }

/** Lobby → coleta lacrada. O prazo é absoluto para todas as telas contarem a mesma rodada. */
export function openOpeningAuction(room: Room, closesAt: number): OpenOpeningAuctionResult {
  if (room.status !== 'lobby') return { ok: false, reason: 'already-started' }
  if (room.seats.length < MIN_SEATS) return { ok: false, reason: 'too-few' }
  if (normalizeRoom(room).openingMode !== 'sealed-bid') return { ok: false, reason: 'wrong-mode' }
  return {
    ok: true,
    room: {
      ...normalizeRoom(room),
      status: 'bidding',
      openingAuction: { closesAt },
      seats: room.seats.map((seat) => ({
        ...seat,
        openingBid: null,
        bidLocked: false,
        openingRoll: null,
      })),
    },
  }
}

export type LockOpeningBidResult =
  | { ok: true; room: Room }
  | { ok: false; reason: 'not-bidding' | 'unknown-uid' | 'invalid-bid' | 'already-locked' }

function validOpeningBid(amount: number): boolean {
  return Number.isInteger(amount)
    && amount >= OPENING_BID_MIN
    && amount <= OPENING_BID_MAX
    && amount % OPENING_BID_STEP === 0
}

/** Autoridade lacra por uid atestado pelo tópico, nunca por identidade declarada no payload. */
export function lockOpeningBid(room: Room, uid: string, amount: number): LockOpeningBidResult {
  if (room.status !== 'bidding') return { ok: false, reason: 'not-bidding' }
  const seat = room.seats.find((candidate) => candidate.uid === uid)
  if (!seat) return { ok: false, reason: 'unknown-uid' }
  if (!validOpeningBid(amount)) return { ok: false, reason: 'invalid-bid' }
  if (seat.bidLocked) return { ok: false, reason: 'already-locked' }
  return {
    ok: true,
    room: {
      ...normalizeRoom(room),
      seats: room.seats.map((candidate) => (
        candidate.uid === uid
          ? { ...candidate, openingBid: amount, bidLocked: true }
          : candidate
      )),
    },
  }
}

export function allOpeningBidsLocked(room: Room): boolean {
  return room.seats.length > 0 && room.seats.every((seat) => seat.bidLocked === true)
}

/** Ordena por valor e embaralha apenas cada grupo empatado. Assentos sem lance viram $0. */
export function finalizeOpeningAuction(
  room: Room,
  rng: () => number,
): { ok: true; room: Room } | { ok: false; reason: 'not-bidding' } {
  if (room.status !== 'bidding') return { ok: false, reason: 'not-bidding' }
  const completed = normalizeRoom(room).seats.map((seat) => (
    seat.bidLocked
      ? seat
      : { ...seat, openingBid: 0, bidLocked: true }
  ))
  const byAmount = new Map<number, Seat[]>()
  for (const seat of completed) {
    const amount = seat.openingBid ?? 0
    const group = byAmount.get(amount) ?? []
    group.push(seat)
    byAmount.set(amount, group)
  }
  const order: Seat[] = []
  const amounts = [...byAmount.keys()].sort((a, b) => b - a)
  for (const amount of amounts) {
    const group = [...byAmount.get(amount)!]
    for (let i = group.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      ;[group[i], group[j]] = [group[j], group[i]]
    }
    order.push(...group)
  }
  return {
    ok: true,
    room: {
      ...normalizeRoom(room),
      status: 'playing',
      openingAuction: null,
      seats: order.map((seat, index) => ({
        ...seat,
        playerId: seatIdFor(index),
        openingRoll: null,
      })),
    },
  }
}

function openingDie(rng: () => number): number {
  return Math.floor(rng() * 6) + 1
}

/** Maior dado: dois d6 por assento, maior soma primeiro, RNG somente dentro dos empates. */
export function rollOpeningOrder(
  room: Room,
  rng: () => number,
): { ok: true; room: Room } | {
  ok: false
  reason: 'too-few' | 'already-started' | 'wrong-mode'
} {
  if (room.status !== 'lobby') return { ok: false, reason: 'already-started' }
  if (room.seats.length < MIN_SEATS) return { ok: false, reason: 'too-few' }
  const normalized = normalizeRoom(room)
  if (normalized.openingMode !== 'dice-roll') return { ok: false, reason: 'wrong-mode' }

  const rolled = normalized.seats.map((seat) => ({
    ...seat,
    openingBid: null,
    bidLocked: false,
    openingRoll: [openingDie(rng), openingDie(rng)] as [number, number],
  }))
  const bySum = new Map<number, Seat[]>()
  for (const seat of rolled) {
    const sum = (seat.openingRoll?.[0] ?? 0) + (seat.openingRoll?.[1] ?? 0)
    const group = bySum.get(sum) ?? []
    group.push(seat)
    bySum.set(sum, group)
  }
  const order: Seat[] = []
  for (const sum of [...bySum.keys()].sort((a, b) => b - a)) {
    const group = [...bySum.get(sum)!]
    for (let i = group.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      ;[group[i], group[j]] = [group[j], group[i]]
    }
    order.push(...group)
  }
  return {
    ok: true,
    room: {
      ...normalized,
      status: 'playing',
      openingAuction: null,
      seats: order.map((seat, index) => ({ ...seat, playerId: seatIdFor(index) })),
    },
  }
}

// Host inicia a partida com 2+ jogadores (FR-006). A ordem de turno é a ordem dos assentos.
export function startGame(room: Room): { ok: true; room: Room } | { ok: false; reason: 'not-host' | 'too-few' | 'already-started' } {
  if (room.status !== 'lobby') return { ok: false, reason: 'already-started' }
  if (room.seats.length < MIN_SEATS) return { ok: false, reason: 'too-few' }
  return { ok: true, room: { ...normalizeRoom(room), status: 'playing', openingAuction: null } }
}

// Ids de jogador na ordem de entrada — insumo do `createSeedState` (host).
export function playerIdsInOrder(room: Room): string[] {
  return room.seats.map((s) => s.playerId)
}

function setConnected(room: Room, uid: string, connected: boolean): Room {
  return { ...room, seats: room.seats.map((s) => (s.uid === uid ? { ...s, connected } : s)) }
}

export function markDisconnected(room: Room, uid: string): Room {
  return setConnected(room, uid, false)
}

export function markConnected(room: Room, uid: string): Room {
  return setConnected(room, uid, true)
}

// True se algum assento que AINDA JOGA está desconectado — gatilho da pausa global (FR-016).
// Só conta durante a partida (no lobby, sair não pausa nada).
//
// Jogadores ELIMINADOS ficam de fora do gatilho (D-029, SRS §11.3 v1.5): quem já faliu não
// tem patrimônio, turno nem decisão a proteger, e costuma fechar a aba — como não existe
// timeout de desconexão (D-015), a regra literal deixava a mesa refém de quem já perdeu.
// `eliminatedIds` vazio (ou omitido) reproduz o comportamento da 037.
export function anyDisconnected(room: Room, eliminatedIds: ReadonlySet<string> = new Set()): boolean {
  return room.seats.some((s) => !s.connected && !eliminatedIds.has(s.playerId))
}

// Assentos cuja ausência trava a partida — o que o banner de pausa lista (spec 038, FR-013).
export function blockingSeats(room: Room, eliminatedIds: ReadonlySet<string> = new Set()): Seat[] {
  return room.seats.filter((s) => !s.connected && !eliminatedIds.has(s.playerId))
}

// Alfabeto sem ambiguidade visual (sem `0/O`, `1/I/L`), maiúsculas — legível em voz alta e
// digitável em teclado de celular (041, data-model §3): o caso de uso é ditar para si mesmo
// em outro aparelho. 6 caracteres em alfabeto de 32 dá margem folgada para 8 assentos.
const REENTRY_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const REENTRY_CODE_LENGTH = 6

// Minta um código de reentrada único NA SALA. `room.ts` não tem RNG (D12 do plan) — quem
// chama já tem um (o host) ou o `roomSession` na criação.
export function newReentryCode(rng: () => number, taken: ReadonlySet<string> = new Set()): string {
  for (;;) {
    let code = ''
    for (let i = 0; i < REENTRY_CODE_LENGTH; i++) code += REENTRY_ALPHABET[Math.floor(rng() * REENTRY_ALPHABET.length)]
    if (!taken.has(code)) return code
  }
}

function normalizeCode(code: string): string {
  return code.replace(/\s+/g, '').toUpperCase()
}

// Reanexa pelo CÓDIGO (041, D-033) em vez do uid — recupera um assento cujo uid se perdeu
// (celular sem bateria, dados do navegador limpos, aba anônima encerrada). Comparação sem
// caixa e sem espaços: quem digita um código ditado erra o caixa alta. Puro: troca só o
// `uid` e marca conectado; o anterior deixa de ter assento por construção (FR-027).
//
// Espelho de teste da RPC `reattach_by_code` (043, D4/D-036) — a partir da Fase 3 quem decide
// de verdade é o servidor; esta função continua existindo porque é o que o adapter local
// exercita, e é o que mantém a conformidade honesta dos dois lados.
export function reattachByCode(
  room: Room,
  code: string,
  uid: string,
): { ok: true; room: Room; seat: Seat } | { ok: false; reason: 'bad-code' } {
  const normalized = normalizeCode(code)
  const target = room.seats.find((s) => normalizeCode(s.reentryCode) === normalized)
  if (!target) return { ok: false, reason: 'bad-code' }
  const seats = room.seats.map((s) => (s.playerId === target.playerId ? { ...s, uid, connected: true } : s))
  const next = { ...room, seats }
  return { ok: true, room: next, seat: next.seats.find((s) => s.playerId === target.playerId)! }
}
