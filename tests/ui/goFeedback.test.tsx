// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DiceArena } from '@/boards/shared'
import { applyCommand } from '@/game/commands'
import { buildGameCtx, createSeedState } from '@/game/setup'
import { useGameStore } from '@/game/store'
import { LiveTokens } from '@/game/ui/LiveTokens'
import { SoundLayer } from '@/game/ui/sound/SoundLayer'
import { useTokenAnim } from '@/game/ui/tokenAnim'
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
  useTokenAnim.setState({ animating: false, rolling: false, goCrossing: null })
  useRoomStore.getState().reset()
})

describe('feedback do bônus de GO', () => {
  function advanceTokenSteps(steps: number) {
    act(() => vi.advanceTimersByTime(1_050))
    for (let step = 0; step < steps; step++) {
      act(() => vi.advanceTimersByTime(150))
    }
  }

  function rollFrom(pos: number, dice: [number, number]) {
    const game = createSeedState(['p1', 'p2'])
    game.players[0].pos = pos
    const next = applyCommand(
      game,
      { kind: 'roll' },
      buildGameCtx(rngFromDice(dice), () => 0),
    )
    return { game, next }
  }

  it('mostra +R$ 200 somente quando o peão passa visualmente pelo GO', () => {
    vi.useFakeTimers()
    const { game, next } = rollFrom(42, [3, 4])
    useGameStore.setState({ game })
    const { container } = render(
      <>
        <DiceArena />
        <LiveTokens gridArea={() => ({})} />
      </>,
    )

    act(() => useGameStore.setState({ game: next }))
    expect(container.querySelector('.dice-arena__money-pulse')).toBeNull()

    advanceTokenSteps(5)
    expect(container.querySelector('.dice-arena__money-pulse')).toBeNull()

    act(() => vi.advanceTimersByTime(150))
    expect(container.querySelector('.dice-arena__money-pulse')?.textContent).toBe('+R$200')
  })

  it('mostra +R$ 400 somente quando o peão chega visualmente ao GO', () => {
    vi.useFakeTimers()
    const { game, next } = rollFrom(43, [2, 3])
    useGameStore.setState({ game })
    const { container } = render(
      <>
        <DiceArena />
        <LiveTokens gridArea={() => ({})} />
      </>,
    )

    act(() => useGameStore.setState({ game: next }))
    expect(container.querySelector('.dice-arena__money-pulse')).toBeNull()

    advanceTokenSteps(4)
    expect(container.querySelector('.dice-arena__money-pulse')).toBeNull()

    act(() => vi.advanceTimersByTime(150))
    expect(container.querySelector('.dice-arena__money-pulse')?.textContent).toBe('+R$400')
  })

  it('separa o bônus do som dos dados para ele continuar audível', () => {
    vi.useFakeTimers()
    const { game, next } = rollFrom(43, [2, 3])
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
