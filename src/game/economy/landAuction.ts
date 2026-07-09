// Leilão de escassez de TERRENOS (031, SRS §7.3) — pregão SIMULTÂNEO, EVENTO AUTÔNOMO.
// Vive em `state.landAuction`, fora da resolução de turno: abrir/fechar NÃO tocam no
// turno. Puro. NÃO confundir com o leilão de CASAS — removido na D-022.
//
// Cada lote tem seu PRÓPRIO prazo (`deadline`): um lance reinicia só o prazo daquele lote,
// e cada lote fecha sozinho quando o seu tempo expira (independente dos demais).
import { BOARD } from '@/lib/boardData'
import type { GameState } from '../turn/types'
import type { LandAuction, LandLot } from './types'
import { THEME } from '../theme'

export const LAND_AUCTION_WINDOW = THEME.LAND_AUCTION_SECONDS * 1000 // ms por lote (8s)

function clone(state: GameState): GameState {
  return structuredClone(state)
}

function cashOf(state: GameState, id: string): number {
  return state.players.find((p) => p.id === id)?.cash ?? 0
}

function aliveCount(state: GameState): number {
  return state.players.filter((p) => !p.eliminated).length
}

// Terrenos compráveis (cidade/aeroporto/utilidade) SEM dono.
export function freeLots(state: GameState): number[] {
  return BOARD.filter(
    (sq) =>
      (sq.kind === 'property' || sq.kind === 'airport' || sq.kind === 'utility') &&
      state.titles[sq.pos]?.ownerId == null,
  ).map((sq) => sq.pos)
}

// Caixa comprometido do jogador NOS OUTROS lotes (soma dos lances onde já é maior
// licitante), excluindo `exceptPos`. Base da trava de solvência e do "caixa disponível" da UI.
export function committedCash(state: GameState, playerId: string, exceptPos: number): number {
  const a = state.landAuction
  if (!a) return 0
  return a.lots.reduce(
    (sum, lot) => (lot.pos !== exceptPos && lot.highBidder === playerId ? sum + lot.currentBid : sum),
    0,
  )
}

// Gatilho (chamado pelo store após eventos que mudam posse). Abre o pregão se:
// 1 ≤ freeLots ≤ THRESHOLD, ≥2 vivos, sem pregão aberto e episódio armado.
// Cada lote nasce com seu próprio prazo (now + WINDOW).
// Re-arma (armed=true) quando freeLots > THRESHOLD (ex.: falência devolveu terreno). No-op senão.
export function maybeOpenLandAuction(state: GameState, now: number): GameState {
  if (state.landAuction) return state // um por vez
  const free = freeLots(state)
  const threshold = THEME.LAND_AUCTION_THRESHOLD

  if (free.length > threshold) {
    if (state.landAuctionArmed) return state
    const s = clone(state)
    s.landAuctionArmed = true // re-arma o episódio (a contagem subiu acima do limiar)
    return s
  }

  // free.length ≤ threshold
  if (free.length < 1) return state // nada a leiloar (guarda U1: nunca pregão vazio)
  if (!state.landAuctionArmed) return state // já disparou neste episódio
  if (aliveCount(state) < 2) return state // sem disputa possível

  const s = clone(state)
  const lots: LandLot[] = free.map((pos) => ({ pos, currentBid: 0, highBidder: null, deadline: now + LAND_AUCTION_WINDOW }))
  const auction: LandAuction = { lots, bidders: s.players.filter((p) => !p.eliminated).map((p) => p.id) }
  s.landAuction = auction
  s.landAuctionArmed = false // dispara 1×/episódio
  return s
}

// Lance num lote. No-op se inválido. Reinicia o prazo SÓ daquele lote (soft-close por lote).
// Regras (§7.2 + solvência): participante; amount > lance atual do lote (mínimo $1 ⇒ > 0);
// committedCash(outros) + amount ≤ caixa.
export function placeLandBid(
  state: GameState,
  playerId: string,
  pos: number,
  amount: number,
  now: number,
): GameState {
  const a = state.landAuction
  if (!a) return state
  if (!a.bidders.includes(playerId)) return state
  const lot = a.lots.find((l) => l.pos === pos)
  if (!lot) return state
  if (amount <= lot.currentBid) return state // deve superar o atual (e o mínimo $1)
  if (committedCash(state, playerId, pos) + amount > cashOf(state, playerId)) return state // solvência
  const s = clone(state)
  const sl = s.landAuction!.lots.find((l) => l.pos === pos)!
  sl.currentBid = amount
  sl.highBidder = playerId
  sl.deadline = now + LAND_AUCTION_WINDOW // reinicia SÓ este lote
  return s
}

// Resolve um lote: vencedor paga ao banco e vira dono; sem lance → fica livre.
function settleLot(s: GameState, lot: LandLot): void {
  if (lot.highBidder) {
    const winner = s.players.find((p) => p.id === lot.highBidder)
    // O lote roda em PARALELO ao turno normal (evento autônomo) — entre o lance e o
    // fecho, o licitante pode ter falido (elimination). Sem herdeiro válido, o lote
    // permanece livre (sem dono) em vez de ir para um jogador eliminado (FR-004g, 036).
    if (!winner || winner.eliminated) return
    // Solvência foi checada NO LANCE (placeLandBid); outra ação no meio-tempo pode ter
    // reduzido o caixa do licitante — paga o que houver em vez de ficar negativo (mesmo
    // padrão de audit()/pagamentos obrigatórios; FR-004a, 036).
    winner.cash -= Math.min(lot.currentBid, winner.cash)
    s.titles[lot.pos].ownerId = lot.highBidder
  }
}

// Fecha os lotes cujo prazo PRÓPRIO já expirou (deadline ≤ now): resolve e remove cada um.
// Quando não sobra lote, o pregão acaba (landAuction = null). No-op se nada expirou.
export function closeExpiredLandLots(state: GameState, now: number): GameState {
  const a = state.landAuction
  if (!a) return state
  if (!a.lots.some((l) => l.deadline <= now)) return state
  const s = clone(state)
  const sa = s.landAuction!
  for (const lot of sa.lots) if (lot.deadline <= now) settleLot(s, lot)
  sa.lots = sa.lots.filter((l) => l.deadline > now)
  if (sa.lots.length === 0) s.landAuction = null
  return s
}

// Fecha TODOS os lotes restantes de imediato (force-close). NÃO toca no turno.
export function closeLandAuction(state: GameState): GameState {
  if (!state.landAuction) return state
  const s = clone(state)
  for (const lot of s.landAuction!.lots) settleLot(s, lot)
  s.landAuction = null
  return s
}
