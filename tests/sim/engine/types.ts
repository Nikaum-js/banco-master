// Tipos do harness de simulação (036) — dev-only. Nada aqui é importado por `src/`.
import type { Trade } from '@/game/economy/trade'

export type SimAction =
  // Turno (turnMachine.ts) — sempre o jogador ativo.
  | { kind: 'roll' }
  | { kind: 'finalize' }
  | { kind: 'jail-decision'; decision: 'pay' | 'card' | 'try' }
  | { kind: 'choose-bus-move'; opt: 'die0' | 'die1' | 'sum' }
  | { kind: 'choose-triple-dest'; dest: number }
  | { kind: 'use-bus-ticket'; dest: number }
  // Casa/compra (resolution.ts/purchase.ts) — jogador ativo.
  | { kind: 'resolve-pending' }
  | { kind: 'buy-property' }
  | { kind: 'decline-property' }
  // Leilão de propriedade (auction.ts) — por licitante (playerId explícito).
  | { kind: 'place-bid'; playerId: string; amount: number }
  | { kind: 'pass-bid'; playerId: string }
  // Pregão de terrenos (landAuction.ts, 031) — por licitante.
  | { kind: 'place-land-bid'; playerId: string; pos: number; amount: number }
  // Construção (construction.ts) — jogador ativo, dono da propriedade.
  | { kind: 'build-house'; pos: number }
  | { kind: 'sell-building'; pos: number }
  | { kind: 'build-hangar'; pos: number }
  | { kind: 'sell-hangar'; pos: number }
  // Hipoteca (mortgage.ts) — jogador ativo.
  | { kind: 'mortgage'; pos: number }
  | { kind: 'unmortgage'; pos: number }
  // Cartas (draw.ts/reacao.ts) — jogador ativo (mão) ou reator (resolução pendente).
  | { kind: 'play-hand-card'; cardId: string; target?: number; targetPlayer?: string }
  | { kind: 'discard-card'; cardId: string }
  | { kind: 'choose-card-shortcut'; dir: 'frente' | 'tras' }
  | { kind: 'confirm-card-reveal' }
  | { kind: 'respond-reaction'; use: boolean }
  // Dívida/falência (falencia.ts) — jogador ativo (devedor da resolução `debt`).
  | { kind: 'pay-debt' }
  | { kind: 'declare-bankruptcy' }
  // Empréstimo (emprestimos.ts) — devedor é sempre o jogador ativo; resposta é do credor.
  | { kind: 'propose-loan'; creditorId: string }
  | { kind: 'respond-loan'; accept: boolean; ratePct: number }
  | { kind: 'pay-off-loan' }
  // Troca (trade.ts) — qualquer jogador pode propor; aceitar/recusar é do destinatário.
  | { kind: 'propose-trade'; trade: Trade }
  | { kind: 'accept-trade' }
  | { kind: 'reject-trade' }

export type SimActionKind = SimAction['kind']

// Ponto de decisão: um jogador (`actorId`) com um repertório de ações VÁLIDAS agora mesmo.
// `mandatory=true` bloqueia o turno até ser respondido (resolução pendente/pendingLoan);
// `mandatory=false` é uma oportunidade fora-de-turno (troca/lance no pregão).
export interface DecisionPoint {
  actorId: string
  mandatory: boolean
  actions: SimAction[]
}

export type SimFailureReason = 'exception' | 'invariant' | 'invalid-action-accepted' | 'round-cap-exceeded'

export interface SimFailure {
  reason: SimFailureReason
  seed: number
  playerCount: number
  round: number
  action?: SimAction
  detail: string
}

export interface SimResult {
  seed: number
  playerCount: number
  outcome: 'ok' | 'fail'
  rounds: number
  actionsExecuted: number
  durationMs: number
  winnerId?: string
  failure?: SimFailure
}

export interface SimReport {
  total: number
  ok: number
  failed: number
  durationMs: number
  roundsHistogram: Record<number, number>
  failures: SimFailure[]
}
