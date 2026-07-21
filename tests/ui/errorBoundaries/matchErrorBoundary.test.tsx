// @vitest-environment jsdom
// Fronteira de jogo (spec 042, T016/T017, FR-009/010/011/024). Remontar é uma tentativa,
// não um laço — inclusive através de reload (o loopBreaker sobrevive via store injetado).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MatchErrorBoundary } from '@/app/MatchErrorBoundary'
import { createLoopBreaker, type KeyValueStore } from '@/app/loopBreaker'

function memoryStore(): KeyValueStore {
  const map = new Map<string, string>()
  return { get: (k) => map.get(k) ?? null, set: (k, v) => void map.set(k, v) }
}

// Lança sempre que `shouldThrow.current` é true — permite simular "remontou e não quebrou mais"
// ou "remontou e quebrou de novo com a mesma causa".
function makeBomb(shouldThrow: { current: boolean }) {
  return function Bomb() {
    if (shouldThrow.current) throw new Error('log sem descritor')
    return <p>tabuleiro vivo</p>
  }
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('MatchErrorBoundary (T016)', () => {
  it('primeira falha: mostra a tela com canRetry — clicar remonta e o jogo reaparece (FR-010)', () => {
    const shouldThrow = { current: true }
    const Bomb = makeBomb(shouldThrow)
    const store = memoryStore()

    render(
      <MatchErrorBoundary roomId="sala-1" loopBreaker={createLoopBreaker(store)}>
        <Bomb />
      </MatchErrorBoundary>,
    )

    expect(screen.getByText(/algo quebrou na tela/i)).toBeTruthy()
    const retry = screen.getByText(/voltar para a partida/i)

    shouldThrow.current = false // a causa passou — remontar deve funcionar desta vez
    fireEvent.click(retry)

    expect(screen.getByText('tabuleiro vivo')).toBeTruthy()
  })

  it('mesma assinatura se repete → segunda tela sem retry, com identificador (FR-011)', () => {
    const shouldThrow = { current: true }
    const Bomb = makeBomb(shouldThrow)
    const store = memoryStore()

    render(
      <MatchErrorBoundary roomId="sala-1" loopBreaker={createLoopBreaker(store)}>
        <Bomb />
      </MatchErrorBoundary>,
    )
    fireEvent.click(screen.getByText(/voltar para a partida/i)) // continua quebrando (shouldThrow ainda true)

    expect(screen.queryByText(/voltar para a partida/i)).toBeNull()
    expect(screen.getByText(/parou de tentar/i)).toBeTruthy()
    expect(screen.getByText(/ocorrência:/i)).toBeTruthy()
  })

  it('reload simulado (nova montagem) com a MESMA assinatura já no store: direto sem retry (FR-024)', () => {
    const store = memoryStore()
    store.set('bm:boundary:match', 'Error|log sem descritor')
    const shouldThrow = { current: true }
    const Bomb = makeBomb(shouldThrow)

    render(
      <MatchErrorBoundary roomId="sala-1" loopBreaker={createLoopBreaker(store)}>
        <Bomb />
      </MatchErrorBoundary>,
    )

    expect(screen.queryByText(/voltar para a partida/i)).toBeNull()
    expect(screen.getByText(/parou de tentar/i)).toBeTruthy()
  })

  it('um irmão fora da fronteira não desmonta quando ela captura (a sessão não sente nada)', () => {
    const shouldThrow = { current: true }
    const Bomb = makeBomb(shouldThrow)

    render(
      <>
        <p>session-badge-fake</p>
        <MatchErrorBoundary roomId="sala-1" loopBreaker={createLoopBreaker(memoryStore())}>
          <Bomb />
        </MatchErrorBoundary>
      </>,
    )

    expect(screen.getByText('session-badge-fake')).toBeTruthy()
    expect(screen.getByText(/algo quebrou na tela/i)).toBeTruthy()
  })
})
