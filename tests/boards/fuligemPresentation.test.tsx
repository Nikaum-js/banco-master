// @vitest-environment jsdom
// Spec 055 (D-069) + 056 (D-070) — a apresentação segue o MAPA ativo: nomes,
// ícone-sem-bandeira,
// rótulos de carta e placa de hipoteca da Cidade da Fuligem; e o Atlas permanece
// byte-idêntico quando o mapa volta.
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ClassicSquare, MortgageMark } from '@/boards/shared'
import { cardLabel, cardDesc } from '@/game/ui/cards/cardMeta'
import { createSeedState } from '@/game/setup'
import { useGameStore } from '@/game/store'
import { activeLabels, useBoardTheme } from '@/game/ui/theme/boardTheme'
import { catalogOf } from '@/lib/mapCatalog'
import { useRoomStore } from '@/net/roomStore'

const originalGame = useGameStore.getState().game

afterEach(() => {
  cleanup()
  act(() => {
    useGameStore.setState({ game: originalGame })
    useRoomStore.getState().reset()
    useBoardTheme.getState().setTheme('atlas')
  })
})

function setTheme(theme: 'atlas' | 'fuligem') {
  act(() => useBoardTheme.getState().setTheme(theme))
}

describe('apresentação por mapa (055)', () => {
  it('a casa 1 é Ladeira do Barreiro com ícone (sem bandeira) na Fuligem; Roma com bandeira no Atlas', () => {
    setTheme('fuligem')
    const fuligemSquare = catalogOf('fuligem').board.find((s) => s.pos === 1)!
    const first = render(<ClassicSquare square={fuligemSquare} side="bottom" />)
    // A topologia de 40 casas usa a área extra para o topônimo completo.
    expect(screen.getByText('Ladeira do Barreiro')).toBeTruthy()
    // Sem bandeira: nenhuma arte de bandeira dentro do avatar da casa.
    expect(first.container.querySelector('.board-flag-avatar svg[data-flag]')).toBeNull()
    first.unmount()

    setTheme('atlas')
    const atlasSquare = catalogOf('atlas').board.find((s) => s.pos === 1)!
    render(<ClassicSquare square={atlasSquare} side="bottom" />)
    expect(screen.getByText('Roma')).toBeTruthy()
  })

  it('todo título livre mostra preço — inclusive ferrovia e mina', () => {
    setTheme('fuligem')
    const board = catalogOf('fuligem').board

    const rail = render(<ClassicSquare square={board[5]} side="bottom" />)
    expect(rail.container.querySelector('.board-square-price')?.textContent).toBe('R$200')
    expect(screen.getByText('Estação Bonfim')).toBeTruthy()
    rail.unmount()

    const mine = render(<ClassicSquare square={board[4]} side="bottom" />)
    expect(mine.container.querySelector('.board-square-price')?.textContent).toBe('R$220')
    expect(screen.getByText('Mina de Ferro')).toBeTruthy()
  })

  it('cardLabel/cardDesc apresentam o vocabulário do mapa sem tocar o canônico', () => {
    setTheme('fuligem')
    expect(cardLabel('passagemOnibus')).toBe('Bilhete de Trem')
    expect(cardDesc('resgateDoPote')).toContain('Sorte Grande')

    setTheme('atlas')
    expect(cardLabel('passagemOnibus')).toBe('Passagem de Ônibus')
    expect(cardDesc('resgateDoPote')).toContain('Loteria')
  })

  it('rótulos dos contratos do motor seguem o mapa ativo', () => {
    setTheme('fuligem')
    expect(activeLabels()).toMatchObject({ airport: 'Ferrovia', lottery: 'Sorte Grande' })
    setTheme('atlas')
    expect(activeLabels()).toMatchObject({ airport: 'Aeroporto', lottery: 'Loteria' })
  })

  it('hipoteca ganha a placa HIPOTECADA na Fuligem (padrão além de cor); no Atlas só o sombreamento', () => {
    const game = createSeedState(['p1'])
    game.titles[1].ownerId = 'p1'
    game.titles[1].mortgaged = true
    act(() => useGameStore.setState({ game }))

    setTheme('fuligem')
    const fuligem = render(<MortgageMark pos={1} />)
    expect(screen.getByText('HIPOTECADA')).toBeTruthy()
    fuligem.unmount()

    setTheme('atlas')
    render(<MortgageMark pos={1} />)
    expect(screen.queryByText('HIPOTECADA')).toBeNull()
  })
})
