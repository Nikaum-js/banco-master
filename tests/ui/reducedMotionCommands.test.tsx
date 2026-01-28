// @vitest-environment jsdom
// Prova executável (044, T072 — FR-031/FR-032, Fase 5b): dois achados da Fase 3 onde a
// lógica de jogo dependia de animação, consertados em T070 (Bus Ticket) e T071 (dado).
//
// `useReducedMotion` do `motion/react` é mockado (mesma fronteira estável de
// `tests/ui/motion.test.tsx` — a implementação real cacheia `matchMedia` num singleton de
// módulo, o que tornaria os cenários dependentes de ORDEM de execução no arquivo).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useGameStore } from '@/game/store'
import { useTokenAnim } from '@/game/ui/tokenAnim'
import { useBusTicketUI } from '@/game/ui/busTicketUI'
import { createSeedState } from '@/game/setup'
import { BOARD } from '@/lib/boardData'
import { ModalLayer } from '@/game/ui/modals/ModalLayer'
import { DiceArena } from '@/boards/shared'
import { LiveTokens } from '@/game/ui/LiveTokens'
import { GameDriver } from '@/game/ui/GameDriver'

const { getReduced, setReduced } = vi.hoisted(() => {
  let reduced = false
  return {
    getReduced: () => reduced,
    setReduced: (v: boolean) => { reduced = v },
  }
})

vi.mock('motion/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('motion/react')>()
  return { ...actual, useReducedMotion: () => getReduced() }
})

function resetStores() {
  useTokenAnim.setState({ animating: false, rolling: false })
  useBusTicketUI.setState({ armed: false, boarding: false })
}

describe('T070 — comando de Bus Ticket não espera animação (FR-031)', () => {
  // Lado 0 do tabuleiro é 1..11 (busSideOf) — fromPos=5 e um destino distinto no mesmo
  // lado (9) não caem em canto nem exigem lidar com wraparound.
  const FROM_POS = 5
  const DEST_POS = 9

  beforeEach(() => {
    vi.useFakeTimers()
    resetStores()
    const g = createSeedState(['p1', 'p2'])
    g.players[0].pos = FROM_POS
    g.players[0].busTickets = 1
    useGameStore.setState({ game: g })
    useBusTicketUI.setState({ armed: true, boarding: false })
  })

  afterEach(() => {
    cleanup()
    resetStores()
    vi.useRealTimers()
    setReduced(false)
  })

  it('sem movimento reduzido: o comando sai na hora; a decoração de embarque continua igual por cima', () => {
    setReduced(false)
    render(<ModalLayer />)
    const stopButton = screen.getByText(BOARD[DEST_POS].name).closest('button')!
    expect(stopButton).not.toBeNull()

    fireEvent.click(stopButton)

    // O comando já rodou — ticket gasto e peão já na casa nova, sem esperar nada (FR-031).
    const game = useGameStore.getState().game
    expect(game.players[0].pos).toBe(DEST_POS)
    expect(game.players[0].busTickets).toBe(0)

    // A decoração (ônibus viajando) ainda está na tela — identidade visual preservada
    // para quem não pediu movimento reduzido: o seletor não fecha no mesmo frame do clique.
    expect(useBusTicketUI.getState().armed).toBe(true)
    expect(screen.getByText('Embarcando…')).toBeTruthy()

    // Só depois da decoração (mesma duração de sempre) o seletor fecha de verdade.
    act(() => { vi.advanceTimersByTime(559) })
    expect(useBusTicketUI.getState().armed).toBe(true)
    act(() => { vi.advanceTimersByTime(1) })
    expect(useBusTicketUI.getState().armed).toBe(false)
  })

  it('com movimento reduzido: nenhuma espera — nem no comando, nem no fechamento do seletor', () => {
    setReduced(true)
    render(<ModalLayer />)
    const stopButton = screen.getByText(BOARD[DEST_POS].name).closest('button')!

    fireEvent.click(stopButton)

    const game = useGameStore.getState().game
    expect(game.players[0].pos).toBe(DEST_POS)
    expect(game.players[0].busTickets).toBe(0)

    // Sem movimento reduzido o fechamento levaria 560ms; reduzido, um único tick basta.
    act(() => { vi.advanceTimersByTime(0) })
    expect(useBusTicketUI.getState().armed).toBe(false)
  })
})

