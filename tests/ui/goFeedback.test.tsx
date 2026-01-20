// @vitest-environment jsdom
import { act, cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DiceArena } from '@/boards/shared'
import { applyCommand } from '@/game/commands'
import { buildGameCtx, createSeedState } from '@/game/setup'
import { useGameStore } from '@/game/store'
import { SoundLayer } from '@/game/ui/sound/SoundLayer'
import { useRoomStore } from '@/net/roomStore'
import { rngFromDice } from '../game/turn/_helpers'

const audio = vi.hoisted(() => ({
  ensureUnlockListener: vi.fn(),
  play: vi.fn(),
  setMasterGain: vi.fn(),
}))

vi.mock('@/game/ui/sound/engine', () => audio)

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.clearAllMocks()
  useRoomStore.getState().reset()
})

describe('feedback do bônus de GO', () => {
  function rollAcrossGo(dice: [number, number]) {
    const game = createSeedState(['p1', 'p2'])
    game.players[0].pos = 43
    const next = applyCommand(
      game,
      { kind: 'roll' },
      buildGameCtx(rngFromDice(dice), () => 0),
    )
    return { game, next }
  }

  it('não duplica o feedback de dinheiro na arena central', async () => {
    const { game, next } = rollAcrossGo([2, 3])
    useGameStore.setState({ game })
    const { container } = render(<DiceArena />)

    act(() => useGameStore.setState({ game: next }))

    await waitFor(() => {
      expect(container.querySelector('.dice-arena__money-pulse')).toBeNull()
    })
  })

  it('separa o bônus do som dos dados para ele continuar audível', () => {
    vi.useFakeTimers()
    const { game, next } = rollAcrossGo([2, 3])
    useGameStore.setState({ game })
    render(<SoundLayer />)

    act(() => useGameStore.setState({ game: next }))

    expect(audio.play).toHaveBeenCalledWith('dice-roll')
    expect(audio.play).not.toHaveBeenCalledWith('go-bonus')

    act(() => vi.advanceTimersByTime(1_050))

    expect(audio.play).toHaveBeenCalledWith('go-bonus')
  })
})

describe('apresentação do jogador da vez', () => {
  it('não desenha o anel pontilhado no avatar central', () => {
    useGameStore.setState({ game: createSeedState(['p1', 'p2']) })

    const { container } = render(<DiceArena />)

    expect(container.querySelector('.face-active-ring')).toBeNull()
  })
})
