import { describe, it, expect } from 'vitest'
import { roll } from '@/game/turn/dice'
import { rngFromDice } from './_helpers'

describe('Dados e Speed Die', () => {
  it('SC-003: sem Speed Die antes da 1ª volta; presente depois', () => {
    expect(roll(rngFromDice([3, 2]), { speedDie: false }).speed).toBeNull()
    const r = roll(rngFromDice([3, 2, 1]), { speedDie: true }) // 3ª "die"=1 → face 1
    expect(r.speed).toBe(1)
  })

  it('FR-014: isDouble só pelos brancos; Speed Die não cria dupla', () => {
    const r = roll(rngFromDice([3, 3, 4]), { speedDie: true }) // brancos 3,3 + mr-banco
    expect(r.isDouble).toBe(true)
    expect(r.special).toBe('mr-banco')
    expect(r.special).not.toBe('triple')
  })

  it('FR-023: faces 1/2/3 somam ao movimento', () => {
    const r = roll(rngFromDice([3, 2, 2]), { speedDie: true }) // 3+2 +2 = 7
    expect(r.move).toBe(7)
    expect(r.speed).toBe(2)
  })

  it('FR-026: três dados iguais → triple', () => {
    const r = roll(rngFromDice([3, 3, 3]), { speedDie: true })
    expect(r.special).toBe('triple')
    expect(r.move).toBe(9) // 3+3+3
  })

  it('faces símbolo: mr-banco (idx 3/4) e ônibus (idx 5)', () => {
    expect(roll(rngFromDice([1, 2, 5]), { speedDie: true }).special).toBe('mr-banco')
    expect(roll(rngFromDice([1, 2, 6]), { speedDie: true }).special).toBe('onibus')
  })
})
