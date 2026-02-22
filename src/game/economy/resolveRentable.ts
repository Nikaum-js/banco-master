// Resolver de economia (003) — handler de property/airport/utility injetado na
// resolução do turno (002). Retorna null para outros kinds (cai no registry default).
import type { ResolveCtx, ResolutionOutcome } from '../turn/resolution'
import { ownerOf, isMortgaged, groupOwnedCount, groupSize, countOwned, groupHasSkyscraper } from './titles'
import { rentCity, rentAirport, rentUtility, diceValue } from './rent'
import { hasImmunity } from './imunidade'
import { logEvent } from '../log'
import { apagaoActive, greveActive, isBoycotted } from './tempEffects'

export function economyResolve(ctx: ResolveCtx): ResolutionOutcome | null {
  const { square, state, playerId, roll } = ctx
  if (square.kind !== 'property' && square.kind !== 'airport' && square.kind !== 'utility') return null

  const pos = square.pos
  const owner = ownerOf(state, pos)

  if (owner === null) {
    state.resolution = { kind: 'purchase', pos } // abre modal; turno segue pendente (FR-001/FR-005)
    return { done: false, blocksFinalize: true }
  }
  if (owner === playerId) return { done: true } // própria (FR-011)
  if (isMortgaged(state, pos)) return { done: true } // hipotecada → sem aluguel (FR-010)
  if (hasImmunity(state, playerId, pos)) return { done: true } // imunidade pessoal (014, §8.4)
  if (isBoycotted(state, pos)) return { done: true } // Boicote: ninguém paga (015, §10.6)

  // aluguel devido (FR-006..009)
  let amount = 0
  if (square.kind === 'airport') {
    const hangarDobra = state.titles[pos].hangar && !apagaoActive(state) // Apagão desliga a dobra (015)
    amount = rentAirport(countOwned(state, 'airport', owner)) * (hangarDobra ? 2 : 1) // Hangar dobra (011, §13.6)
  } else if (square.kind === 'utility') {
    amount = greveActive(state) ? 0 : rentUtility(countOwned(state, 'utility', owner), diceValue(roll)) // Greve zera (015)
  } else {
    const t = state.titles[pos]
    amount = rentCity(
      square.group,
      square.rent,
      groupOwnedCount(state, square.group, owner),
      groupSize(square.group),
      { houses: t.houses, hotel: t.hotel, hotel2: t.hotel2, skyscraper: t.skyscraper },
      groupHasSkyscraper(state, square.group),
    )
  }

  const payer = state.players.find((p) => p.id === playerId)
  if (payer && payer.cash < amount) {
    state.resolution = { kind: 'debt', amount, creditorId: owner } // dívida pendente (008) — pagar/falir
    return { done: false, blocksFinalize: true }
  }
  if (payer) payer.cash -= amount
  const ownerP = state.players.find((p) => p.id === owner)
  if (ownerP) ownerP.cash += amount
  logEvent(state, playerId, `pagou $${amount} de aluguel a ${owner}`) // 021
  return { done: true }
}
