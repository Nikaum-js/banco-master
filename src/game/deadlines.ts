// Política temporal única de Leilão e Pregão.
//
// O estado guarda deadlines serializáveis; este module responde, por uma interface pura,
// quais comandos de sistema venceram e quando o próximo despertar precisa acontecer.
// Browser, autoridade multiplayer e simulação usam a mesma decisão com relógios diferentes.
import type { SystemAction } from './commands'
import type { GameState } from './turn/types'

export interface DeadlinePlan {
  due: SystemAction[]
  next: number | null
}

export function deadlinePlan(game: GameState, now: number): DeadlinePlan {
  if (game.paused) return { due: [], next: null }

  const due: SystemAction[] = []
  const future: number[] = []

  if (game.resolution?.kind === 'auction') {
    const deadline = game.resolution.auction.deadline
    if (deadline <= now) due.push({ kind: 'close-auction' })
    else future.push(deadline)
  }

  if (game.landAuction) {
    const deadlines = game.landAuction.lots.map((lot) => lot.deadline)
    if (deadlines.some((deadline) => deadline <= now)) {
      due.push({ kind: 'close-land-lots', now })
    }
    for (const deadline of deadlines) if (deadline > now) future.push(deadline)
  }

  return {
    due,
    next: future.length > 0 ? Math.min(...future) : null,
  }
}
