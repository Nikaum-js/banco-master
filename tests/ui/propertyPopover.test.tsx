// @vitest-environment jsdom
import { act } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { BuildingMark, PropertyPopover } from '@/boards/shared'
import { createSeedState } from '@/game/setup'
import { useGameStore } from '@/game/store'
import { BOARD, type PropertySquare } from '@/lib/boardData'
import { createRoom, SEAT_COLORS } from '@/net/room'
import { useRoomStore } from '@/net/roomStore'

afterEach(() => {
  cleanup()
  useGameStore.getState().resetGame()
  useRoomStore.getState().reset()
})

describe('popover de propriedade', () => {
  it('apresenta a progressão completa e resolve o dono para sua identidade pública', () => {
    const game = createSeedState(['p1', 'p2'])
    game.titles[1].ownerId = 'p1'
    game.titles[1].houses = 2
    const room = createRoom('r1', {
      uid: 'host',
      name: 'Nikolas',
      color: SEAT_COLORS[0],
      avatar: 'prism-face',
      skin: 'astronauta',
    })

    act(() => {
      useGameStore.setState({ game })
      useRoomStore.setState({ room, myUid: 'host' })
    })

    const { container } = render(
      <PropertyPopover
        square={BOARD[1] as PropertySquare}
        side="top"
        onClose={() => undefined}
      />,
    )

    expect(screen.getByText('Nikolas')).toBeTruthy()
    expect(screen.queryByText(/^p1$/i)).toBeNull()
    expect(container.querySelector('.property-deed__owner-avatar.avatar-face')).toBeTruthy()

    const tiers = container.querySelectorAll('.property-rent-tier')
    expect(tiers).toHaveLength(8)
    expect(container.querySelectorAll('.property-rent-tier__mark svg')).toHaveLength(15)
    expect(container.querySelector('[data-tier="house"][data-active]')?.textContent).toContain('2 casas')
    expect(container.querySelector('svg animate')).toBeNull()
  })

  it('reaproveita a mesma família de glifos na marca de construção do tabuleiro', () => {
    const game = createSeedState(['p1', 'p2'])
    game.titles[1].ownerId = 'p1'
    game.titles[1].houses = 4
    act(() => useGameStore.setState({ game }))

    const { container } = render(<BuildingMark pos={1} />)

    const mark = container.querySelector('[data-building-layout="grid-2x2"]')
    expect(mark).toBeTruthy()
    expect(mark?.querySelectorAll('svg')).toHaveLength(4)
    expect(mark?.querySelector('svg')?.getAttribute('width')).toBe('13')
    expect(container.querySelector('svg animate')).toBeNull()
  })

  it('bloqueia o arranha-céu no botão e no dispatch quando o grupo está incompleto', () => {
    const game = createSeedState(['p1', 'p2'])
    const title = game.titles[1]
    title.ownerId = 'p1'
    title.hotel = true
    title.hotel2 = true
    game.players[0].cash = 10_000
    act(() => useGameStore.setState({ game }))

    render(
      <PropertyPopover
        square={BOARD[1] as PropertySquare}
        side="top"
        onClose={() => undefined}
      />,
    )

    expect((screen.getByRole('button', { name: 'Construir' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('Tenha todas as cidades do país para construir o arranha-céu.')).toBeTruthy()

    const before = useGameStore.getState().game
    act(() => useGameStore.getState().dispatch({ kind: 'build-house', pos: 1 }))
    expect(useGameStore.getState().game).toBe(before)
    expect(useGameStore.getState().game.titles[1].skyscraper).toBe(false)
  })
})
