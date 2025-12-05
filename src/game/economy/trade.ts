// Negociação — troca de propriedades + caixa entre dois jogadores (013, SRS §8). Puro/atômico.
// Representa um acordo JÁ ACEITO (UX propor/aceitar/recusar é UI/multiplayer). Não gated por turno.
// Cartas/Bus Tickets/empréstimos NÃO são negociáveis (D-011/D-012) — não existem no payload.
import { BOARD } from '@/lib/boardData'
import type { GameState } from '../turn/types'
import { ownerOf } from './titles'
import { cityLevel } from './construction'
import { transferKeepFee } from './mortgage'

// Concessão de imunidade de aluguel dentro da troca (014, §8.4): sobre propriedade própria
// mantida, por `laps` voltas (inteiro > 0) ou permanente (`null`).
export interface ImmunityGrant {
  pos: number
  laps: number | null
}

export interface Trade {
  fromId: string
  toId: string
  fromProps: number[] // posições que `from` oferece
  fromCash: number // ≥ 0
  toProps: number[] // posições que `to` oferece
  toCash: number // ≥ 0
  fromImmunities?: ImmunityGrant[] // concedidas por `from` → beneficiário `to` (014)
  toImmunities?: ImmunityGrant[] // concedidas por `to` → beneficiário `from`
}

function clone(state: GameState): GameState {
  return structuredClone(state)
}

// Soma das taxas de transferência (10%) das propriedades HIPOTECADAS da lista (§6.3).
function mortgageFees(state: GameState, props: number[]): number {
  let fee = 0
  for (const p of props) if (state.titles[p]?.mortgaged) fee += transferKeepFee(BOARD[p])
  return fee
}

// Validação: lista pertence ao dono e nenhuma cidade tem construção (não-negociável, §8.2).
function ownsAllSemConstrucao(state: GameState, props: number[], ownerId: string): boolean {
  for (const p of props) {
    const sq = BOARD[p]
    if (!('price' in sq)) return false // não é propriedade
    if (ownerOf(state, p) !== ownerId) return false
    if (sq.kind === 'property' && cityLevel(state.titles[p]) > 0) return false // construção bloqueia
  }
  return true
}

// Imunidade só sobre propriedade PRÓPRIA que o concedente MANTÉM (não está cedendo na troca). §8.4
function validImmunityGrants(
  state: GameState,
  grants: ImmunityGrant[] | undefined,
  granterId: string,
  granterProps: number[],
): boolean {
  for (const g of grants ?? []) {
    const sq = BOARD[g.pos]
    if (!('price' in sq)) return false
    if (ownerOf(state, g.pos) !== granterId) return false // tem que ser própria
    if (granterProps.includes(g.pos)) return false // não pode estar cedendo essa propriedade
    if (g.laps !== null && (!Number.isInteger(g.laps) || g.laps <= 0)) return false // N voltas > 0 ou permanente
  }
  return true
}

export function executeTrade(state: GameState, trade: Trade): GameState {
  if (state.paused) return state
  const { fromId, toId, fromProps, fromCash, toProps, toCash } = trade
  if (fromId === toId) return state
  if (!Number.isInteger(fromCash) || fromCash < 0 || !Number.isInteger(toCash) || toCash < 0) return state

  const from = state.players.find((p) => p.id === fromId)
  const to = state.players.find((p) => p.id === toId)
  if (!from || !to || from.eliminated || to.eliminated) return state
  if (!ownsAllSemConstrucao(state, fromProps, fromId)) return state
  if (!ownsAllSemConstrucao(state, toProps, toId)) return state
  if (from.cash < fromCash || to.cash < toCash) return state // não oferecer mais do que tem
  if (!validImmunityGrants(state, trade.fromImmunities, fromId, fromProps)) return state // §8.4
  if (!validImmunityGrants(state, trade.toImmunities, toId, toProps)) return state

  const feesFrom = mortgageFees(state, toProps) // `from` recebe `toProps` → paga 10% das hipotecadas
  const feesTo = mortgageFees(state, fromProps) // `to` recebe `fromProps`
  const finalFrom = from.cash - fromCash + toCash - feesFrom
  const finalTo = to.cash - toCash + fromCash - feesTo
  if (finalFrom < 0 || finalTo < 0) return state // taxas deixariam alguém negativo

  const s = clone(state)
  for (const p of fromProps) s.titles[p].ownerId = toId // mortgaged/hangar acompanham
  for (const p of toProps) s.titles[p].ownerId = fromId
  s.players.find((p) => p.id === fromId)!.cash = finalFrom
  s.players.find((p) => p.id === toId)!.cash = finalTo // taxas removidas (banco)
  for (const g of trade.fromImmunities ?? []) s.immunities.push({ beneficiaryId: toId, pos: g.pos, lapsRemaining: g.laps })
  for (const g of trade.toImmunities ?? []) s.immunities.push({ beneficiaryId: fromId, pos: g.pos, lapsRemaining: g.laps })
  return s
}
