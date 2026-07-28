import { describe, expect, it } from 'vitest'
import { BOARD } from '@/lib/boardData'
import { deedPresentation } from '@/game/ui/deed/presentation'

describe('deedPresentation', () => {
  it('projeta todos os fatos econômicos e visuais de uma propriedade', () => {
    expect(deedPresentation(BOARD[1])).toMatchObject({
      kind: 'property',
      name: 'Roma',
      subtitle: 'Itália',
      accent: 'var(--color-group-brown)',
      flagCode: 'IT',
      price: 60,
      mortgage: 30,
      buildCost: 40,
      rents: {
        base: 2,
        house1: 14,
        house2: 36,
        house3: 82,
        house4: 102,
        hotel: 120,
        hotel2: 156,
        skyscraper: 192,
      },
    })
  })

  it('projeta os tiers e a melhoria de aeroporto pela fonte do tema', () => {
    expect(deedPresentation(BOARD[6])).toMatchObject({
      kind: 'airport',
      subtitle: 'Aeroporto',
      price: 200,
      mortgage: 100,
      rents: [25, 50, 100, 200],
      hangar: { cost: 100, multiplier: 2 },
    })
  })

  it('projeta os multiplicadores de utilidade sem hardcode no layout', () => {
    expect(deedPresentation(BOARD[14])).toMatchObject({
      kind: 'utility',
      subtitle: 'Utilidade',
      price: 150,
      mortgage: 75,
      multipliers: [4, 10, 20],
    })
  })

  it('recusa casas que não representam uma escritura', () => {
    expect(deedPresentation(BOARD[0])).toBeNull()
  })
})
