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

function clone(state: GameState): GameState {
  return structuredClone(state)
}

// Maioria do grupo: 2 (grupo de 3) / 3 (grupo de 4). 001 FR-013 / D-004.
function majority(size: number): number {
  return size === 4 ? 3 : 2
}

export function buildCost(square: PropertySquare): number {
  return Math.round(square.price / 2) // provisório (tema); Skyscraper usa o mesmo (≥ 2º hotel, §13.7)
}

export const HANGAR_COST = 100 // §13.6 (provisório de tema); venda = metade ($50)

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

// Constrói 1 nível na cidade subindo o ladder (casa → hotel → 2º hotel → Skyscraper).
// No-op se inválido. Uniformidade: constrói na cidade de menor nível do grupo (004).
export function buildHouse(state: GameState, pos: number): GameState {
  if (state.paused) return state
  if (!canBuild(state, pos)) return state
  const sq = BOARD[pos] as PropertySquare
  const player = activePlayer(state)
  const title = state.titles[pos]
  const cur = cityLevel(title)
  if (cur >= 7) return state // já é Skyscraper (máximo)
  const cities = ownedGroupCities(state, sq.group, player.id)
  const min = Math.min(...cities.map((c) => cityLevel(state.titles[c.pos])))
  if (cur !== min) return state // uniformidade
  const cost = buildCost(sq)
  if (player.cash < cost) return state

  // estoque + gates por nível alvo
  if (cur === 4) {
    if (state.bank.hotels < 1) return state // → hotel
  } else if (cur === 5) {
    if (state.bank.hotels < 1) return state // → 2º hotel (mesmo estoque, §14)
  } else if (cur === 6) {
    if (state.bank.skyscrapers < 1) return state // → Skyscraper
    if (cities.length !== groupSize(sq.group)) return state // exige GRUPO COMPLETO (§13.7)
  } else {
    if (state.bank.houses < 1) return state // → casa
  }

  const s = clone(state)
  const p = activePlayer(s)
  const t = s.titles[pos]
  p.cash -= cost
  if (cur === 4) {
    t.houses = 0
    t.hotel = true
    s.bank.houses += 4 // 4 casas voltam ao estoque
    s.bank.hotels -= 1
  } else if (cur === 5) {
    t.hotel2 = true // 2º hotel — não muda aluguel (§14.4)
    s.bank.hotels -= 1
  } else if (cur === 6) {
    t.skyscraper = true // marcador de topo — nada de hotéis volta (clarify)
    s.bank.skyscrapers -= 1
  } else {
    t.houses += 1
    s.bank.houses -= 1
  }
  return s
}

// Hangar (§13.6): melhoria de aeroporto que dobra o aluguel daquele aeroporto. No-op se inválido.
export function buildHangar(state: GameState, pos: number): GameState {
  if (state.paused) return state
  const sq = BOARD[pos]
  if (sq.kind !== 'airport') return state
  const player = activePlayer(state)
  const t = state.titles[pos]
  if (!t || t.ownerId !== player.id || t.mortgaged || t.hangar) return state // dono, não hipotecado, sem Hangar
  if (player.cash < HANGAR_COST) return state
  const s = clone(state)
  activePlayer(s).cash -= HANGAR_COST
  s.titles[pos].hangar = true
  return s
}

export function sellHangar(state: GameState, pos: number): GameState {
  if (state.paused) return state
  const sq = BOARD[pos]
  if (sq.kind !== 'airport') return state
  const player = activePlayer(state)
  const t = state.titles[pos]
  if (!t || t.ownerId !== player.id || !t.hangar) return state
  const s = clone(state)
  activePlayer(s).cash += Math.round(HANGAR_COST / 2) // metade ($50)
  s.titles[pos].hangar = false
  return s
}

// Vende 1 nível ao banco por metade. No-op se inválido. Desce o ladder: Skyscraper → 2º hotel
// → hotel → 4 casas (ou desmonte forçado §5.5) → casas.
export function sellBuilding(state: GameState, pos: number): GameState {
  if (state.paused) return state
  const sq = BOARD[pos]
  if (sq.kind !== 'property') return state
  const player = activePlayer(state)
  const title = state.titles[pos]
  if (!title || title.ownerId !== player.id) return state
  const cur = cityLevel(title)
  if (cur === 0) return state // nada para vender
  // uniformidade: só vende da de maior nível do grupo
  const cities = ownedGroupCities(state, sq.group, player.id)
  const max = Math.max(...cities.map((c) => cityLevel(state.titles[c.pos])))
  if (cur !== max) return state

  const s = clone(state)
  const p = activePlayer(s)
  const t = s.titles[pos]
  const refund = Math.round(buildCost(sq as PropertySquare) / 2)

  if (cur === 7) {
    // Skyscraper → 2º hotel: devolve só 1 Skyscraper (nada de hotéis, clarify)
    t.skyscraper = false
    s.bank.skyscrapers += 1
    p.cash += refund
  } else if (cur === 6) {
    // 2º hotel → hotel: devolve 1 hotel ao estoque
    t.hotel2 = false
    s.bank.hotels += 1
    p.cash += refund
  } else if (t.hotel) {
    if (s.bank.houses >= 4) {
      t.hotel = false
      t.houses = 4
      s.bank.houses -= 4
      s.bank.hotels += 1
      p.cash += refund
    } else {
      // §5.5 — desmonte forçado de TODOS os hotéis do grupo, simultaneamente
      for (const c of cities) {
        const ct = s.titles[c.pos]
        if (ct.hotel) {
          ct.hotel = false
          ct.houses = 0
          s.bank.hotels += 1
          p.cash += Math.round(buildCost(c) / 2)
        }
      }
    }
  } else {
    t.houses -= 1
    s.bank.houses += 1
    p.cash += refund
  }
  return s
}
