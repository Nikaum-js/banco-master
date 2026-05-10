import { describe, it, expect } from 'vitest'
import { buyProperty, declineProperty } from '@/game/economy/purchase'
import { createSeedState, defaultPorts } from '@/game/store'
import { finalizeTurn } from '@/game/turn/turnMachine'
import type { GameState } from '@/game/turn/types'

// Estado parado numa propriedade livre, com o modal de compra aberto.
function setupPurchase(pos: number): GameState {
  const g = createSeedState(['p1', 'p2'])
  g.players[0].pos = pos
  g.turn.state = 'casa-a-resolver'
  g.turn.pendingResolve = true
  g.resolution = { kind: 'purchase', pos }
  return g
}

const ctx = { rng: () => 0, ports: defaultPorts }

describe('Compra (US1)', () => {
  it('SC-001: comprar debita o preço, dá o título e completa a resolução', () => {
    const r = buyProperty(setupPurchase(1)) // Roma, preço 60
    expect(r.titles[1].ownerId).toBe('p1')
    expect(r.players[0].cash).toBe(2000 - 60)
    expect(r.resolution).toBeNull()
    expect(r.turn.state).toBe('aguardando-finalizacao')
  })

  it('SC-001: recusar não cobra e abre leilão', () => {
    const r = declineProperty(setupPurchase(1), 1000)
    expect(r.players[0].cash).toBe(2000)
    expect(r.resolution).toMatchObject({ kind: 'auction', auction: { pos: 1, currentBid: 0 } })
  })

  it('FR-004: caixa insuficiente → comprar é no-op', () => {
    const g = setupPurchase(1)
    g.players[0].cash = 10 // < 60
    const r = buyProperty(g)
    expect(r).toBe(g) // no-op (mesma referência)
    expect(r.titles[1].ownerId).toBeNull()
  })

  it('SC-007: turno não finaliza enquanto a compra está pendente', () => {
    const g = setupPurchase(1)
    expect(finalizeTurn(g, ctx)).toBe(g) // casa-a-resolver + pendingResolve → no-op
    const done = finalizeTurn(buyProperty(g), ctx)
    expect(done.activeSeat).toBe(1) // após comprar, finaliza e passa a vez
  })
})
