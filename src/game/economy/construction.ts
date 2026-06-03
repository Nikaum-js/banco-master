// Construção — funções puras (clonam o estado). Build/sell de casas e hotel.
//
// VALORES DE TEMA (032/D-024): o custo de casa é um **tier por grupo** (`THEME.HOUSE_COST`,
// não mais proporcional ao preço) e a tabela de aluguel por nível vem da FONTE ÚNICA
// `rentLadder` (`rent.ts`, `THEME.RENT_MULT` por grupo). Custos e aluguel seguem calibráveis
// no tema; elegibilidade e uniformidade permanecem centralizadas neste módulo.
import { BOARD } from '@/lib/boardData'
import type { PropertySquare, GroupKey } from '@/lib/boardData'
import type { GameState } from '../turn/types'
import { activePlayer } from '../turn/turnMachine'
import { liquidatorOf } from '../falencia/falencia'
import { groupSize } from './titles'
import { ownsMine } from './rent'
import { isEmbargoed } from './tempEffects'
import { THEME } from '../theme'
import { logEvent } from '../log'

function clone(state: GameState): GameState {
  return structuredClone(state)
}

export function buildCost(square: PropertySquare): number {
  return THEME.HOUSE_COST[square.group] // tier fixo por grupo (032); todos os níveis usam o mesmo custo
}

/**
 * Custo de construção JÁ com o bônus da Mina de Ferro (D-071): quem tem o ferro da cidade
 * constrói 25% mais barato. É o único dos quatro passivos que age no custo e não no
 * aluguel, e por isso precisa do estado (a posse) que `buildCost` puro não tem.
 *
 * Toda decisão de caixa — a guarda de `canBuildHouse` e o débito de `buildHouse` — usa
 * ESTA, nunca `buildCost` direto: se as duas divergirem, o botão libera uma construção que
 * o jogador não paga (ou cobra o que ele não devia).
 */
export function buildCostFor(state: GameState, square: PropertySquare, ownerId: string): number {
  const base = buildCost(square)
  return ownsMine(state, 'ferro', ownerId) ? Math.round(base * THEME.MINE_BONUS.ferro) : base
}

/** Saída total de caixa da próxima construção. */
export function buildPaymentFor(
  state: GameState,
  square: PropertySquare,
  ownerId: string,
  buildIsFree = false,
): number {
  return buildIsFree ? 0 : buildCostFor(state, square, ownerId)
}

export const HANGAR_COST = THEME.HANGAR_COST // §13.6; venda = metade ($50)

// Nível de construção da cidade (ladder estendido — 011): casas 0–4, hotel 5, 2º hotel 6, Skyscraper 7.
export function cityLevel(title: { houses: number; hotel: boolean; hotel2: boolean; skyscraper: boolean }): number {
  if (title.skyscraper) return 7
  if (title.hotel2) return 6
  if (title.hotel) return 5
  return title.houses
}

// D-050: país incompleto libera um nível por cidade possuída; país completo libera
// toda a escada. Derivado, nunca persistido, para snapshots antigos continuarem válidos.
export function buildLevelLimit(ownedCount: number, totalCount: number): number {
  if (ownedCount <= 0 || totalCount <= 0) return 0
  return ownedCount >= totalCount ? 7 : ownedCount
}

// Cidades do grupo possuídas pelo jogador.
function ownedGroupCities(state: GameState, group: GroupKey, ownerId: string): PropertySquare[] {
  return BOARD.filter(
    (s): s is PropertySquare => s.kind === 'property' && s.group === group && state.titles[s.pos]?.ownerId === ownerId,
  )
}

// Pode construir no grupo desta cidade? (dono ativo, nada hipotecado no que possui)
// 034: NÃO exige mais a maioria do país — basta ser dono da cidade; o aluguel é que
// escala pela posse (rent.ts/posseFactor). Arranha-céu ainda exige país completo (canBuildHouse).
export function canBuild(state: GameState, pos: number): boolean {
  const sq = BOARD[pos]
  if (sq.kind !== 'property') return false
  const player = activePlayer(state)
  if (isEmbargoed(state, player.id)) return false // Embargo de Obras (D-064): 2 voltas sem construir
  const title = state.titles[pos]
  if (!title || title.ownerId !== player.id) return false
  const cities = ownedGroupCities(state, sq.group, player.id)
  if (cities.some((c) => state.titles[c.pos]?.mortgaged)) return false // nenhuma hipotecada
  return true
}

// Pode construir 1 nível NESTA cidade? Encapsula a guarda de buildHouse (023):
// canBuild + nível<7 + uniformidade (menor nível do grupo) + teto de posse + caixa.
// Não considera `paused` (o comando trata).
export function canBuildHouse(state: GameState, pos: number): boolean {
  if (!canBuild(state, pos)) return false
  const sq = BOARD[pos]
  if (sq.kind !== 'property') return false
  const player = activePlayer(state)
  const cur = cityLevel(state.titles[pos])
  if (cur >= 7) return false // já é Skyscraper (máximo)
  const cities = ownedGroupCities(state, sq.group, player.id)
  const min = Math.min(...cities.map((c) => cityLevel(state.titles[c.pos])))
  if (cur !== min) return false // uniformidade
  const size = groupSize(sq.group)
  if (cur === 6 && cities.length !== size) return false // → Skyscraper exige grupo completo (§13.7)
  if (cur >= buildLevelLimit(cities.length, size)) return false // D-050: teto enquanto país incompleto
  const payment = buildPaymentFor(state, sq, player.id, player.nextBuildFree === true)
  if (player.cash < payment) return false
  return true // casas/hotéis/arranha-céus são ilimitados (sem estoque do banco)
}

