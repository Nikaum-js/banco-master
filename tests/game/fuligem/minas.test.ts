// Spec 056 (D-071) — as quatro MINAS do mapa Cidade da Fuligem.
//
// Duas coisas distintas a provar:
//   1. a mina é um título comprável normal, mas NÃO cobra aluguel;
//   2. cada metal carrega um BÔNUS PASSIVO sobre uma classe de ativo diferente.
//
// Como sempre, cada afirmação vem em par: ligada na Fuligem, ausente no Atlas.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createSeedState, defaultPorts } from '@/game/setup'
import { buildCost, buildCostFor } from '@/game/economy/construction'
import { rentDue, ownsMine } from '@/game/economy/rent'
import { economyResolve } from '@/game/economy/resolveRentable'
import { audit } from '@/game/cards/ofensivas'
import { setActiveBoard, BOARD, ATLAS_BOARD, type PropertySquare } from '@/lib/boardData'
import { catalogOf, setActiveRules, DEFAULT_RULES } from '@/lib/mapCatalog'
import { THEME } from '@/game/theme'
import type { GameState, Roll } from '@/game/turn/types'

const MINES = { ferro: 4, carvao: 17, estanho: 28, cobre: 34 } as const
const RAILS = [5, 16, 25, 36]

// DERIVADOS, não literais. Estes testes são sobre o BÔNUS DO METAL (o fator que ele aplica),
// não sobre a tabela de aluguel — que é knob de balanceamento e mudou na D-076.
const CASH0 = THEME.INITIAL_CASH
const RAIL4 = THEME.AIRPORT_RENT[3] // aluguel de ferrovia com as quatro no mesmo nome
const MINE_PRICE = (catalogOf('fuligem').board[MINES.estanho] as { price: number }).price

function useMap(id: 'atlas' | 'fuligem') {
  const catalog = catalogOf(id)
  setActiveBoard(catalog.board)
  setActiveRules(catalog.rules)
}

afterEach(() => {
  setActiveBoard(ATLAS_BOARD)
  setActiveRules(DEFAULT_RULES)
})

/** Estado com `owned` no nome do jogador 1. */
function withOwned(owned: number[]): GameState {
  const g = createSeedState(['p1', 'p2'])
  for (const pos of owned) g.titles[pos].ownerId = g.players[0].id
  g.players[0].cash = 100_000
  return g
}

const me = (g: GameState) => g.players[0].id

/** Sobe a propriedade até `level`, driblando as guardas de uniformidade. */
function forceLevel(g: GameState, pos: number, level: number): void {
  const t = g.titles[pos]
  t.houses = Math.min(level, 4)
  t.hotel = level >= 5
  t.hotel2 = level >= 6
  t.skyscraper = level >= 7
}

describe('minas — sem aluguel (D-071)', () => {
  beforeEach(() => useMap('fuligem'))

  it('continua abrindo compra quando está livre', () => {
    const g = withOwned([])
    const outcome = economyResolve({
      playerId: g.players[0].id,
      square: BOARD[MINES.ferro],
      roll: null,
      ports: defaultPorts,
      state: g,
    })

    expect(outcome).toEqual({ done: false })
    expect(g.resolution).toEqual({ kind: 'purchase', pos: MINES.ferro })
  })

  it('retorna zero com uma ou quatro minas, com ou sem dados', () => {
    const uma = withOwned([MINES.ferro])
    expect(rentDue(uma, MINES.ferro, me(uma), null)).toBe(0)

    const todas = withOwned(Object.values(MINES))
    const roll: Roll = { white: [6, 6], speed: null, isDouble: true, move: 12, special: null }
    expect(rentDue(todas, MINES.ferro, me(todas), null)).toBe(0)
    expect(rentDue(todas, MINES.cobre, me(todas), roll)).toBe(0)
  })

  it('pousar numa mina alheia não move caixa, não abre dívida e não registra aluguel', () => {
    const g = withOwned([MINES.ferro])
    const beforeCash = g.players.map((p) => p.cash)
    const beforeLog = g.log.length

    const outcome = economyResolve({
      playerId: g.players[1].id,
      square: BOARD[MINES.ferro],
      roll: null,
      ports: defaultPorts,
      state: g,
    })

    expect(outcome).toEqual({ done: true })
    expect(g.players.map((p) => p.cash)).toEqual(beforeCash)
    expect(g.resolution).toBeNull()
    expect(g.log).toHaveLength(beforeLog)
  })

  it('mina hipotecada não conta como posse para o bônus', () => {
    const g = withOwned([MINES.ferro])
    expect(ownsMine(g, 'ferro', me(g))).toBe(true)
    g.titles[MINES.ferro].mortgaged = true
    expect(ownsMine(g, 'ferro', me(g))).toBe(false)
  })
})

