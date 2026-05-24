// Cartas ofensivas com alvo (016, SRS §10.6) — puras: MUTAM o clone e retornam se aplicaram.
// Despachadas por playHandCard (cards/draw.ts). Reação (Diplomacia) é spec 017 — "não pode recusar".
import { BOARD } from '@/lib/boardData'
import type { Square } from '@/lib/boardData'
import type { GameState } from '../turn/types'
import type { TurnPorts } from '../turn/resolution'
import { ownerOf } from '../economy/titles'
import { cityLevel } from '../economy/construction'
import { transferKeepFee } from '../economy/mortgage'
import { isTempImmune } from '../economy/tempEffects'
import { netWorth } from './effects'

function priceOf(sq: Square): number {
  return 'price' in sq ? sq.price : 0
}

// Quantas propriedades não-hipotecadas o jogador possui (gate da Aquisição Hostil, §10.6).
function nonMortgagedCount(state: GameState, ownerId: string): number {
  return BOARD.filter((sq) => 'price' in sq && state.titles[sq.pos]?.ownerId === ownerId && !state.titles[sq.pos]?.mortgaged).length
}

// Preço pago pela Aquisição (preço de tabela; ×1,5 aeroporto/utilidade) + taxa de hipoteca (§6.3).
function acquireCost(state: GameState, pos: number): { price: number; fee: number } {
  const sq = BOARD[pos]
  const mult = sq.kind === 'airport' || sq.kind === 'utility' ? 1.5 : 1
  const price = Math.round(priceOf(sq) * mult)
  const fee = state.titles[pos]?.mortgaged ? transferKeepFee(sq) : 0
  return { price, fee }
}

// Gates da Aquisição Hostil (reusado pela interceptação de reação, 017).
export function canAcquire(state: GameState, attackerId: string, pos: number): boolean {
  const sq = BOARD[pos]
  if (!('price' in sq)) return false
  const owner = ownerOf(state, pos)
  if (owner === null || owner === attackerId) return false // de outro jogador (§577)
  if (isTempImmune(state, pos)) return false // protegida (015)
  const t = state.titles[pos]
  if (cityLevel(t) > 0 || t.hangar) return false // sem construção (§573, incl. Hangar)
  if (nonMortgagedCount(state, owner) < 2) return false // alvo ≥2 não-hipotecadas (§574)
  const attacker = state.players.find((p) => p.id === attackerId)
  const { price, fee } = acquireCost(state, pos)
  return !!attacker && attacker.cash >= price + fee // precisa pagar
}

// Aquisição Hostil: força a venda da propriedade ao atacante pelo preço de tabela (×1,5 aeroporto/utilidade).
export function acquire(state: GameState, attackerId: string, pos: number): boolean {
  if (!canAcquire(state, attackerId, pos)) return false
  const owner = ownerOf(state, pos)!
  const { price, fee } = acquireCost(state, pos)
  const attacker = state.players.find((p) => p.id === attackerId)!
  const ownerP = state.players.find((p) => p.id === owner)!
  attacker.cash -= price + fee
  ownerP.cash += price // compensação ao dono (a taxa de hipoteca vai ao banco)
  state.titles[pos].ownerId = attackerId // mortgaged acompanha
  state.notice = { kind: 'hostile-takeover', victimId: owner, attackerId, pos } // 030, §12.2
  return true
}

export function canEvict(state: GameState, attackerId: string, pos: number): boolean {
  const sq = BOARD[pos]
  if (sq.kind !== 'property') return false // só cidade tem casa avulsa
  const owner = ownerOf(state, pos)
  if (owner === null || owner === attackerId) return false
  if (isTempImmune(state, pos)) return false // protegida (015)
  const t = state.titles[pos]
  return !t.hotel && t.houses >= 1 // 1 casa (não hotel)
}

// Despejo: demole 1 casa (não hotel) de outro jogador; volta ao banco; o dono não recebe nada.
export function evict(state: GameState, attackerId: string, pos: number): boolean {
  if (!canEvict(state, attackerId, pos)) return false
  state.titles[pos].houses -= 1
  state.bank.houses += 1 // volta ao estoque
  return true
}

export function canAudit(state: GameState, attackerId: string, targetId: string): boolean {
  if (targetId === attackerId) return false
  const target = state.players.find((p) => p.id === targetId)
  return !!target && !target.eliminated
}

// Auditoria Fiscal: o alvo paga 10% do patrimônio líquido ao pote (Free Parking).
export function audit(state: GameState, attackerId: string, targetId: string, ports: TurnPorts): boolean {
  if (!canAudit(state, attackerId, targetId)) return false
  const target = state.players.find((p) => p.id === targetId)!

  const owed = Math.round(netWorth(state, targetId) * 0.1)
  const paid = Math.min(target.cash, owed) // sem caixa → paga o que houver (sem falir nesta versão)
  target.cash -= paid
  ports.onPayToCenter(state, paid) // → pote (§13.4)
  return true
}
