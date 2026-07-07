// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HomeScreen } from '@/net/ui/HomeScreen'
import { useBoardTheme } from '@/game/ui/theme/boardTheme'

beforeEach(() => {
  localStorage.clear()
  window.history.replaceState(null, '', '/')
  act(() => useBoardTheme.getState().setTheme('atlas'))
})

afterEach(() => {
  cleanup()
  act(() => useBoardTheme.getState().setTheme('atlas'))
})

describe('seletor visual do mapa na home', () => {
  it('troca Atlas por Neon sem perder o formulário', async () => {
    render(
      <HomeScreen
        onCreate={vi.fn()}
        onJoin={vi.fn()}
        onLocal={vi.fn()}
      />,
    )

    const input = screen.getByLabelText('Seu nome') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Nikaum' } })

    expect(screen.getByText('Novos mapas em breve')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', {
      name: 'Mudar visual do mapa para Fliperama Neon',
    }))

    expect(useBoardTheme.getState().theme).toBe('neon')
    await waitFor(() => {
      expect(document.querySelector('[data-entry-backdrop="neon"]')).toBeTruthy()
    })

    const visibleName = screen.getAllByLabelText('Seu nome')
      .find((field) => (field as HTMLInputElement).value === 'Nikaum')
    expect(visibleName).toBeTruthy()
    expect(screen.getAllByText('Cidades do Mundo').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Novos mapas em breve').length).toBeGreaterThan(0)
  })
})
