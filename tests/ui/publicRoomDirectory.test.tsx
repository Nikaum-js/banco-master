// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PublicRoomDirectory } from '@/net/ui/PublicRoomDirectory'
import type { PublicDirectoryState } from '@/net/publicRoomDirectory'

const LISTINGS = [
  {
    listingId: '123e4567-e89b-42d3-a456-426614174000',
    label: 'Mesa 123E',
    availableSeats: 5,
    capacity: 8,
    openingMode: 'sealed-bid' as const,
    createdMinutesAgo: 2,
  },
  {
    listingId: '223e4567-e89b-42d3-a456-426614174001',
    label: 'Mesa 223E',
    availableSeats: 2,
    capacity: 8,
    openingMode: 'dice-roll' as const,
    createdMinutesAgo: 8,
  },
]

const ready: PublicDirectoryState = {
  phase: 'ready',
  listings: LISTINGS,
  retryAfterMs: null,
  message: null,
}

afterEach(cleanup)

describe('diretório público', () => {
  it('mostra somente os metadados aprovados e seleciona por listingId', () => {
    const onJoin = vi.fn()
    render(
      <PublicRoomDirectory state={ready} available onRefresh={vi.fn()} onJoin={onJoin} />,
    )

    expect(screen.getByText('Mesa 123E')).toBeTruthy()
    expect(screen.getByText('5 vagas')).toBeTruthy()
    expect(screen.getAllByText('Leilão secreto').length).toBeGreaterThan(0)
    expect(screen.queryByText(/roomId|snapshot|uid|reentry/i)).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Entrar na Mesa 123E' }))
    expect(onJoin).toHaveBeenCalledWith(LISTINGS[0].listingId)
  })

  it('filtra localmente por vagas e Ritual sem pedir atualização', () => {
    const onRefresh = vi.fn()
    render(
      <PublicRoomDirectory state={ready} available onRefresh={onRefresh} onJoin={vi.fn()} />,
    )

    fireEvent.change(screen.getByLabelText('Mínimo de vagas'), { target: { value: '3' } })
    expect(screen.getByText('Mesa 123E')).toBeTruthy()
    expect(screen.queryByText('Mesa 223E')).toBeNull()

    fireEvent.change(screen.getByLabelText('Ritual de Largada'), { target: { value: 'dice-roll' } })
    expect(screen.getByText('Nenhuma mesa atende a estes filtros.')).toBeTruthy()
    expect(onRefresh).not.toHaveBeenCalled()
  })

  it.each([
    ['loading', 'Buscando mesas públicas…'],
    ['empty', 'Nenhuma mesa pública com vagas agora.'],
    ['error', 'Não foi possível carregar as mesas públicas.'],
    ['rate-limited', 'O diretório está atualizando.'],
  ] as const)('anuncia o estado %s', (phase, message) => {
    render(
      <PublicRoomDirectory
        state={{
          phase,
          listings: [],
          retryAfterMs: phase === 'rate-limited' ? 5_000 : null,
          message: phase === 'rate-limited' ? message : null,
        }}
        available
        onRefresh={vi.fn()}
        onJoin={vi.fn()}
      />,
    )
    expect(screen.getByText(new RegExp(message, 'i'))).toBeTruthy()
  })

  it('mantém o convite privado útil quando o diretório está indisponível', () => {
    render(
      <PublicRoomDirectory
        state={{ phase: 'idle', listings: [], retryAfterMs: null, message: null }}
        available={false}
        onRefresh={vi.fn()}
        onJoin={vi.fn()}
      />,
    )
    expect(screen.getByText(/convites privados continuam funcionando/i)).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Atualizar mesas públicas' }) as HTMLButtonElement).disabled).toBe(true)
  })
})
