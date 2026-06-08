// @vitest-environment jsdom
import { act } from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ActionsPanel } from '@/boards/shared'
import { createSeedState } from '@/game/setup'
import { useGameStore } from '@/game/store'
import { TradeDeedItem } from '@/game/ui/trade/TradeDeedItem'
import { useTradeUI } from '@/game/ui/trade/tradeUI'
import { TradeLayer } from '@/game/ui/trade/TradeLayer'

afterEach(() => {
  cleanup()
  useTradeUI.setState({ open: false, selectedProposalId: null })
})

describe('apresentação da negociação', () => {
  it('mostra o nome completo e os fatos canônicos de uma propriedade', () => {
    const game = createSeedState(['p1', 'p2'])
    game.titles[33].ownerId = 'p1'
    act(() => useGameStore.setState({ game }))

    render(<TradeDeedItem pos={33} />)

    const name = screen.getByText('Rio de Janeiro')
    expect(name.classList.contains('truncate')).toBe(false)
    expect(screen.getByText('Brasil')).toBeTruthy()
    expect(screen.getByText('Preço')).toBeTruthy()
    expect(screen.getByText('R$ 300')).toBeTruthy()
    expect(screen.queryByText('Aluguel base')).toBeNull()
    expect(screen.queryByText('Hipoteca')).toBeNull()
  })

  it('preserva os nomes dos dois jogadores no painel lateral', () => {
    const game = createSeedState(['p1', 'p2'])
    game.tradeProposals = [{
      id: 1,
      trade: {
        fromId: 'p1',
        toId: 'p2',
        fromProps: [],
        fromCash: 2_000,
        toProps: [],
        toCash: 0,
      },
    }]
    act(() => useGameStore.setState({ game }))

    render(<><ActionsPanel /><TradeLayer /></>)

    const route = screen.getByLabelText('Jogador 1 propõe uma troca com Jogador 2')
    expect(within(route).getByText('Jogador 1')).toBeTruthy()
    expect(within(route).getByText('Jogador 2')).toBeTruthy()
    expect(route.querySelector('.truncate')).toBeNull()
    expect(screen.queryByText('Nenhum item')).toBeNull()
  })

  it('não antecipa conteúdo mesmo quando a proposta tem muitos itens', () => {
    const game = createSeedState(['p1', 'p2'])
    game.tradeProposals = [{
      id: 4,
      trade: {
        fromId: 'p1',
        toId: 'p2',
        fromProps: [],
        fromCash: 0,
        toProps: [33, 31, 28, 26, 24],
        toCash: 0,
      },
    }]
    act(() => useGameStore.setState({ game }))

    render(<ActionsPanel />)

    expect(screen.queryByText('Rio de Janeiro')).toBeNull()
    expect(screen.queryByText('Brasil')).toBeNull()
    expect(screen.queryByText('R$ 300')).toBeNull()
    expect(screen.queryByText('+4 propriedades')).toBeNull()
  })

  it('não empilha o histórico de negociações no painel lateral', () => {
    const game = createSeedState(['p1', 'p2'])
    game.tradeHistory = [{
      fromId: 'p1',
      toId: 'p2',
      fromProps: [33],
      fromCash: 0,
      toProps: [],
      toCash: 0,
    }]
    act(() => useGameStore.setState({ game }))

    render(<ActionsPanel />)

    expect(screen.getByText('Nenhuma proposta na mesa')).toBeTruthy()
    expect(screen.queryByLabelText('Jogador 1 propõe uma troca com Jogador 2')).toBeNull()
  })

  it('lista várias rotas e abre a proposta escolhida pelo id', () => {
    const game = createSeedState(['p1', 'p2', 'p3'])
    game.tradeProposals = [
      {
        id: 7,
        trade: {
          fromId: 'p1', toId: 'p2', fromProps: [], fromCash: 0, toProps: [33], toCash: 0,
        },
      },
      {
        id: 9,
        trade: {
          fromId: 'p3', toId: 'p1', fromProps: [], fromCash: 500, toProps: [], toCash: 0,
        },
      },
    ]
    act(() => useGameStore.setState({ game }))

    render(<ActionsPanel />)

    expect(screen.getByText('2 ativas')).toBeTruthy()
    const actions = screen.getAllByRole('button', { name: /Ver proposta de/ })
    expect(actions).toHaveLength(2)
    fireEvent.click(actions[1])
    expect(useTradeUI.getState().selectedProposalId).toBe(9)
  })

  it('mantém nova negociação acionável enquanto há propostas ativas', () => {
    const game = createSeedState(['p1', 'p2'])
    game.tradeProposals = [{
      id: 1,
      trade: {
        fromId: 'p1', toId: 'p2', fromProps: [], fromCash: 0, toProps: [33], toCash: 0,
      },
    }]
    act(() => useGameStore.setState({ game }))

    render(<><ActionsPanel /><TradeLayer /></>)

    const action = screen.getByRole('button', { name: 'Nova negociação' })
    expect((action as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(action)
    expect(useTradeUI.getState().open).toBe(true)
    expect(screen.getByText('Negociação', { selector: 'h3' })).toBeTruthy()
  })

  it('oferece título ou imunidade no mesmo item da propriedade', () => {
    const game = createSeedState(['p1', 'p2'])
    game.titles[1].ownerId = 'p1'
    act(() => useGameStore.setState({ game }))

    render(<><ActionsPanel /><TradeLayer /></>)
    fireEvent.click(screen.getByRole('button', { name: 'Nova negociação' }))

    const property = screen.getByRole('group', { name: 'Negociar Roma' })
    const title = within(property).getByRole('button', { name: 'Incluir o título Roma' })
    const immunity = within(property).getByRole('button', { name: 'Conceder imunidade em Roma' })

    expect(screen.getAllByText('Roma')).toHaveLength(1)
    fireEvent.click(title)
    expect(title.getAttribute('aria-pressed')).toBe('true')

    fireEvent.click(immunity)
    expect(title.getAttribute('aria-pressed')).toBe('false')
    expect(immunity.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByLabelText('Duração da imunidade em Roma')).toBeTruthy()
  })
})