describe('minas — Mina de Ferro: construção 25% mais barata', () => {
  beforeEach(() => useMap('fuligem'))

  it('desconta do custo quando a mina é sua', () => {
    const sq = BOARD.find((s): s is PropertySquare => s.kind === 'property' && s.group === 'orange')!
    const base = buildCost(sq)

    const sem = withOwned([])
    expect(buildCostFor(sem, sq, me(sem))).toBe(base)

    const com = withOwned([MINES.ferro])
    expect(buildCostFor(com, sq, me(com))).toBe(Math.round(base * 0.75))
  })

  it('a guarda de caixa e o débito usam o MESMO custo descontado', async () => {
    // Se `canBuildHouse` olhasse o preço cheio e `buildHouse` cobrasse o descontado (ou
    // vice-versa), o botão liberaria construção que não se paga. Este teste amarra os dois.
    const { canBuildHouse, buildHouse } = await import('@/game/economy/construction')
    const positions = BOARD
      .filter((s): s is PropertySquare => s.kind === 'property' && s.group === 'brown')
      .map((s) => s.pos)
    const g = withOwned([...positions, MINES.ferro])
    const sq = BOARD[positions[0]] as PropertySquare
    const custo = buildCostFor(g, sq, me(g))

    g.players[0].cash = custo // exatamente o suficiente para o preço COM desconto
    expect(canBuildHouse(g, positions[0])).toBe(true)
    const after = buildHouse(g, positions[0])
    expect(after.players[0].cash).toBe(0)
  })
})

describe('minas — Mina de Carvão: ferrovias +50%', () => {
  beforeEach(() => useMap('fuligem'))

  it('sobe o aluguel de ferrovia, sobre a escada BASE', () => {
    const sem = withOwned(RAILS)
    const base = rentDue(sem, RAILS[0], me(sem), null)
    expect(base).toBe(RAIL4) // quatro ferrovias

    const com = withOwned([...RAILS, MINES.carvao])
    expect(rentDue(com, RAILS[0], me(com), null)).toBe(Math.round(RAIL4 * THEME.MINE_BONUS.carvao))
  })

  it('NÃO empilha em cima da Estação de Carga — a dobra vem depois do bônus', () => {
    // Empilhar daria base × 2 × 1,5. O desenho é base × 1,5, e só então × 2.
    const comCarvao = Math.round(RAIL4 * THEME.MINE_BONUS.carvao)
    const g = withOwned([...RAILS, MINES.carvao])
    g.titles[RAILS[0]].hangar = true
    // O teto é o dobro do valor COM carvão, não o quádruplo do base.
    expect(rentDue(g, RAILS[0], me(g), null)).toBe(comCarvao * 2)
    expect(rentDue(g, RAILS[0], me(g), null)).toBeLessThan(RAIL4 * 2 * THEME.MINE_BONUS.carvao + 1)
  })
})

