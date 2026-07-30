// Spec 056 (D-070) — as duas mecânicas próprias do mapa Cidade da Fuligem.
//
// O contrato central destes testes é a SIMETRIA: cada mecânica é provada ligada na
// Fuligem E desligada no Atlas. Sem o segundo lado, um `smokeTax` que vazasse para o
// Atlas passaria o teste — e o mapa novo deixaria de ser aditivo, que é a única razão
// pela qual ele pôde existir sem rebalancear o jogo inteiro.
import { beforeEach, afterEach, describe, expect, it } from 'vitest'
import { createSeedState } from '@/game/setup'
import { buildCostFor, buildHouse, cityLevel } from '@/game/economy/construction'
import { canRailHop, railHop, railHopTargets } from '@/game/turn/turnMachine'
import { setActiveBoard, BOARD, ATLAS_BOARD, type PropertySquare } from '@/lib/boardData'
import { catalogOf, setActiveRules, DEFAULT_RULES } from '@/lib/mapCatalog'
import type { GameState } from '@/game/turn/types'
import type { TurnCtx } from '@/game/turn/turnMachine'

// O motor lê o tabuleiro/regra ATIVOS (D-070). Nos testes trocamos os dois à mão, no
// mesmo par em que `boardTheme.setTheme` os troca em produção.
function useMap(id: 'atlas' | 'fuligem') {
  const catalog = catalogOf(id)
  setActiveBoard(catalog.board)
  setActiveRules(catalog.rules)
}

afterEach(() => {
  setActiveBoard(ATLAS_BOARD)
  setActiveRules(DEFAULT_RULES)
})

const ctx = { rng: () => 0.5, ports: { onPassGo: () => 200 } } as unknown as TurnCtx

/** Sobe a propriedade até `level` sem passar pelas guardas de uniformidade/caixa. */
function forceLevel(g: GameState, pos: number, level: number): void {
  const t = g.titles[pos]
  t.houses = Math.min(level, 4)
  t.hotel = level >= 5
  t.hotel2 = level >= 6
  t.skyscraper = level >= 7
}

describe('Taxa de Fumaça (D-070)', () => {
  /** Dá ao jogador ativo o bairro inteiro e caixa de sobra, e devolve as posições. */
  function ownWholeGroup(g: GameState, group: string): number[] {
    const positions = BOARD
      .filter((s): s is PropertySquare => s.kind === 'property' && s.group === group)
      .map((s) => s.pos)
    for (const pos of positions) g.titles[pos].ownerId = g.players[0].id
    g.players[0].cash = 100_000
    return positions
  }

  it('na Fuligem, subir para FÁBRICA joga a taxa no pote', () => {
    useMap('fuligem')
    const g = createSeedState(['p1'])
    const [first, ...rest] = ownWholeGroup(g, 'brown') // Olaria: 2 casas
    // Todas a 4 oficinas: o próximo nível de `first` é fábrica, e a uniformidade permite.
    for (const pos of [first, ...rest]) forceLevel(g, pos, 4)
    const potBefore = g.centerPot

    const after = buildHouse(g, first)

    expect(cityLevel(after.titles[first])).toBe(5) // virou fábrica
    expect(after.centerPot).toBe(potBefore + 50)
    expect(after.log.some((e) => e.kind === 'smoke-tax')).toBe(true)
  })

  it('na Fuligem, subir OFICINA (níveis 1–4) não paga taxa nenhuma', () => {
    useMap('fuligem')
    const g = createSeedState(['p1'])
    const positions = ownWholeGroup(g, 'brown')
    const potBefore = g.centerPot

    const after = buildHouse(g, positions[0])

    expect(cityLevel(after.titles[positions[0]])).toBe(1) // oficina
    expect(after.centerPot).toBe(potBefore)
    expect(after.log.some((e) => e.kind === 'smoke-tax')).toBe(false)
  })

  it('a taxa sai do CAIXA de quem constrói e entra no POTE — não evapora', () => {
    useMap('fuligem')
    const g = createSeedState(['p1'])
    const [first, ...rest] = ownWholeGroup(g, 'brown')
    for (const pos of [first, ...rest]) forceLevel(g, pos, 4)
    const cashBefore = g.players[0].cash
    const potBefore = g.centerPot

    const after = buildHouse(g, first)

    // O caixa cai pelo custo da construção; o pote sobe pela taxa. A lição do taxMan é
    // que dinheiro não pode sumir sem destino visível — aqui o destino é o pote.
    const spent = cashBefore - after.players[0].cash
    expect(spent).toBe(buildCostFor(g, BOARD[first] as PropertySquare, g.players[0].id) + 50)
    expect(after.centerPot - potBefore).toBe(50)
  })

  it('no Atlas a mecânica está DESLIGADA — o pote não se mexe', () => {
    useMap('atlas')
    const g = createSeedState(['p1'])
    const [first, ...rest] = ownWholeGroup(g, 'brown') // Itália: 3 cidades
    for (const pos of [first, ...rest]) forceLevel(g, pos, 4)
    const potBefore = g.centerPot

    const after = buildHouse(g, first)

    expect(cityLevel(after.titles[first])).toBe(5) // virou hotel
    expect(after.centerPot).toBe(potBefore)
    expect(after.log.some((e) => e.kind === 'smoke-tax')).toBe(false)
  })
})

