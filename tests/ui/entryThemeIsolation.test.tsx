// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
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
    expect(document.querySelector('[data-entry-backdrop="neon"]')).toBeNull()
    expect(screen.getByTestId('entry-content')).toBeTruthy()
  })

  it('Neon monta somente a metrópole arcade e a troca não remonta o conteúdo', () => {
    render(
      <EntryStage>
        <ContentMarker />
      </EntryStage>,
    )
    expect(mounts).toBe(1)

    act(() => useBoardTheme.getState().setTheme('neon'))

    expect(document.querySelector('[data-entry-backdrop="atlas"]')).toBeNull()
    expect(document.querySelector('[data-entry-cityscape="atlas"]')).toBeNull()
    expect(document.querySelector('[data-entry-car]')).toBeNull()
    expect(document.querySelector('[data-entry-backdrop="neon"]')).toBeTruthy()
    expect(screen.getByTestId('entry-content')).toBeTruthy()
    expect(mounts).toBe(1)
  })
})
