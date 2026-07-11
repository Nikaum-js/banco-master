import { describe, it, expect } from 'vitest'
import { playHandCard } from '@/game/cards/draw'
import { transferKeepFee } from '@/game/economy/mortgage'
import { createSeedState, defaultPorts } from '@/game/setup'
import type { GameState } from '@/game/turn/types'
import { BOARD } from '@/lib/boardData'
import { THEME } from '@/game/theme'

// Caixa inicial vem do THEME: um literal aqui trava o balanceamento no teste (D-076).
const CASH0 = THEME.INITIAL_CASH

const AIRPORT = BOARD.find((s) => s.kind === 'airport')!.pos
const AIRPORT_PRICE = 'price' in BOARD[AIRPORT] ? (BOARD[AIRPORT] as { price: number }).price : 0

// p1 (ativo) com a carta na mão; p2 dono de pos 1 e pos 3 (brown), não-hipotecadas.
function setup(card: string): GameState {
  const g = createSeedState(['p1', 'p2', 'p3'])
  g.players[0].hand.push(card)
  g.titles[1].ownerId = 'p2'
  g.titles[3].ownerId = 'p2'
  return g
}

describe('Aquisição Hostil (US1)', () => {
  it('SC-001: força a venda de cidade pela METADE do preço de tabela (D-064)', () => {
    const g = setup('aquisicao-hostil-1')
    const out = playHandCard(g, 'p1', 'aquisicao-hostil-1', defaultPorts, 1) // Roma, price 60 → paga 30
    expect(out.titles[1].ownerId).toBe('p1')
    expect(out.players[0].cash).toBe(CASH0 - 30)
    expect(out.players[1].cash).toBe(CASH0 + 30)
    expect(out.players[0].hand).not.toContain('aquisicao-hostil-1')
  })

  it('SC-001: aeroporto/utilidade pagam 1,5× sobre a metade (D-064)', () => {
    const g = setup('aquisicao-hostil-1')
    g.titles[AIRPORT].ownerId = 'p2' // p2 agora tem 3 não-hipotecadas
    const esperado = Math.round(AIRPORT_PRICE * 0.5 * 1.5)
    const out = playHandCard(g, 'p1', 'aquisicao-hostil-1', defaultPorts, AIRPORT)
    expect(out.titles[AIRPORT].ownerId).toBe('p1')
    expect(out.players[0].cash).toBe(CASH0 - esperado)
    expect(out.players[1].cash).toBe(CASH0 + esperado)
  })

  it('SC-001: hipotecada chega hipotecada e cobra a taxa de 10% ao banco', () => {
    const g = setup('aquisicao-hostil-1')
    g.titles[5].ownerId = 'p2' // 3 props; pos1 vai ser a hipotecada, pos3/5 não-hipotecadas (≥2)
    g.titles[1].mortgaged = true
    const fee = transferKeepFee(BOARD[1]) // round((60/2)*0.1)=3
    const out = playHandCard(g, 'p1', 'aquisicao-hostil-1', defaultPorts, 1)
    expect(out.titles[1].ownerId).toBe('p1')
    expect(out.titles[1].mortgaged).toBe(true)
    expect(out.players[0].cash).toBe(CASH0 - 30 - fee) // metade do preço + taxa (D-064)
    expect(out.players[1].cash).toBe(CASH0 + 30) // dono recebe só a metade
  })

  it('SC-004: gates → no-op (própria, construção, <2 não-hipotecadas, imune, sem caixa)', () => {
    const propria = setup('aquisicao-hostil-1')
    propria.titles[1].ownerId = 'p1'
    expect(playHandCard(propria, 'p1', 'aquisicao-hostil-1', defaultPorts, 1)).toBe(propria)

    const comCasa = setup('aquisicao-hostil-1')
    comCasa.titles[1].houses = 1
    expect(playHandCard(comCasa, 'p1', 'aquisicao-hostil-1', defaultPorts, 1)).toBe(comCasa)

    const poucas = createSeedState(['p1', 'p2'])
    poucas.players[0].hand.push('aquisicao-hostil-1')
    poucas.titles[1].ownerId = 'p2' // só 1 não-hipotecada
    expect(playHandCard(poucas, 'p1', 'aquisicao-hostil-1', defaultPorts, 1)).toBe(poucas)

    const imune = setup('aquisicao-hostil-1')
    imune.tempEffects.push({ kind: 'imunidade-temp', ownerId: 'p2', pos: 1, lapsRemaining: 2 })
    expect(playHandCard(imune, 'p1', 'aquisicao-hostil-1', defaultPorts, 1)).toBe(imune)

    const semCaixa = setup('aquisicao-hostil-1')
    semCaixa.players[0].cash = 10
    expect(playHandCard(semCaixa, 'p1', 'aquisicao-hostil-1', defaultPorts, 1)).toBe(semCaixa)
  })
})

