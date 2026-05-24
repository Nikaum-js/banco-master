import { describe, it, expect } from 'vitest'
import { liquidationValue, isBankrupt, payDebt, declareBankruptcy, checkEndGame } from '@/game/falencia/falencia'
import { createSeedState, defaultPorts } from '@/game/store'
import type { GameState } from '@/game/turn/types'
import type { TurnCtx } from '@/game/turn/turnMachine'

const ctx: TurnCtx = { rng: () => 0, ports: defaultPorts }

// Estado com dívida pendente do jogador ativo (p1).
function withDebt(creditorId: string | null, amount: number): GameState {
  const g = createSeedState(['p1', 'p2', 'p3'])
  g.turn.state = 'casa-a-resolver'
  g.turn.pendingResolve = true
  g.resolution = { kind: 'debt', amount, creditorId }
  return g
}

describe('Falência (US1)', () => {
  it('SC-001: isBankrupt quando a liquidação total < dívida', () => {
    const g = createSeedState(['p1', 'p2'])
    g.players[0].cash = 100
    expect(liquidationValue(g, 'p1')).toBe(100)
    expect(isBankrupt(g, 'p1', 150)).toBe(true)
    expect(isBankrupt(g, 'p1', 80)).toBe(false)
    g.titles[1].ownerId = 'p1' // Roma (price 60) não-hipotecada → +30
    expect(liquidationValue(g, 'p1')).toBe(130)
  })

  it('SC-002: payDebt paga ao credor e libera o turno', () => {
    const g = withDebt('p2', 50)
    g.players[0].cash = 200
    const after = payDebt(g)
    expect(after.players[0].cash).toBe(150)
    expect(after.players[1].cash).toBe(2050)
    expect(after.resolution).toBeNull()
    expect(after.turn.state).toBe('aguardando-finalizacao')
  })

  it('SC-002: falir devendo a jogador → propriedades + caixa ao credor; eliminado', () => {
    const g = withDebt('p2', 500)
    g.players[0].cash = 100
    g.titles[1].ownerId = 'p1'
    g.titles[3].ownerId = 'p1'
    const after = declareBankruptcy(g, ctx)
    expect(after.players[0].eliminated).toBe(true)
    expect(after.players[0].cash).toBe(0)
    expect(after.players[1].cash).toBe(2000 + 100)
    expect(after.titles[1].ownerId).toBe('p2')
    expect(after.titles[3].ownerId).toBe('p2')
    expect(after.resolution).toBeNull()
  })

  it('SC-002: falir devendo ao banco → propriedades voltam ao banco; construção ao estoque', () => {
    const g = withDebt(null, 500)
    g.titles[1].ownerId = 'p1'
    g.titles[1].hotel = true
    const hotelsBefore = g.bank.hotels
    const after = declareBankruptcy(g, ctx)
    expect(after.players[0].eliminated).toBe(true)
    expect(after.titles[1].ownerId).toBeNull()
    expect(after.titles[1].hotel).toBe(false)
    expect(after.bank.hotels).toBe(hotelsBefore + 1)
  })

  it('SC-003: turno pula o eliminado', () => {
    const after = declareBankruptcy(withDebt('p2', 500), ctx) // p1 (seat 0) falir
    expect(after.activeSeat).not.toBe(0)
    expect(after.players[after.turnOrder[after.activeSeat]].eliminated).toBe(false)
  })
})

describe('Fim de jogo (US2)', () => {
  it('SC-004: 1 não-eliminado → ended; ≥2 → playing', () => {
    const g = createSeedState(['p1', 'p2'])
    checkEndGame(g)
    expect(g.phase).toBe('playing')
    g.players[1].eliminated = true
    checkEndGame(g)
    expect(g.phase).toBe('ended')
  })

  it('SC-004: última falência encerra a partida com o vencedor', () => {
    const g = withDebt(null, 500)
    g.players[2].eliminated = true // sobram p1 e p2; p1 vai falir
    const after = declareBankruptcy(g, ctx)
    expect(after.phase).toBe('ended')
    expect(after.players.filter((p) => !p.eliminated)).toHaveLength(1)
    expect(after.players[1].eliminated).toBe(false) // p2 vence
  })

  it('round-trip JSON com a dívida pendente', () => {
    const g = withDebt('p2', 50)
    expect(JSON.parse(JSON.stringify(g))).toEqual(g)
  })
})