describe('T071/T072 — o dado não trava o turno por tempo fixo; handshake com GameDriver (FR-032)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    resetStores()
    useGameStore.setState({ game: createSeedState(['p1', 'p2']) })
  })

  afterEach(() => {
    cleanup()
    resetStores()
    vi.useRealTimers()
    setReduced(false)
  })

  // Roda a cena completa (rolar → peão anda → GameDriver libera a resolução) e devolve
  // pontos de checagem nos dois lados do "dado parou" — comuns aos dois modos.
  function runRollAndAssertHandshake(reduced: boolean) {
    setReduced(reduced)
    render(
      <>
        <DiceArena />
        <LiveTokens gridArea={() => ({})} />
        <GameDriver />
      </>,
    )

    const before = useGameStore.getState().game.players[0].pos
    fireEvent.click(screen.getByRole('button', { name: /Rolar dados/ }))

    // O comando de jogo já avançou — não espera a animação (FR-031/032): posição mudou e o
    // turno já está esperando resolução, ANTES de qualquer timer avançar.
    const justRolled = useGameStore.getState().game
    expect(justRolled.turn.state).toBe('casa-a-resolver')
    expect(justRolled.resolution).toBeNull()
    expect(justRolled.players[0].pos).not.toBe(before)

    // O dado ainda está "rolando" — o handshake segura o peão E o GameDriver nos DOIS
    // modos (rolling→animating→driver continua valendo mesmo com rollDurationMs=0).
    expect(useTokenAnim.getState().rolling).toBe(true)
    expect(useTokenAnim.getState().animating).toBe(true)
    expect(useGameStore.getState().game.turn.state).toBe('casa-a-resolver')
    expect(useGameStore.getState().game.resolution).toBeNull()

    // O dado "para": sem movimento reduzido isso levava 1050ms fixos INDEPENDENTE da
    // preferência do usuário (o bug do T071); reduzido, não há mais espera nenhuma.
    act(() => { vi.advanceTimersByTime(reduced ? 0 : 1050) })
    expect(useTokenAnim.getState().rolling).toBe(false)

    // O peão anda (passo a passo sem reduced; snap direto com reduced) até chegar — só
    // ENTÃO o GameDriver libera a resolução da casa. Avança em passos de STEP_MS (150ms)
    // até convergir; funciona pros dois modos porque o passo também é 0 sob reduced.
    for (let i = 0; i < 30 && useTokenAnim.getState().animating; i++) {
      act(() => { vi.advanceTimersByTime(150) })
    }
    expect(useTokenAnim.getState().animating).toBe(false)
    expect(useGameStore.getState().game.players[0].pos).toBe(justRolled.players[0].pos)

    // O handshake com GameDriver se manteve de ponta a ponta: só depois do peão chegar
    // (`animating: false`) é que o turno saiu do "casa-a-resolver + nada pendente" em que
    // ficou preso enquanto animava — prova de que `resolve-pending` não disparou cedo E
    // de que disparou depois (o jogo não trava esperando animação, FR-031).
    const settled = useGameStore.getState().game
    const stillStuck = settled.turn.state === 'casa-a-resolver' && settled.resolution === null && settled.turn.awaitingChoice === null
    expect(stillStuck).toBe(false)
  }

  it('sem movimento reduzido: o peão só anda quando o dado para; o driver só libera a resolução quando o peão chega', () => {
    runRollAndAssertHandshake(false)
  })

  it('com movimento reduzido: mesmo handshake, sem nenhuma das esperas fixas', () => {
    runRollAndAssertHandshake(true)
  })
})
