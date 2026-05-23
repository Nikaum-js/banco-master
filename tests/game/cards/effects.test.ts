import { describe, it, expect } from 'vitest'
import { applyEffect, netWorth } from '@/game/cards/effects'
import { playHandCard } from '@/game/cards/draw'
import { createSeedState } from '@/game/store'
import type { TurnPorts } from '@/game/turn/resolution'

function ports(extra?: Partial<TurnPorts>): TurnPorts {
  return { onPassGo: () => 200, onPayToCenter: () => {}, onCollectCenter: () => 0, isEliminated: () => false, ...extra }
}

describe('Efeitos de carta (US1)', () => {
  it('SC-004: efeitos de caixa (Aniversário, Erro do banco, Boom)', () => {
    const g = createSeedState(['p1', 'p2', 'p3'])
    applyEffect('aniversario', g, 'p1', ports())
    expect(g.players[0].cash).toBe(2000 + 100) // 2 outros × $50
    expect(g.players[1].cash).toBe(1950)
    applyEffect('boomEconomico', g, 'p1', ports())
    expect(g.players[2].cash).toBe(1950 + 200)
  })

  it('SC-004: Honorários e Crise pagam ao centro', () => {
    let center = 0
    const p = ports({ onPayToCenter: (a) => { center += a } })
    const g = createSeedState(['p1', 'p2'])
    applyEffect('honorarios', g, 'p1', p)
    expect(g.players[0].cash).toBe(1950)
    applyEffect('criseImobiliaria', g, 'p1', p) // 5% de 1950 e de 2000
    expect(g.players[0].cash).toBe(1950 - Math.round(1950 * 0.05))
    expect(g.players[1].cash).toBe(2000 - 100)
    expect(center).toBe(50 + Math.round(1950 * 0.05) + 100)
  })

  it('SC-004: Investidor Anjo marca desconto; Passagem de Ônibus +ticket', () => {
    const g = createSeedState(['p1', 'p2'])
    applyEffect('investidorAnjo', g, 'p1', ports())
    expect(g.players[0].nextPurchaseDiscount).toBe(0.2)
    applyEffect('passagemOnibus', g, 'p1', ports())
    expect(g.players[0].busTickets).toBe(1)
  })

  it('SC-004: movimento Volta para o GO e Vá para a Prisão', () => {
    const g = createSeedState(['p1', 'p2'])
    g.players[0].pos = 20
    applyEffect('voltaGo', g, 'p1', ports())
    expect(g.players[0].pos).toBe(0)
    applyEffect('vaPrisao', g, 'p1', ports())
    expect(g.players[0].pos).toBe(12)
    expect(g.players[0].jail.inJail).toBe(true)
  })

  it('SC-005: carta deferida (Aquisição Hostil) → no-op seguro', () => {
    const g = createSeedState(['p1', 'p2'])
    const before = JSON.stringify(g.players)
    applyEffect('aquisicaoHostil', g, 'p1', ports())
    expect(JSON.stringify(g.players)).toBe(before)
  })

  it('SC-007: Saia da Prisão (mão, preso) sai via playHandCard', () => {
    const g = createSeedState(['p1', 'p2'])
    g.players[0].pos = 12
    g.players[0].jail = { inJail: true, attempts: 1 }
    g.players[0].hand = ['saia-prisao-1']
    const after = playHandCard(g, 'p1', 'saia-prisao-1', ports())
    expect(after.players[0].jail.inJail).toBe(false)
    expect(after.players[0].hand).not.toContain('saia-prisao-1')
    expect(after.decks.tesouro).toContain('saia-prisao-1') // voltou ao fundo
  })

  it('netWorth = caixa + propriedades + construções (hipotecada ÷2)', () => {
    const g = createSeedState(['p1', 'p2'])
    g.titles[1].ownerId = 'p1' // Roma, price 60
    expect(netWorth(g, 'p1')).toBe(2000 + 60)
    g.titles[1].mortgaged = true
    expect(netWorth(g, 'p1')).toBe(2000 + 30)
  })
})
