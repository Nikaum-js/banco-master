// @vitest-environment jsdom
// Foco de modal (044, T022 — US3/D4 do plan/D-039). `Overlay`/`ModalShell` (shell.tsx) são
// o ÚNICO lugar que implementa trap/restauração/Esc — este teste exercita o primitivo
// diretamente (não um consumidor específico), porque as seis camadas que o usam herdam
// o comportamento de graça (é exatamente o ponto do D4).
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { Overlay, ModalShell, ModalHeader } from '@/game/ui/shell'

afterEach(() => cleanup())

// Harness mínimo: um botão que abre o modal (e vira "quem abriu" pra restauração de
// foco) + um Overlay com dois controles focáveis dentro. `onDismiss` é espionável e
// independente do botão "Fechar" interno — assim os testes de Esc não se confundem
// com o teste de restauração de foco.
function Harness({ dismissible, onDismiss }: { dismissible?: boolean; onDismiss?: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Abrir
      </button>
      {open && (
        <Overlay dismissible={dismissible} onClick={onDismiss}>
          <ModalShell>
            <ModalHeader title="Modal de teste" />
            <button type="button">Primeiro</button>
            <button type="button">Segundo</button>
            <button type="button" onClick={() => setOpen(false)}>
              Fechar
            </button>
          </ModalShell>
        </Overlay>
      )}
    </div>
  )
}

describe('trap de foco do modal (T022)', () => {
  it('abrir o modal leva o foco pro primeiro controle focável dentro dele', () => {
    render(<Harness />)
    fireEvent.click(screen.getByText('Abrir'))
    expect(document.activeElement).toBe(screen.getByText('Primeiro'))
  })

  it('o container do modal tem role="dialog", aria-modal e nome ligado ao ModalHeader', () => {
    render(<Harness />)
    fireEvent.click(screen.getByText('Abrir'))
    const dialog = screen.getByRole('dialog', { name: 'Modal de teste' })
    expect(dialog.getAttribute('aria-modal')).toBe('true')
  })

  it('Tab e Shift+Tab circulam só entre os controles do modal (trap)', () => {
    render(<Harness />)
    fireEvent.click(screen.getByText('Abrir'))

    const primeiro = screen.getByText('Primeiro')
    const segundo = screen.getByText('Segundo')
    const fechar = screen.getByText('Fechar')
    expect(document.activeElement).toBe(primeiro)

    fireEvent.keyDown(document.activeElement!, { key: 'Tab' })
    expect(document.activeElement).toBe(segundo)

    fireEvent.keyDown(document.activeElement!, { key: 'Tab' })
    expect(document.activeElement).toBe(fechar)

    // Do último controle, Tab de novo VOLTA pro primeiro — nunca escapa pro resto da página.
    fireEvent.keyDown(document.activeElement!, { key: 'Tab' })
    expect(document.activeElement).toBe(primeiro)

    // Shift+Tab do primeiro vai pro ÚLTIMO — mesma volta, sentido contrário.
    fireEvent.keyDown(document.activeElement!, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(fechar)
  })

  it('fechar o modal devolve o foco a quem abriu', () => {
    render(<Harness />)
    const abrir = screen.getByText('Abrir')
    // jsdom não foca automaticamente no clique (diferente de um browser real) — focamos
    // explicitamente pra simular quem abriu o modal por teclado ou mouse.
    abrir.focus()
    fireEvent.click(abrir)
    expect(document.activeElement).toBe(screen.getByText('Primeiro'))

    fireEvent.click(screen.getByText('Fechar'))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(abrir)
  })

  it('sem `dismissible`, Esc NÃO fecha o modal (comando de jogo não pode disparar por engano)', () => {
    const onDismiss = vi.fn()
    render(<Harness onDismiss={onDismiss} />)
    fireEvent.click(screen.getByText('Abrir'))

    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })

    expect(onDismiss).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('com `dismissible`, Esc fecha o modal', () => {
    const onDismiss = vi.fn()
    render(<Harness dismissible onDismiss={onDismiss} />)
    fireEvent.click(screen.getByText('Abrir'))

    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })

    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('sem `dismissible`, clique no backdrop também não fecha (mesmo booleano governa os dois — D4)', () => {
    const onDismiss = vi.fn()
    render(<Harness onDismiss={onDismiss} />)
    fireEvent.click(screen.getByText('Abrir'))

    fireEvent.click(screen.getByRole('dialog'))

    expect(onDismiss).not.toHaveBeenCalled()
  })
})
