// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HomeScreen } from '@/net/ui/HomeScreen'

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
})
