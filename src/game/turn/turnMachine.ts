// Máquina de estados do turno — funções PURAS (state, ctx) → novo state.
// Único efeito é o setter do store; aqui nada muta o argumento (clona via structuredClone).
import { BOARD } from '@/lib/boardData'
import type { GameState, Player, Turn, Roll } from './types'
import { roll as rollDiceFn, type RNG } from './dice'
import { resolveSquare, type TurnPorts, type ResolveCtx, type ResolutionOutcome } from './resolution'

export const BOARD_SIZE = 48
export const JAIL_POS = 12
export const JAIL_FINE = 50

export interface TurnCtx {
  rng: RNG
  ports: TurnPorts
  // Resolver de economia (003) injetado pelo store: trata property/airport/utility.
  // Retorna null para outros kinds → cai no registry default (tax/cantos/etc.).
  resolve?: (rctx: ResolveCtx) => ResolutionOutcome | null
  now?: () => number // relógio injetável (deadline do leilão)
}

function clone(state: GameState): GameState {
  return structuredClone(state)
}

export function activePlayer(state: GameState): Player {
  return state.players[state.turnOrder[state.activeSeat]]
}

// Triple não conta como dupla (FR-014/FR-015/clarify Q1) — nem p/ re-roll nem p/ prisão.
function countsAsDouble(roll: Roll): boolean {
  return roll.isDouble && roll.special !== 'triple'
}

// Avança `steps` casas (horário); credita GO ao cruzar/parar no índice 0 (FR-008).
function advance(player: Player, steps: number, ports: TurnPorts): void {
  if (steps <= 0) return
  const passedGo = player.pos + steps >= BOARD_SIZE
  player.pos = (player.pos + steps) % BOARD_SIZE
  if (passedGo) {
    ports.onPassGo(player.id)
    player.completouPrimeiraVolta = true // Speed Die a partir da próxima rolagem (clarify Q2)
  }
}

// Teleporte do triple: move à frente até `dest`; GO se o caminho cruzar o 0.
function teleport(player: Player, dest: number, ports: TurnPorts): void {
  advance(player, (dest - player.pos + BOARD_SIZE) % BOARD_SIZE, ports)
}

function sendToJail(player: Player): void {
  player.pos = JAIL_POS
  player.jail = { inJail: true, attempts: 0 }
}

// Próxima casa comprável (Mr. Banco Master). "Não comprada" refina na spec de Compra & Aluguel.
function nextBuyableSteps(fromPos: number): number {
  for (let s = 1; s <= BOARD_SIZE; s++) {
    const k = BOARD[(fromPos + s) % BOARD_SIZE].kind
    if (k === 'property' || k === 'airport' || k === 'utility') return s
  }
  return 0
}

// Pousa o token: "Vá para a Prisão" encerra o turno; senão exige resolução da casa.
function land(turn: Turn, player: Player, roll: Roll | null): void {
  if (BOARD[player.pos].kind === 'corner-gotojail') {
    sendToJail(player) // FR-012 — sem GO (já tratado), encerra o movimento
    turn.state = 'encerrado'
    turn.pendingResolve = false
    turn.mayRollAgain = false
    return
  }
  turn.state = 'casa-a-resolver'
  turn.pendingResolve = true
  turn.mayRollAgain = roll ? countsAsDouble(roll) : false // sair da prisão (roll=null) não dá re-roll (FR-019)
}

function advanceSeat(s: GameState, ctx: TurnCtx): void {
  const n = s.turnOrder.length
  let next = s.activeSeat
  for (let i = 0; i < n; i++) {
    next = (next + 1) % n
    const p = s.players[s.turnOrder[next]]
    if (!p.eliminated && !ctx.ports.isEliminated(p.id)) break // pula eliminados (FR-002)
  }
  s.activeSeat = next
  startTurn(s)
}

// Turnos forçados a encerrar (3ª dupla, prisão, tentativa falha) passam a vez na hora.
function finishIfEnded(s: GameState, ctx: TurnCtx): GameState {
  if (s.turn.state === 'encerrado') advanceSeat(s, ctx)
  return s
}

// Prepara o turno do jogador ativo atual.
export function startTurn(s: GameState): void {
  const player = activePlayer(s)
  s.turn = {
    state: player.jail.inJail ? 'prisao-decisao' : 'aguardando-rolagem',
    seat: s.activeSeat,
    consecutiveDoubles: 0,
    lastRoll: null,
    pendingResolve: false,
    mayRollAgain: false,
    awaitingChoice: null,
  }
}

// --- Comandos (API pública) ---------------------------------------------------

export function rollDice(state: GameState, ctx: TurnCtx): GameState {
  if (state.paused) return state // FR-028
  if (state.turn.state !== 'aguardando-rolagem') return state // FR-001/FR-004
  const s = clone(state)
  const turn = s.turn
  const player = activePlayer(s)

  const roll = rollDiceFn(ctx.rng, { speedDie: player.completouPrimeiraVolta })
  turn.lastRoll = roll

  // 3ª dupla consecutiva → prisão; o 3º movimento NÃO é executado (FR-015).
  if (countsAsDouble(roll)) {
    turn.consecutiveDoubles += 1
    if (turn.consecutiveDoubles >= 3) {
      sendToJail(player)
      turn.state = 'encerrado'
      return finishIfEnded(s, ctx)
    }
  }

  // Faces que exigem escolha antes de mover (Ônibus / Triple).
  if (roll.special === 'onibus' || roll.special === 'triple') {
    turn.awaitingChoice = roll.special
    turn.state = 'casa-a-resolver' // resolvePending fica bloqueado por awaitingChoice
    turn.pendingResolve = true
    return s
  }

  // Mr. Banco Master: move o normal e depois até a próxima comprável (FR-024).
  if (roll.special === 'mr-banco') {
    advance(player, roll.move, ctx.ports)
    advance(player, nextBuyableSteps(player.pos), ctx.ports)
    land(turn, player, roll)
    return finishIfEnded(s, ctx)
  }

  // Movimento normal/numérico.
  advance(player, roll.move, ctx.ports)
  land(turn, player, roll)
  return finishIfEnded(s, ctx)
}

