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
  it('expõe a lotação, a ordem dos assentos e o turno atual semanticamente', () => {
    const game = createSeedState(['p1', 'p2'])
    act(() => useGameStore.setState({ game }))

    const { container } = render(<PlayersPanel />)

    expect(screen.getByLabelText('2 de 8 jogadores')).toBeTruthy()
    const roster = screen.getByRole('list', { name: 'Participantes da partida' })
    const rows = within(roster).getAllByRole('listitem')
    expect(rows).toHaveLength(2)
    expect(rows[0].getAttribute('aria-current')).toBe('step')
    expect(rows[1].hasAttribute('aria-current')).toBe(false)
    expect(container.querySelectorAll('.players-capacity__slots i[data-filled]')).toHaveLength(2)
    expect(container.querySelectorAll('.player-row__seat')[0]?.textContent).toBe('01')
    expect(within(rows[0]).getByText('Caixa')).toBeTruthy()
    expect(within(rows[0]).getByText('VEZ')).toBeTruthy()
  })
})
