// Seletor puro da UI de gestão de propriedade (023). Deriva, do estado e de uma
// posição, os dados reais do título + as FLAGS de habilitação de cada ação — todas
// vindas dos predicados puros do motor (fonte única). Consumido pelos popovers
// (renderizar/habilitar). Sem efeito, sem mutação. Padrão de playersView (020).
import type { GameState } from '@/game/turn/types'
import type { GroupKey } from '@/lib/boardData'
import {
  cityLevel,
  buildLevelLimit,
  buildCost,
  buildPaymentFor,
  canBuildHouse,
  canSellBuilding,
  canBuildHangar,
  canSellHangar,
} from '@/game/economy/construction'
import { mortgageValue, unmortgageCost, canMortgage, canUnmortgage } from '@/game/economy/mortgage'
import { groupSize } from '@/game/economy/titles'
import { activeBoard } from '@/game/ui/theme/boardTheme'

export interface DeedFlags {
  podeConstruir: boolean
  podeVender: boolean
  podeConstruirHangar: boolean
  podeVenderHangar: boolean
  podeHipotecar: boolean
  podeDeshipotecar: boolean
}

export type BuildBlock =
  | 'hipoteca-no-grupo'
  | 'topo'
  | 'uniformidade'
  | 'limite-posse'
  | 'grupo-incompleto'
  | 'caixa'
  | null

export interface DeedView {
  pos: number
  kind: 'property' | 'airport' | 'utility' | 'mine' // D-071: a mina também tem título
  owner: string | null
  ownedByActive: boolean
  mortgaged: boolean
  level: number // cityLevel 0–7 (property)
  hangar: boolean
  price: number
  buildCost: number // property
  mortgageValue: number
  unmortgageCost: number
  flags: DeedFlags
  buildBlock: BuildBlock // motivo de podeConstruir=false (p/ a dica)
}

function activeId(game: GameState): string {
  return game.players[game.turnOrder[game.activeSeat]].id
}

function groupCities(game: GameState, group: GroupKey, ownerId: string): number[] {
  return activeBoard().filter((s) => s.kind === 'property' && s.group === group && game.titles[s.pos]?.ownerId === ownerId).map(
    (s) => s.pos,
  )
}

const NO_FLAGS: DeedFlags = {
  podeConstruir: false,
  podeVender: false,
  podeConstruirHangar: false,
  podeVenderHangar: false,
  podeHipotecar: false,
  podeDeshipotecar: false,
}

// Motivo do bloqueio de construção (apenas para a dica) — espelha a ordem de
// checagem de canBuildHouse. Assume property do jogador da vez.
function buildBlock(game: GameState, pos: number): BuildBlock {
  const sq = activeBoard()[pos]
  if (sq.kind !== 'property') return null
  const owner = activeId(game)
  const cities = groupCities(game, sq.group, owner)
  const size = groupSize(sq.group)
  if (cities.some((p) => game.titles[p]?.mortgaged)) return 'hipoteca-no-grupo'
  const cur = cityLevel(game.titles[pos])
  if (cur >= 7) return 'topo'
  const min = Math.min(...cities.map((p) => cityLevel(game.titles[p])))
  if (cur !== min) return 'uniformidade'
  if (cur === 6 && cities.length !== size) return 'grupo-incompleto' // Skyscraper exige país completo
  if (cur >= buildLevelLimit(cities.length, size)) return 'limite-posse'
  const cash = game.players.find((pl) => pl.id === owner)?.cash ?? 0
  const player = game.players.find((pl) => pl.id === owner)
  if (cash < buildPaymentFor(game, sq, owner, player?.nextBuildFree === true)) return 'caixa'
  return null
}

export function deedView(game: GameState, pos: number): DeedView | null {
  const sq = activeBoard()[pos]
  // Disjunção explícita (e não `isRentableKind`) porque é ela que ESTREITA `sq` para o
  // union comprável — um predicado sobre `sq.kind` estreitaria só o campo, não o objeto.
  if (sq.kind !== 'property' && sq.kind !== 'airport' && sq.kind !== 'utility' && sq.kind !== 'mine') return null
  const title = game.titles[pos]
  const owner = title?.ownerId ?? null
  const ownedByActive = owner !== null && owner === activeId(game)

  const flags: DeedFlags = ownedByActive
    ? {
        podeConstruir: canBuildHouse(game, pos),
        podeVender: canSellBuilding(game, pos),
        podeConstruirHangar: canBuildHangar(game, pos),
        podeVenderHangar: canSellHangar(game, pos),
        podeHipotecar: canMortgage(game, pos),
        podeDeshipotecar: canUnmortgage(game, pos),
      }
    : NO_FLAGS

  return {
    pos,
    kind: sq.kind,
    owner,
    ownedByActive,
    mortgaged: title?.mortgaged ?? false,
    level: title ? cityLevel(title) : 0,
    hangar: title?.hangar ?? false,
    price: 'price' in sq ? sq.price : 0,
    buildCost: sq.kind === 'property' ? buildCost(sq) : 0,
    mortgageValue: mortgageValue(sq),
    unmortgageCost: unmortgageCost(sq),
    flags,
    buildBlock: ownedByActive && sq.kind === 'property' && !flags.podeConstruir ? buildBlock(game, pos) : null,
  }
}
