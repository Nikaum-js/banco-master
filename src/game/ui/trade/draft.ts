// Draft da negociação (024/028): concentra transições, compatibilidade entre
// termos e elegibilidade. React só despacha intents e renderiza esta projeção.
import { BOARD } from '@/lib/boardData'
import { tradableProps, validateTrade } from '@/game/economy/trade'
import { tradeBalance } from '@/game/economy/appraisal'
import type { Immunity, Trade } from '@/game/economy/types'
import type { GameState, Player } from '@/game/turn/types'

export const TRADE_LAPS_PRESETS = [2, 5] as const
export type TradeGrantMap = Record<number, number | null>
export type TradeDraftParty = 'from' | 'to'

export interface TradeDraftSide {
  props: Set<number>
  cash: number
  tickets: number
  grants: TradeGrantMap
  transfers: Set<number>
}

export interface TradeDraft {
  fromId: string
  toId: string
  from: TradeDraftSide
  to: TradeDraftSide
}

export type TradeDraftAction =
  | { kind: 'pick-recipient'; toId: string }
  | { kind: 'toggle-property'; party: TradeDraftParty; pos: number }
  | { kind: 'set-cash'; party: TradeDraftParty; amount: number }
  | { kind: 'set-tickets'; party: TradeDraftParty; amount: number }
  | { kind: 'toggle-grant'; party: TradeDraftParty; pos: number }
  | { kind: 'set-grant-laps'; party: TradeDraftParty; pos: number; laps: number | null }
  | { kind: 'toggle-transfer'; party: TradeDraftParty; pos: number }

export interface TradeDraftProjection {
  proposer: Player
  recipients: Player[]
  recipient: Player | undefined
  fromProps: number[]
  toProps: number[]
  fromGrantable: number[]
  toGrantable: number[]
  fromImmunities: Immunity[]
  toImmunities: Immunity[]
  trade: Trade
  canPropose: boolean
  /**
   * Trava de esvaziamento (§8.5, D-058) quando a proposta NÃO passa: quanto falta a cada lado
   * para não ficar esvaziado, e se algum lado está doando sem receber nada. `null` quando passa
   * (ou quando nem há termos). Proposta bloqueada sem motivo na tela é lida como bug — este
   * campo existe para a recusa se explicar.
   */
  counterpart: TradeCounterpartGap | null
}

export interface TradeCounterpartGap {
  fromMissing: number
  toMissing: number
  fromDonation: boolean
  toDonation: boolean
}

function emptySide(): TradeDraftSide {
  return { props: new Set(), cash: 0, tickets: 0, grants: {}, transfers: new Set() }
}

function recipients(game: GameState, fromId: string): Player[] {
  return game.players.filter((player) => player.id !== fromId && !player.eliminated)
}

export function createTradeDraft(game: GameState, fromId: string): TradeDraft {
  return {
    fromId,
    toId: recipients(game, fromId)[0]?.id ?? '',
    from: emptySide(),
    to: emptySide(),
  }
}

function playerFor(game: GameState, draft: TradeDraft, party: TradeDraftParty): Player | undefined {
  const id = party === 'from' ? draft.fromId : draft.toId
  return game.players.find((player) => player.id === id)
}

function replaceSide(draft: TradeDraft, party: TradeDraftParty, side: TradeDraftSide): TradeDraft {
  return { ...draft, [party]: side }
}

function toggle(values: Set<number>, value: number): Set<number> {
  const next = new Set(values)
  if (next.has(value)) next.delete(value)
  else next.add(value)
  return next
}

function amountWithin(value: number, max: number): number {
  const integer = Number.isFinite(value) ? Math.trunc(value) : 0
  return Math.max(0, Math.min(integer, max))
}

function ownedProps(game: GameState, ownerId: string): number[] {
  return BOARD
    .filter((square) => 'price' in square && game.titles[square.pos]?.ownerId === ownerId)
    .map((square) => square.pos)
}

