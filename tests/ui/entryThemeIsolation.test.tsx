// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useEffect } from 'react'
import { EntryStage } from '@/net/ui/entryShell'
import { useBoardTheme } from '@/game/ui/theme/boardTheme'

let mounts = 0

function ContentMarker() {
  useEffect(() => {
    mounts += 1
  }, [])
  return <span data-testid="entry-content">conteúdo preservado</span>
}

beforeEach(() => {
  localStorage.clear()
  mounts = 0
  act(() => useBoardTheme.getState().setTheme('atlas'))
})

afterEach(() => {
  cleanup()
  act(() => useBoardTheme.getState().setTheme('atlas'))
})

describe('isolamento visual das telas de entrada', () => {
  it('Atlas monta somente a carta de aviação', () => {
    render(
      <EntryStage>
        <ContentMarker />
      </EntryStage>,
    )

    expect(document.querySelector('[data-entry-backdrop="atlas"]')).toBeTruthy()
    expect(document.querySelector('[data-entry-cityscape="atlas"]')).toBeTruthy()
    const cars = document.querySelectorAll('[data-entry-car]')
    expect(cars).toHaveLength(4)
    expect((cars[0] as SVGGElement).style.offsetPath).toContain('path(')
    expect(document.querySelector('[data-entry-backdrop="fuligem"]')).toBeNull()
    expect(screen.getByTestId('entry-content')).toBeTruthy()
  })

  it('Fuligem monta somente o pátio de fábricas e a troca não remonta o conteúdo', async () => {
    render(
      <EntryStage>
        <ContentMarker />
      </EntryStage>,
    )
    expect(mounts).toBe(1)

    act(() => useBoardTheme.getState().setTheme('fuligem'))

    expect(document.querySelector('[data-entry-backdrop="atlas"]')).toBeNull()
    expect(document.querySelector('[data-entry-cityscape="atlas"]')).toBeNull()
    expect(document.querySelector('[data-entry-car]')).toBeNull()
    await waitFor(() => {
      expect(document.querySelector('[data-entry-backdrop="fuligem"]')).toBeTruthy()
    })
    expect(screen.getByTestId('entry-content')).toBeTruthy()
    // A verificação de DESEMPENHO da troca de mapa: trocar a pele nunca pode
    // remontar a subárvore de conteúdo (contrato herdado do tema anterior).
    expect(mounts).toBe(1)
  })
})
