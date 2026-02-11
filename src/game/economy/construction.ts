// Construção — funções puras (clonam o estado). Build/sell de casas e hotel.
//
// VALORES DE TEMA (provisórios, research D3): o custo de construção e a tabela de
// aluguel por nível são dado de tema. Aqui o custo entra como `round(price/2)` e a
// tabela de aluguel vive em `rent.ts` (HOUSE_RENT_MULT/HOTEL_RENT_MULT). O tema
// substitui esses números sem mudar a regra (uniformidade, 70%/100%, metade na venda).
import { BOARD } from '@/lib/boardData'
import type { PropertySquare, GroupKey } from '@/lib/boardData'
import type { GameState } from '../turn/types'
import { activePlayer } from '../turn/turnMachine'
import { groupSize } from './titles'
import { THEME } from '../theme'

function clone(state: GameState): GameState {
  return structuredClone(state)
}

// Maioria do grupo: 2 (grupo de 3) / 3 (grupo de 4). 001 FR-013 / D-004.
function majority(size: number): number {
  return size === 4 ? 3 : 2
}

export function buildCost(square: PropertySquare): number {
  return Math.round(square.price * THEME.BUILD_COST_RATIO) // tema; Skyscraper usa o mesmo (≥ 2º hotel, §13.7)
}

export const HANGAR_COST = THEME.HANGAR_COST // §13.6; venda = metade ($50)

// Nível de construção da cidade (ladder estendido — 011): casas 0–4, hotel 5, 2º hotel 6, Skyscraper 7.
export function cityLevel(title: { houses: number; hotel: boolean; hotel2: boolean; skyscraper: boolean }): number {
  if (title.skyscraper) return 7
  if (title.hotel2) return 6
  if (title.hotel) return 5
  return title.houses
}

// Cidades do grupo possuídas pelo jogador.
function ownedGroupCities(state: GameState, group: GroupKey, ownerId: string): PropertySquare[] {
  return BOARD.filter(
    (s): s is PropertySquare => s.kind === 'property' && s.group === group && state.titles[s.pos]?.ownerId === ownerId,
  )
}

// Pode construir no grupo desta cidade? (dono ativo, maioria, nada hipotecado)
export function canBuild(state: GameState, pos: number): boolean {
  const sq = BOARD[pos]
  if (sq.kind !== 'property') return false
  const player = activePlayer(state)
  const title = state.titles[pos]
  if (!title || title.ownerId !== player.id) return false
  const cities = ownedGroupCities(state, sq.group, player.id)
  if (cities.length < majority(groupSize(sq.group))) return false // precisa da maioria
  if (cities.some((c) => state.titles[c.pos]?.mortgaged)) return false // nenhuma hipotecada
  return true
}

// Próxima cidade do grupo onde construir (a de menor nível — uniformidade). null se nenhuma.
export function nextBuildTarget(state: GameState, group: GroupKey, ownerId: string): number | null {
  const cities = ownedGroupCities(state, group, ownerId)
  if (cities.length === 0) return null
  const min = Math.min(...cities.map((c) => cityLevel(state.titles[c.pos])))
  if (min >= 7) return null // tudo já no topo (Skyscraper)
  const target = cities.find((c) => cityLevel(state.titles[c.pos]) === min)
  return target ? target.pos : null
}

// Pode construir 1 nível NESTA cidade? Encapsula a guarda de buildHouse (023):
// canBuild + nível<7 + uniformidade (menor nível do grupo) + caixa + estoque +
// (arranha-céu exige grupo completo). Não considera `paused` (o comando trata).
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
  if (player.cash < buildCost(sq)) return false
  if (cur === 6) return cities.length === groupSize(sq.group) // → Skyscraper exige grupo completo (§13.7)
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
  p.cash -= buildCost(sq)
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
  return s
}

// Pode construir Hangar? (aeroporto próprio, não-hipotecado, sem Hangar, com caixa) — 023.
export function canBuildHangar(state: GameState, pos: number): boolean {
  const sq = BOARD[pos]
  if (sq.kind !== 'airport') return false
  const player = activePlayer(state)
  const t = state.titles[pos]
  if (!t || t.ownerId !== player.id || t.mortgaged || t.hangar) return false
  return player.cash >= HANGAR_COST
}

// Pode vender Hangar? (aeroporto próprio com Hangar) — 023.
export function canSellHangar(state: GameState, pos: number): boolean {
  const sq = BOARD[pos]
  if (sq.kind !== 'airport') return false
  const player = activePlayer(state)
  const t = state.titles[pos]
  return !!t && t.ownerId === player.id && t.hangar
}

// Hangar (§13.6): melhoria de aeroporto que dobra o aluguel daquele aeroporto. No-op se inválido.
export function buildHangar(state: GameState, pos: number): GameState {
  if (state.paused) return state
  if (!canBuildHangar(state, pos)) return state
  const s = clone(state)
  activePlayer(s).cash -= HANGAR_COST
  s.titles[pos].hangar = true
  return s
}

export function sellHangar(state: GameState, pos: number): GameState {
  if (state.paused) return state
  if (!canSellHangar(state, pos)) return state
  const s = clone(state)
  activePlayer(s).cash += Math.round(HANGAR_COST / 2) // metade ($50)
  s.titles[pos].hangar = false
  return s
}

// Pode vender 1 nível NESTA cidade? (property própria, nível>0, uniformidade: maior nível do grupo) — 023.
export function canSellBuilding(state: GameState, pos: number): boolean {
  const sq = BOARD[pos]
  if (sq.kind !== 'property') return false
  const player = activePlayer(state)
  const title = state.titles[pos]
  if (!title || title.ownerId !== player.id) return false
  const cur = cityLevel(title)
  if (cur === 0) return false // nada para vender
  const cities = ownedGroupCities(state, sq.group, player.id)
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
  const p = activePlayer(s)
  const t = s.titles[pos]
  p.cash += Math.round(buildCost(sq as PropertySquare) / 2)

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
  return s
}
