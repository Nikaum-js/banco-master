// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { LiveTokens } from '@/game/ui/LiveTokens'
import { createSeedState } from '@/game/setup'
import { useGameStore } from '@/game/store'
import { createRoom, joinRoom, SEAT_COLORS } from '@/net/room'
import { useRoomStore } from '@/net/roomStore'

afterEach(() => {
  cleanup()
  act(() => useRoomStore.getState().reset())
})

describe('tokens vivos', () => {
  it('usa cor, avatar e skin da identidade persistida na sala', () => {
    const game = createSeedState(['p1', 'p2'])
    let room = createRoom('r1', {
      uid: 'host',
      name: 'Host',
      color: SEAT_COLORS[0],
      avatar: 'prism-face',
      skin: 'cartola',
    })
    const joined = joinRoom(room, {
      uid: 'guest',
      name: 'Guest',
      color: SEAT_COLORS[1],
      avatar: 'totem-face',
      skin: 'astronauta',
    })
    if (!joined.ok) throw new Error(joined.reason)
    room = joined.room

    act(() => {
      useGameStore.setState({ game })
      useRoomStore.setState({ room, myUid: 'host' })
    })

    const { container } = render(<LiveTokens gridArea={() => ({})} />)
    expect(container.querySelector('[data-avatar="prism-face"][data-skin="cartola"]')).toBeTruthy()
    expect(container.querySelector('[data-avatar="totem-face"][data-skin="astronauta"]')).toBeTruthy()
  })
})
