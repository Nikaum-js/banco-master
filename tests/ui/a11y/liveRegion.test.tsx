// @vitest-environment jsdom
// LiveRegion (044, T028 — US3/D5 do plan). Estilo de teste segue o padrão de componente
// da 042/044 (pragma jsdom, @testing-library/react, store zustand pilotado direto via
// `setState`, igual `tests/ui/errorBoundaries/commandFailureToast.test.tsx`).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { LiveRegion } from '@/game/ui/a11y/LiveRegion'
import { useGameStore } from '@/game/store'
import { useRoomStore } from '@/net/roomStore'
import { createSeedState } from '@/game/setup'
import { BOARD } from '@/lib/boardData'
import { money } from '@/lib/money'
import type { GameState } from '@/game/turn/types'
import type { Room } from '@/net/room'

function seed(playerCount: number): GameState {
  const ids = Array.from({ length: playerCount }, (_, i) => `p${i + 1}`)
  return createSeedState(ids)
}

function fakeRoom(): Room {
  return {
    id: 'room-1',
    status: 'playing',
    seats: [
      { playerId: 'p1', token: 'tok1', name: 'Ana', color: '#d9a650', isHost: true, connected: true, reentryCode: 'AAA111' },
      { playerId: 'p2', token: 'tok2', name: 'Bia', color: '#a76bf5', isHost: false, connected: true, reentryCode: 'BBB222' },
    ],
  }
}

beforeEach(() => {
  // O boundary loga a falha capturada no console — mesmo silenciamento que
  // `accessoryErrorBoundary.test.tsx` já usa, pra não sujar a saída do teste.
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  useGameStore.getState().resetGame()
  useRoomStore.getState().reset()
})

describe('LiveRegion (T028)', () => {
  it('entrada nova no log é anunciada no canal educado, com a MESMA frase da tela', () => {
    const g = seed(2)
    useGameStore.setState({ game: g })
    const { rerender } = render(<LiveRegion />)
    expect(screen.getByRole('status').textContent).toBe('')

    // 'buy': describeLogEntry produz [who, ' comprou ', place, ' por ', money] — a região
    // viva concatena os MESMOS fragmentos em texto puro (D5), então a expectativa usa as
    // mesmas fontes (BOARD, money) em vez de um texto fixo frágil.
    const pos = 1
    const price = 60
    const next: GameState = { ...g, log: [...g.log, { kind: 'buy', who: 'p1', pos, price }] }
    useGameStore.setState({ game: next })
    rerender(<LiveRegion />)

    expect(screen.getByRole('status').textContent).toBe(`Jogador 1 comprou ${BOARD[pos].name} por ${money(price)}`)
  })

  it('início da minha vez (ou de uma decisão minha) é anunciado no canal assertivo', () => {
    const g = seed(2)
    g.activeSeat = 0 // vez de p1 — não sou eu
    useGameStore.setState({ game: g })
    useRoomStore.setState({ room: fakeRoom(), myToken: 'tok2' }) // eu sou p2

    const { rerender } = render(<LiveRegion />)
    expect(screen.getByRole('alert').textContent).toBe('')

    const next: GameState = { ...g, activeSeat: 1 } // agora é a vez de p2 (eu)
    useGameStore.setState({ game: next })
    rerender(<LiveRegion />)

    expect(screen.getByRole('alert').textContent).toBe('Sua vez')
  })

  it('`kind` de log desconhecido não derruba a região viva nem o resto da árvore (não repete o bug da 040/042)', () => {
    const g = seed(2)
    // Fato impossível pelo motor real, mas possível num snapshot velho/adulterado —
    // `describeLogEntry` lança por exaustividade (`assertNever`), e só um throw durante
    // RENDER é capturado pela `AccessoryErrorBoundary` que envolve `LiveRegion`.
    g.log = [{ kind: 'kind-que-nao-existe' } as unknown as GameState['log'][number]]
    useGameStore.setState({ game: g })

    render(
      <>
        <p>tabuleiro-fake</p>
        <LiveRegion />
      </>,
    )

    expect(screen.getByText('tabuleiro-fake')).toBeTruthy()
    expect(screen.getByText(/anúncios indisponível/i)).toBeTruthy()
  })
})
