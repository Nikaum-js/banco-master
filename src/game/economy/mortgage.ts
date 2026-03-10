// Hipoteca — funções puras. Escreve a flag `mortgaged` (003); efeitos (aluguel/construção)
// já vivem em 003/004. Sem novo estado. Os 10% incidem sobre o valor da hipoteca (clarif.).
import { BOARD } from '@/lib/boardData'
import type { Square, GroupKey } from '@/lib/boardData'
import type { GameState } from '../turn/types'
import { activePlayer } from '../turn/turnMachine'
import { debtorOf } from '../falencia/falencia'
import { THEME } from '../theme'
import { logEvent } from '../log'

function clone(state: GameState): GameState {
  return structuredClone(state)
}

function priceOf(sq: Square): number {
  return 'price' in sq ? sq.price : 0
}

export function mortgageValue(sq: Square): number {
  return Math.round(priceOf(sq) * THEME.MORTGAGE_RATIO) // metade do preço (§6.1)
}

export function unmortgageCost(sq: Square): number {
  return Math.round(mortgageValue(sq) * (1 + THEME.UNMORTGAGE_SURCHARGE)) // metade + 10% (§6.2)
}

export function transferKeepFee(sq: Square): number {
  return Math.round(mortgageValue(sq) * THEME.TRANSFER_FEE_RATIO) // taxa de manter na transferência (§6.3)
}

// Há construção em alguma propriedade do grupo possuída pelo jogador? (bloqueio §6.1)
export function groupHasConstruction(state: GameState, group: GroupKey, ownerId: string): boolean {
  return BOARD.some(
    (s) =>
      s.kind === 'property' &&
      s.group === group &&
      state.titles[s.pos]?.ownerId === ownerId &&
      (
        (state.titles[s.pos]?.houses ?? 0) > 0 ||
        !!state.titles[s.pos]?.hotel ||
        !!state.titles[s.pos]?.hotel2 ||
        !!state.titles[s.pos]?.skyscraper
      ),
  )
}

// Hipoteca a propriedade do jogador ativo. No-op se inválido.
// Pode hipotecar? Própria, não-hipotecada e sem construção vinculada (§6.1, D-049).
export function canMortgage(state: GameState, pos: number): boolean {
  const sq = BOARD[pos]
  if (sq.kind !== 'property' && sq.kind !== 'airport' && sq.kind !== 'utility') return false
  const player = activePlayer(state)
  const title = state.titles[pos]
  if (!title || title.ownerId !== player.id || title.mortgaged) return false
  if (sq.kind === 'property' && groupHasConstruction(state, sq.group, player.id)) return false // §6.1
  if (sq.kind === 'airport' && title.hangar) return false // D-049: vende o Hangar primeiro
  return true
}

// Pode deshipotecar? (própria, hipotecada, com caixa p/ resgate §6.2) — 023.
export function canUnmortgage(state: GameState, pos: number): boolean {
  const sq = BOARD[pos]
  const player = activePlayer(state)
  const title = state.titles[pos]
  if (!title || title.ownerId !== player.id || !title.mortgaged) return false
  return player.cash >= unmortgageCost(sq)
}

export function mortgageProperty(state: GameState, pos: number): GameState {
  if (!canMortgage(state, pos)) return state
  const sq = BOARD[pos]
  const amount = mortgageValue(sq)
  const s = clone(state)
  const p = activePlayer(s)
  p.cash += amount
  s.titles[pos].mortgaged = true
  logEvent(s, { kind: 'mortgage', who: p.id, pos, amount })
  return s
}

// Deshipoteca (paga metade × 1,10). No-op se inválido.
export function unmortgageProperty(state: GameState, pos: number): GameState {
  if (!canUnmortgage(state, pos)) return state
  const sq = BOARD[pos]
  const cost = unmortgageCost(sq)
  const s = clone(state)
  const p = activePlayer(s)
  p.cash -= cost
  s.titles[pos].mortgaged = false
  logEvent(s, { kind: 'unmortgage', who: p.id, pos, cost })
  return s
}

/**
 * Pode devolver a HIPOTECADA ao banco? (§6.4, D-062)
 *
 * Só a hipotecada, e a razão é que a livre já tem essa saída: hipotecar (§6.1) **é** a venda
 * ao banco, por metade do preço, com recompra. O que faltava era sair do estado SEGUINTE —
 * onde o único caminho de volta era pagar metade + 10% por um título que o dono talvez não
 * queira mais, e onde uma cidade hipotecada congela a construção do país inteiro.
 *
 * A trava de dívida pendente não é incidental: sem ela isto vira a porta dos fundos da
 * falência. O devedor derrubaria o próprio `liquidationValue` devolvendo títulos ao banco até
 * ficar "insolvente" e declararia falência com o credor recebendo menos do que os ativos
 * valiam — a mesma proteção de credor que a §8.5 aplica à troca, pelo mesmo motivo.
 */
export function canSellMortgagedToBank(state: GameState, pos: number): boolean {
  if (state.paused) return false
  if (state.phase !== 'playing') return false
  // Proteção de credor (§9.1/§6.4): com dívida pendente NA MESA, quem deve não pode derrubar o
  // próprio valor de liquidação devolvendo títulos. Só o DEVEDOR fica travado — travar todos
  // puniria quem não tem nada a ver com a cobrança.
  if (debtorOf(state) === activePlayer(state).id) return false
  const sq = BOARD[pos]
  if (sq.kind !== 'property' && sq.kind !== 'airport' && sq.kind !== 'utility') return false
  const title = state.titles[pos]
  if (!title || !title.mortgaged) return false // só a hipotecada
  return title.ownerId === activePlayer(state).id // própria, na própria vez
}

/**
 * Devolve a hipotecada ao banco por ZERO (§6.4, D-062). O título volta a TERRENO LIVRE.
 *
 * Zero é o único número que conserva: a metade do preço já foi paga ao dono no ato da hipoteca
 * (§6.1), e devolver o título liquida esse financiamento. Pagar algo a mais criaria dinheiro
 * para quem já recebeu adiantado pelo mesmo ativo; cobrar algo a mais puniria duas vezes.
 *
 * A limpeza é a MESMA da desistência (§9.6, `handOverTitles` com `freeToBank`): hipoteca,
 * Hangar e construção saem, porque o terreno tem de voltar ao estado de nunca-comprado — é
 * isso que o faz voltar a contar para a escassez (§7.5) e ao fluxo de cair-e-comprar.
 */
export function sellMortgagedToBank(state: GameState, pos: number): GameState {
  if (!canSellMortgagedToBank(state, pos)) return state
  const s = clone(state)
  const p = activePlayer(s)
  const t = s.titles[pos]
  t.ownerId = null
  t.mortgaged = false
  t.hangar = false
  t.houses = 0
  t.hotel = false
  t.hotel2 = false
  t.skyscraper = false
  // `amount: 0` EXPLÍCITO (D-063): um valor zero registrado é um fato; um fato não registrado
  // é o que produziu três relatos de "perdi dinheiro sem motivo".
  logEvent(s, { kind: 'sell-to-bank', who: p.id, pos, amount: 0 })
  return s
}
