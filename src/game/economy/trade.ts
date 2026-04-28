// Negociação — troca de propriedades + caixa + Bus Tickets entre dois jogadores
// (013, SRS §8). Puro/atômico. Representa um acordo JÁ ACEITO (UX propor/aceitar/
// recusar é UI/multiplayer). Não gated por turno.
// Cartas/empréstimos NÃO são negociáveis (D-011); Bus Tickets SÃO (D-028, §8.2).
import { BOARD } from '@/lib/boardData'
import type { GameState } from '../turn/types'
import type { Trade, ImmunityGrant } from './types'
import { ownerOf } from './titles'
import { cityLevel } from './construction'
import { transferKeepFee } from './mortgage'
import { hasImmunity } from './imunidade'
import { activePlayer } from '../turn/turnMachine'
import { liquidationValue } from '../falencia/falencia'
import { logEvent } from '../log'

// `Trade` vive em ./types (024, p/ o GameState referenciar sem ciclo).
// Re-exportado aqui para preservar o ponto de import público já usado.
export type { Trade } from './types'

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

// Transferência de imunidade existente (028, §8.4): cada pos deve ser uma imunidade
// ATIVA cujo beneficiário é o transferente. Reusa hasImmunity (014).
function validImmunityTransfers(
  state: GameState,
  transfers: number[] | undefined,
  beneficiaryId: string,
): boolean {
  return (transfers ?? []).every((pos) => hasImmunity(state, beneficiaryId, pos))
}

// Saldos finais após dinheiro + taxas de hipoteca (10%) das propriedades recebidas.
function finalCash(state: GameState, trade: Trade): { from: number; to: number } | null {
  const from = state.players.find((p) => p.id === trade.fromId)
  const to = state.players.find((p) => p.id === trade.toId)
  if (!from || !to) return null
  const feesFrom = mortgageFees(state, trade.toProps) // `from` recebe `toProps`
  const feesTo = mortgageFees(state, trade.fromProps) // `to` recebe `fromProps`
  return {
    from: from.cash - trade.fromCash + trade.toCash - feesFrom,
    to: to.cash - trade.toCash + trade.fromCash - feesTo,
  }
}

// Proposta bem-formada e aplicável? (024) Guarda única, espelha as condições do
// executeTrade. Não considera `paused` (concern do comando).
export function validateTrade(state: GameState, trade: Trade): boolean {
  const { fromId, toId, fromProps, fromCash, toProps, toCash } = trade
  const fromBus = trade.fromBusTickets ?? 0
  const toBus = trade.toBusTickets ?? 0
  if (fromId === toId) return false
  if (!Number.isInteger(fromCash) || fromCash < 0 || !Number.isInteger(toCash) || toCash < 0) return false
  if (!Number.isInteger(fromBus) || fromBus < 0 || !Number.isInteger(toBus) || toBus < 0) return false // D-028
  const from = state.players.find((p) => p.id === fromId)
  const to = state.players.find((p) => p.id === toId)
  if (!from || !to || from.eliminated || to.eliminated) return false
  if (!ownsAllSemConstrucao(state, fromProps, fromId)) return false
  if (!ownsAllSemConstrucao(state, toProps, toId)) return false
  if (from.cash < fromCash || to.cash < toCash) return false // não oferecer mais do que tem
  if (from.busTickets < fromBus || to.busTickets < toBus) return false // idem para tickets (D-028)
  if (!validImmunityGrants(state, trade.fromImmunities, fromId, fromProps)) return false // §8.4
  if (!validImmunityGrants(state, trade.toImmunities, toId, toProps)) return false
  if (!validImmunityTransfers(state, trade.fromImmunityTransfers, fromId)) return false // §8.4 transferência
  if (!validImmunityTransfers(state, trade.toImmunityTransfers, toId)) return false
  const fin = finalCash(state, trade)
  if (!fin || fin.from < 0 || fin.to < 0) return false // taxas deixariam alguém negativo
  // Proteção do credor (§9.1): com dívida pendente, troca envolvendo o DEVEDOR (jogador
  // ativo) só vale se ele CONTINUAR capaz de cobrir a dívida após a troca — bloqueia doar
  // ativos antes de declarar falência; trocas que levantam caixa seguem válidas.
  if (state.resolution?.kind === 'debt') {
    const debtorId = activePlayer(state).id
    if ((fromId === debtorId || toId === debtorId) && liquidationValue(applyTrade(state, trade), debtorId) < state.resolution.amount)
      return false
  }
  return true
}

