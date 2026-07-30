// @vitest-environment jsdom
//
// O bônus de GO tem UM lugar na tela: a caixa de jogadores à esquerda. Antes ele aparecia
// DUAS vezes — lá e num pulso flutuante em cima da carinha central da DiceArena, no ponto de
// maior atenção da tela (ao lado dos dados e do botão de rolar). O pulso central saiu; este
// arquivo trava a remoção pelos dois lados, senão ele volta na primeira refatoração.
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DiceArena, PlayersPanel } from '@/boards/shared'
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
  useTokenAnim.setState({ animating: false, rolling: false })
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

  it.each([
    ['passando pelo GO', 42, [3, 4] as [number, number], 5],
    ['parando no GO', 43, [2, 3] as [number, number], 4],
  ])('não mostra dinheiro sobre a carinha central ao %s', (_label, pos, dice, steps) => {
    vi.useFakeTimers()
    const { game, next } = rollFrom(pos, dice)
    useGameStore.setState({ game })
    const { container } = render(
      <>
        <DiceArena />
        <LiveTokens gridArea={() => ({})} />
      </>,
    )

    act(() => useGameStore.setState({ game: next }))
    expect(container.querySelector('.dice-arena__money-pulse')).toBeNull()

    // Atravessa a caminhada inteira, incluindo o passo visual 47→0 que ANTES acendia o
    // pulso central: em nenhum instante a arena mostra valor de dinheiro.
    advanceTokenSteps(steps)
    expect(container.querySelector('.dice-arena__money-pulse')).toBeNull()

    act(() => vi.advanceTimersByTime(150))
    expect(container.querySelector('.dice-arena__money-pulse')).toBeNull()
    expect(container.textContent).not.toMatch(/\+R\$/)
  })

  it.each([
    ['+R$200 passando pelo GO', 42, [3, 4] as [number, number]],
    ['+R$400 parando no GO', 43, [2, 3] as [number, number]],
  ])('mostra %s na caixa de jogadores', (label, pos, dice) => {
    const { game, next } = rollFrom(pos, dice)
    useGameStore.setState({ game })
    const { container } = render(<PlayersPanel />)

    act(() => useGameStore.setState({ game: next }))

    const expected = label.split(' ')[0]
    expect(container.querySelector('.player-row__pulse')?.textContent).toBe(expected)
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
