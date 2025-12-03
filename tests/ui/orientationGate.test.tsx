// @vitest-environment jsdom
// Portão de orientação (044, T035 — US4/D6 do plan). A garantia central que este teste
// prova: girar o aparelho NUNCA desmonta a árvore de jogo por baixo — só o aviso aparece
// e desaparece por cima. Desmontar dispararia o `dispose()` da sessão online (a mesma
// armadilha que a 042 documentou pra D1 do plan dela): a mesa registraria uma saída só
// porque alguém girou o celular.
//
// jsdom não implementa `window.matchMedia` (confirmado: `window.matchMedia is not a
// function` num jsdom novo, sem polyfill) — por isso o mock abaixo é o mesmo tipo de
// fronteira que o `motion-dom` já trata como ausente (`if (window.matchMedia) … else
// false`). O mock respeita a query pedida (não confunde a query de orientação com a de
// `prefers-reduced-motion` que o `Overlay`/`useMotion` também consulta por baixo).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { useEffect, useRef } from 'react'
import { OrientationGate } from '@/game/ui/OrientationGate'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

type Listener = (e: MediaQueryListEvent) => void

// Uma "MediaQueryList" fake por query — só a de `(orientation: portrait)` é controlada
// pelo teste; qualquer outra (ex.: `prefers-reduced-motion`, que o `useMotion()` do
// `Overlay` também lê) recebe uma fake neutra (`matches: false`, sem listener ativo).
function installMatchMedia(initialPortrait: boolean) {
  let portrait = initialPortrait
  const portraitListeners = new Set<Listener>()

  const mediaQueryLists = new Map<string, MediaQueryList>()
  function mqlFor(query: string): MediaQueryList {
    const cached = mediaQueryLists.get(query)
    if (cached) return cached
    const isPortraitQuery = query === '(orientation: portrait)'
    const mql = {
      get matches() {
        return isPortraitQuery ? portrait : false
      },
      media: query,
      onchange: null,
      addEventListener: (_type: 'change', cb: Listener) => {
        if (isPortraitQuery) portraitListeners.add(cb)
      },
      removeEventListener: (_type: 'change', cb: Listener) => {
        if (isPortraitQuery) portraitListeners.delete(cb)
      },
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => true,
    } as unknown as MediaQueryList
    mediaQueryLists.set(query, mql)
    return mql
  }

  vi.stubGlobal('matchMedia', vi.fn((query: string) => mqlFor(query)))

  return {
    setPortrait(next: boolean) {
      portrait = next
      act(() => {
        portraitListeners.forEach((cb) => cb({ matches: next } as MediaQueryListEvent))
      })
    },
  }
}

// Conta quantas vezes a árvore "de sessão" MONTA de verdade — se o gate desmontasse
// `children` ao alternar o aviso, este efeito dispararia de novo.
let sessionMounts = 0
function SessionMarker() {
  const counted = useRef(false)
  useEffect(() => {
    if (!counted.current) {
      counted.current = true
      sessionMounts += 1
    }
  }, [])
  return <div data-testid="session">sessão viva</div>
}

describe('OrientationGate (T035)', () => {
  beforeEach(() => {
    sessionMounts = 0
  })

  it('retrato abaixo do limiar: o aviso aparece e a árvore de jogo continua montada', () => {
    installMatchMedia(true)
    render(
      <OrientationGate>
        <SessionMarker />
      </OrientationGate>,
    )
    expect(screen.getByRole('dialog', { name: 'Gire o aparelho' })).toBeTruthy()
    expect(screen.getByTestId('session')).toBeTruthy()
    expect(sessionMounts).toBe(1)
  })

  it('voltar a paisagem: o aviso some e nada por baixo remonta (nenhum efeito de sessão dispara de novo)', () => {
    const media = installMatchMedia(true)
    render(
      <OrientationGate>
        <SessionMarker />
      </OrientationGate>,
    )
    expect(sessionMounts).toBe(1)

    media.setPortrait(false)

    expect(screen.queryByRole('dialog', { name: 'Gire o aparelho' })).toBeNull()
    expect(screen.getByTestId('session')).toBeTruthy()
    expect(sessionMounts).toBe(1) // nenhum novo mount — a árvore de baixo nunca desmontou

    // Girar de novo pra retrato: o aviso reaparece, a sessão continua sendo a MESMA.
    media.setPortrait(true)
    expect(screen.getByRole('dialog', { name: 'Gire o aparelho' })).toBeTruthy()
    expect(sessionMounts).toBe(1)
  })

  it('paisagem desde o início: nenhum aviso aparece', () => {
    installMatchMedia(false)
    render(
      <OrientationGate>
        <SessionMarker />
      </OrientationGate>,
    )
    expect(screen.queryByRole('dialog', { name: 'Gire o aparelho' })).toBeNull()
    expect(screen.getByTestId('session')).toBeTruthy()
  })
})
