import { describe, it, expect } from 'vitest'
import { logEvent } from '@/game/log'
import { createSeedState, defaultPorts } from '@/game/store'
import { rollDice } from '@/game/turn/turnMachine'
import { resolveSquare } from '@/game/turn/resolution'
import { buyProperty } from '@/game/economy/purchase'
import { economyResolve } from '@/game/economy/resolveRentable'
import { cardResolve } from '@/game/cards/draw'
import { payDebt, declareBankruptcy } from '@/game/falencia/falencia'
import { BOARD } from '@/lib/boardData'
import type { GameState } from '@/game/turn/types'
import type { TurnCtx } from '@/game/turn/turnMachine'
import { ctxWith } from './turn/_helpers'

const ctx: TurnCtx = { rng: () => 0, ports: defaultPorts }

describe('Log de eventos — helper (021)', () => {
  it('logEvent acrescenta {who, what} ao fim do log', () => {
    const g = createSeedState(['p1', 'p2'])
    logEvent(g, 'p1', 'fez algo')
    expect(g.log).toEqual([{ who: 'p1', what: 'fez algo' }])
  })

  it('SC-003: log é limitado a 50 — descarta os mais antigos', () => {
    const g = createSeedState(['p1', 'p2'])
    for (let i = 0; i < 60; i++) logEvent(g, 'p1', `evento ${i}`)
    expect(g.log).toHaveLength(50)
    expect(g.log[0].what).toBe('evento 10') // os 10 primeiros saíram
    expect(g.log[49].what).toBe('evento 59') // o mais recente fica no fim
  })
})

describe('Log de eventos — emissões do núcleo (021)', () => {
  it('SC-001: rollDice loga "rolou a+b"', () => {
    let g = createSeedState(['p1', 'p2'])
    g = rollDice(g, ctxWith([3, 2]))
    expect(g.log[0]).toEqual({ who: 'p1', what: 'rolou 3+2' })
  })

  it('SC-001: advance ao cruzar o GO loga "passou pelo GO (+$bônus)"', () => {
    let g = createSeedState(['p1', 'p2'])
    g.players[0].pos = 44 // 44 + 5 = 49 → cruza o GO (BOARD_SIZE 48), cai em Roma (livre)
    g = rollDice(g, ctxWith([3, 2])) // mockPorts.onPassGo = 200
    expect(g.log.some((l) => l.who === 'p1' && l.what === 'passou pelo GO (+$200)')).toBe(true)
  })

  it('SC-001: buyProperty loga "comprou {nome} por ${preço}"', () => {
    const g = createSeedState(['p1', 'p2'])
    g.players[0].pos = 1
    g.turn.state = 'casa-a-resolver'
    g.turn.pendingResolve = true
    g.resolution = { kind: 'purchase', pos: 1 }
    const r = buyProperty(g)
    expect(r.log.at(-1)).toEqual({ who: 'p1', what: 'comprou Roma por $60' })
  })

  it('SC-001: aluguel pago loga "pagou ${valor} de aluguel a {dono}"', () => {
    const g = createSeedState(['p1', 'p2'])
    g.titles[1].ownerId = 'p2' // Roma base = 2
    economyResolve({ playerId: 'p1', square: BOARD[1], roll: null, ports: defaultPorts, state: g })
    expect(g.log.at(-1)).toEqual({ who: 'p1', what: 'pagou $2 de aluguel a p2' })
  })

  it('SC-001: imposto pago loga "pagou ${valor} de imposto"', () => {
    const g = createSeedState(['p1', 'p2'])
    resolveSquare({ playerId: 'p1', square: BOARD[4], roll: null, ports: defaultPorts, state: g }) // Imposto de Renda 200
    expect(g.log.at(-1)).toEqual({ who: 'p1', what: 'pagou $200 de imposto' })
  })

  it('SC-001: payDebt loga "pagou dívida ${valor}"', () => {
    const g = createSeedState(['p1', 'p2'])
    g.turn.state = 'casa-a-resolver'
    g.turn.pendingResolve = true
    g.resolution = { kind: 'debt', amount: 50, creditorId: 'p2' }
    const r = payDebt(g)
    expect(r.log.at(-1)).toEqual({ who: 'p1', what: 'pagou dívida $50' })
  })

  it('SC-001: declareBankruptcy loga "faliu"', () => {
    const g = createSeedState(['p1', 'p2', 'p3'])
    g.players[0].cash = 10
    g.turn.state = 'casa-a-resolver'
    g.turn.pendingResolve = true
    g.resolution = { kind: 'debt', amount: 500, creditorId: 'p2' }
    const r = declareBankruptcy(g, ctx)
    expect(r.log.some((l) => l.who === 'p1' && l.what === 'faliu')).toBe(true)
  })

  it('SC-002: saque loga só o deck (privacidade) — "sacou Acaso"/"sacou Tesouro"', () => {
    const ga = createSeedState(['p1', 'p2'])
    cardResolve({ playerId: 'p1', square: BOARD[8], roll: null, ports: defaultPorts, state: ga }) // pos 8 = Acaso
    expect(ga.log.at(-1)).toEqual({ who: 'p1', what: 'sacou Acaso' })

    const gt = createSeedState(['p1', 'p2'])
    cardResolve({ playerId: 'p1', square: BOARD[2], roll: null, ports: defaultPorts, state: gt }) // pos 2 = Tesouro
    expect(gt.log.at(-1)).toEqual({ who: 'p1', what: 'sacou Tesouro' })
  })
})
