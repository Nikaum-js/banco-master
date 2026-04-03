import { describe, it, expect } from 'vitest'
import { rentLadder } from '@/game/economy/rent'
import { buildCost, buildLadderCost, investedCost } from '@/game/economy/construction'
import { THEME } from '@/game/theme'
import { BOARD, type GroupKey, type PropertySquare } from '@/lib/boardData'

const GROUPS: GroupKey[] = ['brown', 'skyblue', 'pink', 'purple', 'orange', 'red', 'yellow', 'green', 'navy', 'platinum']
const cities = (g: GroupKey) => BOARD.filter((s): s is PropertySquare => s.kind === 'property' && s.group === g)
const topBase = (g: GroupKey) => Math.max(...cities(g).map((c) => c.rent))
const topHotel = (g: GroupKey) => rentLadder(g, topBase(g)).hotel

describe('Rebalance 032 — curva de aluguel (US1)', () => {
  it('SC-001: hotel-topo por grupo bate os alvos; o topo é a Alta Roda (super-luxo)', () => {
    // Os alvos seguem o TABULEIRO × o multiplicador do tier: escrever o produto à mão faz um
    // rebalanceamento de aluguel-base (D-076 subiu o brown) reprovar um teste sobre a CURVA.
    expect(topHotel('brown')).toBe(topBase('brown') * THEME.RENT_MULT.brown.hotel)
    expect(topHotel('skyblue')).toBe(topBase('skyblue') * THEME.RENT_MULT.skyblue.hotel)
    expect(topHotel('navy')).toBe(topBase('navy') * THEME.RENT_MULT.navy.hotel) // França é duo (033)
    // Alta Roda (platinum) é o novo topo do tabuleiro (033)
    const maxHotel = Math.max(...GROUPS.map(topHotel))
    expect(maxHotel).toBe(topHotel('platinum'))
  })

  it('SC-002: spread de hotel-topo (caro/barato) fica em ~5–8×', () => {
    const hotels = GROUPS.map(topHotel)
    const spread = Math.max(...hotels) / Math.min(...hotels)
    expect(spread).toBeGreaterThanOrEqual(4)
    expect(spread).toBeLessThanOrEqual(8)
  })

  it('FR-004: ladder sempre crescente (casas → hotel → 2º hotel → arranha-céu)', () => {
    for (const g of GROUPS) {
      const l = rentLadder(g, topBase(g))
      expect(l.house[0]).toBeLessThan(l.house[1])
      expect(l.house[1]).toBeLessThan(l.house[2])
      expect(l.house[2]).toBeLessThan(l.house[3])
      expect(l.house[3]).toBeLessThan(l.hotel)
      expect(l.hotel).toBeLessThan(l.hotel2) // 2º hotel cobra mais (§14.4)
      expect(l.hotel2).toBeLessThan(l.skyscraper) // arranha-céu = topo (§13.7)
    }
  })

  it('FR-004: salto acentuado na 3ª casa', () => {
    const l = rentLadder('navy', topBase('navy'))
    expect(l.house[2] - l.house[1]).toBeGreaterThan(l.house[1] - l.house[0]) // 2→3 maior que 1→2
  })
})

describe('Rebalance 032 — tiers de casa e sweet spot (US2)', () => {
  it('SC-003: custo de casa é fixo por grupo (não proporcional ao preço)', () => {
    for (const g of GROUPS) {
      const cs = cities(g)
      const custos = cs.map(buildCost)
      expect(new Set(custos).size).toBe(1) // todas iguais dentro do grupo
      expect(custos[0]).toBe(THEME.HOUSE_COST[g])
    }
    // e NÃO é preço × 0,5 (Roma $60 → tier $40, não $30)
    const roma = cities('brown')[0]
    expect(buildCost(roma)).not.toBe(Math.round(roma.price * 0.5))
  })

  it('SC-004: ROI (hotel-topo ÷ custo-casa) de orange e red > green (sweet spot)', () => {
    const roi = (g: GroupKey) => topHotel(g) / THEME.HOUSE_COST[g]
    expect(roi('orange')).toBeGreaterThan(roi('green'))
    expect(roi('red')).toBeGreaterThan(roi('green'))
  })
})