describe('minas — Mina de Estanho: impostos e aluguéis pagos −15%', () => {
  beforeEach(() => useMap('fuligem'))

  it('reduz o aluguel FINAL pago, inclusive depois da dobra', () => {
    const g = createSeedState(['p1', 'p2'])
    for (const pos of RAILS) g.titles[pos].ownerId = 'p2'
    g.titles[MINES.estanho].ownerId = 'p1'
    g.players[0].doubleRentOnce = true

    economyResolve({
      playerId: 'p1',
      square: BOARD[RAILS[0]],
      roll: null,
      ports: defaultPorts,
      state: g,
    })

    // Quatro ferrovias = RAIL4; Obras na Linha dobra; estanho tira 15% do total.
    const pago = Math.round(RAIL4 * 2 * THEME.MINE_BONUS.estanho)
    expect(g.players[0].cash).toBe(CASH0 - pago)
    expect(g.players[1].cash).toBe(CASH0 + pago)
  })

  it('hipotecada não reduz aluguel pago', () => {
    const g = createSeedState(['p1', 'p2'])
    for (const pos of RAILS) g.titles[pos].ownerId = 'p2'
    g.titles[MINES.estanho].ownerId = 'p1'
    g.titles[MINES.estanho].mortgaged = true

    economyResolve({
      playerId: 'p1',
      square: BOARD[RAILS[0]],
      roll: null,
      ports: defaultPorts,
      state: g,
    })

    expect(g.players[0].cash).toBe(CASH0 - RAIL4)
    expect(g.players[1].cash).toBe(CASH0 + RAIL4)
  })

  it('reduz o Imposto Federal em 25%', () => {
    const g = createSeedState(['p1', 'p2'])
    g.titles[MINES.estanho].ownerId = 'p2'
    const caixa = 2_000 - MINE_PRICE // + a mina = patrimônio de exatamente R$2.000
    g.players[1].cash = caixa
    const potBefore = g.centerPot

    expect(audit(g, 'p1', 'p2', defaultPorts)).toBe(true)

    // Imposto Federal: 25% de R$2.000 = R$500; Estanho reduz o pagamento em 15%.
    const devido = Math.round(500 * THEME.MINE_BONUS.estanho)
    expect(g.players[1].cash).toBe(caixa - devido)
    expect(g.centerPot).toBe(potBefore + devido)
  })
})

describe('minas — Mina de Cobre: construções +25%', () => {
  beforeEach(() => useMap('fuligem'))

  /** Um bairro inteiro do jogador 1, mais as minas pedidas. */
  function comBairro(group: string, minas: number[] = []): { g: GameState; pos: number } {
    const positions = BOARD
      .filter((s): s is PropertySquare => s.kind === 'property' && s.group === group)
      .map((s) => s.pos)
    const g = withOwned([...positions, ...minas])
    return { g, pos: positions[0] }
  }

  it('cobre sobe FÁBRICA e acima em 25%', () => {
    const sem = comBairro('orange')
    forceLevel(sem.g, sem.pos, 5)
    const base = rentDue(sem.g, sem.pos, me(sem.g), null)

    const com = comBairro('orange', [MINES.cobre])
    forceLevel(com.g, com.pos, 5)
    expect(rentDue(com.g, com.pos, me(com.g), null)).toBe(Math.round(base * 1.25))
  })

  it('cobre também sobe OFICINA em 25%', () => {
    const cob = comBairro('orange', [MINES.cobre])
    forceLevel(cob.g, cob.pos, 2)
    const sem = comBairro('orange')
    forceLevel(sem.g, sem.pos, 2)
    expect(rentDue(cob.g, cob.pos, me(cob.g), null)).toBe(
      Math.round(rentDue(sem.g, sem.pos, me(sem.g), null) * 1.25),
    )
  })

  it('terreno sem construção não recebe o bônus', () => {
    const com = comBairro('orange', [MINES.cobre])
    const sem = comBairro('orange')
    expect(rentDue(com.g, com.pos, me(com.g), null)).toBe(rentDue(sem.g, sem.pos, me(sem.g), null))
  })
})

describe('minas — o Atlas não tem mina nenhuma', () => {
  it('nenhuma casa do Atlas é mina, e o aluguel de lá segue intocado', () => {
    useMap('atlas')
    expect(ATLAS_BOARD.some((s) => s.kind === 'mine')).toBe(false)
    // Quatro aeroportos no Atlas rendem a escada CRUA do THEME: não há metal a aplicar.
    const g = withOwned([6, 18, 30, 42])
    expect(rentDue(g, 6, me(g), null)).toBe(RAIL4)
  })
})
