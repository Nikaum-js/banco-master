// @vitest-environment jsdom
// Camada acessória (spec 042, T021, FR-004). A queda de log/som não pode levar o tabuleiro.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { useEffect } from 'react'
import { AccessoryErrorBoundary } from '@/app/AccessoryErrorBoundary'

function RenderBomb(): never {
  throw new Error('LogKind não tratado pelo descritor')
}

// Espelha o caso real do som (spec 042, item 1 do "Por que esta spec existe"): o throw
// acontece dentro de um useEffect, não durante o render — o boundary precisa capturar os dois.
function EffectBomb() {
  useEffect(() => {
    throw new Error('LogKind não tratado pelo seletor de som')
  }, [])
  return null
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('AccessoryErrorBoundary (T021)', () => {
  it('some só ele — mostra a linha de indisponibilidade no lugar do filho', () => {
    render(
      <AccessoryErrorBoundary label="Histórico">
        <RenderBomb />
      </AccessoryErrorBoundary>,
    )
    expect(screen.getByText(/histórico indisponível/i)).toBeTruthy()
  })

  it('captura falha dentro de useEffect (o caso real do som, FR-004)', () => {
    render(
      <AccessoryErrorBoundary label="Som">
        <EffectBomb />
      </AccessoryErrorBoundary>,
    )
    expect(screen.getByText(/som indisponível/i)).toBeTruthy()
  })

  it('um irmão fora da fronteira (o tabuleiro) continua de pé', () => {
    render(
      <>
        <p>tabuleiro-fake</p>
        <AccessoryErrorBoundary label="Histórico">
          <RenderBomb />
        </AccessoryErrorBoundary>
      </>,
    )
    expect(screen.getByText('tabuleiro-fake')).toBeTruthy()
    expect(screen.getByText(/histórico indisponível/i)).toBeTruthy()
  })

  it('sem falha, renderiza o filho normalmente', () => {
    render(
      <AccessoryErrorBoundary label="Histórico">
        <p>linha do log</p>
      </AccessoryErrorBoundary>,
    )
    expect(screen.getByText('linha do log')).toBeTruthy()
  })
})
