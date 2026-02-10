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
import type { RNG } from './dice'
import { logEvent } from '../log'

export interface TurnPorts {
  onPassGo(state: GameState, playerId: string): number // bônus do GO; advance credita o retorno (007)
  onPayToCenter(state: GameState, amount: number): void // imposto/multa/$50 prisão → pote (007)
  onCollectCenter(state: GameState, playerId: string): void // Free Parking: coleta o pote (007)
  isEliminated(playerId: string): boolean
  onInsolvency?(playerId: string, amount: number, creditorId: string | null): void // → Falência (003)
  afterPassGo?(state: GameState, playerId: string): void // → juros de empréstimo no GO (010)
  taxMan?(state: GameState, rng: RNG): void // → Fiscal move 1×/turno e cobra o dono (012)
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
  // Espaço Bus Ticket (009; SRS §2.7): parar GANHA 1 Bus Ticket guardado — uso é
  // facultativo depois (antes de rolar, §10.7). Não força viagem na hora
  // (revertido D-021 em 2026-05-27: não obrigar o jogador a usar ao parar).
  'bus-ticket': ({ state, playerId }) => {
    const p = state.players.find((x) => x.id === playerId)
    if (p) p.busTickets += 1
    logEvent(state, playerId, 'parou no espaço Bus Ticket — ganhou 1 Bus Ticket') // 021
    return { done: true }
  },
  // Roteados pelo turno:
  tax: ({ square, ports, state, playerId }) => {
    if (square.kind !== 'tax') return { done: true }
    const p = state.players.find((x) => x.id === playerId)
    if (p && p.cash < square.amount) {
      state.resolution = { kind: 'debt', amount: square.amount, creditorId: null } // dívida ao banco (008)
      return { done: false, blocksFinalize: true }
    }
    if (p) p.cash -= square.amount // débito real (007)
    ports.onPayToCenter(state, square.amount) // → pote
    logEvent(state, playerId, `pagou $${square.amount} de imposto`) // 021
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
