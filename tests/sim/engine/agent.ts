// Política do agente (036): aleatória pura seedada sobre ações VÁLIDAS (Assumption —
// sem heurística de "jogador razoável"). Prioriza pontos obrigatórios (bloqueiam o
// turno); dá uma chance fixa a pontos oportunistas fora-de-turno (D4).
//
// Amostragem em DOIS NÍVEIS (tipo → instância): famílias com muitas instâncias
// posicionais (build-house em cada propriedade, propose-trade por par de jogadores)
// não podem afogar ações de progresso do turno (finalize/roll/resolve-pending, que têm
// só 1 instância) — sem isso o turno quase nunca avança (round-cap "falso positivo").
import type { RNG } from '@/game/turn/dice'
import type { DecisionPoint, SimAction, SimActionKind } from './types'

const OPPORTUNISTIC_CHANCE = 0.2

function pickOne<T>(rng: RNG, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)]
}

function pickByKind<T>(rng: RNG, items: T[], kindOf: (item: T) => SimActionKind): T {
  const kinds = [...new Set(items.map(kindOf))]
  const kind = pickOne(rng, kinds)
  const candidates = items.filter((item) => kindOf(item) === kind)
  return pickOne(rng, candidates)
}

function pickPoint(rng: RNG, points: DecisionPoint[]): DecisionPoint {
  return pickByKind(rng, points, (p) => p.actions[0].kind)
}

function pickActionFromPoint(rng: RNG, point: DecisionPoint): SimAction {
  return pickByKind(rng, point.actions, (a) => a.kind)
}

export function pickAction(rng: RNG, points: DecisionPoint[]): { actorId: string; action: SimAction } {
  if (points.length === 0) throw new Error('nenhum DecisionPoint enumerado — possível deadlock do turno')
  const mandatory = points.filter((p) => p.mandatory)
  const opportunistic = points.filter((p) => !p.mandatory)

  const useOpportunistic = opportunistic.length > 0 && (mandatory.length === 0 || rng() < OPPORTUNISTIC_CHANCE)
  const pool = useOpportunistic ? opportunistic : mandatory
  const point = pickPoint(rng, pool)
  return { actorId: point.actorId, action: pickActionFromPoint(rng, point) }
}
