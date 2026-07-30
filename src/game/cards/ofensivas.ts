// Cartas ofensivas com alvo (016, SRS §10.6) — puras: MUTAM o clone e retornam se aplicaram.
// Despachadas por playHandCard (cards/draw.ts). Reação (Diplomacia) é spec 017 — "não pode recusar".
import { BOARD } from '@/lib/boardData'
import type { Square } from '@/lib/boardData'
import type { GameState } from '../turn/types'
import type { TurnPorts } from '../turn/resolution'
import { ownerOf } from '../economy/titles'
import { cityLevel } from '../economy/construction'
import { transferKeepFee } from '../economy/mortgage'
import { isTempImmune, isPlayerImmune, isEmbargoed, addTempEffect } from '../economy/tempEffects'
import { netWorth } from './effects'
import { logEvent } from '../log'
import { discountedByTin } from '../economy/rent'

function priceOf(sq: Square): number {
  return 'price' in sq ? sq.price : 0
}

// Quantas propriedades não-hipotecadas o jogador possui (gate da Aquisição Hostil, §10.6).
function nonMortgagedCount(state: GameState, ownerId: string): number {
  return BOARD.filter((sq) => 'price' in sq && state.titles[sq.pos]?.ownerId === ownerId && !state.titles[sq.pos]?.mortgaged).length
}

// Preço pago pela Aquisição — METADE da tabela (D-064); a sobretaxa ×1,5 de
// aeroporto/utilidade incide sobre a metade. + taxa de hipoteca (§6.3).
function acquireCost(state: GameState, pos: number): { price: number; fee: number } {
  const sq = BOARD[pos]
  const mult = sq.kind === 'airport' || sq.kind === 'utility' || sq.kind === 'mine' ? 1.5 : 1
  const price = Math.round(priceOf(sq) * 0.5 * mult)
  const fee = state.titles[pos]?.mortgaged ? transferKeepFee(sq) : 0
  return { price, fee }
}

// Gates da Aquisição Hostil (reusado pela interceptação de reação, 017).
export function canAcquire(state: GameState, attackerId: string, pos: number): boolean {
  const sq = BOARD[pos]
  if (!('price' in sq)) return false
  const owner = ownerOf(state, pos)
  if (owner === null || owner === attackerId) return false // de outro jogador (§577)
  if (isTempImmune(state, pos) || isPlayerImmune(state, owner)) return false // protegida (015) / Imunidade Total (D-064)
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
  // O `notice` é efêmero (a UI o dispensa); o histórico precisa do fato, com o valor (D-063).
  logEvent(state, { kind: 'hostile-takeover', who: attackerId, pos, amount: price + fee, victimId: owner })
  return true
}

// Confisco Geral (D-064, ex-Despejo): alvo é propriedade construída de outro jogador —
// cidade com qualquer nível OU aeroporto com Hangar. O terreno fica com o dono.
export function canConfiscate(state: GameState, attackerId: string, pos: number): boolean {
  const sq = BOARD[pos]
  const owner = ownerOf(state, pos)
  if (owner === null || owner === attackerId) return false
  if (isTempImmune(state, pos) || isPlayerImmune(state, owner)) return false // protegida (015) / Imunidade Total (D-064)
  const t = state.titles[pos]
  if (sq.kind === 'property') return cityLevel(t) > 0
  if (sq.kind === 'airport') return t.hangar
  return false
}

// Confisco Geral: demole TODAS as construções da propriedade (casas, hotéis, arranha-céu,
// Hangar); voltam ao banco; o dono mantém o terreno e não recebe nada.
export function confiscate(state: GameState, attackerId: string, pos: number): boolean {
  if (!canConfiscate(state, attackerId, pos)) return false
  const owner = ownerOf(state, pos)
  const t = state.titles[pos]
  t.houses = 0
  t.hotel = false
  t.hotel2 = false
  t.skyscraper = false
  t.hangar = false
  logEvent(state, { kind: 'evict', who: attackerId, pos, victimId: owner! }) // kind mantido (D-064): a narração muda, o fato não
  return true
}

export function canAudit(state: GameState, attackerId: string, targetId: string): boolean {
  if (targetId === attackerId) return false
  const target = state.players.find((p) => p.id === targetId)
  if (target && isPlayerImmune(state, targetId)) return false // Imunidade Total (D-064)
  return !!target && !target.eliminated
}

