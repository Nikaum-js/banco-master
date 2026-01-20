// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ClassicSquare } from '@/boards/shared'
import { createSeedState } from '@/game/setup'
import { useGameStore } from '@/game/store'
import { BOARD } from '@/lib/boardData'
import { createRoom, joinRoom, SEAT_COLORS } from '@/net/room'
import { useRoomStore } from '@/net/roomStore'

const originalGame = useGameStore.getState().game

afterEach(() => {
  cleanup()
  act(() => {
    useGameStore.setState({ game: originalGame })
    useRoomStore.getState().reset()
  })
})

describe('ClassicSquare', () => {
  it('usa a cor da identidade da sala na marca de posse', () => {
    const game = createSeedState(['p1', 'p2'])
    game.titles[1].ownerId = 'p1'
    game.titles[3].ownerId = 'p2'

    let room = createRoom('r1', {
      uid: 'ana',
      name: 'Ana',
      color: SEAT_COLORS[6],
    })
    const joined = joinRoom(room, {
      uid: 'nikolas',
      name: 'Nikolas',
      color: SEAT_COLORS[0],
    })
    if (!joined.ok) throw new Error(joined.reason)
    room = joined.room

    act(() => {
      useGameStore.setState({ game })
      useRoomStore.setState({ room, myUid: 'nikolas' })
    })

    const anaSquare = BOARD.find((item) => item.pos === 1)
    const nikolasSquare = BOARD.find((item) => item.pos === 3)
    if (!anaSquare || !nikolasSquare) throw new Error('Casas do cenário ausentes')
    const { container } = render(
      <>
        <ClassicSquare square={anaSquare} side="bottom" />
        <ClassicSquare square={nikolasSquare} side="bottom" />
      </>,
    )
    const ownerBorders = Array.from(container.querySelectorAll<HTMLElement>('[style]'))
      .filter((element) => element.getAttribute('style')?.includes('box-shadow: inset 0 0 0 1.5px'))

    expect(ownerBorders[0]?.getAttribute('style')).toContain(SEAT_COLORS[6])
    expect(ownerBorders[1]?.getAttribute('style')).toContain(SEAT_COLORS[0])
  })
})
