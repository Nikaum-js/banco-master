// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OnlineGate } from '@/net/ui/OnlineGate'

vi.mock('@/net/ui/HomeScreen', () => ({
  HomeScreen: ({
    onCreate,
    onJoinPublic,
  }: {
    onCreate: () => void
    onJoinPublic: (listingId: string) => void
  }) => (
    <>
      <button type="button" onClick={onCreate}>Criar sala</button>
      <button
        type="button"
        onClick={() => onJoinPublic('123e4567-e89b-42d3-a456-426614174000')}
      >
        Entrar em mesa pública
      </button>
    </>
  ),
}))

vi.mock('@/net/supabaseClient', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/net/supabaseClient')>()
  return {
    ...original,
    isSupabaseConfigured: () => false,
    describeSupabaseConfiguration: () => 'Configuração indisponível no teste.',
  }
})

describe('navegação da porta de entrada', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/')
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('abre a criação de sala sem recarregar o documento', () => {
    const pushState = vi.spyOn(window.history, 'pushState')

    render(
      <OnlineGate>
        <div>Partida</div>
      </OnlineGate>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Criar sala' }))

    expect(pushState).toHaveBeenCalledOnce()
    expect(window.location.search).toBe('?host=1')
    expect(screen.getByText('Multiplayer indisponível')).toBeTruthy()
  })

  it('navega por listingId sem transformar o valor em roomId', () => {
    render(
      <OnlineGate>
        <div>Partida</div>
      </OnlineGate>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Entrar em mesa pública' }))

    expect(window.location.search).toBe('?public=123e4567-e89b-42d3-a456-426614174000')
    expect(window.location.search).not.toContain('room=')
    expect(screen.getByText('Multiplayer indisponível')).toBeTruthy()
  })
})
