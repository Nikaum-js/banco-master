// Leilão de escassez de TERRENOS (031, SRS §7.3) — pregão SIMULTÂNEO, EVENTO AUTÔNOMO.
// Vive em `state.landAuction`, fora da resolução de turno: abrir/fechar NÃO tocam no
// turno. Puro. NÃO confundir com o leilão de CASAS — removido na D-022.
//
// Cada lote tem seu PRÓPRIO prazo (`deadline`): um lance reinicia só o prazo daquele lote,
// e cada lote fecha sozinho quando o seu tempo expira (independente dos demais).
import { BOARD } from '@/lib/boardData'
import { isRentableKind } from '@/game/economy/titles'
import type { GameState } from '../turn/types'
import type { AuctionOrigin, LandAuction, LandLot } from './types'
import { THEME } from '../theme'
import { logEvent } from '../log'

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
      isRentableKind(sq.kind) &&
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

/**
  * Quantos terrenos livres AINDA precisam ser comprados para o pregão de escassez disparar
  * (§7.5, D-060). É o número que a interface mostra enquanto não há pregão aberto.
  *
  * O motor é a fonte de verdade — a UI não recomputa contagem de tabuleiro. Nunca negativo, e
  * `0` significa "o gatilho está armado neste instante": a próxima compra abre o pregão.
  *
  * `null` quando não faz sentido contar: já há pregão aberto (a UI mostra o leilão, não o
  * contador), o episódio está gasto (`landAuctionArmed === false`, não vai disparar por mais
  * compras que aconteçam), não há terreno livre nenhum, ou a mesa não tem disputa possível.
  * Distinguir "faltam 0" de "não vai acontecer" é a diferença entre informar e mentir.
  */
export function lotsUntilScarcityAuction(state: GameState): number | null {
  if (state.landAuction) return null // pregão em curso — o contador dá lugar ao estado do leilão
  if (!state.landAuctionArmed) return null // episódio gasto: não dispara nesta descida
  if (aliveCount(state) < 2) return null // sem disputa possível
  const free = freeLots(state).length
  if (free < 1) return null // nada a leiloar (guarda U1)
  return Math.max(0, free - THEME.LAND_AUCTION_THRESHOLD)
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
  const auction: LandAuction = {
    lots,
    bidders: s.players.filter((p) => !p.eliminated).map((p) => p.id),
    origin: 'scarcity',
    bankruptId: null,
  }
  s.landAuction = auction
  s.landAuctionArmed = false // dispara 1×/episódio
  return s
}

// Abre OU injeta o pregão do ESPÓLIO de um falido (039, SRS §9.2 / D-031).
//
// Um só ponto de entrada para os dois casos porque o chamador não deveria precisar saber em
// qual está: se não há pregão, cria; se há, acrescenta lotes ao que está em curso (o formato
// simultâneo já é indiferente a lotes com prazos distintos).
//
// Recusar é SEGURO e não precisa ser comunicado ao chamador: um lote em pregão e uma
// propriedade no banco têm o MESMO estado de título (`ownerId: null`) — o que os distingue é
// só estar ou não em `landAuction.lots`. Então quando uma guarda recusa, as propriedades já
// estão exatamente onde o comportamento anterior à 039 as deixava, sem limbo possível.
//
// PRÉ-CONDIÇÃO: `state` já deve ter o falido marcado `eliminated` — a guarda de "≥2 vivos"
// conta sobre este estado, e é assim que um espólio numa mesa de 2 corretamente não abre
// pregão (sobrou 1 vivo → §9.5, fim de jogo tem precedência).
export function openEstateAuction(
  state: GameState,
  positions: number[],
  now: number,
  bankruptId: string,
): GameState {
  const none = state
  if (positions.length === 0) return none // FR-005
  if (aliveCount(state) < 2) return none // FR-006 — sem disputa possível

  // FR-019: posição que já é lote no pregão em curso não entra de novo. A interseção deveria
  // ser vazia (lote de escassez é propriedade SEM dono; o espólio só produz propriedades que
  // TINHAM dono), mas "deveria" é o tipo de invariante que um dia deixa de valer em silêncio.
  const open = new Set(state.landAuction?.lots.map((l) => l.pos) ?? [])
  const fresh = [...new Set(positions)].filter((pos) => !open.has(pos))
  if (fresh.length === 0) return none

  const s = clone(state)
  const lots: LandLot[] = fresh.map((pos) => ({ pos, currentBid: 0, highBidder: null, deadline: now + LAND_AUCTION_WINDOW }))
  const bidders = s.players.filter((p) => !p.eliminated).map((p) => p.id)

  if (!s.landAuction) {
    s.landAuction = { lots, bidders, origin: 'bankruptcy', bankruptId }
  } else {
    const a = s.landAuction
    a.lots.push(...lots) // prazos dos lotes preexistentes ficam INTACTOS (FR-016)
    a.bidders = bidders // FR-017 — o recém-falido sai inclusive dos lotes que já estavam lá
    a.origin = a.origin === 'scarcity' ? 'mixed' : a.origin // FR-020
    a.bankruptId = bankruptId
  }
  // FR-018: `landAuctionArmed` NÃO é tocado — um pregão de falência não pode desarmar o
  // pregão de escassez que ainda não aconteceu.
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
// `origin` vem da `LandAuction` (não do `LandLot`) — precisa ser passado porque
// `state.landAuction` pode já ter sido esvaziado quando o evento é montado (D5 do plan).
function settleLot(s: GameState, lot: LandLot, origin: AuctionOrigin): void {
  if (lot.highBidder) {
    const winner = s.players.find((p) => p.id === lot.highBidder)
    // O lote roda em PARALELO ao turno normal (evento autônomo) — entre o lance e o
    // fecho, o licitante pode ter falido (elimination). Sem herdeiro válido, o lote
    // permanece livre (sem dono) em vez de ir para um jogador eliminado (FR-004g, 036).
    if (!winner || winner.eliminated) {
      logEvent(s, { kind: 'lot-unsold', who: 'bank', pos: lot.pos, origin })
      return
    }
    // Solvência foi checada NO LANCE (placeLandBid); outra ação no meio-tempo pode ter
    // reduzido o caixa do licitante — paga o que houver em vez de ficar negativo (mesmo
    // padrão de audit()/pagamentos obrigatórios; FR-004a, 036).
    const paid = Math.min(lot.currentBid, winner.cash)
    winner.cash -= paid
    s.titles[lot.pos].ownerId = lot.highBidder
    logEvent(s, { kind: 'lot-won', who: 'bank', pos: lot.pos, amount: paid, winnerId: lot.highBidder, origin })
  } else {
    logEvent(s, { kind: 'lot-unsold', who: 'bank', pos: lot.pos, origin })
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
  for (const lot of sa.lots) if (lot.deadline <= now) settleLot(s, lot, sa.origin)
  sa.lots = sa.lots.filter((l) => l.deadline > now)
  if (sa.lots.length === 0) s.landAuction = null
  return s
}

// Fecha TODOS os lotes restantes de imediato (force-close). NÃO toca no turno.
export function closeLandAuction(state: GameState): GameState {
  if (!state.landAuction) return state
  const s = clone(state)
  const origin = s.landAuction!.origin
  for (const lot of s.landAuction!.lots) settleLot(s, lot, origin)
  s.landAuction = null
  return s
}
