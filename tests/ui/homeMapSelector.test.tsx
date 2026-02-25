// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
  useBoardTheme.getState().setTheme('atlas')
})

afterEach(() => {
  cleanup()
  useBoardTheme.getState().setTheme('atlas')
})

describe('seletor visual do mapa na home', () => {
  it('seleciona a Cidade da Fuligem como mapa jogável e preserva o formulário ao voltar', async () => {
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
      name: 'Selecionar o mapa Cidade da Fuligem',
    }))

    await waitFor(() => {
      expect(document.querySelector('[data-entry-backdrop="fuligem"]')).toBeTruthy()
    })

    // O segundo mapa é JOGÁVEL (055/D-069): o formulário de criar sala continua
    // disponível e a seleção vive no store do mapa (que a OnlineGate grava na sala).
    expect(screen.getAllByText('Cidade da Fuligem').length).toBeGreaterThan(0)
    expect(useBoardTheme.getState().theme).toBe('fuligem')
    const fuligemFacts = screen.getByLabelText('Características do mapa Cidade da Fuligem')
    expect(within(fuligemFacts).getByText('Bilhete de Trem')).toBeTruthy()
    expect(within(fuligemFacts).getByText('bairros')).toBeTruthy()
    const createButtons = screen.getAllByRole('button', { name: /^Criar sala$/ })
    expect(createButtons.length).toBeGreaterThan(0)
    fireEvent.click(createButtons[createButtons.length - 1])
    expect(onCreate).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', {
      name: 'Selecionar o mapa Cidades do Mundo',
    }))

    await waitFor(() => {
      expect(useBoardTheme.getState().theme).toBe('atlas')
    })
    // As duas homes ficam montadas (<Activity>); o valor preservado é o do palco do Atlas.
    const atlasInput = screen
      .getAllByLabelText('Seu nome')
      .find((el) => el.closest('[data-home-theme="atlas"]')) as HTMLInputElement
    expect(atlasInput.value).toBe('Nikaum')
    // O palco do segundo mapa permanece montado, só escondido.
    expect(document.querySelector('[data-entry-backdrop="fuligem"]')).toBeTruthy()
  })
})
