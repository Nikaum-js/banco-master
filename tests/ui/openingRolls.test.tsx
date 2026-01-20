// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Room } from '@/net/room'
import { OpeningRolls } from '@/net/ui/LobbyScreen'

const seats: Room['seats'] = [
  {
    playerId: 'p1',
    uid: 'host',
    name: 'Nikaum',
    color: '#36dde7',
    avatar: 'orbital-eyes',
    skin: 'careca',
    isHost: true,
    connected: true,
    openingRoll: null,
    openingRollStartedAt: null,
    openingRollResolvesAt: null,
    reentryCode: '',
  },
  {
    playerId: 'p2',
    uid: 'guest',
    name: 'Ana',
    color: '#e77376',
    avatar: 'prism-face',
    skin: 'astronauta',
    isHost: false,
    connected: true,
    openingRoll: null,
    openingRollStartedAt: null,
    openingRollResolvesAt: null,
    reentryCode: '',
  },
]

function rollingRoom(nextSeats: Room['seats'] = seats): Room {
  return {
    id: 'mesa',
    status: 'rolling',
    openingMode: 'dice-roll',
    seats: nextSeats,
  }
}

afterEach(cleanup)

describe('disputa de Maior dado', () => {
  it('entrega a ação somente ao dono do assento da vez', () => {
    const onRoll = vi.fn()
    const { rerender } = render(
      <OpeningRolls room={rollingRoom()} myUid="host" onRoll={onRoll} />,
    )

    expect(screen.getByText('Nikaum joga agora')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Rolar meus dados' }))
    expect(onRoll).toHaveBeenCalledOnce()

    rerender(<OpeningRolls room={rollingRoom()} myUid="guest" onRoll={onRoll} />)
    expect(screen.queryByRole('button', { name: 'Rolar meus dados' })).toBeNull()
    expect(screen.getByText('Aguardando Nikaum rolar')).toBeTruthy()
  })

  it('anuncia o mesmo arremesso para toda a mesa e só depois libera o próximo', () => {
    vi.useFakeTimers()
    try {
      const inFlight = rollingRoom([
        {
          ...seats[0],
          openingRollStartedAt: 1_000,
          openingRollResolvesAt: 2_400,
        },
        seats[1],
      ])
      const { rerender } = render(
        <OpeningRolls room={inFlight} myUid="guest" onRoll={vi.fn()} />,
      )

      expect(screen.getByRole('status').textContent).toContain('Nikaum está rolando')
      expect(screen.getByRole('img', { name: 'Dados de Nikaum em movimento' })).toBeTruthy()
      expect(screen.queryByRole('button', { name: 'Rolar meus dados' })).toBeNull()

      const next = rollingRoom([
        {
          ...seats[0],
          openingRoll: [5, 3],
          openingRollStartedAt: null,
          openingRollResolvesAt: null,
        },
        seats[1],
      ])
      rerender(<OpeningRolls room={next} myUid="guest" onRoll={vi.fn()} />)

      // Reveal: o foco FICA em quem rolou enquanto o dado 3D tomba na face
      // sorteada — o resultado é anunciado antes de o foco passar adiante.
      expect(screen.getByText('Nikaum lidera com 8')).toBeTruthy()
      expect(screen.getByRole('status').textContent).toContain('Nikaum tirou 8')
      expect(screen.getByRole('button', { name: 'Rolar meus dados' })).toBeTruthy()

      // Vencido o tempo do tumble, o foco libera o próximo da fila.
      act(() => {
        vi.advanceTimersByTime(1_600)
      })
      expect(screen.getByText('Ana joga agora')).toBeTruthy()
    } finally {
      vi.useRealTimers()
    }
  })
})
