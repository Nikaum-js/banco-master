// Resolver de economia (003) — handler de property/airport/utility injetado na
// resolução do turno (002). Retorna null para outros kinds (cai no registry default).
import type { ResolveCtx, ResolutionOutcome } from '../turn/resolution'
import { ownerOf, isMortgaged, groupOwnedCount, groupSize, countOwned } from './titles'
import { rentCity, rentAirport, rentUtility, diceValue } from './rent'

export function economyResolve(ctx: ResolveCtx): ResolutionOutcome | null {
  const { square, state, playerId, roll, ports } = ctx
  if (square.kind !== 'property' && square.kind !== 'airport' && square.kind !== 'utility') return null

  const pos = square.pos
  const owner = ownerOf(state, pos)

  if (owner === null) {
    state.resolution = { kind: 'purchase', pos } // abre modal; turno segue pendente (FR-001/FR-005)
    return { done: false, blocksFinalize: true }
  }
  if (owner === playerId) return { done: true } // própria (FR-011)
  if (isMortgaged(state, pos)) return { done: true } // hipotecada → sem aluguel (FR-010)

  // aluguel devido (FR-006..009)
  let amount = 0
  if (square.kind === 'airport') amount = rentAirport(countOwned(state, 'airport', owner))
  else if (square.kind === 'utility') amount = rentUtility(countOwned(state, 'utility', owner), diceValue(roll))
  else {
    const t = state.titles[pos]
    amount = rentCity(square.rent, groupOwnedCount(state, square.group, owner), groupSize(square.group), {
      houses: t.houses,
      hotel: t.hotel,
    })
  }

  const payer = state.players.find((p) => p.id === playerId)
  if (payer && payer.cash < amount) {
    ports.onInsolvency?.(playerId, amount, owner) // → Falência (FR-016)
    return { done: true }
  }
  if (payer) payer.cash -= amount
  const ownerP = state.players.find((p) => p.id === owner)
  if (ownerP) ownerP.cash += amount
  return { done: true }
}