describe('Desvio pela Ferrovia (D-070)', () => {
  const RAILS = [5, 16, 25, 36] // as quatro da Fuligem

  /** Jogador ativo parado em `at`, dono das ferrovias `owned`, no fim do turno. */
  function atRail(at: number, owned: number[]): GameState {
    const g = createSeedState(['p1', 'p2'])
    const me = g.players[0].id
    for (const pos of owned) g.titles[pos].ownerId = me
    g.players[0].pos = at
    g.turn.state = 'aguardando-finalizacao'
    return g
  }

  beforeEach(() => useMap('fuligem'))

  it('com duas ferrovias, oferece a outra como destino', () => {
    const g = atRail(5, [5, 16])
    expect(canRailHop(g)).toBe(true)
    expect(railHopTargets(g)).toEqual([16])
  })

  it('com as quatro, oferece as outras três', () => {
    const g = atRail(16, RAILS)
    expect(railHopTargets(g)).toEqual([5, 25, 36])
  })

  it('embarcar move o peão e deixa a casa de destino A RESOLVER', () => {
    const g = atRail(5, [5, 25])
    const after = railHop(g, 25, ctx)

    expect(after.players[0].pos).toBe(25)
    expect(after.turn.state).toBe('casa-a-resolver')
    expect(after.log.some((e) => e.kind === 'rail-hop')).toBe(true)
  })

  it('embarcar NÃO paga o bônus de GO, mesmo indo para uma casa de índice menor', () => {
    // 36 → 5 "passa" pelo zero em índice, mas embarque não percorre o tabuleiro.
    const g = atRail(36, [36, 5])
    const cashBefore = g.players[0].cash

    const after = railHop(g, 5, ctx)

    expect(after.players[0].pos).toBe(5)
    expect(after.players[0].cash).toBe(cashBefore)
    expect(after.log.some((e) => e.kind === 'go')).toBe(false)
  })

  it('uma ferrovia só não embarca — não há para onde ir', () => {
    const g = atRail(5, [5])
    expect(canRailHop(g)).toBe(false)
    expect(railHopTargets(g)).toEqual([])
  })

  it('em ferrovia ALHEIA não embarca, mesmo tendo outras', () => {
    const g = atRail(5, [16, 25]) // parado na 5, que não é dele
    expect(canRailHop(g)).toBe(false)
  })

  it('fora de ferrovia não embarca', () => {
    const g = atRail(6, [5, 16]) // 6 é propriedade (Largo do Tear)
    expect(canRailHop(g)).toBe(false)
  })

  it('ferrovia hipotecada não embarca nem recebe embarque', () => {
    const origem = atRail(5, [5, 16])
    origem.titles[5].mortgaged = true
    expect(canRailHop(origem)).toBe(false)

    const destino = atRail(5, [5, 16])
    destino.titles[16].mortgaged = true
    expect(railHopTargets(destino)).toEqual([])
  })

  it('só na janela de fim de turno — nunca antes de rolar', () => {
    const g = atRail(5, [5, 16])
    g.turn.state = 'aguardando-rolagem'
    expect(canRailHop(g)).toBe(false)
  })

  it('destino inválido é no-op: nada muda de posição', () => {
    const g = atRail(5, [5, 16])
    expect(railHop(g, 25, ctx).players[0].pos).toBe(5) // 25 não é dele
    expect(railHop(g, 5, ctx).players[0].pos).toBe(5) // ele já está aqui
  })

  it('no Atlas a mecânica está DESLIGADA, mesmo com quatro aeroportos', () => {
    useMap('atlas')
    const g = createSeedState(['p1', 'p2'])
    for (const pos of [6, 18, 30, 42]) g.titles[pos].ownerId = g.players[0].id
    g.players[0].pos = 6
    g.turn.state = 'aguardando-finalizacao'

    expect(canRailHop(g)).toBe(false)
    expect(railHopTargets(g)).toEqual([])
  })
})
