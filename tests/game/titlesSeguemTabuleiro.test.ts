// @vitest-environment jsdom
// (jsdom porque o último caso exercita `setTheme`, que escreve `data-board-theme` no <html>.)
//
// A INVARIANTE QUE FALTAVA: `titles` acompanha o TABULEIRO ATIVO.
//
// Este arquivo nasce de um crash em partida real: "Cannot set properties of undefined (setting
// 'ownerId')" em `purchase.ts`, ao clicar em Comprar. Vale registrar por que a suíte inteira —
// 1343 testes, incluindo simulação de partida completa — passou por cima dele durante muito tempo.
//
// O bug NÃO estava no motor. `seedTitles()` (setup.ts) e `priceOf()` (purchase.ts) leem os dois o
// binding vivo `BOARD`, mas em momentos diferentes: o primeiro quando o estado é criado, o segundo
// quando o jogador clica. A divergência só existe se o `BOARD` mudar ENTRE os dois — e é o que
// acontecia no boot, porque o store se cria no carregamento do módulo (com o Atlas, o default) e o
// `?map=` era aplicado depois, num `useEffect`.
//
// Por que os testes de simulação não pegam: `runGame` semeia o estado E joga com o MESMO tabuleiro
// ativo, sempre. Eles provam que o motor é correto — e o motor é. O que ninguém provava é a
// COERÊNCIA entre o estado semeado e o tabuleiro em uso, que é exatamente o que quebrava. Simulação
// não substitui invariante: ela exercita o caminho, não amarra o contrato.
import { afterEach, describe, expect, it } from 'vitest'
import { createSeedState } from '@/game/setup'
import { buyProperty } from '@/game/economy/purchase'
import { isRentableKind } from '@/game/economy/titles'
import { setActiveBoard, ATLAS_BOARD, BOARD } from '@/lib/boardData'
import { catalogOf, setActiveRules, DEFAULT_RULES } from '@/lib/mapCatalog'
import { useBoardTheme } from '@/game/ui/theme/boardTheme'

function activateMap(id: 'atlas' | 'fuligem') {
  const c = catalogOf(id)
  setActiveBoard(c.board)
  setActiveRules(c.rules)
}

afterEach(() => {
  setActiveBoard(ATLAS_BOARD)
  setActiveRules(DEFAULT_RULES)
})

describe('titles cobre exatamente as casas rentáveis do tabuleiro ativo', () => {
  it.each(['atlas', 'fuligem'] as const)('em %s, toda casa rentável tem título e vice-versa', (id) => {
    activateMap(id)
    const g = createSeedState(['p1', 'p2'])
    const rentaveis = BOARD.filter((s) => isRentableKind(s.kind)).map((s) => s.pos).sort((a, b) => a - b)
    const comTitulo = Object.keys(g.titles).map(Number).sort((a, b) => a - b)
    expect(comTitulo).toEqual(rentaveis)
  })

  it('toda casa com PREÇO no tabuleiro ativo tem título — é o par que `buyProperty` assume', () => {
    // `priceOf(pos) > 0` é o que libera `resolution: purchase`, e `buyProperty` escreve em
    // `titles[pos]`. Se um existe sem o outro, a compra estoura. Este é o contrato, afirmado.
    for (const id of ['atlas', 'fuligem'] as const) {
      activateMap(id)
      const g = createSeedState(['p1', 'p2'])
      for (const sq of BOARD) {
        if ('price' in sq && sq.price > 0) {
          expect(g.titles[sq.pos], `${id} pos ${sq.pos} (${sq.name})`).toBeTruthy()
        }
      }
    }
  })
})

describe('a regressão exata: pos 4 é mina na Fuligem e imposto no Atlas', () => {
  it('comprar na pos 4 da Fuligem funciona com estado semeado na Fuligem', () => {
    activateMap('fuligem')
    const g = createSeedState(['p1', 'p2'])
    expect(g.titles[4]).toBeTruthy() // mina ⇒ rentável ⇒ tem título
    const antes = g.players[0].cash
    const depois = buyProperty({ ...g, resolution: { kind: 'purchase', pos: 4 } })
    expect(depois.titles[4].ownerId).toBe(g.players[0].id)
    expect(depois.players[0].cash).toBe(antes - (catalogOf('fuligem').board[4] as { price: number }).price)
  })

  it('estado semeado no Atlas NÃO tem título na pos 4 — a origem do crash', () => {
    // Prova que a combinação perigosa é real, e não uma teoria: no Atlas a pos 4 é imposto,
    // logo não-rentável, logo sem título. Se o tabuleiro virar Fuligem depois deste seed, a
    // pos 4 passa a ter preço e a compra escreve num `undefined`.
    activateMap('atlas')
    const g = createSeedState(['p1', 'p2'])
    expect(g.titles[4]).toBeUndefined()
    expect(ATLAS_BOARD[4].kind).not.toBe('mine')
    activateMap('fuligem')
    expect('price' in BOARD[4] && BOARD[4].price > 0).toBe(true) // preço sem título = crash
  })
})

describe('setTheme realinha os títulos quando o tabuleiro troca (a segunda defesa)', () => {
  it('depois de trocar o mapa, o estado do store bate com o tabuleiro novo', async () => {
    const { useGameStore } = await import('@/game/store')

    useBoardTheme.getState().setTheme('atlas')
    expect(useGameStore.getState().game.titles[4]).toBeUndefined()

    useBoardTheme.getState().setTheme('fuligem')
    // Sem o realinhamento, `titles` continuaria com a forma do Atlas e esta asserção falharia —
    // que é precisamente o estado em que o jogo crashava ao comprar.
    expect(useGameStore.getState().game.titles[4]).toBeTruthy()

    const rentaveis = BOARD.filter((s) => isRentableKind(s.kind)).map((s) => s.pos)
    for (const pos of rentaveis) {
      expect(useGameStore.getState().game.titles[pos], `pos ${pos}`).toBeTruthy()
    }

    useBoardTheme.getState().setTheme('atlas')
  })
})
