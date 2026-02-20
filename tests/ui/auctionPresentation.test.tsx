// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSeedState } from '@/game/setup'
import { useGameStore } from '@/game/store'
import { ModalLayer } from '@/game/ui/modals/ModalLayer'
import { useRoomStore } from '@/net/roomStore'

describe('apresentação das ações do leilão', () => {
  beforeEach(() => {
    const game = createSeedState(['p1', 'p2'])
    game.players[0].cash = 499
    game.resolution = {
      kind: 'auction',
      auction: {
        pos: 30,
        currentBid: 110,
        highBidder: 'p1',
        activeBidders: ['p1', 'p2'],
        deadline: Date.now() + 8_000,
      },
    }
    useGameStore.setState({ game })
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    useRoomStore.getState().reset()
  })

  it('distingue cada lance dos valores informativos com ícone e linguagem de ação', () => {
    render(<ModalLayer />)

    const bids = screen.getAllByRole('button', { name: /Dar lance de/ })
    expect(bids).toHaveLength(3)
    for (const bid of bids) {
      expect(bid.classList.contains('title-auction-bid-option')).toBe(true)
      expect(bid.querySelector('.title-auction-bid-option__cue svg')).toBeTruthy()
      expect(bid.querySelector('.title-auction-bid-option__amount')).toBeTruthy()
      expect(bid.querySelector('.title-auction-bid-option__increment')).toBeTruthy()
    }

    const facts = screen.getByLabelText('Valores do título')
    expect(within(facts).getByText('Preço')).toBeTruthy()
    expect(within(facts).getByText('Hipoteca')).toBeTruthy()
    expect(facts.querySelector('.title-auction-bid-option__cue')).toBeNull()
  })

  it('usa o relógio autoritativo mesmo quando o relógio local está 190s atrasado', () => {
    vi.useFakeTimers()
    vi.setSystemTime(810_000)
    const game = createSeedState(['p1', 'p2'])
    game.resolution = {
      kind: 'auction',
      auction: {
        pos: 30,
        currentBid: 100,
        highBidder: 'p1',
        activeBidders: ['p1', 'p2'],
        deadline: 1_010_000,
      },
    }
    useGameStore.setState({ game })
    useRoomStore.setState({ clockOffsetMs: 190_000 } as Partial<ReturnType<typeof useRoomStore.getState>>)

    render(<ModalLayer />)

    expect(screen.getByText('10s')).toBeTruthy()
  })
})
