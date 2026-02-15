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

      // Fase 1 do reveal: o dado 3D ainda tomba — soma, líder e a vez do próximo
      // esperam o pouso (mesma disciplina da arena de dados do tabuleiro).
      expect(screen.getByRole('status').textContent).toContain('Nikaum está rolando')
      expect(screen.queryByText('Nikaum lidera com 8')).toBeNull()
      expect(screen.queryByRole('button', { name: 'Rolar meus dados' })).toBeNull()
      expect(screen.getByText('A mesa acompanha Nikaum')).toBeTruthy()

      // Fase 2: o cubo pousou — o resultado entra e o próximo já pode agir.
      act(() => {
        vi.advanceTimersByTime(1_100)
      })
      expect(screen.getByText('Nikaum lidera com 8')).toBeTruthy()
      expect(screen.getByRole('status').textContent).toContain('Nikaum tirou 8')
      expect(screen.getByRole('button', { name: 'Rolar meus dados' })).toBeTruthy()

      // Vencida a vitrine do resultado, o foco libera o próximo da fila.
      act(() => {
        vi.advanceTimersByTime(1_600)
      })
      expect(screen.getByText('Ana joga agora')).toBeTruthy()
    } finally {
      vi.useRealTimers()
    }
  })

  it('segura o resultado do último arremesso em cartaz até a autoridade trocar de tela', () => {
    vi.useFakeTimers()
    try {
      const beforeLast = rollingRoom([
        { ...seats[0], openingRoll: [5, 3] },
        seats[1],
      ])
      const { rerender } = render(
        <OpeningRolls room={beforeLast} myUid="host" onRoll={vi.fn()} />,
      )

      const allRolled = rollingRoom([
        { ...seats[0], openingRoll: [5, 3] },
        { ...seats[1], openingRoll: [6, 6], openingRollStartedAt: 5_000, openingRollResolvesAt: 7_600 },
      ])
      rerender(<OpeningRolls room={allRolled} myUid="host" onRoll={vi.fn()} />)

      expect(screen.getByRole('status').textContent).toContain('Ana está rolando')

      // Pousou: o resultado decisivo fica anunciado SEM prazo local — quem encerra é a
      // troca de tela comandada pela autoridade, nunca um timer da própria tela.
      act(() => {
        vi.advanceTimersByTime(5_000)
      })
      expect(screen.getByRole('status').textContent).toContain('Ana tirou 12')
      expect(screen.getByText('Ana lidera com 12')).toBeTruthy()
    } finally {
      vi.useRealTimers()
    }
  })
})
