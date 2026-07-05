// Catálogo fixo de sondas inválidas (036/FR-005, clarify Q3) — 1 sorteada por turno,
// aplicada sobre um clone descartável do estado. Cada entrada é aplicável quando a ação
// que ela dispara é GARANTIDAMENTE inválida no estado atual (para não confundir um
// no-op esperado com uma ação que, por acaso, seria legítima agora).
import { BOARD } from '@/lib/boardData'
import type { GameState } from '@/game/turn/types'
import { activePlayer } from '@/game/turn/turnMachine'
import type { RNG } from '@/game/turn/dice'
import { createSimSession, dispatch, type SimSession } from './driver'
import type { SimAction } from './types'

export interface ProbeEntry {
  name: string
  isApplicable(game: GameState): boolean
  build(game: GameState): SimAction
}

const BOARD_SIZE = BOARD.length

export const INVALID_PROBE_CATALOG: ProbeEntry[] = [
  {
    name: 'comprar-sem-oferta-pendente',
    isApplicable: (g) => g.resolution?.kind !== 'purchase',
    build: () => ({ kind: 'buy-property' }),
  },
  {
    name: 'lance-sem-leilao-aberto',
    isApplicable: (g) => g.resolution?.kind !== 'auction',
    build: (g) => ({ kind: 'place-bid', playerId: g.players[0].id, amount: 1 }),
  },
  {
    name: 'construir-propriedade-alheia',
    isApplicable: (g) => BOARD.some((sq) => sq.kind === 'property' && g.titles[sq.pos]?.ownerId !== activePlayer(g).id),
    build: (g) => {
      const sq = BOARD.find((s) => s.kind === 'property' && g.titles[s.pos]?.ownerId !== activePlayer(g).id)!
      return { kind: 'build-house', pos: sq.pos }
    },
  },
  {
    name: 'hipotecar-propriedade-alheia',
    isApplicable: (g) =>
      BOARD.some((sq) => (sq.kind === 'property' || sq.kind === 'airport' || sq.kind === 'utility') && g.titles[sq.pos]?.ownerId !== activePlayer(g).id),
    build: (g) => {
      const sq = BOARD.find(
        (s) => (s.kind === 'property' || s.kind === 'airport' || s.kind === 'utility') && g.titles[s.pos]?.ownerId !== activePlayer(g).id,
      )!
      return { kind: 'mortgage', pos: sq.pos }
    },
  },
  {
    name: 'jogar-carta-fora-da-mao',
    isApplicable: () => true,
    build: () => ({ kind: 'play-hand-card', cardId: '__sonda-invalida__' }),
  },
  {
    name: 'decisao-prisao-fora-de-janela',
    isApplicable: (g) => g.turn.state !== 'prisao-decisao',
    build: () => ({ kind: 'jail-decision', decision: 'pay' }),
  },
  {
    name: 'finalizar-com-turno-nao-pronto',
    isApplicable: (g) => g.turn.state !== 'aguardando-finalizacao',
    build: () => ({ kind: 'finalize' }),
  },
  {
    name: 'aceitar-troca-inexistente',
    isApplicable: (g) => g.pendingTrade === null,
    build: () => ({ kind: 'accept-trade' }),
  },
  {
    name: 'responder-emprestimo-inexistente',
    isApplicable: (g) => g.pendingLoan === null,
    build: () => ({ kind: 'respond-loan', accept: true, ratePct: 10 }),
  },
  {
    name: 'usar-bus-ticket-sem-saldo',
    isApplicable: (g) => activePlayer(g).busTickets === 0,
    build: (g) => ({ kind: 'use-bus-ticket', dest: (activePlayer(g).pos + 1) % BOARD_SIZE }),
  },
  {
    name: 'rolar-fora-da-janela',
    isApplicable: (g) => g.turn.state !== 'aguardando-rolagem',
    build: () => ({ kind: 'roll' }),
  },
  {
    name: 'lance-terreno-invalido',
    isApplicable: () => true,
    build: (g) => {
      if (g.landAuction && g.landAuction.lots.length > 0) {
        const lot = g.landAuction.lots[0]
        return { kind: 'place-land-bid', playerId: g.players[0].id, pos: lot.pos, amount: lot.currentBid } // ≤ atual: inválido
      }
      return { kind: 'place-land-bid', playerId: g.players[0].id, pos: 1, amount: 1 } // sem pregão aberto: sempre no-op
    },
  },
]

export function pickProbe(rng: RNG, game: GameState): ProbeEntry | null {
  const applicable = INVALID_PROBE_CATALOG.filter((p) => p.isApplicable(game))
  if (applicable.length === 0) return null
  return applicable[Math.floor(rng() * applicable.length)]
}

// Roda a sonda sobre um CLONE descartável (nunca sobre `session` real) e confirma no-op:
// nem exceção, nem mudança de estado (FR-005).
export function applyProbe(session: SimSession, probe: ProbeEntry): { ok: boolean; detail: string } {
  const before = session.game
  const shadow: SimSession = { game: structuredClone(before), ctx: session.ctx, clock: session.clock }
  const action = probe.build(shadow.game)
  try {
    dispatch(shadow, action)
  } catch (e) {
    return { ok: false, detail: `sonda "${probe.name}" lançou exceção: ${e instanceof Error ? e.message : String(e)}` }
  }
  const same = JSON.stringify(before) === JSON.stringify(shadow.game)
  return { ok: same, detail: same ? '' : `sonda "${probe.name}" mutou o estado — deveria ser no-op` }
}

// Reexportado só para o teste de unidade poder montar uma sessão mínima sem duplicar setup.
export { createSimSession }
