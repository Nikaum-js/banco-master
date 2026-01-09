import { describe, it, expect } from 'vitest'
import { declareBankruptcy } from '@/game/falencia/falencia'
import { createSeedState, defaultPorts } from '@/game/store'
import type { GameState } from '@/game/turn/types'
import type { TurnCtx } from '@/game/turn/turnMachine'

const ctx: TurnCtx = { rng: () => 0, ports: defaultPorts }

// p1 (ativo) em dívida que não cobre → vai falir/eliminar.
function withDebt(): GameState {
  const g = createSeedState(['p1', 'p2', 'p3'])
  g.turn.state = 'casa-a-resolver'
  g.turn.pendingResolve = true
  g.resolution = { kind: 'debt', amount: 5000, creditorId: null } // > liquidação → falir
  g.players[0].cash = 0
  return g
}

describe('Limpeza na eliminação §9.4 (019)', () => {
  it('SC-001/002: remove imunidades concedidas/recebidas e tempEffects do eliminado; terceiros intactos', () => {
    const g = withDebt()
    // p1 (vai eliminar) concedeu uma imunidade e recebeu outra; e originou efeitos
    g.immunities.push({ beneficiaryId: 'p2', pos: 1, lapsRemaining: 3, granterId: 'p1' }) // concedida por p1
    g.immunities.push({ beneficiaryId: 'p1', pos: 3, lapsRemaining: null, granterId: 'p2' }) // recebida por p1
    g.tempEffects.push({ kind: 'boicote', ownerId: 'p1', pos: 5, lapsRemaining: 2 }) // originado por p1
    // terceiros (não envolvem p1) — devem permanecer
    g.immunities.push({ beneficiaryId: 'p2', pos: 7, lapsRemaining: 2, granterId: 'p3' })
    g.tempEffects.push({ kind: 'apagao', ownerId: 'p2', pos: null, lapsRemaining: 1 })

    const out = declareBankruptcy(g, ctx)
    expect(out.players[0].eliminated).toBe(true)
    // do eliminado: removidos
    expect(out.immunities.find((i) => i.granterId === 'p1')).toBeUndefined()
    expect(out.immunities.find((i) => i.beneficiaryId === 'p1')).toBeUndefined()
    expect(out.tempEffects.find((e) => e.ownerId === 'p1')).toBeUndefined()
    // de terceiros: intactos
    expect(out.immunities).toContainEqual({ beneficiaryId: 'p2', pos: 7, lapsRemaining: 2, granterId: 'p3' })
    expect(out.tempEffects.find((e) => e.ownerId === 'p2')).toBeDefined()
  })

  it('SC-003: sem imunidades/efeitos do eliminado, nada de terceiros é tocado', () => {
    const g = withDebt()
    g.immunities.push({ beneficiaryId: 'p2', pos: 1, lapsRemaining: 3, granterId: 'p3' })
    g.tempEffects.push({ kind: 'greve', ownerId: 'p2', pos: null, lapsRemaining: 1 })
    const out = declareBankruptcy(g, ctx)
    expect(out.immunities).toHaveLength(1)
    expect(out.tempEffects).toHaveLength(1)
  })
})
