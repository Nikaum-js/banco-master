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

  it('abre a criação de sala sem recarregar o documento', async () => {
    const pushState = vi.spyOn(window.history, 'pushState')

    render(
      <OnlineGate>
        <div>Partida</div>
      </OnlineGate>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Criar sala' }))

    expect(pushState).toHaveBeenCalledOnce()
    expect(window.location.search).toBe('?host=1')
    expect(screen.getByRole('status').textContent).toBe('Preparando a mesa…')
    // Teto de 15s, não o default de 1s da RTL: o que se espera aqui é o `import()` do
    // `OnlineSessionGate`, e com ele o grafo inteiro que a 2d5e69e tirou do caminho crítico
    // — Supabase, lobby, HUD, OrientationGate. Local isso resolve na hora porque o
    // transform já está em cache; em runner frio passou de 1s e o teste reprovou com a
    // fallback do Suspense ainda na tela (run 30668329508). É guarda contra trava, não
    // medida de desempenho: o que se afirma é que a tela CHEGA, não em quanto tempo.
    expect(await screen.findByText('Multiplayer indisponível', {}, { timeout: 15_000 })).toBeTruthy()
  })
})
