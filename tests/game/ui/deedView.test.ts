import { describe, it, expect } from 'vitest'
import { deedView } from '@/game/ui/deed/deedView'
import { createSeedState } from '@/game/store'
import type { GameState } from '@/game/turn/types'

// p1 é o jogador da vez. brown = {1,3,5} (maioria 2). Aeroporto em pos 6.
function base(): GameState {
  return createSeedState(['p1', 'p2'])
}

describe('deedView — construir/vender (US1)', () => {
  it('SC-002: dono da maioria, cidade de menor nível, caixa+estoque → podeConstruir', () => {
    const s = base()
    s.titles[1].ownerId = 'p1'
    s.titles[3].ownerId = 'p1' // 2 de 3 brown
    const v = deedView(s, 1)!
    expect(v.ownedByActive).toBe(true)
    expect(v.flags.podeConstruir).toBe(true)
    expect(v.buildBlock).toBeNull()
  })

  it('SC-005: cidade de nível maior que outra do grupo → bloqueado por uniformidade', () => {
    const s = base()
    s.titles[1].ownerId = 'p1'
    s.titles[3].ownerId = 'p1'
    s.titles[1].houses = 1 // nível 1; pos3 nível 0 (min)
    const v = deedView(s, 1)!
    expect(v.flags.podeConstruir).toBe(false)
    expect(v.buildBlock).toBe('uniformidade')
  })

  it('SC-005: banco sem casas → bloqueado por estoque', () => {
    const s = base()
    s.titles[1].ownerId = 'p1'
    s.titles[3].ownerId = 'p1'
    s.bank.houses = 0
    const v = deedView(s, 1)!
    expect(v.flags.podeConstruir).toBe(false)
    expect(v.buildBlock).toBe('estoque')
  })

  it('SC-005: alvo arranha-céu sem grupo completo → bloqueado por grupo-incompleto', () => {
    const s = base()
    s.titles[1].ownerId = 'p1'
    s.titles[3].ownerId = 'p1' // só 2 de 3
    s.titles[1].hotel2 = true // nível 6
    s.titles[3].hotel2 = true // nível 6 (uniforme)
    const v = deedView(s, 1)!
    expect(v.flags.podeConstruir).toBe(false)
    expect(v.buildBlock).toBe('grupo-incompleto')
  })

  it('SC-001: nível>0 na cidade de maior nível → podeVender', () => {
    const s = base()
    s.titles[1].ownerId = 'p1'
    s.titles[3].ownerId = 'p1'
    s.titles[1].houses = 1
    expect(deedView(s, 1)!.flags.podeVender).toBe(true)
    expect(deedView(s, 3)!.flags.podeVender).toBe(false) // nível 0, nada a vender
  })
})

describe('deedView — hipoteca (US2)', () => {
  it('SC-005: cidade com construção no grupo → não pode hipotecar', () => {
    const s = base()
    s.titles[1].ownerId = 'p1'
    s.titles[3].ownerId = 'p1'
    s.titles[1].houses = 1 // construção no grupo
    expect(deedView(s, 3)!.flags.podeHipotecar).toBe(false)
  })

  it('sem construção no grupo → pode hipotecar', () => {
    const s = base()
    s.titles[1].ownerId = 'p1'
    s.titles[3].ownerId = 'p1'
    expect(deedView(s, 1)!.flags.podeHipotecar).toBe(true)
  })

  it('SC-005: deshipotecar exige caixa para o resgate', () => {
    const s = base()
    s.titles[1].ownerId = 'p1'
    s.titles[1].mortgaged = true
    s.players[0].cash = 0
    expect(deedView(s, 1)!.flags.podeDeshipotecar).toBe(false) // unmortgageCost ~33 > 0
    s.players[0].cash = 1000
    expect(deedView(s, 1)!.flags.podeDeshipotecar).toBe(true)
  })
})

describe('deedView — hangar (US3)', () => {
  it('SC-005: aeroporto próprio sem hangar → podeConstruirHangar; com hangar → podeVenderHangar', () => {
    const s = base()
    s.titles[6].ownerId = 'p1' // aeroporto
    const v = deedView(s, 6)!
    expect(v.kind).toBe('airport')
    expect(v.flags.podeConstruirHangar).toBe(true)
    expect(v.flags.podeVenderHangar).toBe(false)
    s.titles[6].hangar = true
    const v2 = deedView(s, 6)!
    expect(v2.flags.podeConstruirHangar).toBe(false)
    expect(v2.flags.podeVenderHangar).toBe(true)
  })
})

describe('deedView — terceiro / livre / não-gerenciável', () => {
  it('SC-004: propriedade de outro dono → sem ações', () => {
    const s = base()
    s.titles[1].ownerId = 'p2'
    const v = deedView(s, 1)!
    expect(v.owner).toBe('p2')
    expect(v.ownedByActive).toBe(false)
    expect(v.flags).toEqual({
      podeConstruir: false,
      podeVender: false,
      podeConstruirHangar: false,
      podeVenderHangar: false,
      podeHipotecar: false,
      podeDeshipotecar: false,
    })
  })

  it('SC-004: propriedade livre → sem dono, sem ações', () => {
    const s = base()
    const v = deedView(s, 3)!
    expect(v.owner).toBeNull()
    expect(v.ownedByActive).toBe(false)
    expect(v.flags.podeConstruir).toBe(false)
  })

  it('casa não-gerenciável (canto/imposto) → null', () => {
    const s = base()
    expect(deedView(s, 0)).toBeNull() // GO
  })
})
