// Hipoteca — funções puras. Escreve a flag `mortgaged` (003); efeitos (aluguel/construção)
// já vivem em 003/004. Sem novo estado. Os 10% incidem sobre o valor da hipoteca (clarif.).
import { BOARD } from '@/lib/boardData'
import type { Square, GroupKey } from '@/lib/boardData'
import type { GameState } from '../turn/types'
import { activePlayer } from '../turn/turnMachine'

function clone(state: GameState): GameState {
  return structuredClone(state)
}

function priceOf(sq: Square): number {
  return 'price' in sq ? sq.price : 0
}

export function mortgageValue(sq: Square): number {
  return Math.round(priceOf(sq) / 2) // metade do preço (§6.1)
}

export function unmortgageCost(sq: Square): number {
  return Math.round(mortgageValue(sq) * 1.1) // metade + 10% (§6.2)
}

export function transferKeepFee(sq: Square): number {
  return Math.round(mortgageValue(sq) * 0.1) // taxa de manter na transferência (§6.3)
}

// Há construção em alguma propriedade do grupo possuída pelo jogador? (bloqueio §6.1)
export function groupHasConstruction(state: GameState, group: GroupKey, ownerId: string): boolean {
  return BOARD.some(
    (s) =>
      s.kind === 'property' &&
      s.group === group &&
      state.titles[s.pos]?.ownerId === ownerId &&
      ((state.titles[s.pos]?.houses ?? 0) > 0 || !!state.titles[s.pos]?.hotel),
  )
}

// Hipoteca a propriedade do jogador ativo. No-op se inválido.
export function mortgageProperty(state: GameState, pos: number): GameState {
  const sq = BOARD[pos]
  if (sq.kind !== 'property' && sq.kind !== 'airport' && sq.kind !== 'utility') return state
  const player = activePlayer(state)
  const title = state.titles[pos]
  if (!title || title.ownerId !== player.id || title.mortgaged) return state
  if (sq.kind === 'property' && groupHasConstruction(state, sq.group, player.id)) return state // §6.1

  const s = clone(state)
  activePlayer(s).cash += mortgageValue(sq)
  s.titles[pos].mortgaged = true
  return s
}

// Deshipoteca (paga metade × 1,10). No-op se inválido.
export function unmortgageProperty(state: GameState, pos: number): GameState {
  const sq = BOARD[pos]
  const player = activePlayer(state)
  const title = state.titles[pos]
  if (!title || title.ownerId !== player.id || !title.mortgaged) return state
  const cost = unmortgageCost(sq)
  if (player.cash < cost) return state // §6.2 — precisa de caixa

  const s = clone(state)
  activePlayer(s).cash -= cost
  s.titles[pos].mortgaged = false
  return s
}
