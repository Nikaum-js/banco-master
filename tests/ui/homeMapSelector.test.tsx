// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HomeScreen } from '@/net/ui/HomeScreen'
import { useBoardTheme } from '@/game/ui/theme/boardTheme'

vi.mock('motion/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('motion/react')>()
  return { ...actual, useReducedMotion: () => true }
})

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
  it('mostra a prévia Neon sem permitir sala e preserva o formulário ao voltar', async () => {
    const onCreate = vi.fn()
    render(
      <HomeScreen
        onCreate={onCreate}
        onJoin={vi.fn()}
        onLocal={vi.fn()}
      />,
    )

    const input = screen.getByLabelText('Seu nome') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Nikaum' } })

    expect(screen.queryByText('Novos mapas em breve')).toBeNull()
    expect(screen.getByText('Multiplayer')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', {
      name: 'Pré-visualizar o mapa Metrópole Neon',
    }))

    expect(useBoardTheme.getState().theme).toBe('neon')
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

    expect(useBoardTheme.getState().theme).toBe('atlas')
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Criar sala$/ })).toBeTruthy()
    })
    expect((screen.getByLabelText('Seu nome') as HTMLInputElement).value).toBe('Nikaum')
  })
})
