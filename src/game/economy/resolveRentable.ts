// Resolver de economia (003) — handler de property/airport/utility/mine injetado na
// resolução do turno (002). Retorna null para outros kinds (cai no registry default).
import type { ResolveCtx, ResolutionOutcome } from '../turn/resolution'
import { isRentableKind } from './titles'
import { ownerOf, isMortgaged } from './titles'
import { discountedByTin, rentDue } from './rent'
import { hasImmunity } from './imunidade'
import { logEvent } from '../log'
import { isBoycotted, isPlayerImmune, isValorizada, estatizacaoActive } from './tempEffects'

export function economyResolve(ctx: ResolveCtx): ResolutionOutcome | null {
  const { square, state, playerId, roll } = ctx
  if (!isRentableKind(square.kind)) return null

  const pos = square.pos
  const owner = ownerOf(state, pos)
  const payer = state.players.find((p) => p.id === playerId)
  // Obras na Pista (D-064): flag armada só no pouso forçado no aeroporto — consumida (ou
  // descartada, se o aeroporto estiver livre/for do próprio) na primeira casa rentável.
  const doubleOnce = payer?.doubleRentOnce === true
  if (payer?.doubleRentOnce) delete payer.doubleRentOnce

  if (owner === null) {
    state.resolution = { kind: 'purchase', pos } // abre modal; turno segue pendente (FR-001/FR-005)
    return { done: false }
  }
  // D-071: Mina continua nesta categoria para compra/leilão, mas uma Mina ocupada nunca
  // cobra aluguel. Encerrar antes de imunidade/efeitos evita log ou dívida de valor zero.
  if (square.kind === 'mine') return { done: true }
  if (owner === playerId) return { done: true } // própria (FR-011)
  if (isMortgaged(state, pos)) return { done: true } // hipotecada → sem aluguel (FR-010)
  if (hasImmunity(state, playerId, pos)) return { done: true } // imunidade pessoal (014, §8.4)
  if (isBoycotted(state, pos)) return { done: true } // Boicote: ninguém paga (015, §10.6)
  if (isPlayerImmune(state, playerId)) return { done: true } // Imunidade Total (D-064): 1 volta sem pagar aluguel

  let amount = rentDue(state, pos, owner, roll) // FR-006..009 — fonte única, ver rent.ts
  if (isValorizada(state, pos)) amount *= 2 // Valorização (D-064): a propriedade cobra em dobro
  if (doubleOnce) amount *= 2 // Obras na Pista (D-064)
  amount = discountedByTin(state, playerId, amount) // Mina de Estanho: −15% no aluguel PAGO

  // Estatização (D-064, duração revista pela D-080): por 1 volta o aluguel vai à Loteria, não ao dono.
  const confiscated = estatizacaoActive(state)

  if (payer && payer.cash < amount) {
    // dívida pendente (008) — pagar/falir. `debtorId`/`cause` (D-061/D-063): o devedor deixa de
    // ser implícito e a abertura deixa de ser muda. Sob Estatização o credor é o pote (banco).
    state.resolution = { kind: 'debt', amount, creditorId: confiscated ? null : owner, debtorId: playerId, cause: 'rent' }
    logEvent(state, { kind: 'debt-open', who: playerId, amount, creditorId: confiscated ? null : owner, cause: 'rent' })
    return { done: false }
  }
  if (payer) payer.cash -= amount
  if (confiscated) {
    ctx.ports.onPayToCenter(state, amount) // → Loteria (§13.4)
    logEvent(state, { kind: 'rent', who: playerId, pos, amount, ownerId: 'bank' }) // dono = pote sob Estatização
    return { done: true }
  }
  const ownerP = state.players.find((p) => p.id === owner)
  if (ownerP) ownerP.cash += amount
  logEvent(state, { kind: 'rent', who: playerId, pos, amount, ownerId: owner }) // 021/040
  return { done: true }
}
