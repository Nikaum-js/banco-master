// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OnlineGate } from '@/net/ui/OnlineGate'

vi.mock('@/net/ui/HomeScreen', () => ({
  HomeScreen: ({ onCreate }: { onCreate: () => void }) => (
    <button type="button" onClick={onCreate}>Criar sala</button>
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
})
