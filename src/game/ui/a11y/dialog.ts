// Comportamento de diálogo acessível — foco inicial, trap de Tab, restauração e Esc
// condicionado a `dismissible` (044/T023, US3/D4 do plan, D-039).
//
// Em arquivo PRÓPRIO (não dentro de `shell.tsx`) por exigência do lint de fast-refresh: um
// módulo que mistura componente React com contexto/hook solto quebra o HMR do Vite
// (`react-refresh/only-export-components`). `shell.tsx` (Overlay/ModalHeader), o
// `DecisionShell` de `GameHUD.tsx` (reação/empréstimo) e o backdrop custom da loteria em
// `NoticeLayer.tsx` são os três consumidores — nenhum duplica trap/Esc/restauração (D4).
import { createContext, useContext, useEffect, type RefObject } from 'react'

// Título do diálogo ATIVO — quem abre o diálogo (Overlay, DecisionShell) provê um id via
// `useId()`; quem renderiza o título (ModalHeader, ReactionHead) o consome e vira o
// `aria-labelledby` do container. Uma fonte de id por diálogo.
export const ModalTitleContext = createContext<string | null>(null)

export function useModalTitleId(): string | null {
  return useContext(ModalTitleContext)
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

// Sem `offsetParent` (layout real) de propósito: em jsdom (testes) ele é sempre `null`, e
// filtrar por ele quebraria o trap em teste sem quebrar nada em produção — o app não usa
// `display:none` pra esconder controle dentro de diálogo aberto (o padrão daqui é
// desmontar via render condicional), então `hidden`/`aria-hidden` já bastam.
function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => !el.hidden && el.getAttribute('aria-hidden') !== 'true',
  )
}

// Hook único de comportamento de diálogo — Overlay o usa, e dois consumidores que NÃO
// passam por Overlay (a "loteria" do NoticeLayer, backdrop custom, e o DecisionShell(dim)
// do GameHUD, que também bloqueia a tela) o chamam direto, pra não duplicar trap/
// restauração/Esc em três lugares.
export function useDialogA11y(
  containerRef: RefObject<HTMLElement | null>,
  { dismissible = false, onDismiss, active = true }: { dismissible?: boolean; onDismiss?: () => void; active?: boolean },
): void {
  // Foco inicial (primeiro controle focável, ou o próprio container) + restauração pra
  // quem tinha o foco antes de abrir — capturado e devolvido no mesmo efeito.
  useEffect(() => {
    if (!active) return
    const node = containerRef.current
    const opener = document.activeElement as HTMLElement | null
    if (node) {
      const [first] = getFocusable(node)
      ;(first ?? node).focus()
    }
    return () => {
      opener?.focus?.()
    }
  }, [active, containerRef])

  // Trap de Tab (circula DENTRO do container, nunca escapa) + Esc, condicionado a
  // `dismissible` — o mesmo booleano governa Esc e clique no backdrop (D4): default
  // fechado é o lado seguro, então "decisão de jogo" nunca fecha por acidente.
  useEffect(() => {
    if (!active) return
    const node = containerRef.current
    if (!node) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (dismissible) {
          e.stopPropagation()
          onDismiss?.()
        }
        return
      }
      if (e.key !== 'Tab') return
      const focusable = getFocusable(node!)
      e.preventDefault()
      if (focusable.length === 0) {
        node!.focus()
        return
      }
      const delta = e.shiftKey ? -1 : 1
      const current = focusable.indexOf(document.activeElement as HTMLElement)
      const next = current === -1 ? (delta === 1 ? 0 : focusable.length - 1) : (current + delta + focusable.length) % focusable.length
      focusable[next]?.focus()
    }
    node.addEventListener('keydown', onKeyDown)
    return () => node.removeEventListener('keydown', onKeyDown)
  }, [active, dismissible, onDismiss, containerRef])
}