// Propriedades do dono que podem entrar numa troca: sem construção (cidades nível 0). §8.2
export function tradableProps(state: GameState, ownerId: string): number[] {
  const out: number[] = []
  for (const sq of BOARD) {
    if (!('price' in sq)) continue
    if (ownerOf(state, sq.pos) !== ownerId) continue
    if (sq.kind === 'property' && cityLevel(state.titles[sq.pos]) > 0) continue
    out.push(sq.pos)
  }
  return out
}

// Aplica a troca SEM validar — núcleo compartilhado por executeTrade e pela projeção
// de solvência do devedor em validateTrade. Pré-condição: finalCash não-nulo (validado antes).
function applyTrade(state: GameState, trade: Trade): GameState {
  const { fromId, toId, fromProps, toProps } = trade
  const fin = finalCash(state, trade)!

  const s = clone(state)
  for (const p of fromProps) s.titles[p].ownerId = toId // mortgaged/hangar acompanham
  for (const p of toProps) s.titles[p].ownerId = fromId
  const fromP = s.players.find((p) => p.id === fromId)!
  const toP = s.players.find((p) => p.id === toId)!
  fromP.cash = fin.from
  toP.cash = fin.to // taxas removidas (banco)
  // Bus Tickets trocam de mão como contadores (D-028) — sem taxa, sem limite (§10.7).
  const busDelta = (trade.toBusTickets ?? 0) - (trade.fromBusTickets ?? 0)
  fromP.busTickets += busDelta
  toP.busTickets -= busDelta
  // Transferência de imunidades existentes (028, §8.4): re-atribui só o beneficiário,
  // preservando lapsRemaining + granterId. ANTES das concessões novas (não casar recém-criada).
  for (const pos of trade.fromImmunityTransfers ?? []) {
    const im = s.immunities.find((i) => i.beneficiaryId === fromId && i.pos === pos)
    if (im) im.beneficiaryId = toId
  }
  for (const pos of trade.toImmunityTransfers ?? []) {
    const im = s.immunities.find((i) => i.beneficiaryId === toId && i.pos === pos)
    if (im) im.beneficiaryId = fromId
  }
  for (const g of trade.fromImmunities ?? []) s.immunities.push({ beneficiaryId: toId, pos: g.pos, lapsRemaining: g.laps, granterId: fromId })
  for (const g of trade.toImmunities ?? []) s.immunities.push({ beneficiaryId: fromId, pos: g.pos, lapsRemaining: g.laps, granterId: toId })
  return s
}

export function executeTrade(state: GameState, trade: Trade): GameState {
  if (state.paused) return state
  if (!validateTrade(state, trade)) return state
  return applyTrade(state, trade)
}

// Propostas simultâneas (047/D-048). Nenhuma reserva ativos ou bloqueia o turno;
// cada resposta endereça um envelope e revalida a troca no estado mais recente.
export function proposeTrade(state: GameState, trade: Trade): GameState {
  if (state.paused) return state
  if (!validateTrade(state, trade)) return state
  const s = clone(state)
  s.tradeProposals.push({ id: s.nextTradeProposalId, trade })
  s.nextTradeProposalId += 1
  return s
}

export function acceptTrade(state: GameState, proposalId: number): GameState {
  if (state.paused) return state
  const proposal = state.tradeProposals.find((candidate) => candidate.id === proposalId)
  if (!proposal) return state
  const { trade } = proposal
  if (!validateTrade(state, trade)) return state // obsoleta → no-op (pode recusar)
  const s = executeTrade(state, trade)
  s.tradeHistory = [...s.tradeHistory, trade].slice(-12) // 027 — registro (bounded)
  logEvent(s, { kind: 'trade', who: trade.fromId, toId: trade.toId }) // 027/040
  s.tradeProposals = s.tradeProposals.filter((candidate) => candidate.id !== proposalId)
  return s
}

export function rejectTrade(state: GameState, proposalId: number): GameState {
  if (!state.tradeProposals.some((candidate) => candidate.id === proposalId)) return state
  const s = clone(state)
  s.tradeProposals = s.tradeProposals.filter((candidate) => candidate.id !== proposalId)
  return s
}
