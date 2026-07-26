// PauseState (041, data-model §1) como reducer PURO, sem host: as sete invariantes que a
// causa e o relógio da pausa precisam sustentar. `applyCommand` é o dispatcher único —
// testar por ele é testar o mesmo caminho que host e cliente percorrem.
import { describe, expect, it } from 'vitest'
import { applyCommand } from '@/game/commands'
import { buildGameCtx, buildInitialGame } from '@/game/setup'
import { mulberry32 } from '../../sim/engine/rng'
import { pausedBy } from '../../net/harness'
import type { GameState } from '@/game/turn/types'

const ctx = () => buildGameCtx(mulberry32(9), () => 1_000)
const game = () => buildInitialGame(['p1', 'p2'], mulberry32(1))

function withAuctionDeadline(g: GameState, deadline: number): GameState {
  return { ...g, resolution: { kind: 'auction', auction: { pos: 1, currentBid: 0, highBidder: null, activeBidders: ['p1'], deadline } } }
}

describe('PauseState — invariantes (041, data-model §1)', () => {
  it('1. pausar do zero cria { causes: [cause], since: at }', () => {
    const g = applyCommand(game(), { kind: 'pause', cause: 'disconnect', at: 100 }, ctx())
    expect(g.paused).toEqual({ causes: ['disconnect'], since: 100 })
  })

  it('2. pausar a mesma causa já ativa é no-op (mesma referência)', () => {
    const g = { ...game(), paused: pausedBy('disconnect', 100) }
    const next = applyCommand(g, { kind: 'pause', cause: 'disconnect', at: 200 }, ctx())
    expect(next).toBe(g)
  })

  it('3. segunda causa entrando NÃO reinicia `since`', () => {
    const g = { ...game(), paused: pausedBy('disconnect', 100) }
    const next = applyCommand(g, { kind: 'pause', cause: 'persistence', at: 300 }, ctx())
    expect(next.paused).toEqual({ causes: ['disconnect', 'persistence'], since: 100 })
  })

  it('4. retomar causa ausente é no-op', () => {
    const g = { ...game(), paused: pausedBy('disconnect', 100) }
    const next = applyCommand(g, { kind: 'resume', cause: 'persistence', at: 500 }, ctx())
    expect(next).toBe(g)
  })

  it('4b. retomar sem pausa nenhuma é no-op', () => {
    const g = game()
    const next = applyCommand(g, { kind: 'resume', cause: 'disconnect', at: 500 }, ctx())
    expect(next).toBe(g)
  })

  it('5. retomar com causa restante NÃO desloca prazo nem muda `since`', () => {
    let g: GameState = { ...game(), paused: pausedBy('disconnect', 100) }
    g = applyCommand(g, { kind: 'pause', cause: 'persistence', at: 300 }, ctx())
    g = withAuctionDeadline(g, 1_000)
    const next = applyCommand(g, { kind: 'resume', cause: 'persistence', at: 900 }, ctx())
    expect(next.paused).toEqual({ causes: ['disconnect'], since: 100 })
    expect(next.resolution?.kind === 'auction' && next.resolution.auction.deadline).toBe(1_000)
  })

  it('6. retomar a ÚLTIMA causa desloca por `at - since` e zera o campo', () => {
    let g: GameState = { ...game(), paused: pausedBy('disconnect', 100) }
    g = withAuctionDeadline(g, 1_000)
    const next = applyCommand(g, { kind: 'resume', cause: 'disconnect', at: 400 }, ctx())
    expect(next.paused).toBe(null)
    expect(next.resolution?.kind === 'auction' && next.resolution.auction.deadline).toBe(1_300) // +300ms
  })

  it('7. `null` ⟺ sem causa', () => {
    expect(game().paused).toBe(null)
  })

  it('8. round-trip JSON preserva causes e since', () => {
    const g = { ...game(), paused: pausedBy('persistence', 42) }
    const roundTripped = JSON.parse(JSON.stringify(g)) as typeof g
    expect(roundTripped.paused).toEqual({ causes: ['persistence'], since: 42 })
  })
})
