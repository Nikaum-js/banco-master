// Estado da sala e identidade (spec 037, FR-001..006a, 019).
//
// A sala é o estado LADO-SERVIDOR que amarra assentos↔tokens de sessão. Ela vive fora do
// `GameState` (que nunca ganha PII nem token — D-019): o `GameState` só conhece `playerId`s
// serializáveis ('p1'..'p8'). Todos os reducers aqui são PUROS (não mutam o argumento).
//
// Identidade visual: a COR é única por sala (§12.5); o NOME é livre (duplicata permitida,
// Clarifications). Ordem de turno = ordem de entrada (host = 1º assento); a rolagem de ordem
// inicial pertence ao 038+ (FR-006).

// Paleta de assentos — espelha `PLAYER_COLORS` de `src/boards/shared.tsx` (mantida aqui para
// não acoplar a casca de rede à UI). 8 cores → no máximo 8 assentos (§11.1).
// Catálogo de PEÇAS — uma por assento possível (§11.1 = até 8, FR-023). Rótulos
// temáticos do tabuleiro "Cidades do Mundo"; a arte fica na UI, aqui só id + emblema.
//
// Menores do review de arquitetura (2026-07-25): o catálogo morava em `identity.ts` mas a
// REGRA de unicidade da peça já morava aqui (`joinRoom` → 'piece-taken'), enquanto a cor
// tinha catálogo e regra no mesmo arquivo. A fragmentação cobrava um `as PieceId` em
// `identityOf`; agora `Seat.piece` é tipado e o cast some.
export const PIECES = [
  { id: 'aviao', label: 'Avião', glyph: '✈' },
  { id: 'navio', label: 'Navio', glyph: '⚓' },
  { id: 'trem', label: 'Trem', glyph: '🚂' },
  { id: 'taxi', label: 'Táxi', glyph: '🚕' },
  { id: 'balao', label: 'Balão', glyph: '🎈' },
  { id: 'bussola', label: 'Bússola', glyph: '🧭' },
  { id: 'mala', label: 'Mala', glyph: '🧳' },
  { id: 'farol', label: 'Farol', glyph: '🗼' },
] as const

export type PieceId = (typeof PIECES)[number]['id']

/**
 * Peça pelo id, com fallback. Uma resposta só: havia TRÊS lookups `PIECES.find(...)` com
 * três fallbacks diferentes (`'●'` no `LobbyScreen`, `PIECES[0]` no `PlayerName`,
 * `fallbackIdentity` no `identity.ts`) — a mesma peça aparecia diferente por tela.
 */
export function pieceOf(id?: string): (typeof PIECES)[number] {
  return PIECES.find((p) => p.id === id) ?? PIECES[0]
}

export const SEAT_COLORS = ['#d9a650', '#a76bf5', '#06b6d4', '#14b8a6', '#d946ef', '#f97316', '#35d97b', '#4d8bf5'] as const

export const MIN_SEATS = 2
export const MAX_SEATS = 8

export type RoomStatus = 'lobby' | 'playing' | 'paused' | 'ended'

export interface Seat {
  playerId: string // id serializável usado pelo GameState ('p1'..'p8')
  token: string // token de sessão (NUNCA entra no GameState) — chave de reconexão
  name: string // nome exibido (livre)
  color: string // cor (única por sala)
  piece?: PieceId // peça visual (única por sala, §12.5/spec 038); ausente em salas da 037
  isHost: boolean
  connected: boolean
  /** Código de reentrada (041, D-033) — estável pela vida do assento; sobrevive à perda do
   * token (celular sem bateria, dados do navegador limpos). `kickSeat`/`shuffleSeatOrder`
   * preservam por construção (nunca reescrevem o campo). */
  reentryCode: string
}

export interface Room {
  id: string
  status: RoomStatus
  seats: Seat[] // ordem de entrada; host = seats[0]
}

export type JoinResult = { ok: true; room: Room; seat: Seat } | { ok: false; reason: JoinError }
export type JoinError = 'room-full' | 'color-taken' | 'piece-taken' | 'already-started' | 'unknown-token' | 'kicked' | 'bad-code'

export interface Identity {
  token: string
  name: string
  color: string
  piece?: PieceId // escolhida no lobby (spec 038); opcional para compatibilidade com a 037
  /** Código de reentrada PRONTO (041, D-033/D12) — `room.ts` não tem RNG e não deveria
   * ganhar um; quem minta é quem já tem RNG (host) ou o `roomSession` na criação. Vazio nos
   * chamadores que não exercitam reentrada (determinístico, sem mock). */
  reentryCode?: string
}

function seatIdFor(index: number): string {
  return `p${index + 1}`
}

export function seatByToken(room: Room, token: string): Seat | undefined {
  return room.seats.find((s) => s.token === token)
}

export function hostSeat(room: Room): Seat {
  return room.seats[0]
}

// Cria a sala com o host ocupando o 1º assento (FR-001). Cor livre entre as da paleta.
export function createRoom(id: string, host: Identity): Room {
  return {
    id,
    status: 'lobby',
    seats: [{
      playerId: seatIdFor(0), token: host.token, name: host.name, color: host.color, piece: host.piece,
      isHost: true, connected: true, reentryCode: host.reentryCode ?? '',
    }],
  }
}

