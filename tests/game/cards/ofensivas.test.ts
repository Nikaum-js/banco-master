import { describe, it, expect } from 'vitest'
import { playHandCard } from '@/game/cards/draw'
import { transferKeepFee } from '@/game/economy/mortgage'
import { createSeedState, defaultPorts } from '@/game/store'
import type { GameState } from '@/game/turn/types'
import { BOARD } from '@/lib/boardData'

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
  it('SC-001: força a venda de cidade pelo preço de tabela', () => {
    const g = setup('aquisicao-hostil-1')
    const out = playHandCard(g, 'p1', 'aquisicao-hostil-1', defaultPorts, 1) // Roma, price 60
    expect(out.titles[1].ownerId).toBe('p1')
    expect(out.players[0].cash).toBe(2000 - 60)
    expect(out.players[1].cash).toBe(2000 + 60)
    expect(out.players[0].hand).not.toContain('aquisicao-hostil-1')
  })

  it('SC-001: aeroporto/utilidade pagam 1,5×', () => {
    const g = setup('aquisicao-hostil-1')
    g.titles[AIRPORT].ownerId = 'p2' // p2 agora tem 3 não-hipotecadas
    const esperado = Math.round(AIRPORT_PRICE * 1.5)
    const out = playHandCard(g, 'p1', 'aquisicao-hostil-1', defaultPorts, AIRPORT)
    expect(out.titles[AIRPORT].ownerId).toBe('p1')
    expect(out.players[0].cash).toBe(2000 - esperado)
    expect(out.players[1].cash).toBe(2000 + esperado)
  })

  it('SC-001: hipotecada chega hipotecada e cobra a taxa de 10% ao banco', () => {
    const g = setup('aquisicao-hostil-1')
    g.titles[5].ownerId = 'p2' // 3 props; pos1 vai ser a hipotecada, pos3/5 não-hipotecadas (≥2)
    g.titles[1].mortgaged = true
    const fee = transferKeepFee(BOARD[1]) // round((60/2)*0.1)=3
    const out = playHandCard(g, 'p1', 'aquisicao-hostil-1', defaultPorts, 1)
    expect(out.titles[1].ownerId).toBe('p1')
    expect(out.titles[1].mortgaged).toBe(true)
    expect(out.players[0].cash).toBe(2000 - 60 - fee) // preço + taxa
    expect(out.players[1].cash).toBe(2000 + 60) // dono recebe só o preço
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

describe('Despejo (US2)', () => {
  it('SC-002: demole 1 casa; dono não recebe', () => {
    const g = setup('despejo-1')
    g.titles[1].houses = 3
    const out = playHandCard(g, 'p1', 'despejo-1', defaultPorts, 1)
    expect(out.titles[1].houses).toBe(2)
    expect(out.players[1].cash).toBe(2000) // dono não recebe nada
  })

  it('SC-002: sem casa / com hotel / própria / imune → no-op', () => {
    const semCasa = setup('despejo-1')
    expect(playHandCard(semCasa, 'p1', 'despejo-1', defaultPorts, 1)).toBe(semCasa)

    const comHotel = setup('despejo-1')
    comHotel.titles[1].hotel = true
    expect(playHandCard(comHotel, 'p1', 'despejo-1', defaultPorts, 1)).toBe(comHotel)

    const imune = setup('despejo-1')
    imune.titles[1].houses = 2
    imune.tempEffects.push({ kind: 'imunidade-temp', ownerId: 'p2', pos: 1, lapsRemaining: 2 })
    expect(playHandCard(imune, 'p1', 'despejo-1', defaultPorts, 1)).toBe(imune)
  })
})

describe('Auditoria Fiscal (US3)', () => {
  it('SC-003: alvo paga 10% do patrimônio ao pote', () => {
    const g = createSeedState(['p1', 'p2'])
    g.players[0].hand.push('auditoria-fiscal-1') // p2 só caixa → netWorth 2000
    const potAntes = g.centerPot
    const out = playHandCard(g, 'p1', 'auditoria-fiscal-1', defaultPorts, undefined, 'p2')
    expect(out.players[1].cash).toBe(2000 - 200) // 10% de 2000
    expect(out.centerPot).toBe(potAntes + 200)
  })

  it('SC-003: alvo sem caixa paga o que tem; self → no-op', () => {
    const g = createSeedState(['p1', 'p2'])
    g.players[0].hand.push('auditoria-fiscal-1')
    g.players[1].cash = 5
    g.titles[1].ownerId = 'p2' // netWorth = 5 + 60 = 65 → owed 7 > 5
    const out = playHandCard(g, 'p1', 'auditoria-fiscal-1', defaultPorts, undefined, 'p2')
    expect(out.players[1].cash).toBe(0) // pagou o que tinha

    const self = createSeedState(['p1', 'p2'])
    self.players[0].hand.push('auditoria-fiscal-1')
    expect(playHandCard(self, 'p1', 'auditoria-fiscal-1', defaultPorts, undefined, 'p1')).toBe(self)
  })
})
