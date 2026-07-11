import { describe, expect, it } from 'vitest'
import { BOARD, type PropertySquare } from '@/lib/boardData'
import { deedPresentation } from '@/game/ui/deed/presentation'
import { rentLadder } from '@/game/economy/rent'
import { THEME } from '@/game/theme'
import { catalogOf } from '@/lib/mapCatalog'

// Esta suíte é sobre a PROJEÇÃO — que a escritura mostre o que o motor calcula, com os campos
// certos e nada de hardcode no layout. Os NÚMEROS são knobs de balanceamento (a D-076 mexeu em
// preço, aluguel-base, Hangar e utilidades): travá-los aqui transforma cada recalibragem numa
// varredura de testes de UI que não têm opinião sobre economia.
describe('deedPresentation', () => {
  it('projeta todos os fatos econômicos e visuais de uma propriedade', () => {
    const roma = BOARD[1] as PropertySquare
    const ladder = rentLadder(roma.group, roma.rent)
    expect(deedPresentation(roma)).toMatchObject({
      kind: 'property',
      name: 'Roma',
      subtitle: 'Itália',
      accent: 'var(--color-group-brown)',
      flagCode: 'IT',
      price: roma.price,
      mortgage: Math.round(roma.price * THEME.MORTGAGE_RATIO),
      buildCost: THEME.HOUSE_COST[roma.group],
      rents: {
        base: roma.rent,
        house1: ladder.house[0],
        house2: ladder.house[1],
        house3: ladder.house[2],
        house4: ladder.house[3],
        hotel: ladder.hotel,
        hotel2: ladder.hotel2,
        skyscraper: ladder.skyscraper,
      },
    })
  })

  it('projeta os tiers e a melhoria de aeroporto pela fonte do tema', () => {
    const jfk = BOARD[6] as { price: number }
    expect(deedPresentation(BOARD[6])).toMatchObject({
      kind: 'airport',
      subtitle: 'Aeroporto',
      price: jfk.price,
      mortgage: Math.round(jfk.price * THEME.MORTGAGE_RATIO),
      rents: [...THEME.AIRPORT_RENT],
      hangar: { cost: THEME.HANGAR_COST, multiplier: 2 },
    })
  })

  it('projeta os multiplicadores de utilidade sem hardcode no layout', () => {
    const util = BOARD[14] as { price: number }
    expect(deedPresentation(BOARD[14])).toMatchObject({
      kind: 'utility',
      subtitle: 'Utilidade',
      price: util.price,
      mortgage: Math.round(util.price * THEME.MORTGAGE_RATIO),
      multipliers: [...THEME.UTILITY_MULT],
    })
  })

  it('projeta Mina como bônus passivo sem escada de aluguel', () => {
    const mine = catalogOf('fuligem').board[4]
    const presentation = deedPresentation(mine)

    expect(presentation).toMatchObject({
      kind: 'mine',
      name: 'Mina de Ferro',
      price: (mine as { price: number }).price,
      mortgage: Math.round((mine as { price: number }).price * THEME.MORTGAGE_RATIO),
      bonus: 'Suas construções custam 25% menos.',
      rentRows: [],
    })
    expect(presentation).not.toHaveProperty('rents')
  })

  it('recusa casas que não representam uma escritura', () => {
    expect(deedPresentation(BOARD[0])).toBeNull()
  })
})