// Constrói 1 nível na cidade subindo o ladder (casa → hotel → 2º hotel → Skyscraper).
// No-op se inválido. Uniformidade: constrói na cidade de menor nível do grupo (004).
export function buildHouse(state: GameState, pos: number): GameState {
  if (state.paused) return state
  if (!canBuildHouse(state, pos)) return state
  const sq = BOARD[pos] as PropertySquare
  const cur = cityLevel(state.titles[pos])
  const s = clone(state)
  const p = activePlayer(s)
  const t = s.titles[pos]
  const cost = p.nextBuildFree ? 0 : buildCostFor(s, sq, p.id) // Obra Relâmpago (D-064) + Mina de Ferro (D-071)
  if (p.nextBuildFree) delete p.nextBuildFree
  p.cash -= cost
  if (cur === 4) {
    t.houses = 0
    t.hotel = true // 4 casas viram 1 hotel
  } else if (cur === 5) {
    t.hotel2 = true // 2º hotel — cobra mais que o 1º (§14.4)
  } else if (cur === 6) {
    t.skyscraper = true // 2 hotéis viram 1 arranha-céu — topo (1 por propriedade)
  } else {
    t.houses += 1
  }
  const level = cityLevel(t)
  logEvent(s, { kind: 'build', who: p.id, pos, level, cost })
  return s
}

// Pode construir Hangar? (aeroporto próprio, não-hipotecado, sem Hangar, com caixa) — 023.
export function canBuildHangar(state: GameState, pos: number): boolean {
  const sq = BOARD[pos]
  if (sq.kind !== 'airport') return false
  const player = activePlayer(state)
  if (isEmbargoed(state, player.id)) return false // Embargo de Obras (D-064)
  const t = state.titles[pos]
  if (!t || t.ownerId !== player.id || t.mortgaged || t.hangar) return false
  return player.nextBuildFree === true || player.cash >= HANGAR_COST // Obra Relâmpago (D-064)
}

// Pode vender Hangar? (aeroporto próprio com Hangar) — 023.
export function canSellHangar(state: GameState, pos: number): boolean {
  const sq = BOARD[pos]
  if (sq.kind !== 'airport') return false
  const ownerId = liquidatorOf(state) // levantar caixa: o devedor, se houver dívida (§9.1/D-061)
  const t = state.titles[pos]
  return !!t && t.ownerId === ownerId && t.hangar
}

// Hangar (§13.6): melhoria de aeroporto que dobra o aluguel daquele aeroporto. No-op se inválido.
export function buildHangar(state: GameState, pos: number): GameState {
  if (state.paused) return state
  if (!canBuildHangar(state, pos)) return state
  const s = clone(state)
  const p = activePlayer(s)
  const cost = p.nextBuildFree ? 0 : HANGAR_COST // Obra Relâmpago (D-064)
  if (p.nextBuildFree) delete p.nextBuildFree
  p.cash -= cost
  s.titles[pos].hangar = true
  logEvent(s, { kind: 'build-hangar', who: p.id, pos, cost })
  return s
}

export function sellHangar(state: GameState, pos: number): GameState {
  if (state.paused) return state
  if (!canSellHangar(state, pos)) return state
  const s = clone(state)
  const p = s.players.find((x) => x.id === liquidatorOf(s))! // o devedor, se houver dívida
  const amount = Math.round(HANGAR_COST / 2) // metade ($50)
  p.cash += amount
  s.titles[pos].hangar = false
  logEvent(s, { kind: 'sell-hangar', who: p.id, pos, amount })
  return s
}

// Pode vender 1 nível NESTA cidade? (property própria, nível>0, uniformidade: maior nível do grupo) — 023.
export function canSellBuilding(state: GameState, pos: number): boolean {
  const sq = BOARD[pos]
  if (sq.kind !== 'property') return false
  // Vender construção é LEVANTAR caixa: com dívida pendente, quem vende é o DEVEDOR nomeado
  // (§9.1/D-061), que pode não ser o jogador da vez. Ver `liquidatorOf`.
  const ownerId = liquidatorOf(state)
  const title = state.titles[pos]
  if (!title || title.ownerId !== ownerId) return false
  const cur = cityLevel(title)
  if (cur === 0) return false // nada para vender
  const cities = ownedGroupCities(state, sq.group, ownerId)
  const max = Math.max(...cities.map((c) => cityLevel(state.titles[c.pos])))
  return cur === max // só vende da de maior nível do grupo
}

// Vende 1 nível ao banco por metade. No-op se inválido. Desce o ladder:
// arranha-céu → 2º hotel → 1º hotel → 4 casas → casas.
export function sellBuilding(state: GameState, pos: number): GameState {
  if (state.paused) return state
  if (!canSellBuilding(state, pos)) return state
  const sq = BOARD[pos]
  const cur = cityLevel(state.titles[pos])

  const s = clone(state)
  const p = s.players.find((x) => x.id === liquidatorOf(s))! // o devedor, se houver dívida
  const t = s.titles[pos]
  const amount = Math.round(buildCost(sq as PropertySquare) / 2)
  p.cash += amount

  if (cur === 7) {
    t.skyscraper = false // arranha-céu → 2º hotel
  } else if (cur === 6) {
    t.hotel2 = false // 2º hotel → 1º hotel
  } else if (t.hotel) {
    t.hotel = false
    t.houses = 4 // 1º hotel → 4 casas
  } else {
    t.houses -= 1
  }
  logEvent(s, { kind: 'sell-building', who: p.id, pos, level: cityLevel(t), amount })
  return s
}
