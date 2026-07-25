// VIEW-MODEL DO HUD — card 4 do review de arquitetura (2026-07-25).
//
// O `GameHUD` tem cinco telas mutuamente exclusivas, e a PRECEDÊNCIA entre elas ("vitória
// vence pedido de empréstimo, que vence reação, que vence dívida") era a ordem dos
// `return` no corpo da função. Regra de apresentação codificada como ordem de statement:
// impossível de testar, e invisível para quem for adicionar a sexta.
//
// Pior, `activeModal.ts:3` afirma ser consumida "por ModalLayer (render) e por GameHUD
// (esconder os ramos que ela cobre)" — e `GameHUD` nunca a importou. A seam documentada
// não existia. Este módulo é o análogo que faltava: o `activeModal` do HUD.
import type { GameState } from '../../turn/types'
import type { LocalView } from '@/net/localView'
import type { LoanRequest } from '../../economy/types'

export type HudKind = 'winner' | 'loan-request' | 'reaction-diplomacia' | 'reaction-bunker' | 'debt'

export type HudView =
  | { kind: 'winner'; winnerId: string | null }
  | { kind: 'loan-request'; req: LoanRequest }
  | { kind: 'reaction-diplomacia'; reactorId: string; attackerId: string; effect: string }
  | { kind: 'reaction-bunker'; reactorId: string; amount: number }
  | { kind: 'debt'; debtorId: string; amount: number; creditorId: string | null }

/** Comando que cada tela do HUD pede — a mesma tabela que o host usa para validar. */
export const HUD_ACTION: Record<HudKind, Parameters<LocalView['mayAct']>[0]> = {
  winner: 'dismiss-notice', // não pede ação; qualquer kind serve de sentinela
  'loan-request': 'respond-loan',
  'reaction-diplomacia': 'respond-reaction',
  'reaction-bunker': 'respond-reaction',
  debt: 'pay-debt',
}

/** De quem o HUD espera, quando a decisão NÃO é deste dispositivo. */
export function hudWaitingFor(view: HudView, game: GameState): string | null {
  switch (view.kind) {
    case 'loan-request': return view.req.creditorId
    case 'reaction-diplomacia':
    case 'reaction-bunker': return view.reactorId
    case 'debt': return view.debtorId
    case 'winner': return null
    default: return game.players[game.turnOrder[game.activeSeat]]?.id ?? null
  }
}

/**
 * Qual das cinco telas do HUD está ativa — `null` quando nenhuma. A ORDEM DOS RAMOS ABAIXO
 * É A REGRA DE PRECEDÊNCIA, e agora é testável.
 */
export function activeHudView(game: GameState): HudView | null {
  // 1. Fim de jogo vence tudo: nada mais é acionável depois do vencedor.
  if (game.phase === 'ended') {
    return { kind: 'winner', winnerId: game.players.find((p) => !p.eliminated)?.id ?? null }
  }
  // 2. Pedido de empréstimo: bloqueia o devedor até o credor responder (§15.2/§15.3).
  if (game.pendingLoan) return { kind: 'loan-request', req: game.pendingLoan }

  const res = game.resolution
  // 3-4. Reações precedem a dívida: a carta pode CANCELAR o que geraria a cobrança (D-013).
  if (res?.kind === 'reaction-diplomacia') {
    return { kind: 'reaction-diplomacia', reactorId: res.reactorId, attackerId: res.attackerId, effect: res.effect }
  }
  if (res?.kind === 'reaction-bunker') return { kind: 'reaction-bunker', reactorId: res.reactorId, amount: res.amount }
  // 5. Dívida pendente.
  if (res?.kind === 'debt') {
    return {
      kind: 'debt',
      debtorId: game.players[game.turnOrder[game.activeSeat]]?.id ?? '',
      amount: res.amount,
      creditorId: res.creditorId,
    }
  }
  return null
}
