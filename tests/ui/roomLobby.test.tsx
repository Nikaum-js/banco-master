// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Room } from '@/net/room'
import { RoomLobby } from '@/net/ui/LobbyScreen'

const hostSeat: Room['seats'][number] = {
  playerId: 'p1',
  uid: 'host',
  name: 'Nikaum',
  color: '#36dde7',
  avatar: 'orbital-eyes',
  skin: 'careca',
  isHost: true,
  connected: true,
  reentryCode: '823-174',
}

function roomWith(...seats: Room['seats']): Room {
  return {
    id: 'fc532036e9',
    status: 'lobby',
    openingMode: 'sealed-bid',
    seats,
  }
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('sala aberta', () => {
  it('apresenta convite copiável e identidade do assento sem input ou badges redundantes', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })

    render(
      <RoomLobby
        room={roomWith(hostSeat)}
        myUid="host"
        myReentryCode={null}
        isHost
        link="http://localhost:5173/?room=fc532036e9"
        onStart={vi.fn()}
      />,
    )

    expect(screen.queryByRole('textbox', { name: 'Link da sala' })).toBeNull()
    expect(screen.getByText('Link pronto para compartilhar')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Compartilhar sala' })).toBeTruthy()
    expect(screen.getByText('Seu assento · Host')).toBeTruthy()
    expect(screen.queryByText(/^você$/i)).toBeNull()
    expect(screen.queryByText(/^host$/i)).toBeNull()
    expect((screen.getByRole('button', {
      name: 'Falta 1 jogador para liberar a largada',
    }) as HTMLButtonElement).disabled).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Copiar link da sala' }))

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('http://localhost:5173/?room=fc532036e9')
      expect(screen.getByRole('button', { name: 'Link da sala copiado' })).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Compartilhar sala' }))
    expect(screen.getByRole('dialog', { name: 'Compartilhar sala' })).toBeTruthy()
    expect(screen.getByRole('img', { name: 'QR Code do convite da sala' })).toBeTruthy()
  })

  it('explica os rituais e libera a ação quando a mesa atinge o mínimo', () => {
    const onOpeningModeChange = vi.fn()
    const onStart = vi.fn()
    const guestSeat: Room['seats'][number] = {
      ...hostSeat,
      playerId: 'p2',
      uid: 'guest',
      name: 'Ana',
      color: '#e77376',
      isHost: false,
      reentryCode: '291-630',
    }

    render(
      <RoomLobby
        room={roomWith(hostSeat, guestSeat)}
        myUid="host"
        myReentryCode={null}
        isHost
        link="http://localhost:5173/?room=fc532036e9"
        onOpeningModeChange={onOpeningModeChange}
        onStart={onStart}
      />,
    )

    expect(screen.getByText('Lances definem a ordem e abastecem a Loteria.')).toBeTruthy()
    expect(screen.getByText('Cada jogador rola dois dados, um por vez e sem custo.')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Maior dado/ }))
    expect(onOpeningModeChange).toHaveBeenCalledWith('dice-roll')

    fireEvent.click(screen.getByRole('button', { name: 'Abrir leilão' }))
    expect(onStart).toHaveBeenCalledOnce()
  })

  it('mostra o histórico somente no lobby de revanche', () => {
    const { rerender } = render(
      <RoomLobby
        room={roomWith(hostSeat)}
        myUid="host"
        myReentryCode={null}
        isHost
        link="http://localhost:5173/play?room=fc532036e9"
        onStart={vi.fn()}
      />,
    )
    expect(screen.queryByText('Histórico da sala')).toBeNull()

    rerender(
      <RoomLobby
        room={{ ...roomWith(hostSeat), matchGeneration: 1, matchHistory: [] }}
        myUid="host"
        myReentryCode={null}
        isHost
        link="http://localhost:5173/play?room=fc532036e9"
        onStart={vi.fn()}
      />,
    )
    expect(screen.getByText('Histórico da sala')).toBeTruthy()
  })
})