export function chooseBusMove(state: GameState, opt: 'die0' | 'die1' | 'sum', ctx: TurnCtx): GameState {
  if (state.paused) return state
  if (state.turn.awaitingChoice !== 'onibus' || !state.turn.lastRoll) return state
  const s = clone(state)
  const turn = s.turn
  const player = activePlayer(s)
  const [d0, d1] = turn.lastRoll!.white
  const steps = opt === 'die0' ? d0 : opt === 'die1' ? d1 : d0 + d1
  turn.awaitingChoice = null
  advance(player, steps, ctx.ports)
  land(turn, player, turn.lastRoll) // dupla pelos brancos não é quebrada pelo Ônibus (FR-025)
  return finishIfEnded(s, ctx)
}

export function chooseTripleDest(state: GameState, dest: number, ctx: TurnCtx): GameState {
  if (state.paused) return state
  if (state.turn.awaitingChoice !== 'triple' || !state.turn.lastRoll) return state
  const s = clone(state)
  const turn = s.turn
  const player = activePlayer(s)
  turn.awaitingChoice = null
  teleport(player, dest, ctx.ports)
  land(turn, player, turn.lastRoll) // triple não dá re-roll (FR-026)
  return finishIfEnded(s, ctx)
}

export function resolvePending(state: GameState, ctx: TurnCtx): GameState {
  if (state.paused) return state
  if (state.turn.state !== 'casa-a-resolver' || state.turn.awaitingChoice !== null) return state
  const s = clone(state)
  const turn = s.turn
  const player = activePlayer(s)
  const rctx: ResolveCtx = { playerId: player.id, square: BOARD[player.pos], roll: turn.lastRoll, ports: ctx.ports, state: s }
  const outcome = ctx.resolve?.(rctx) ?? resolveSquare(rctx)
  if (outcome.done) {
    turn.pendingResolve = false
    turn.state = 'aguardando-finalizacao' // FR-007
  }
  // outcome.done === false: casa segue pendente (ex.: compra/leilão abertos por 003)
  return s
}

// Usado pela economia (003) para concluir uma resolução interativa (compra/leilão).
export function completeResolution(s: GameState): void {
  s.resolution = null
  s.turn.pendingResolve = false
  s.turn.state = 'aguardando-finalizacao'
}

export function finalizeTurn(state: GameState, ctx: TurnCtx): GameState {
  if (state.paused) return state // FR-028
  if (state.turn.state !== 'aguardando-finalizacao' || state.turn.pendingResolve) return state // FR-022
  const s = clone(state)
  const turn = s.turn

  if (turn.mayRollAgain) {
    // mesmo jogador rola de novo (dupla) — consecutiveDoubles persiste
    turn.mayRollAgain = false
    turn.lastRoll = null
    turn.pendingResolve = false
    turn.state = 'aguardando-rolagem'
    return s
  }

  advanceSeat(s, ctx) // próximo jogador (FR-002)
  return s
}

export function jailDecision(state: GameState, decision: 'pay' | 'card' | 'try', ctx: TurnCtx): GameState {
  if (state.paused) return state
  if (state.turn.state !== 'prisao-decisao') return state // FR-016
  const s = clone(state)
  const turn = s.turn
  const player = activePlayer(s)

  if (decision === 'pay') {
    ctx.ports.onPayToCenter(JAIL_FINE) // $50 → centro
    player.jail = { inJail: false, attempts: 0 }
    turn.state = 'aguardando-rolagem'
    return s
  }
  if (decision === 'card') {
    player.jail = { inJail: false, attempts: 0 } // "Saia da Prisão" (consumo na spec de Cartas)
    turn.state = 'aguardando-rolagem'
    return s
  }

  // try: rola 2 brancos — Speed Die NÃO é usado na tentativa de sair (SRS §13.2).
  const roll = rollDiceFn(ctx.rng, { speedDie: false })
  turn.lastRoll = roll
  if (roll.isDouble) {
    player.jail = { inJail: false, attempts: 0 }
    advance(player, roll.move, ctx.ports)
    land(turn, player, null) // sair com dupla NÃO dá nova rolagem (FR-019)
    return finishIfEnded(s, ctx)
  }
  // sem dupla
  player.jail.attempts += 1
  if (player.jail.attempts >= 3) {
    ctx.ports.onPayToCenter(JAIL_FINE) // 3ª tentativa: paga obrigatoriamente e move (FR-018)
    player.jail = { inJail: false, attempts: 0 }
    advance(player, roll.move, ctx.ports)
    land(turn, player, null)
    return finishIfEnded(s, ctx)
  }
  turn.state = 'encerrado' // segue preso; passa a vez (FR-017)
  return finishIfEnded(s, ctx)
}
