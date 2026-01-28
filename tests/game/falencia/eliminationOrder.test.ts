// eliminationOrder (044, D2 do plan): único fato registrado é a ORDEM em que `bankrupt`
// (aqui `declareBankruptcy`) processou cada falência, com a rodada da queda junto — a
// posição final é derivada por `matchSummary`, nunca guardada aqui.
import { describe, it, expect } from 'vitest'
import { declareBankruptcy } from '@/game/falencia/falencia'
import { createSeedState, defaultPorts } from '@/game/setup'
import type { GameState } from '@/game/turn/types'
import type { TurnCtx } from '@/game/turn/turnMachine'

const ctx: TurnCtx = { rng: () => 0, ports: defaultPorts }

// Arma uma dívida insolvente no jogador `playerIdx`, na rodada `round`, e processa a
// falência. Isolado de propósito (sem passar pelo `turnMachine`): o que se testa aqui é
// só o registro, não o fluxo de turno que leva até ele.
function bankruptAt(g: GameState, playerIdx: number, round: number): GameState {
  const s: GameState = structuredClone(g)
  s.activeSeat = playerIdx // turnOrder é identidade em createSeedState
  s.round = round
  s.turn = { ...s.turn, state: 'casa-a-resolver', pendingResolve: true }
  s.resolution = { kind: 'debt', amount: 999_999, creditorId: null } // insolvente de certeza
  s.players[playerIdx].cash = 0
  return declareBankruptcy(s, ctx)
}

describe('eliminationOrder (044)', () => {
  it('mesa de 2: uma falência → um registro', () => {
    const g = createSeedState(['p1', 'p2'])
    const after = bankruptAt(g, 0, 1)
    expect(after.eliminationOrder).toEqual([{ playerId: 'p1', round: 1 }])
  })

  it('mesa de 6 com três falências → três registros, na ORDEM em que rodaram, cada um com sua rodada', () => {
    let g = createSeedState(['p1', 'p2', 'p3', 'p4', 'p5', 'p6'])

    // Ordem de queda deliberadamente distinta da ordem de assento, para provar que o
    // registro segue a SEQUÊNCIA de processamento, não `turnOrder`.
    g = bankruptAt(g, 3, 1) // p4 cai na rodada 1
    expect(g.eliminationOrder).toEqual([{ playerId: 'p4', round: 1 }])

    g = bankruptAt(g, 0, 2) // p1 cai na rodada 2
    expect(g.eliminationOrder).toEqual([
      { playerId: 'p4', round: 1 },
      { playerId: 'p1', round: 2 },
    ])

    g = bankruptAt(g, 5, 5) // p6 cai na rodada 5
    expect(g.eliminationOrder).toEqual([
      { playerId: 'p4', round: 1 },
      { playerId: 'p1', round: 2 },
      { playerId: 'p6', round: 5 },
    ])

    // Nenhum outro jogador foi tocado.
    expect(g.players.filter((p) => p.eliminated).map((p) => p.id).sort()).toEqual(['p1', 'p4', 'p6'])
  })

  it('eliminationOrder.length === players.filter(eliminated).length em todo passo', () => {
    let g = createSeedState(['p1', 'p2', 'p3', 'p4', 'p5', 'p6'])
    const checkInvariant = (state: GameState): void => {
      expect(state.eliminationOrder.length).toBe(state.players.filter((p) => p.eliminated).length)
    }
    checkInvariant(g)

    g = bankruptAt(g, 1, 1)
    checkInvariant(g)

    g = bankruptAt(g, 2, 3)
    checkInvariant(g)

    g = bankruptAt(g, 4, 4)
    checkInvariant(g)
  })

  it('é apenas append: falência anterior nunca é reordenada nem removida', () => {
    let g = createSeedState(['p1', 'p2', 'p3'])
    g = bankruptAt(g, 1, 1) // p2 cai primeiro
    const firstRecord = g.eliminationOrder[0]
    g = bankruptAt(g, 0, 2) // p1 cai depois
    expect(g.eliminationOrder[0]).toEqual(firstRecord)
    expect(g.eliminationOrder).toHaveLength(2)
  })
})
