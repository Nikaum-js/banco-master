// Consulta de mídia como estado de React, via `useSyncExternalStore`.
//
// Existe porque duas camadas precisam DECIDIR ESTRUTURA por viewport, não só pintura:
// o `OrientationGate` (retrato estreito pede o aviso de girar) e a `LandAuctionLayer`
// (paisagem baixa troca a grade de lotes por seleção + painel, D-078). Layout que só
// esconde com CSS deixa o conteúdo escondido na árvore — dois pontos de tabulação para o
// mesmo lote, duas leituras para o leitor de tela. Quando a diferença é de ESTRUTURA, quem
// decide tem de ser o React.
//
// Sem `window.matchMedia` (SSR, ambiente de teste sem polyfill) o produto não trava: a
// suposição segura é "não casa" — mesmo espírito defensivo que o `motion-dom` usa pro freio
// de `prefers-reduced-motion`.
import { useCallback, useSyncExternalStore } from 'react'

function hasMatchMedia(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
}

/** `true` enquanto a consulta casar. Reavalia sozinho ao girar/redimensionar. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback((onChange: () => void) => {
    if (!hasMatchMedia()) return () => {}
    const mql = window.matchMedia(query)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])

  const getSnapshot = useCallback(() => {
    if (!hasMatchMedia()) return false
    return window.matchMedia(query).matches
  }, [query])

  // App 100% client (sem SSR) — o snapshot do servidor nunca é usado de verdade, mas
  // `useSyncExternalStore` exige o terceiro argumento.
  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}
