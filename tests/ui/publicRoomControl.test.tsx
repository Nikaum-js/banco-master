// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PublicRoomControl } from '@/net/ui/PublicRoomControl'
import type { PublicRoomGateway } from '@/net/publicRoomDirectory'
import { PublicRoomError } from '@/net/publicRoomDirectory'
import type { Telemetry } from '@/telemetry/port'

const PRIVATE = { published: false, visible: false, listingId: null, hiddenReason: null }
const PUBLIC = {
  published: true,
  visible: true,
  listingId: '123e4567-e89b-42d3-a456-426614174000',
  hiddenReason: null,
}

function gateway(overrides: Partial<PublicRoomGateway> = {}): PublicRoomGateway {
  return {
    list: vi.fn().mockResolvedValue([]),
    publication: vi.fn().mockResolvedValue(PRIVATE),
    publish: vi.fn().mockResolvedValue(PUBLIC),
    unpublish: vi.fn().mockResolvedValue(PRIVATE),
    heartbeat: vi.fn().mockResolvedValue(PUBLIC),
    join: vi.fn().mockResolvedValue('ROOM01'),
    ...overrides,
  }
}

function telemetry(): Telemetry {
  return { track: vi.fn() }
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('controle de publicação do host', () => {
  it('nasce privado, publica e emite somente telemetria agregada', async () => {
    const api = gateway()
    const events = telemetry()
    render(<PublicRoomControl roomId="ROOM01" gateway={api} telemetry={events} />)

    await screen.findByText(/privada — só entra quem receber/i)
    fireEvent.click(screen.getByRole('button', { name: 'Publicar lobby' }))

    await screen.findByText(/publicada — aparece no diretório/i)
    expect(api.publish).toHaveBeenCalledWith('ROOM01')
    expect(events.track).toHaveBeenCalledWith({ kind: 'public_room_published' })
  })

  it('despublica sem tocar nenhuma operação de sala', async () => {
    const api = gateway({ publication: vi.fn().mockResolvedValue(PUBLIC) })
    render(<PublicRoomControl roomId="ROOM01" gateway={api} telemetry={telemetry()} />)

    await screen.findByText(/publicada — aparece no diretório/i)
    fireEvent.click(screen.getByRole('button', { name: 'Tornar privada' }))
    await screen.findByText(/privada — só entra quem receber/i)
    expect(api.unpublish).toHaveBeenCalledWith('ROOM01')
  })

  it('explica limite sem inutilizar a sala privada', async () => {
    const api = gateway({
      publish: vi.fn().mockRejectedValue(new PublicRoomError('rate-limited', 60_000)),
    })
    render(<PublicRoomControl roomId="ROOM01" gateway={api} telemetry={telemetry()} />)

    await screen.findByText(/privada — só entra quem receber/i)
    fireEvent.click(screen.getByRole('button', { name: 'Publicar lobby' }))
    await screen.findByRole('alert')
    expect(screen.getByText(/limite de 3 salas públicas/i)).toBeTruthy()
    expect(screen.getByText(/privada — só entra quem receber/i)).toBeTruthy()
  })

  it('mantém heartbeat apenas enquanto a publicação está vigente', async () => {
    vi.useFakeTimers()
    const heartbeat = vi.fn().mockResolvedValue(PUBLIC)
    const api = gateway({
      publication: vi.fn().mockResolvedValue(PUBLIC),
      heartbeat,
    })
    const view = render(
      <PublicRoomControl roomId="ROOM01" gateway={api} telemetry={telemetry()} />,
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(screen.getByText(/publicada — aparece/i)).toBeTruthy()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(heartbeat).toHaveBeenCalledTimes(1)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })
    expect(heartbeat).toHaveBeenCalledTimes(2)

    view.unmount()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })
    expect(heartbeat).toHaveBeenCalledTimes(2)
  })
})
