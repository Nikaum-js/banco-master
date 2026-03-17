// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HomeScreen } from '@/net/ui/HomeScreen'
import type { PublicRoomGateway } from '@/net/publicRoomDirectory'

vi.mock('motion/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('motion/react')>()
  return { ...actual, useReducedMotion: () => true }
})

beforeEach(() => {
  localStorage.clear()
  window.history.replaceState(null, '', '/')
})

afterEach(() => {
  cleanup()
})

describe('seletor visual do mapa na home', () => {
  it('mostra a prévia Neon sem permitir sala e preserva o formulário ao voltar', async () => {
    const onCreate = vi.fn()
    render(
      <HomeScreen
        onCreate={onCreate}
        onJoin={vi.fn()}
        onLocal={vi.fn()}
      />,
    )

    const homePanel = document.querySelector('.home-map-panel')
    expect(homePanel?.classList.contains('atlas-surface')).toBe(true)
    expect(homePanel?.classList.contains('atlas-surface--entry')).toBe(true)

    const input = screen.getByLabelText('Seu nome') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Nikaum' } })

    expect(screen.queryByText('Novos mapas em breve')).toBeNull()
    const mapFacts = screen.getByLabelText('Características do mapa Cidades do Mundo')
    expect(within(mapFacts).getByText('48')).toBeTruthy()
    expect(within(mapFacts).getByText('10')).toBeTruthy()
    expect(within(mapFacts).getByText('1')).toBeTruthy()
    expect(within(mapFacts).getByText('Bus Ticket')).toBeTruthy()
    expect(screen.queryByText('Multiplayer em tempo real')).toBeNull()
    expect(screen.queryByText('Convite por link')).toBeNull()
    expect(screen.queryByText('Partida salva automaticamente')).toBeNull()
    fireEvent.click(screen.getByRole('button', {
      name: 'Pré-visualizar o mapa Metrópole Neon',
    }))

    await waitFor(() => {
      expect(document.querySelector('[data-entry-backdrop="neon"]')).toBeTruthy()
    })

    expect(screen.getAllByText('Metrópole Neon').length).toBeGreaterThan(0)
    expect(screen.getByText('Criação de salas bloqueada')).toBeTruthy()
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /^Criar sala$/ })).toBeNull()
    })
    expect(onCreate).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', {
      name: 'Selecionar Cidades do Mundo',
    }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Criar sala$/ })).toBeTruthy()
    })
    expect((screen.getByLabelText('Seu nome') as HTMLInputElement).value).toBe('Nikaum')
    expect(document.querySelector('[data-entry-backdrop="neon"]')).toBeTruthy()
  })

  it('abre uma única consulta pública e preserva o nome ao selecionar a mesa', async () => {
    const list = vi.fn().mockResolvedValue([{
      listingId: '123e4567-e89b-42d3-a456-426614174000',
      label: 'Mesa 123E',
      availableSeats: 4,
      capacity: 8,
      openingMode: 'dice-roll',
      createdMinutesAgo: 1,
    }])
    const publicRooms: PublicRoomGateway = {
      list,
      publication: vi.fn(),
      publish: vi.fn(),
      unpublish: vi.fn(),
      heartbeat: vi.fn(),
      join: vi.fn(),
    }
    const onJoinPublic = vi.fn()
    render(
      <HomeScreen
        onCreate={vi.fn()}
        onJoin={vi.fn()}
        onJoinPublic={onJoinPublic}
        onLocal={vi.fn()}
        publicRooms={publicRooms}
      />,
    )

    fireEvent.change(screen.getByLabelText('Seu nome'), { target: { value: 'Nikaum' } })
    fireEvent.click(screen.getByRole('button', { name: 'Encontrar sala pública' }))
    await screen.findByText('Mesa 123E')

    expect(list).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Entrar na Mesa 123E' }))
    expect(onJoinPublic).toHaveBeenCalledWith('123e4567-e89b-42d3-a456-426614174000')
    expect(localStorage.getItem('bm.player-name')).toBe('Nikaum')
  })
})