export function updateTradeDraft(game: GameState, draft: TradeDraft, action: TradeDraftAction): TradeDraft {
  if (action.kind === 'pick-recipient') {
    if (!recipients(game, draft.fromId).some((player) => player.id === action.toId)) return draft
    return { ...draft, toId: action.toId, to: emptySide() }
  }

  const player = playerFor(game, draft, action.party)
  if (!player) return draft
  const side = draft[action.party]

  switch (action.kind) {
    case 'toggle-property': {
      if (!tradableProps(game, player.id).includes(action.pos)) return draft
      const props = toggle(side.props, action.pos)
      const grants = { ...side.grants }
      if (props.has(action.pos)) delete grants[action.pos]
      return replaceSide(draft, action.party, { ...side, props, grants })
    }
    case 'set-cash':
      return replaceSide(draft, action.party, { ...side, cash: amountWithin(action.amount, player.cash) })
    case 'set-tickets':
      return replaceSide(draft, action.party, { ...side, tickets: amountWithin(action.amount, player.busTickets) })
    case 'toggle-grant': {
      if (!ownedProps(game, player.id).includes(action.pos)) return draft
      const grants = { ...side.grants }
      if (action.pos in grants) delete grants[action.pos]
      else {
        grants[action.pos] = TRADE_LAPS_PRESETS[0]
        const props = new Set(side.props)
        props.delete(action.pos)
        return replaceSide(draft, action.party, { ...side, props, grants })
      }
      return replaceSide(draft, action.party, { ...side, grants })
    }
    case 'set-grant-laps': {
      if (!(action.pos in side.grants)) return draft
      if (action.laps !== null && (!Number.isInteger(action.laps) || action.laps <= 0)) return draft
      return replaceSide(draft, action.party, {
        ...side,
        grants: { ...side.grants, [action.pos]: action.laps },
      })
    }
    case 'toggle-transfer': {
      const transferable = game.immunities.some(
        (immunity) => immunity.beneficiaryId === player.id && immunity.pos === action.pos,
      )
      if (!transferable) return draft
      return replaceSide(draft, action.party, { ...side, transfers: toggle(side.transfers, action.pos) })
    }
  }
}

function grantsFor(side: TradeDraftSide): Trade['fromImmunities'] {
  return Object.entries(side.grants)
    .filter(([pos]) => !side.props.has(Number(pos)))
    .map(([pos, laps]) => ({ pos: Number(pos), laps }))
}

function toTrade(draft: TradeDraft): Trade {
  return {
    fromId: draft.fromId,
    toId: draft.toId,
    fromProps: [...draft.from.props],
    fromCash: draft.from.cash,
    toProps: [...draft.to.props],
    toCash: draft.to.cash,
    fromBusTickets: draft.from.tickets,
    toBusTickets: draft.to.tickets,
    fromImmunities: grantsFor(draft.from),
    toImmunities: grantsFor(draft.to),
    fromImmunityTransfers: [...draft.from.transfers],
    toImmunityTransfers: [...draft.to.transfers],
  }
}

function hasTerms(trade: Trade): boolean {
  return trade.fromProps.length > 0
    || trade.toProps.length > 0
    || trade.fromCash > 0
    || trade.toCash > 0
    || (trade.fromBusTickets ?? 0) > 0
    || (trade.toBusTickets ?? 0) > 0
    || (trade.fromImmunities?.length ?? 0) > 0
    || (trade.toImmunities?.length ?? 0) > 0
    || (trade.fromImmunityTransfers?.length ?? 0) > 0
    || (trade.toImmunityTransfers?.length ?? 0) > 0
}

export function projectTradeDraft(game: GameState, draft: TradeDraft): TradeDraftProjection {
  const proposer = game.players.find((player) => player.id === draft.fromId)
  if (!proposer) throw new Error(`Proponente ausente no GameState: ${draft.fromId}`)
  const eligibleRecipients = recipients(game, draft.fromId)
  const recipient = eligibleRecipients.find((player) => player.id === draft.toId)
  const trade = toTrade(draft)
  const balance = recipient && hasTerms(trade) ? tradeBalance(game, trade) : null
  const gap = balance && (balance.from.missing > 0 || balance.to.missing > 0 || balance.from.donation || balance.to.donation)
    ? {
        fromMissing: balance.from.missing,
        toMissing: balance.to.missing,
        fromDonation: balance.from.donation,
        toDonation: balance.to.donation,
      }
    : null

  return {
    proposer,
    recipients: eligibleRecipients,
    recipient,
    fromProps: tradableProps(game, draft.fromId),
    toProps: recipient ? tradableProps(game, recipient.id) : [],
    fromGrantable: ownedProps(game, draft.fromId).filter((pos) => !draft.from.props.has(pos)),
    toGrantable: recipient ? ownedProps(game, recipient.id).filter((pos) => !draft.to.props.has(pos)) : [],
    fromImmunities: game.immunities.filter((immunity) => immunity.beneficiaryId === draft.fromId),
    toImmunities: recipient
      ? game.immunities.filter((immunity) => immunity.beneficiaryId === recipient.id)
      : [],
    trade,
    canPropose: recipient !== undefined && hasTerms(trade) && validateTrade(game, trade),
    counterpart: gap,
  }
}
