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
  return Math.round(square.price / 2) // provisório (tema)
}

// Nível numérico para uniformidade: casas 0–4, hotel = 5.
function levelNum(title: { houses: number; hotel: boolean }): number {
  return title.hotel ? 5 : title.houses
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
  const min = Math.min(...cities.map((c) => levelNum(state.titles[c.pos])))
  if (min >= 5) return null // tudo já em hotel
  const target = cities.find((c) => levelNum(state.titles[c.pos]) === min)
  return target ? target.pos : null
}

// Constrói 1 nível na cidade (casa, ou hotel se já tem 4 casas). No-op se inválido.
export function buildHouse(state: GameState, pos: number): GameState {
  if (!canBuild(state, pos)) return state
  const sq = BOARD[pos] as PropertySquare
  const player = activePlayer(state)
  const title = state.titles[pos]
  const cur = levelNum(title)
  if (cur >= 5) return state // já é hotel
  // uniformidade: só constrói na de menor nível do grupo
  const min = Math.min(...ownedGroupCities(state, sq.group, player.id).map((c) => levelNum(state.titles[c.pos])))
  if (cur !== min) return state
  const cost = buildCost(sq)
  if (player.cash < cost) return state
  const buildingHotel = cur === 4
  if (buildingHotel ? state.bank.hotels < 1 : state.bank.houses < 1) return state // sem estoque

  const s = clone(state)
  const p = activePlayer(s)
  const t = s.titles[pos]
  p.cash -= cost
  if (buildingHotel) {
    t.houses = 0
    t.hotel = true
    s.bank.houses += 4 // 4 casas voltam ao estoque
    s.bank.hotels -= 1
  } else {
    t.houses += 1
    s.bank.houses -= 1
  }
  return s
}

// Vende 1 nível ao banco por metade. No-op se inválido. Hotel → 4 casas, ou desmonte
// forçado de todos os hotéis do grupo quando faltam casas no banco (§5.5).
export function sellBuilding(state: GameState, pos: number): GameState {
  const sq = BOARD[pos]
  if (sq.kind !== 'property') return state
  const player = activePlayer(state)
  const title = state.titles[pos]
  if (!title || title.ownerId !== player.id) return state
  const cur = levelNum(title)
  if (cur === 0) return state // nada para vender
  // uniformidade: só vende da de maior nível do grupo
  const cities = ownedGroupCities(state, sq.group, player.id)
  const max = Math.max(...cities.map((c) => levelNum(state.titles[c.pos])))
  if (cur !== max) return state

  const s = clone(state)
  const p = activePlayer(s)
  const t = s.titles[pos]
  const refund = Math.round(buildCost(sq as PropertySquare) / 2)

  if (t.hotel) {
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