// Entrada por link (FR-002/005). Token já assentado → reconexão (use `reattach`), não join.
// Regras: sala cheia recusa; cor duplicada recusa; após o início, token novo é recusado.
export function joinRoom(room: Room, who: Identity): JoinResult {
  const existing = seatByToken(room, who.token)
  if (existing) return { ok: true, room: markConnected(room, who.token), seat: seatByToken(markConnected(room, who.token), who.token)! }
  if (room.status !== 'lobby') return { ok: false, reason: 'already-started' } // sem novos assentos após o início (FR-005, §11.2)
  if (room.seats.length >= MAX_SEATS) return { ok: false, reason: 'room-full' } // §11.1
  if (room.seats.some((s) => s.color === who.color)) return { ok: false, reason: 'color-taken' } // cor única (§12.5)
  if (who.piece && room.seats.some((s) => s.piece === who.piece)) return { ok: false, reason: 'piece-taken' } // peça única (§12.5 / FR-022)
  const seat: Seat = {
    playerId: seatIdFor(room.seats.length),
    token: who.token,
    name: who.name,
    color: who.color,
    piece: who.piece,
    isHost: false,
    connected: true,
    reentryCode: who.reentryCode ?? '',
  }
  return { ok: true, room: { ...room, seats: [...room.seats, seat] }, seat }
}

// Peças ainda livres na sala — escolha única por sala, como a cor (§12.5 / FR-022).
export function availablePieces(room: Room): PieceId[] {
  const taken = new Set<string>(room.seats.map((s) => s.piece).filter(Boolean) as string[])
  return PIECES.map((p) => p.id).filter((id) => !taken.has(id))
}

// Cores ainda disponíveis para escolha no lobby mínimo.
export function availableColors(room: Room): string[] {
  const taken = new Set(room.seats.map((s) => s.color))
  return SEAT_COLORS.filter((c) => !taken.has(c))
}

// Reabrir o link com token JÁ assentado re-anexa ao MESMO assento — antes ou depois do início
// (FR-004). Marca conectado; a leitura do snapshot é responsabilidade do cliente/host.
export function reattach(room: Room, token: string): { ok: true; room: Room; seat: Seat } | { ok: false; reason: 'unknown-token' } {
  const seat = seatByToken(room, token)
  if (!seat) return { ok: false, reason: 'unknown-token' }
  const next = markConnected(room, token)
  return { ok: true, room: next, seat: seatByToken(next, token)! }
}

// Host remove um jogador ANTES do início (§11.1 / spec 038 FR-024). Libera cor e peça. O
// host não se remove (FR-025), e depois do início ninguém é removido — expulsar mid-game
// colidiria com D-016/princípio VII e exigiria ADR próprio.
export function kickSeat(
  room: Room,
  token: string,
): { ok: true; room: Room } | { ok: false; reason: 'not-in-lobby' | 'is-host' | 'unknown-token' } {
  if (room.status !== 'lobby') return { ok: false, reason: 'not-in-lobby' }
  const seat = seatByToken(room, token)
  if (!seat) return { ok: false, reason: 'unknown-token' }
  if (seat.isHost) return { ok: false, reason: 'is-host' }
  // Reindexa os assentos restantes: `playerId` é posicional ('p1'..'p8') e o motor conta com
  // uma sequência sem buracos. Como isto só roda no LOBBY, nenhuma partida está em curso.
  const seats = room.seats
    .filter((s) => s.token !== token)
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

// Host inicia a partida com 2+ jogadores (FR-006). A ordem de turno é a ordem dos assentos.
export function startGame(room: Room): { ok: true; room: Room } | { ok: false; reason: 'not-host' | 'too-few' | 'already-started' } {
  if (room.status !== 'lobby') return { ok: false, reason: 'already-started' }
  if (room.seats.length < MIN_SEATS) return { ok: false, reason: 'too-few' }
  return { ok: true, room: { ...room, status: 'playing' } }
}

// Ids de jogador na ordem de entrada — insumo do `createSeedState` (host).
export function playerIdsInOrder(room: Room): string[] {
  return room.seats.map((s) => s.playerId)
}

function setConnected(room: Room, token: string, connected: boolean): Room {
  return { ...room, seats: room.seats.map((s) => (s.token === token ? { ...s, connected } : s)) }
}

export function markDisconnected(room: Room, token: string): Room {
  return setConnected(room, token, false)
}

export function markConnected(room: Room, token: string): Room {
  return setConnected(room, token, true)
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

export function hostDisconnected(room: Room): boolean {
  return !hostSeat(room).connected
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

// Reanexa pelo CÓDIGO (041, D-033) em vez do token — recupera um assento cujo token se
// perdeu (celular sem bateria, dados do navegador limpos, aba anônima encerrada). Comparação
// sem caixa e sem espaços: quem digita um código ditado erra o caixa alta. Puro: troca só o
// `token` e marca conectado; o anterior deixa de ter assento por construção (FR-027).
export function reattachByCode(
  room: Room,
  code: string,
  token: string,
): { ok: true; room: Room; seat: Seat } | { ok: false; reason: 'bad-code' } {
  const normalized = normalizeCode(code)
  const target = room.seats.find((s) => normalizeCode(s.reentryCode) === normalized)
  if (!target) return { ok: false, reason: 'bad-code' }
  const seats = room.seats.map((s) => (s.playerId === target.playerId ? { ...s, token, connected: true } : s))
  const next = { ...room, seats }
  return { ok: true, room: next, seat: next.seats.find((s) => s.playerId === target.playerId)! }
}
