import { describe, it, expect } from 'vitest'
import { handCardsView, cardTargets } from '@/game/ui/cards/handView'
import { createSeedState } from '@/game/store'
import type { GameState } from '@/game/turn/types'

// p1 é o jogador ativo (activeSeat 0). pos 1 e 7 são cidades; pos 6 é aeroporto.
function setup(): GameState {
  const g = createSeedState(['p1', 'p2', 'p3'])
  g.players[0].cash = 5000 // caixa folgado p/ Aquisição
  return g
}
const handOf = (g: GameState, id: string, ...ids: string[]) => {
  g.players[0].hand = [id, ...ids]
  return g
}
const find = (g: GameState, pid: string, cardId: string) => handCardsView(g, pid).find((c) => c.id === cardId)!

describe('handCardsView — jogável por timing (US1)', () => {
  it('SC-002: carta de reação (Diplomacia) → não jogável, motivo de reação', () => {
    const g = handOf(setup(), 'diplomacia-1')
    const v = find(g, 'p1', 'diplomacia-1')
    expect(v.playable).toBe(false)
    expect(v.reason).toMatch(/reação/i)
  })

  it('SC-002: carta de próprio turno na mão de quem NÃO é a vez → "Só no seu turno"', () => {
    const g = setup()
    g.players[1].hand = ['boicote-1'] // p2 não é o ativo
    const v = handCardsView(g, 'p2').find((c) => c.id === 'boicote-1')!
    expect(v.playable).toBe(false)
    expect(v.reason).toBe('Só no seu turno')
  })

  it('SC-002: "Saia da Prisão" só jogável preso', () => {
    const livre = handOf(setup(), 'saia-prisao-1')
    expect(find(livre, 'p1', 'saia-prisao-1').playable).toBe(false)
    expect(find(livre, 'p1', 'saia-prisao-1').reason).toBe('Só quando preso')

    const preso = handOf(setup(), 'saia-prisao-1')
    preso.players[0].jail.inJail = true
    const v = find(preso, 'p1', 'saia-prisao-1')
    expect(v.playable).toBe(true)
    expect(v.needsTarget).toBe(false)
  })

  it('campos de apresentação derivados (label/desc/cor)', () => {
    const g = handOf(setup(), 'boicote-1')
    g.titles[7].ownerId = 'p2' // alvo válido p/ ficar jogável
    const v = find(g, 'p1', 'boicote-1')
    expect(v.label).toBe('Boicote')
    expect(v.rarityColor).toBe('#3b82f6') // rara = azul
    expect(v.desc.length).toBeGreaterThan(0)
    expect(v.playable).toBe(true)
  })

  it('SC-003: carta de alvo sem nenhum alvo válido → "Sem alvo válido"', () => {
    const g = handOf(setup(), 'despejo-1') // ninguém tem casa para demolir
    const v = find(g, 'p1', 'despejo-1')
    expect(v.playable).toBe(false)
    expect(v.reason).toBe('Sem alvo válido')
  })
})

describe('cardTargets — alvos válidos por carta (US2)', () => {
  it('SC-003: Imunidade Temporária → só propriedades próprias', () => {
    const g = setup()
    g.titles[1].ownerId = 'p1'
    g.titles[7].ownerId = 'p2'
    const t = cardTargets(g, 'p1', 'imunidade-1')!
    expect(t.positions).toContain(1)
    expect(t.positions).not.toContain(7)
  })

  it('SC-003: Aquisição Hostil → propriedade de outro, sem construção, dono ≥2 não-hipotecadas', () => {
    const g = setup()
    g.titles[7].ownerId = 'p2'
    g.titles[9].ownerId = 'p2' // p2 tem 2 não-hipotecadas
    const t = cardTargets(g, 'p1', 'aquisicao-hostil-1')!
    expect(t.positions).toContain(7)
    expect(t.positions).not.toContain(1) // sem dono
    // com construção deixa de ser elegível
    g.titles[7].houses = 1
    expect(cardTargets(g, 'p1', 'aquisicao-hostil-1')!.positions).not.toContain(7)
  })

  it('SC-003: Despejo → só cidade de outro com ≥1 casa (não hotel)', () => {
    const g = setup()
    g.titles[7].ownerId = 'p2'
    expect(cardTargets(g, 'p1', 'despejo-1')!.positions).not.toContain(7) // sem casa
    g.titles[7].houses = 1
    expect(cardTargets(g, 'p1', 'despejo-1')!.positions).toContain(7)
  })

  it('SC-003: Boicote → propriedade de outro jogador (não a própria)', () => {
    const g = setup()
    g.titles[1].ownerId = 'p1'
    g.titles[7].ownerId = 'p2'
    const t = cardTargets(g, 'p1', 'boicote-1')!
    expect(t.positions).toContain(7)
    expect(t.positions).not.toContain(1)
  })

  it('SC-003: Auditoria Fiscal → adversários não eliminados', () => {
    const t = cardTargets(setup(), 'p1', 'auditoria-fiscal-1')!
    expect(t.players).toEqual(expect.arrayContaining(['p2', 'p3']))
    expect(t.players).not.toContain('p1')
  })

  it('carta sem alvo → null', () => {
    expect(cardTargets(setup(), 'p1', 'saia-prisao-1')).toBeNull()
  })
})
