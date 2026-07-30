// Card 7 do review de arquitetura: a geometria do tabuleiro estava espalhada por nove
// sites em dois arquivos React e não tinha um único teste. Extraída para `boards/topology`,
// é pura — e estes são os primeiros testes que ela tem.
import { describe, expect, it } from 'vitest'
import { BOARD } from '@/lib/boardData'
import {
  CLASSIC_TOPOLOGY,
  CORNERS,
  FULIGEM_TOPOLOGY,
  FULIGEM_TRACK_TEMPLATE,
  gridArea,
  isCorner,
  markLayout,
  popoverPlacement,
  sideOf,
} from '@/boards/topology'
import { catalogOf } from '@/lib/mapCatalog'

describe('sideOf', () => {
  it('as quatro esquinas são canto', () => {
    for (const c of CORNERS) expect(sideOf(c)).toBe('corner')
  })

  it('cada lado tem exatamente 11 casas (48 = 4 cantos + 4×11)', () => {
    const count = { bottom: 0, left: 0, top: 0, right: 0, corner: 0 }
    for (const sq of BOARD) count[sideOf(sq.pos)] += 1
    expect(count).toEqual({ bottom: 11, left: 11, top: 11, right: 11, corner: 4 })
  })

  it('cobre o tabuleiro inteiro sem buraco', () => {
    for (const sq of BOARD) expect(sideOf(sq.pos)).toBeTruthy()
  })

  it('isCorner concorda com sideOf', () => {
    for (const sq of BOARD) expect(isCorner(sq.pos)).toBe(sideOf(sq.pos) === 'corner')
  })
})

describe('gridArea', () => {
  it('mapeia as 48 casas em 48 células DISTINTAS da grade 13×13', () => {
    const cells = BOARD.map((sq) => {
      const a = gridArea(sq.pos) as { gridRow: number; gridColumn: number }
      return `${a.gridRow}:${a.gridColumn}`
    })
    expect(new Set(cells).size).toBe(48)
  })

  it('só usa o perímetro — nenhuma casa cai no miolo', () => {
    for (const sq of BOARD) {
      const { gridRow: r, gridColumn: c } = gridArea(sq.pos) as { gridRow: number; gridColumn: number }
      expect(r >= 1 && r <= 13 && c >= 1 && c <= 13).toBe(true)
      expect(r === 1 || r === 13 || c === 1 || c === 13).toBe(true)
    }
  })

  it('GO fica no canto inferior direito (pos 0 = SE)', () => {
    expect(gridArea(0)).toEqual({ gridRow: 13, gridColumn: 13 })
  })

  it('anda no sentido anti-horário na tela a partir do GO', () => {
    // pos cresce → coluna diminui na linha de baixo.
    const a = gridArea(1) as { gridColumn: number }
    const b = gridArea(2) as { gridColumn: number }
    expect(a.gridColumn).toBeGreaterThan(b.gridColumn)
  })

  it('concorda com sideOf sobre em qual borda cada casa está', () => {
    for (const sq of BOARD) {
      const { gridRow: r, gridColumn: c } = gridArea(sq.pos) as { gridRow: number; gridColumn: number }
      const side = sideOf(sq.pos)
      if (side === 'bottom') expect(r).toBe(13)
      if (side === 'top') expect(r).toBe(1)
      if (side === 'left') expect(c).toBe(1)
      if (side === 'right') expect(c).toBe(13)
    }
  })
})

describe('popoverPlacement', () => {
  it('abre sempre para DENTRO do tabuleiro', () => {
    // Casa na borda de baixo → balão sobe; borda de cima → desce.
    expect(popoverPlacement('bottom').position).toHaveProperty('bottom', '100%')
    expect(popoverPlacement('top').position).toHaveProperty('top', '100%')
    expect(popoverPlacement('left').position).toHaveProperty('left', '100%')
    expect(popoverPlacement('right').position).toHaveProperty('right', '100%')
  })

  it('centraliza no eixo paralelo ao lado', () => {
    expect(popoverPlacement('left').centerTransform).toBe('translateY(-50%)')
    expect(popoverPlacement('bottom').centerTransform).toBe('translateX(-50%)')
  })

  it('o rabicho aponta para a casa em todos os lados', () => {
    for (const side of ['bottom', 'top', 'left', 'right'] as const) {
      expect(popoverPlacement(side).tail.transform).toBe('rotate(45deg)')
    }
  })
})

describe('markLayout', () => {
  it('empilha em linha nas bordas horizontais e em coluna nas verticais', () => {
    expect(markLayout('bottom').flexDirection).toBe('row')
    expect(markLayout('top').flexDirection).toBe('row')
    expect(markLayout('left').flexDirection).toBe('column')
    expect(markLayout('right').flexDirection).toBe('column')
  })
})

describe('CLASSIC_TOPOLOGY', () => {
  it('declara a forma que um Board02 teria de implementar', () => {
    expect(CLASSIC_TOPOLOGY.size).toBe(BOARD.length)
    expect(CLASSIC_TOPOLOGY.corners).toEqual(CORNERS)
    // `minmax(0, …)` mantém as faixas proporcionais — sem ele o board sai retangular.
    expect(CLASSIC_TOPOLOGY.trackTemplate).toContain('minmax(0,')
  })
})

describe('FULIGEM_TOPOLOGY', () => {
  it('declara 40 casas, quatro cantos e 9 casas por lado', () => {
    const board = catalogOf('fuligem').board
    const count = { bottom: 0, left: 0, top: 0, right: 0, corner: 0 }
    for (const square of board) count[FULIGEM_TOPOLOGY.sideOf(square.pos)] += 1

    expect(FULIGEM_TOPOLOGY.size).toBe(40)
    expect(FULIGEM_TOPOLOGY.corners).toEqual([0, 10, 20, 30])
    expect(count).toEqual({ bottom: 9, left: 9, top: 9, right: 9, corner: 4 })
  })

  it('usa uma faixa periférica mais profunda que o Atlas', () => {
    expect(FULIGEM_TRACK_TEMPLATE).toContain('2.5fr')
    expect(FULIGEM_TRACK_TEMPLATE).not.toBe(CLASSIC_TOPOLOGY.trackTemplate)
  })
})
