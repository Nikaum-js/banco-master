// Cartas de reação (017, SRS §10.6/§12.4) — subsistema de interrupção. Puro.
// Diplomacia cancela uma ofensiva contra você; Bunker Fiscal cancela um imposto de casa.
// A reação reusa o slot `resolution` (bloqueia finalizar); a ofensiva fica "em voo" na variante.
import type { ResolveCtx, ResolutionOutcome, TurnPorts } from '../turn/resolution'
import type { GameState } from '../turn/types'
import { completeResolution } from '../turn/turnMachine'
import { cardById } from './catalog'
import { ownerOf } from '../economy/titles'
import { isTempImmune, addTempEffect } from '../economy/tempEffects'
import { acquire, evict, audit, canAcquire, canEvict, canAudit } from './ofensivas'

// id da carta na mão do jogador cujo efeito é a reação procurada (privado: não revela ao atacante).
export function findReactionCard(
  state: GameState,
  playerId: string,
  effect: 'diplomacia' | 'bunkerFiscal',
): string | undefined {
  const p = state.players.find((x) => x.id === playerId)
  return p?.hand.find((id) => cardById(id).effect === effect)
}

// Quem pode reagir (Diplomacia) a esta ofensiva, SE ela for válida; senão null.
export function reactorFor(
  state: GameState,
  effect: string,
  attackerId: string,
  targetPos: number | null,
  targetPlayer: string | null,
): string | null {
  if (effect === 'aquisicaoHostil') return targetPos != null && canAcquire(state, attackerId, targetPos) ? ownerOf(state, targetPos) : null
  if (effect === 'despejo') return targetPos != null && canEvict(state, attackerId, targetPos) ? ownerOf(state, targetPos) : null
  if (effect === 'auditoriaFiscal') return targetPlayer != null && canAudit(state, attackerId, targetPlayer) ? targetPlayer : null
  if (effect === 'boicote') {
    if (targetPos == null) return null
    const owner = ownerOf(state, targetPos)
    if (owner === null || owner === attackerId || isTempImmune(state, targetPos)) return null // gate do Boicote (015)
    return owner
  }
  return null
}

// Aplica a ofensiva (na recusa da Diplomacia). MUTA o state.
export function applyOffensive(
  state: GameState,
  effect: string,
  attackerId: string,
  targetPos: number | null,
  targetPlayer: string | null,
  ports: TurnPorts,
): void {
  if (effect === 'aquisicaoHostil' && targetPos != null) acquire(state, attackerId, targetPos)
  else if (effect === 'despejo' && targetPos != null) evict(state, attackerId, targetPos)
  else if (effect === 'auditoriaFiscal' && targetPlayer != null) audit(state, attackerId, targetPlayer, ports)
  else if (effect === 'boicote' && targetPos != null) addTempEffect(state, { kind: 'boicote', ownerId: attackerId, pos: targetPos, lapsRemaining: 2 })
}

// Imposto de casa + pagador com Bunker → abre reação (em vez de cobrar). Composto no ctx.resolve.
export function taxBunkerResolve(rctx: ResolveCtx): ResolutionOutcome | null {
  const { square, state, playerId } = rctx
  if (square.kind !== 'tax') return null
  if (!findReactionCard(state, playerId, 'bunkerFiscal')) return null
  state.resolution = { kind: 'reaction-bunker', reactorId: playerId, amount: square.amount }
  return { done: false, blocksFinalize: true }
}

// Responde a reação pendente (Diplomacia/Bunker): usar (cancela) ou recusar (aplica). Puro.
export function respondReaction(state: GameState, use: boolean, ports: TurnPorts): GameState {
  const res = state.resolution
  if (res?.kind !== 'reaction-diplomacia' && res?.kind !== 'reaction-bunker') return state
  if (state.paused) return state
  const s = structuredClone(state)
  const r = s.resolution!

  if (r.kind === 'reaction-diplomacia') {
    const reactor = s.players.find((p) => p.id === r.reactorId)
    if (use) {
      const dip = findReactionCard(s, r.reactorId, 'diplomacia') // cancela: gasta a Diplomacia
      if (reactor && dip) {
        reactor.hand = reactor.hand.filter((h) => h !== dip)
        s.decks.tesouro.push(dip)
      }
    } else {
      applyOffensive(s, r.effect, r.attackerId, r.targetPos, r.targetPlayer, ports) // recusa: aplica
    }
    s.decks[r.deck].push(r.cardId) // a ofensiva é gasta sempre (volta ao fundo)
    s.resolution = null // aberta fora do fluxo de resolução: preserva o estado do turno
    return s
  }

  if (r.kind !== 'reaction-bunker') return state // narrowing p/ o TS (inalcançável: já filtrado acima)
  const reactor = s.players.find((p) => p.id === r.reactorId)!
  if (use) {
    const bunker = findReactionCard(s, r.reactorId, 'bunkerFiscal') // cancela o imposto
    if (bunker) {
      reactor.hand = reactor.hand.filter((h) => h !== bunker)
      s.decks.tesouro.push(bunker)
    }
    completeResolution(s)
  } else if (reactor.cash >= r.amount) {
    reactor.cash -= r.amount // recusou: paga o imposto
    ports.onPayToCenter(s, r.amount)
    completeResolution(s)
  } else {
    s.resolution = { kind: 'debt', amount: r.amount, creditorId: null } // sem caixa → dívida (008)
  }
  return s
}