describe('Confisco Geral (US2, D-064)', () => {
  it('SC-002: demole TODAS as construções; dono mantém o terreno e não recebe', () => {
    const g = setup('confisco-geral-1')
    g.titles[1].houses = 3
    const out = playHandCard(g, 'p1', 'confisco-geral-1', defaultPorts, 1)
    expect(out.titles[1].houses).toBe(0)
    expect(out.titles[1].ownerId).toBe('p2') // terreno fica com o dono
    expect(out.players[1].cash).toBe(CASH0) // dono não recebe nada
  })

  it('SC-002: derruba hotel, 2º hotel e arranha-céu de uma vez', () => {
    const g = setup('confisco-geral-1')
    g.titles[1].hotel = true
    g.titles[1].hotel2 = true
    g.titles[1].skyscraper = true
    const out = playHandCard(g, 'p1', 'confisco-geral-1', defaultPorts, 1)
    expect(out.titles[1].hotel).toBe(false)
    expect(out.titles[1].hotel2).toBe(false)
    expect(out.titles[1].skyscraper).toBe(false)
  })

  it('SC-002: sem construção / própria / imune → no-op', () => {
    const semCasa = setup('confisco-geral-1')
    expect(playHandCard(semCasa, 'p1', 'confisco-geral-1', defaultPorts, 1)).toBe(semCasa)

    const propria = setup('confisco-geral-1')
    propria.titles[1].ownerId = 'p1'
    propria.titles[1].houses = 2
    expect(playHandCard(propria, 'p1', 'confisco-geral-1', defaultPorts, 1)).toBe(propria)

    const imune = setup('confisco-geral-1')
    imune.titles[1].houses = 2
    imune.tempEffects.push({ kind: 'imunidade-temp', ownerId: 'p2', pos: 1, lapsRemaining: 2 })
    expect(playHandCard(imune, 'p1', 'confisco-geral-1', defaultPorts, 1)).toBe(imune)
  })
})

describe('Imposto Federal (US3, D-064)', () => {
  it('SC-003: alvo paga 25% do patrimônio ao pote', () => {
    const g = createSeedState(['p1', 'p2'])
    g.players[0].hand.push('imposto-federal-1') // p2 só caixa → netWorth CASH0
    const potAntes = g.centerPot
    const out = playHandCard(g, 'p1', 'imposto-federal-1', defaultPorts, undefined, 'p2')
    const quarto = Math.round(CASH0 * 0.25) // 25% do patrimônio, que aqui é só caixa
    expect(out.players[1].cash).toBe(CASH0 - quarto)
    expect(out.centerPot).toBe(potAntes + quarto)
  })

  it('SC-003: alvo sem caixa paga o que tem; self → no-op', () => {
    const g = createSeedState(['p1', 'p2'])
    g.players[0].hand.push('imposto-federal-1')
    g.players[1].cash = 5
    g.titles[1].ownerId = 'p2' // netWorth = 5 + 60 = 65 → owed 16 > 5
    const out = playHandCard(g, 'p1', 'imposto-federal-1', defaultPorts, undefined, 'p2')
    expect(out.players[1].cash).toBe(0) // pagou o que tinha

    const self = createSeedState(['p1', 'p2'])
    self.players[0].hand.push('imposto-federal-1')
    expect(playHandCard(self, 'p1', 'imposto-federal-1', defaultPorts, undefined, 'p1')).toBe(self)
  })
})
