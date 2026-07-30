import { describe, it, expect } from 'vitest'
import { createSeedState, defaultPorts } from '@/game/setup'
import { rollDice } from '@/game/turn/turnMachine'
import { resolveSquare } from '@/game/turn/resolution'
import { buyProperty } from '@/game/economy/purchase'
import { economyResolve } from '@/game/economy/resolveRentable'
import { cardResolve } from '@/game/cards/draw'
import { payDebt, declareBankruptcy } from '@/game/falencia/falencia'
import { BOARD } from '@/lib/boardData'
import type { TurnCtx } from '@/game/turn/turnMachine'
import { ctxWith } from './turn/_helpers'

const ctx: TurnCtx = { rng: () => 0, ports: defaultPorts }

// Forma do LogEntry ({who, what}, o helper logEvent, e o teto de 50) é testada em
// tests/game/log/logEntry.test.ts (040). Aqui só as emissões dos reducers reais —
// integração, não a forma do dado.
describe('Log de eventos — emissões do núcleo (021/040)', () => {
  it('SC-001: rollDice loga kind "roll"', () => {
    let g = createSeedState(['p1', 'p2'])
    g = rollDice(g, ctxWith([3, 2]))
    expect(g.log[0]).toEqual({ kind: 'roll', who: 'p1', white: [3, 2], isDouble: false, special: null, speed: null, attempt: false })
  })

  it('SC-001: advance ao cruzar o GO loga kind "go"', () => {
    let g = createSeedState(['p1', 'p2'])
    g.players[0].pos = 44 // 44 + 5 = 49 → cruza o GO (BOARD_SIZE 48), cai em Roma (livre)
    g = rollDice(g, ctxWith([3, 2])) // mockPorts.onPassGo = 200
    expect(g.log.some((l) => l.kind === 'go' && l.who === 'p1' && l.amount === 200 && !l.landed)).toBe(true)
  })

  it('SC-001: buyProperty loga kind "buy"', () => {
    const g = createSeedState(['p1', 'p2'])
    g.players[0].pos = 1
    g.turn.state = 'casa-a-resolver'
    g.turn.pendingResolve = true
    g.resolution = { kind: 'purchase', pos: 1 }
    const r = buyProperty(g)
    expect(r.log.at(-1)).toEqual({ kind: 'buy', who: 'p1', pos: 1, price: 60 })
  })

  it('SC-001: aluguel pago loga kind "rent"', () => {
    const g = createSeedState(['p1', 'p2'])
    g.titles[1].ownerId = 'p2' // Roma base = 2
    economyResolve({ playerId: 'p1', square: BOARD[1], roll: null, ports: defaultPorts, state: g })
    expect(g.log.at(-1)).toEqual({ kind: 'rent', who: 'p1', pos: 1, amount: 2, ownerId: 'p2' })
  })

  it('SC-001: imposto pago loga kind "tax"', () => {
    const g = createSeedState(['p1', 'p2'])
    resolveSquare({ playerId: 'p1', square: BOARD[4], roll: null, ports: defaultPorts, state: g }) // Imposto de Renda 200
    expect(g.log.at(-1)).toEqual({ kind: 'tax', who: 'p1', amount: 200 })
  })

  it('SC-001: payDebt loga kind "debt-paid"', () => {
    const g = createSeedState(['p1', 'p2'])
    g.turn.state = 'casa-a-resolver'
    g.turn.pendingResolve = true
    g.resolution = { kind: 'debt', amount: 50, creditorId: 'p2' }
    const r = payDebt(g)
    expect(r.log.at(-1)).toEqual({ kind: 'debt-paid', who: 'p1', amount: 50, creditorId: 'p2' }) // `creditorId`: D-063
  })

  it('SC-001: declareBankruptcy loga kind "bankruptcy"', () => {
    const g = createSeedState(['p1', 'p2', 'p3'])
    g.players[0].cash = 10
    g.turn.state = 'casa-a-resolver'
    g.turn.pendingResolve = true
    g.resolution = { kind: 'debt', amount: 500, creditorId: 'p2' }
    const r = declareBankruptcy(g, ctx)
    expect(r.log.some((l) => l.kind === 'bankruptcy' && l.who === 'p1')).toBe(true)
  })

  it('SC-002: saque loga só o deck (privacidade) — kind "card-draw"', () => {
    const ga = createSeedState(['p1', 'p2'])
    cardResolve({ playerId: 'p1', square: BOARD[8], roll: null, ports: defaultPorts, state: ga }) // pos 8 = Acaso
    expect(ga.log.at(-1)).toEqual({ kind: 'card-draw', who: 'p1', deck: 'acaso' })

    const gt = createSeedState(['p1', 'p2'])
    cardResolve({ playerId: 'p1', square: BOARD[2], roll: null, ports: defaultPorts, state: gt }) // pos 2 = Tesouro
    expect(gt.log.at(-1)).toEqual({ kind: 'card-draw', who: 'p1', deck: 'tesouro' })
  })
})
