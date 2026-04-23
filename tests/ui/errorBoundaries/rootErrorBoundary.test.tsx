// @vitest-environment jsdom
// Fronteira de último recurso (spec 042, T013, FR-001/005/006/014). Cobre casca e boot.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { RootErrorBoundary } from '@/app/RootErrorBoundary'
import { setActiveSession } from '@/net/activeSession'
import type { RoomSession } from '@/net/roomSession'

function Bomb(): never {
  throw new Error('kaboom')
}

const originalSearch = window.location.search
function setSearch(search: string): void {
  window.history.replaceState(null, '', `/${search}`)
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  setActiveSession(null)
  setSearch(originalSearch)
})

describe('RootErrorBoundary (T013)', () => {
  it('nunca deixa a árvore vazia — mostra a tela de falha (FR-001)', () => {
    render(
      <RootErrorBoundary>
        <Bomb />
      </RootErrorBoundary>,
    )
    expect(document.body.textContent).not.toBe('')
    expect(screen.getByText(/sessão foi interrompida/i)).toBeTruthy()
  })

  it('encerra a presença ANTES do fallback ficar visível, quando há sessão ativa (FR-006)', () => {
    const leaveOnFatalError = vi.fn()
    setActiveSession({ leaveOnFatalError } as unknown as RoomSession)

    render(
      <RootErrorBoundary>
        <Bomb />
      </RootErrorBoundary>,
    )

    expect(leaveOnFatalError).toHaveBeenCalledTimes(1)
  })

  it('sem sessão ativa (boot), não lança e mostra o caminho de voltar ao início', () => {
    setSearch('')
    expect(() =>
      render(
        <RootErrorBoundary>
          <Bomb />
        </RootErrorBoundary>,
      ),
    ).not.toThrow()
    expect(screen.getByText(/voltar ao início/i)).toBeTruthy()
    expect(screen.queryByText(/partida local não pode ser recuperada/i)).toBeNull()
  })

  it('criação de sala (?host=1) nunca cai no fallback de partida local', () => {
    setSearch('?host=1')
    render(
      <RootErrorBoundary>
        <Bomb />
      </RootErrorBoundary>,
    )
    expect(screen.getByText(/voltar ao início/i)).toBeTruthy()
    expect(screen.queryByText(/partida local não pode ser recuperada/i)).toBeNull()
  })

  it('modo local (?local=1) mostra a variante sem oferta de recuperação (FR-014)', () => {
    setSearch('?local=1')
    render(
      <RootErrorBoundary>
        <Bomb />
      </RootErrorBoundary>,
    )
    expect(screen.getByText(/não pode ser recuperada/i)).toBeTruthy()
  })

  it('modo sala (?room=x) oferece reabrir a sala', () => {
    setSearch('?room=sala-x')
    render(
      <RootErrorBoundary>
        <Bomb />
      </RootErrorBoundary>,
    )
    expect(screen.getByText(/reabrir a sala/i)).toBeTruthy()
  })
})
