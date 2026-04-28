// Driver do harness (036/D1-D2): dirige o MESMO motor puro que src/game/store.ts liga
// ao Zustand — sem Zustand, sem timers reais. `now()` é um relógio LÓGICO controlado
// pelo próprio harness (não Date.now()), avançado explicitamente para fechar leilões.
import { buildGameCtx, buildInitialGame } from '@/game/setup'
import type { GameState } from '@/game/turn/types'
import type { TurnCtx } from '@/game/turn/turnMachine'
import { applyCommand } from '@/game/commands'
import { deadlinePlan } from '@/game/deadlines'
import { mulberry32 } from './rng'
import type { SimAction } from './types'

export interface SimSession {
  game: GameState
  ctx: TurnCtx
  clock: number // relógio lógico (ms simulados); avançado só pelo driver, nunca Date.now()
}

export function createSimSession(seed: number, playerIds: string[]): SimSession {
  const rng = mulberry32(seed)
  // Baralhos embaralhados pela MESMA seed (nunca Math.random() — FR-003).
  const game = buildInitialGame(playerIds, rng)

  const session: SimSession = { game, clock: 0, ctx: null as unknown as TurnCtx }
  // MESMA fábrica do store e do host (`@/game/setup`): a simulação valida a
  // configuração do produto, não uma paralela (FR-013).
  session.ctx = buildGameCtx(rng, () => session.clock)
  return session
}

// O despacho é o de PRODUÇÃO (`applyCommand`) — antes este arquivo tinha um `switch`
// próprio e um `LAND_TRIGGERING` próprio, e o conjunto daqui não era o da produção:
// disparava o pregão em `decline-property`/`place-bid`/`accept-trade` (que não mudam a
// contagem de terrenos livres) e o da produção não disparava em `declare-bankruptcy`
// (que muda). A simulação validava um jogo que ninguém jogava.

export function dispatch(session: SimSession, action: SimAction): void {
  session.game = applyCommand(session.game, action, session.ctx)
}

// Relógio lógico (D2): quando não resta lance possível, avança `clock` até o deadline
// mais próximo e fecha na hora — sem esperar de verdade.
export function closeExhaustedAuctions(session: SimSession): boolean {
  const { game } = session
  const candidates: number[] = []

  if (game.resolution?.kind === 'auction') {
    const a = game.resolution.auction
    const canStillBid = a.activeBidders.some((id) => {
      const cash = game.players.find((p) => p.id === id)?.cash ?? 0
      return cash > a.currentBid
    })
    if (!canStillBid) candidates.push(a.deadline)
  }

  if (game.landAuction) {
    const la = game.landAuction
    const anyBiddable = la.lots.some((lot) =>
      la.bidders.some((id) => {
        const cash = game.players.find((p) => p.id === id)?.cash ?? 0
        return cash > lot.currentBid
      }),
    )
    if (!anyBiddable && la.lots.length > 0) candidates.push(...la.lots.map((lot) => lot.deadline))
  }

  if (candidates.length === 0) return false

  session.clock = Math.max(session.clock, Math.min(...candidates))
  const actions = deadlinePlan(session.game, session.clock).due
  for (const action of actions) session.game = applyCommand(session.game, action, session.ctx)
  return actions.length > 0
}
