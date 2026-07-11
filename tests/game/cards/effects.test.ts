import { describe, it, expect } from 'vitest'
import { applyEffect, netWorth } from '@/game/cards/effects'
import { playHandCard } from '@/game/cards/draw'
import { findReactionCard } from '@/game/cards/reacao'
import { createSeedState } from '@/game/setup'
import type { TurnPorts } from '@/game/turn/resolution'
import { THEME } from '@/game/theme'

// Caixa inicial vem do THEME: um literal aqui trava o balanceamento no teste (D-076).
const CASH0 = THEME.INITIAL_CASH

function ports(extra?: Partial<TurnPorts>): TurnPorts {
  return {
    onPassGo: () => 200, onPayToCenter: () => {}, onCollectCenter: () => 0,
    draw: (state, deckId) => state.decks[deckId].shift() ?? null, // 043 — igual ao default de produção (setup.ts)
    hasReaction: (state, playerId, effect) => findReactionCard(state, playerId, effect) ?? null,
    ...extra,
  }
}

describe('Efeitos de carta (US1)', () => {
  it('SC-004: efeitos de caixa (Aniversário, Erro do banco, Boom)', () => {
    const g = createSeedState(['p1', 'p2', 'p3'])
    applyEffect('aniversario', g, 'p1', ports())
    expect(g.players[0].cash).toBe(CASH0 + 100) // 2 outros × $50
    expect(g.players[1].cash).toBe(CASH0 - 50)
    applyEffect('boomEconomico', g, 'p1', ports())
    expect(g.players[2].cash).toBe(CASH0 - 50 + 200)
  })

  it('SC-004: Honorários e Crise pagam ao centro (Crise poupa quem sacou, D-064)', () => {
    let center = 0
    const p = ports({ onPayToCenter: (_s, a) => { center += a } })
    const g = createSeedState(['p1', 'p2'])
    applyEffect('honorarios', g, 'p1', p)
    expect(g.players[0].cash).toBe(CASH0 - 50)
    applyEffect('criseImobiliaria', g, 'p1', p) // 10% SÓ dos adversários (D-064)
    expect(g.players[0].cash).toBe(CASH0 - 50) // quem sacou não paga
    const dezDoAdversario = Math.round(CASH0 * 0.1)
    expect(g.players[1].cash).toBe(CASH0 - dezDoAdversario) // 10% do patrimônio do adversário
    expect(center).toBe(50 + dezDoAdversario)
  })

  it('SC-004: novas imediatas do Tesouro/Acaso (D-064)', () => {
    let center = 0
    const p = ports({ onPayToCenter: (_s, a) => { center += a } })
    const g = createSeedState(['p1', 'p2'])

    g.centerPot = 501
    applyEffect('resgateDoPote', g, 'p1', p) // metade (piso) do pote
    expect(g.players[0].cash).toBe(CASH0 + 250)
    expect(g.centerPot).toBe(251)

    const caixaAntes = g.players[0].cash
    const dezPct = Math.round(caixaAntes * 0.1)
    applyEffect('desvalorizacaoCambial', g, 'p1', p) // 10% do caixa
    expect(g.players[0].cash).toBe(caixaAntes - dezPct)
    expect(center).toBe(dezPct)

    g.titles[1].ownerId = 'p2'
    g.titles[1].mortgaged = true
    applyEffect('incentivoFiscal', g, 'p2', p) // $50 por hipotecada
    expect(g.players[1].cash).toBe(CASH0 + 50)

    applyEffect('obraRelampago', g, 'p1', p)
    expect(g.players[0].nextBuildFree).toBe(true)

    g.titles[3].ownerId = 'p1'
    g.titles[3].hotel = true
    g.titles[3].hotel2 = true
    const antes = g.players[0].cash
    applyEffect('multaAmbiental', g, 'p1', p) // $50 base + $50×2 hotéis
    expect(g.players[0].cash).toBe(antes - 150)

    applyEffect('estatizacao', g, 'p1', p)
    expect(g.tempEffects.some((e) => e.kind === 'estatizacao')).toBe(true)
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
    expect(netWorth(g, 'p1')).toBe(CASH0 + 60)
    g.titles[1].mortgaged = true
    expect(netWorth(g, 'p1')).toBe(CASH0 + 30)
  })
})
