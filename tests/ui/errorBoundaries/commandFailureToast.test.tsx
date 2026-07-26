// @vitest-environment jsdom
// Aviso de recusa por falha (spec 042, T033, FR-020/022). Alimentado só por `roomStore`.
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { CommandFailureToast } from '@/net/ui/CommandFailureToast'
import { useRoomStore } from '@/net/roomStore'

afterEach(() => {
  cleanup()
  useRoomStore.getState().reset()
})

describe('CommandFailureToast (T033)', () => {
  it('commandFailure populado → toast aparece com o occurrenceId', () => {
    useRoomStore.setState({ commandFailure: { occurrenceId: 'ABC123' } })
    render(<CommandFailureToast />)
    expect(screen.getByText(/não foi aplicada/i)).toBeTruthy()
    expect(screen.getByText(/ABC123/)).toBeTruthy()
  })

  it('null → nada aparece', () => {
    useRoomStore.setState({ commandFailure: null })
    const { container } = render(<CommandFailureToast />)
    expect(container.textContent).toBe('')
  })
})
