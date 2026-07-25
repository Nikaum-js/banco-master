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
export const SEAT_COLORS = ['#d9a650', '#a76bf5', '#06b6d4', '#14b8a6', '#d946ef', '#f97316', '#35d97b', '#4d8bf5'] as const

export const MIN_SEATS = 2
export const MAX_SEATS = 8

export type RoomStatus = 'lobby' | 'playing' | 'paused' | 'ended'

export interface Seat {
  playerId: string // id serializável usado pelo GameState ('p1'..'p8')
  token: string // token de sessão (NUNCA entra no GameState) — chave de reconexão
  name: string // nome exibido (livre)
  color: string // cor (única por sala)
  isHost: boolean
  connected: boolean
}

export interface Room {
  id: string
  status: RoomStatus
  seats: Seat[] // ordem de entrada; host = seats[0]
}

export type JoinResult = { ok: true; room: Room; seat: Seat } | { ok: false; reason: JoinError }
export type JoinError = 'room-full' | 'color-taken' | 'already-started' | 'unknown-token'

export interface Identity {
  token: string
  name: string
  color: string
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
    seats: [{ playerId: seatIdFor(0), token: host.token, name: host.name, color: host.color, isHost: true, connected: true }],
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
  const seat: Seat = { playerId: seatIdFor(room.seats.length), token: who.token, name: who.name, color: who.color, isHost: false, connected: true }
  return { ok: true, room: { ...room, seats: [...room.seats, seat] }, seat }
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

// True se algum assento está desconectado — gatilho da pausa global (FR-016). Só conta
// durante a partida (no lobby, sair não pausa nada).
export function anyDisconnected(room: Room): boolean {
  return room.seats.some((s) => !s.connected)
}

export function hostDisconnected(room: Room): boolean {
  return !hostSeat(room).connected
}
