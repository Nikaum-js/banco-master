// Dispatch de resolução da casa por `kind`.
//
// FRONTEIRA DE SPEC (research D5): esta feature só orquestra *quando* a casa é
// resolvida. As mecânicas internas vivem em specs irmãs e entram por estas portas:
//   - property/airport/utility → Compra & Aluguel (+ Hangar/Balanceamento)
//   - acaso/tesouro            → Sistema de Cartas
//   - bus-ticket               → Bus Tickets
//   - onPassGo / onPayToCenter / onCollectCenter → Mecânicas de Balanceamento
//   - isEliminated             → Falência
// Até a spec dona existir, o handler é um STUB no-op ({ done: true }).
import type { Square } from '@/lib/boardData'
import type { Roll, GameState } from './types'

export interface TurnPorts {
  onPassGo(state: GameState, playerId: string): number // bônus do GO; advance credita o retorno (007)
  onPayToCenter(state: GameState, amount: number): void // imposto/multa/$50 prisão → pote (007)
  onCollectCenter(state: GameState, playerId: string): void // Free Parking: coleta o pote (007)
  isEliminated(playerId: string): boolean
  onInsolvency?(playerId: string, amount: number, creditorId: string | null): void // → Falência (003)
}

export interface ResolveCtx {
  playerId: string
  square: Square
  roll: Roll | null // para utilidades (valor dos dados, FR-027) e Ônibus
  ports: TurnPorts
  state: GameState // clone mutável — economia (003) lê titles/players e abre interação
}

export interface ResolutionOutcome {
  done: boolean
  blocksFinalize?: boolean
}

export type ResolutionHandler = (ctx: ResolveCtx) => ResolutionOutcome

// Mecânica de spec irmã ainda inexistente → resolve imediatamente.
const stub: ResolutionHandler = () => ({ done: true })

export const resolutionRegistry: Record<Square['kind'], ResolutionHandler> = {
  // Stubs de spec irmã:
  property: stub,
  airport: stub,
  utility: stub,
  acaso: stub,
  tesouro: stub,
  'bus-ticket': stub,
  // Roteados pelo turno:
  tax: ({ square, ports, state, playerId }) => {
    if (square.kind === 'tax') {
      const p = state.players.find((x) => x.id === playerId)
      if (p) p.cash -= square.amount // débito real (007 — antes era no-op)
      ports.onPayToCenter(state, square.amount) // → pote
    }
    return { done: true }
  },
  'corner-parking': ({ playerId, ports, state }) => {
    ports.onCollectCenter(state, playerId) // coleta o pote e reseta $500
    return { done: true }
  },
  'corner-go': () => ({ done: true }), // crédito de GO já disparado no movimento
  'corner-jail': stub, // apenas visitando
  'corner-gotojail': stub, // envio à prisão tratado no movimento (turnMachine)
}

export function resolveSquare(ctx: ResolveCtx): ResolutionOutcome {
  return resolutionRegistry[ctx.square.kind](ctx)
}
