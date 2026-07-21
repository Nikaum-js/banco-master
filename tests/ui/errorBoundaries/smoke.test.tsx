// @vitest-environment jsdom
// Smoke do ambiente jsdom novo (spec 042, T024). Confirma que @testing-library/react monta
// e desmonta um componente de verdade — nenhum teste da suíte node existente muda de ambiente.
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

describe('ambiente jsdom (T024)', () => {
  it('monta um componente React pela primeira vez nesta suíte', () => {
    render(<p>alo</p>)
    expect(screen.getByText('alo').textContent).toBe('alo')
  })
})
