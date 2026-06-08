// @vitest-environment jsdom
import { act } from 'react'
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { PlayersPanel } from '@/boards/shared'
import { createSeedState } from '@/game/setup'
import { useGameStore } from '@/game/store'
import { useRoomStore } from '@/net/roomStore'

afterEach(() => {
  cleanup()
  useRoomStore.getState().reset()
})

describe('painel de participantes', () => {
  it('expõe a lotação, segue a ordem de jogada e marca o turno sem numeração redundante', () => {
    const game = createSeedState(['p1', 'p2'])
    game.turnOrder = [1, 0]
    act(() => useGameStore.setState({ game }))

    const { container } = render(<PlayersPanel />)

    expect(screen.getByText('2 de 8 jogadores').classList.contains('sr-only')).toBe(true)
    const roster = screen.getByRole('list', { name: 'Participantes da partida' })
    const rows = within(roster).getAllByRole('listitem')
    expect(rows).toHaveLength(2)
    expect(within(rows[0]).getByText('Jogador 2')).toBeTruthy()
    expect(within(rows[1]).getByText('Jogador 1')).toBeTruthy()
    expect(rows[0].dataset.active).toBe('true')
    expect(rows[0].hasAttribute('aria-current')).toBe(false)
    expect(within(rows[0]).getByText('Turno atual').classList.contains('sr-only')).toBe(true)
    expect(container.querySelector('.players-capacity__slots')).toBeNull()
    expect(container.querySelector('.player-row__seat')).toBeNull()
    expect(container.querySelector('.player-row__portrait .avatar-artwork')).toBeTruthy()
    expect(within(rows[0]).getByText('Caixa')).toBeTruthy()
    expect(within(rows[0]).queryByText('VEZ')).toBeNull()
  })

  it('trata o participante falido como um assento encerrado', () => {
    const game = createSeedState(['p1', 'p2'])
    game.players[1].eliminated = true
    act(() => useGameStore.setState({ game }))

    const { container } = render(<PlayersPanel />)
    const row = screen.getByText('Jogador 2').closest('.player-row')

    expect(row?.classList.contains('player-row--bankrupt')).toBe(true)
    expect(within(row as HTMLElement).getByText('Falido').classList.contains('player-row__state--bankrupt')).toBe(true)
    expect(container.querySelectorAll('.player-row--bankrupt')).toHaveLength(1)
  })
})
