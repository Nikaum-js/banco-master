// Resolver de economia (003) — handler de property/airport/utility injetado na
// resolução do turno (002). Retorna null para outros kinds (cai no registry default).
import type { ResolveCtx, ResolutionOutcome } from '../turn/resolution'
import { ownerOf, isMortgaged } from './titles'
import { rentDue } from './rent'
import { hasImmunity } from './imunidade'
import { logEvent } from '../log'
import { isBoycotted } from './tempEffects'

export function economyResolve(ctx: ResolveCtx): ResolutionOutcome | null {
  const { square, state, playerId, roll } = ctx
  if (square.kind !== 'property' && square.kind !== 'airport' && square.kind !== 'utility') return null

  const pos = square.pos
  const owner = ownerOf(state, pos)

  if (owner === null) {
    state.resolution = { kind: 'purchase', pos } // abre modal; turno segue pendente (FR-001/FR-005)
    return { done: false }
  }
  if (owner === playerId) return { done: true } // própria (FR-011)
  if (isMortgaged(state, pos)) return { done: true } // hipotecada → sem aluguel (FR-010)
  if (hasImmunity(state, playerId, pos)) return { done: true } // imunidade pessoal (014, §8.4)
  if (isBoycotted(state, pos)) return { done: true } // Boicote: ninguém paga (015, §10.6)

  const amount = rentDue(state, pos, owner, roll) // FR-006..009 — fonte única, ver rent.ts

  const payer = state.players.find((p) => p.id === playerId)
  if (payer && payer.cash < amount) {
    // dívida pendente (008) — pagar/falir. `debtorId`/`cause` (D-061/D-063): o devedor deixa de
    // ser implícito e a abertura deixa de ser muda.
    state.resolution = { kind: 'debt', amount, creditorId: owner, debtorId: playerId, cause: 'rent' }
    logEvent(state, { kind: 'debt-open', who: playerId, amount, creditorId: owner, cause: 'rent' })
    return { done: false }
  }
  if (payer) payer.cash -= amount
  const ownerP = state.players.find((p) => p.id === owner)
  if (ownerP) ownerP.cash += amount
  logEvent(state, { kind: 'rent', who: playerId, pos, amount, ownerId: owner }) // 021/040
  return { done: true }
}