// Imposto Federal (D-064, ex-Auditoria Fiscal): o alvo paga 25% do patrimônio líquido ao pote.
export function audit(state: GameState, attackerId: string, targetId: string, ports: TurnPorts): boolean {
  if (!canAudit(state, attackerId, targetId)) return false
  const target = state.players.find((p) => p.id === targetId)!

  const owed = discountedByTin(state, targetId, Math.round(netWorth(state, targetId) * 0.25))
  // Truncagem MANTIDA de propósito (§9.1/D-061): o credor é o POTE, não um jogador — ninguém é
  // privado de receita a que a regra lhe deu direito, e cobrança incondicional que pode falir
  // transforma azar em eliminação. O que mudou é que agora o fato existe.
  const paid = Math.min(target.cash, owed) // sem caixa → paga o que houver
  target.cash -= paid
  ports.onPayToCenter(state, paid) // → pote (§13.4)
  logEvent(state, { kind: 'audit', who: attackerId, targetId, amount: paid })
  return true
}

// Sem construção alguma (nem Hangar) — elegibilidade dos dois lados da Permuta Forçada (D-064).
function unbuilt(state: GameState, pos: number): boolean {
  const t = state.titles[pos]
  return !!t && cityLevel(t) === 0 && !t.hangar
}

// Permuta Forçada (D-064): troca qualquer propriedade SUA por qualquer de um adversário,
// sem restrição de preço; nenhuma das duas pode ter construção. Hipotecada transfere (§6.3):
// quem recebe uma hipotecada paga a taxa de manutenção — o atacante precisa poder pagar a dele.
export function canSwap(state: GameState, attackerId: string, myPos: number, targetPos: number): boolean {
  const mySq = BOARD[myPos]
  const targetSq = BOARD[targetPos]
  if (!mySq || !targetSq || !('price' in mySq) || !('price' in targetSq)) return false
  if (ownerOf(state, myPos) !== attackerId) return false
  const owner = ownerOf(state, targetPos)
  if (owner === null || owner === attackerId) return false
  if (isTempImmune(state, targetPos) || isPlayerImmune(state, owner)) return false // protegida (015) / Imunidade Total
  if (!unbuilt(state, myPos) || !unbuilt(state, targetPos)) return false
  const attacker = state.players.find((p) => p.id === attackerId)
  const feeIn = state.titles[targetPos].mortgaged ? transferKeepFee(targetSq) : 0
  return !!attacker && attacker.cash >= feeIn
}

export function swap(state: GameState, attackerId: string, myPos: number, targetPos: number): boolean {
  if (!canSwap(state, attackerId, myPos, targetPos)) return false
  const victimId = ownerOf(state, targetPos)!
  const attacker = state.players.find((p) => p.id === attackerId)!
  const victim = state.players.find((p) => p.id === victimId)!
  // Taxa de transferência de hipoteca (§6.3) de cada lado, paga por quem RECEBE a hipotecada.
  // A do alvo é truncada ao caixa dele (§9.1: credor é o banco, cobrança incondicional).
  const feeIn = state.titles[targetPos].mortgaged ? transferKeepFee(BOARD[targetPos]) : 0
  const feeOut = state.titles[myPos].mortgaged ? transferKeepFee(BOARD[myPos]) : 0
  attacker.cash -= feeIn
  victim.cash -= Math.min(feeOut, victim.cash)
  state.titles[myPos].ownerId = victimId // mortgaged acompanha o título
  state.titles[targetPos].ownerId = attackerId
  logEvent(state, { kind: 'swap', who: attackerId, posGiven: myPos, posTaken: targetPos, victimId })
  return true
}

// Embargo de Obras (D-064): o alvo não pode construir por 2 voltas (relógio: GO do atacante,
// mesmo padrão do Boicote). Sem empilhar embargo sobre quem já está embargado.
export function canEmbargo(state: GameState, attackerId: string, targetId: string): boolean {
  if (targetId === attackerId) return false
  const target = state.players.find((p) => p.id === targetId)
  if (!target || target.eliminated) return false
  if (isPlayerImmune(state, targetId)) return false // Imunidade Total (D-064)
  return !isEmbargoed(state, targetId)
}

export function embargo(state: GameState, attackerId: string, targetId: string): boolean {
  if (!canEmbargo(state, attackerId, targetId)) return false
  addTempEffect(state, { kind: 'embargo', ownerId: attackerId, pos: null, lapsRemaining: 2, targetId })
  return true
}
