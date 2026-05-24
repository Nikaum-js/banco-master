// Falência & Fim de jogo — puro. A dívida é uma resolução pendente (bloqueia o turno);
// o jogador liquida (comandos de 004/005) e paga, ou declara falência. §9.
import { BOARD } from '@/lib/boardData'
import type { Square, PropertySquare } from '@/lib/boardData'
import type { GameState } from '../turn/types'
import { buildCost } from '../economy/construction'
import { activePlayer, completeResolution, advanceSeat, type TurnCtx } from '../turn/turnMachine'

function clone(state: GameState): GameState {
  return structuredClone(state)
}

function priceOf(sq: Square): number {
  return 'price' in sq ? sq.price : 0
}

// Máximo que o jogador consegue levantar: caixa + construções a metade + hipoteca das livres.
export function liquidationValue(state: GameState, playerId: string): number {
  let v = state.players.find((p) => p.id === playerId)?.cash ?? 0
  for (const sq of BOARD) {
    const t = state.titles[sq.pos]
    if (!t || t.ownerId !== playerId) continue
    if (sq.kind === 'property') {
      const units = t.hotel ? 5 : t.houses
      v += Math.round((units * buildCost(sq as PropertySquare)) / 2) // venda de construção (metade)
    }
    if (!t.mortgaged) v += Math.round(priceOf(sq) / 2) // hipoteca das não-hipotecadas
  }
  return v
}

export function isBankrupt(state: GameState, playerId: string, debt: number): boolean {
  return liquidationValue(state, playerId) < debt
}

// Fim de jogo: resta 1 não-eliminado → phase 'ended'. Muta o estado.
export function checkEndGame(state: GameState): void {
  if (state.players.filter((p) => !p.eliminated).length <= 1) state.phase = 'ended'
}

// Paga a dívida pendente se o caixa cobrir. No-op senão (jogador precisa liquidar ou falir).
export function payDebt(state: GameState): GameState {
  if (state.resolution?.kind !== 'debt') return state
  const { amount, creditorId } = state.resolution
  if (activePlayer(state).cash < amount) return state
  const s = clone(state)
  activePlayer(s).cash -= amount
  if (creditorId) {
    const c = s.players.find((x) => x.id === creditorId)
    if (c) c.cash += amount
  } else {
    s.centerPot += amount // dívida ao banco (imposto) → pote do Free Parking
  }
  completeResolution(s)
  return s
}

// Falência (§9.2, sem empréstimo): destina ativos, elimina, checa fim de jogo, passa a vez.
export function declareBankruptcy(state: GameState, ctx: TurnCtx): GameState {
  if (state.resolution?.kind !== 'debt') return state
  const creditorId = state.resolution.creditorId
  const s = clone(state)
  const debtor = activePlayer(s)

  for (const sq of BOARD) {
    if (!('price' in sq)) continue
    const t = s.titles[sq.pos]
    if (!t || t.ownerId !== debtor.id) continue
    if (sq.kind === 'property') {
      if (t.hotel) {
        s.bank.hotels += 1
        t.hotel = false
      }
      s.bank.houses += t.houses // construções voltam ao banco (§9.2)
      t.houses = 0
    }
    t.ownerId = creditorId // credor (jogador) ou banco (null → livre; leilão é refinamento)
  }
  if (creditorId) {
    const creditor = s.players.find((p) => p.id === creditorId)
    if (creditor) creditor.cash += debtor.cash // caixa restante ao credor
  }
  debtor.cash = 0
  debtor.eliminated = true // token sai do tabuleiro (LiveTokens pula eliminados)

  s.resolution = null
  s.turn.pendingResolve = false
  checkEndGame(s)
  if (s.phase !== 'ended') advanceSeat(s, ctx)
  return s
}