describe('D-081 — custo de construção por nível', () => {
  const ladder = (g: GroupKey) => buildLadderCost(cities(g)[0])
  // Aluguel que CADA degrau acrescenta, numa cidade de país completo.
  const rentSteps = (g: GroupKey) => {
    const l = rentLadder(g, topBase(g))
    const rents = [topBase(g) * 2, ...l.house, l.hotel, l.hotel2, l.skyscraper]
    return rents.slice(1).map((r, i) => r - rents[i])
  }

  it('a escada de custo nunca decresce e o topo custa 3× a primeira casa', () => {
    for (const g of GROUPS) {
      const cs = ladder(g)
      expect(cs).toHaveLength(7)
      for (let i = 1; i < cs.length; i++) expect(cs[i]).toBeGreaterThanOrEqual(cs[i - 1])
      expect(cs[6]).toBe(cs[0] * 3)
      expect(cs.every((c) => c % 5 === 0)).toBe(true) // valores legíveis num botão
    }
  })

  it('a entrada continua barata: 1ª e 2ª casa mantêm o tier do grupo', () => {
    for (const g of GROUPS) {
      const cs = ladder(g)
      expect(cs[0]).toBe(THEME.HOUSE_COST[g])
      expect(cs[1]).toBe(THEME.HOUSE_COST[g])
    }
  })

  it('a inversão foi consertada: o arranha-céu rende MENOS por real que a 3ª casa', () => {
    // Era o furo do custo flat — o topo da escada era o melhor negócio do tabuleiro.
    for (const g of GROUPS) {
      const cs = ladder(g)
      const steps = rentSteps(g)
      const roiTerceira = steps[2] / cs[2]
      const roiArranha = steps[6] / cs[6]
      expect(roiArranha).toBeLessThan(roiTerceira)
      expect(roiArranha).toBeLessThan(1.2) // topo não se paga numa batida só
    }
  })

  it('a 3ª casa segue sendo o sweet spot do gênero', () => {
    for (const g of GROUPS) {
      const cs = ladder(g)
      const steps = rentSteps(g)
      const roi = steps.map((s, i) => s / cs[i])
      expect(Math.max(...roi)).toBe(roi[2])
    }
  })

  it('país completo no topo leva ≥ 2,4 visitas para se pagar', () => {
    for (const g of GROUPS) {
      const cs = cities(g)
      const investido = cs.reduce((a, c) => a + c.price + investedCost(c, 7), 0)
      const aluguelMedio = cs.reduce((a, c) => a + rentLadder(g, c.rent).skyscraper, 0) / cs.length
      expect(investido / aluguelMedio).toBeGreaterThanOrEqual(2.4)
    }
  })

  it('investedCost é a soma da escada, não nível × tier', () => {
    const berlim = cities('orange')[0]
    expect(investedCost(berlim, 7)).toBe(buildLadderCost(berlim).reduce((a, b) => a + b, 0))
    expect(investedCost(berlim, 7)).toBeGreaterThan(7 * buildCost(berlim)) // o atalho antigo
    expect(investedCost(berlim, 0)).toBe(0)
  })
})

describe('Distrito Super-Luxo "Alta Roda" (033)', () => {
  it('SC-002: aluguel-armadilha — Dubai hotel ~$2.300, arranha ~$3.600', () => {
    const dubai = rentLadder('platinum', 72) // Dubai base 72
    expect(dubai.hotel).toBe(2304) // 72 × 32
    expect(dubai.skyscraper).toBe(3600) // 72 × 50
    expect(dubai.hotel).toBeGreaterThan(topHotel('navy')) // acima do antigo topo (França)
  })

  it('SC-003: NÃO é sweet spot — ROI da Alta Roda < orange e < red', () => {
    const roi = (g: GroupKey) => topHotel(g) / THEME.HOUSE_COST[g]
    expect(roi('platinum')).toBeLessThan(roi('orange'))
    expect(roi('platinum')).toBeLessThan(roi('red'))
  })

  it('SC-001/SC-002: Mônaco/Dubai são as mais caras e Dubai tem o maior aluguel-hotel do jogo', () => {
    const allCities = BOARD.filter((s): s is PropertySquare => s.kind === 'property')
    const precoMax2 = allCities.map((c) => c.price).sort((a, b) => b - a).slice(0, 2)
    expect(precoMax2).toEqual([650, 550]) // Dubai, Abu Dhabi (Emirados)
    const maxHotel = Math.max(...GROUPS.map(topHotel))
    expect(maxHotel).toBe(rentLadder('platinum', 72).hotel) // Dubai = topo
  })
})
