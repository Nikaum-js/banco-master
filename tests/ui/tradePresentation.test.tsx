// @vitest-environment jsdom
import { act } from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ActionsPanel, PlayersPanel } from '@/boards/shared'
import { createSeedState } from '@/game/setup'
import { useGameStore } from '@/game/store'
import { THEME } from '@/game/theme'
import { TradeDeedItem } from '@/game/ui/trade/TradeDeedItem'
import { useTradeUI } from '@/game/ui/trade/tradeUI'
import { TradeLayer } from '@/game/ui/trade/TradeLayer'
import type { Room } from '@/net/room'
import { useRoomStore } from '@/net/roomStore'

afterEach(() => {
  cleanup()
  useTradeUI.setState({ open: false, selectedProposalId: null })
  useRoomStore.getState().reset()
})

describe('apresentação da negociação', () => {
  it('mantém o empréstimo ativo abaixo dos efeitos na coluna esquerda', () => {
    const game = createSeedState(['p1', 'p2'])
    game.loans = [{ debtorId: 'p1', creditorId: 'p2', principal: 26, ratePct: 50 }]
    act(() => useGameStore.setState({ game }))

    render(
      <>
        <PlayersPanel />
        <ActionsPanel />
      </>,
    )

    const effectsPanel = screen.getByText('Efeitos ativos').closest('aside')
    const loanPanel = screen.getByText('Empréstimo ativo').closest('aside')
    expect(loanPanel).toBe(effectsPanel)
    expect(screen.getByText('Empréstimo ativo').closest('.loan-panel-section')).toBeTruthy()
  })

  it('mostra o empréstimo ao credor sem oferecer quitação em nome do devedor', () => {
    const game = createSeedState(['p1', 'p2'])
    game.loans = [{ debtorId: 'p1', creditorId: 'p2', principal: 26, ratePct: 50 }]
    const room: Room = {
      id: 'loan-room',
      status: 'playing',
      seats: [
        {
          playerId: 'p1', uid: 'nikolas-uid', name: 'Nikolas', color: '#3b8bd0',
          isHost: true, connected: true, reentryCode: 'NIK111',
        },
        {
          playerId: 'p2', uid: 'ana-uid', name: 'Ana', color: '#b665a2',
          isHost: false, connected: true, reentryCode: 'ANA222',
        },
      ],
    }
    act(() => {
      useGameStore.setState({ game })
      useRoomStore.setState({ room, myUid: 'ana-uid' })
    })

    render(<PlayersPanel />)

    expect(screen.getByText('Nikolas deve a você')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Quitar/ })).toBeNull()
    expect(screen.getByText('Principal fixo')).toBeTruthy()
    expect(screen.getByText('Cobrança por GO')).toBeTruthy()
  })

  it('oferece quitação somente ao devedor local', () => {
    const game = createSeedState(['p1', 'p2'])
    game.loans = [{ debtorId: 'p1', creditorId: 'p2', principal: 26, ratePct: 50 }]
    const room: Room = {
      id: 'loan-room',
      status: 'playing',
      seats: [
        {
          playerId: 'p1', uid: 'nikolas-uid', name: 'Nikolas', color: '#3b8bd0',
          isHost: true, connected: true, reentryCode: 'NIK111',
        },
        {
          playerId: 'p2', uid: 'ana-uid', name: 'Ana', color: '#b665a2',
          isHost: false, connected: true, reentryCode: 'ANA222',
        },
      ],
    }
    act(() => {
      useGameStore.setState({ game })
      useRoomStore.setState({ room, myUid: 'nikolas-uid' })
    })

    render(<PlayersPanel />)

    expect(screen.getByText('Você deve a Ana')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Quitar R$ 26' })).toBeTruthy()
  })

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

    const proposal = screen.getByRole('button', { name: 'Ver proposta de Jogador 1 para Jogador 2' })
    expect(within(proposal).getByText('Jogador 1')).toBeTruthy()
    expect(within(proposal).getByText('Jogador 2')).toBeTruthy()
    expect(proposal.querySelector('.truncate')).toBeNull()
    expect(screen.queryByText('Ver proposta')).toBeNull()
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

  it('usa o assento local como "você" mesmo fora da própria vez', () => {
    const game = createSeedState(['p1', 'p2'])
    game.activeSeat = 0
    game.titles[33].ownerId = 'p1'
    game.titles[1].ownerId = 'p2'
    const room: Room = {
      id: 'r1',
      status: 'playing',
      seats: [
        {
          playerId: 'p1',
          uid: 'ana-uid',
          name: 'Ana',
          color: '#b665a2',
          isHost: true,
          connected: true,
          reentryCode: 'ANA111',
        },
        {
          playerId: 'p2',
          uid: 'nikolas-uid',
          name: 'Nikolas',
          color: '#3b8bd0',
          isHost: false,
          connected: true,
          reentryCode: 'NIK222',
        },
      ],
    }
    act(() => {
      useGameStore.setState({ game })
      useRoomStore.setState({ room, myUid: 'nikolas-uid' })
    })

    render(<><ActionsPanel /><TradeLayer /></>)
    fireEvent.click(screen.getByRole('button', { name: 'Nova negociação' }))

    const youSide = screen.getByText('Você oferece').parentElement?.parentElement
    expect(youSide).toBeTruthy()
    expect(within(youSide as HTMLElement).getByRole('button', { name: 'Incluir o título Roma' })).toBeTruthy()
    expect(within(youSide as HTMLElement).queryByRole('button', { name: 'Incluir o título Rio de Janeiro' })).toBeNull()
    expect(screen.getByText('Ana oferece')).toBeTruthy()
    expect(screen.queryByText('Nikolas oferece')).toBeNull()
  })

  it('oferece qualquer valor inteiro pelo trilho, até o caixa disponível', () => {
    const game = createSeedState(['p1', 'p2'])
    act(() => useGameStore.setState({ game }))

    render(<><ActionsPanel /><TradeLayer /></>)
    fireEvent.click(screen.getByRole('button', { name: 'Nova negociação' }))

    const ranges = screen.getAllByRole('slider', { name: 'Dinheiro na oferta' }) as HTMLInputElement[]
    expect(ranges[0].step).toBe('1')
    expect(ranges[0].max).toBe(String(THEME.INITIAL_CASH))

    fireEvent.change(ranges[0], { target: { value: '1' } })
    expect(ranges[0].value).toBe('1')
    expect(ranges[0].getAttribute('aria-valuetext')).toBe(`R$ 1 de R$ ${THEME.INITIAL_CASH.toLocaleString('pt-BR')}`)

    const tudo = screen.getAllByRole('button', { name: 'TUDO' })
    fireEvent.click(tudo[0])
    expect(ranges[0].value).toBe(String(THEME.INITIAL_CASH))
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

  // §8.5 (D-058, FR-017) — recusar sem dizer o porquê seria indistinguível de bug. Roma sem
  // nada em troca é doação pura; a mensagem pede qualquer contrapartida.
  it('explica a recusa por doação pura', () => {
    const game = createSeedState(['p1', 'p2'])
    game.titles[1].ownerId = 'p1' // Roma, $60, oferecida por nada
    act(() => useGameStore.setState({ game }))

    render(<><ActionsPanel /><TradeLayer /></>)
    fireEvent.click(screen.getByRole('button', { name: 'Nova negociação' }))
    fireEvent.click(screen.getByRole('button', { name: 'Incluir o título Roma' }))

    const status = screen.getByRole('status')
    expect(status.textContent).toContain('sem receber nada')
    expect((screen.getByRole('button', { name: 'Confirmar' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('some com a explicação quando há contrapartida', () => {
    const game = createSeedState(['p1', 'p2'])
    game.titles[1].ownerId = 'p1'
    game.titles[3].ownerId = 'p2' // Veneza, $80 — contrapartida real
    act(() => useGameStore.setState({ game }))

    render(<><ActionsPanel /><TradeLayer /></>)
    fireEvent.click(screen.getByRole('button', { name: 'Nova negociação' }))
    fireEvent.click(screen.getByRole('button', { name: 'Incluir o título Roma' }))
    fireEvent.click(screen.getByRole('button', { name: 'Incluir o título Veneza' }))

    expect(screen.queryByRole('status')).toBeNull()
    expect((screen.getByRole('button', { name: 'Confirmar' }) as HTMLButtonElement).disabled).toBe(false)
  })
})
