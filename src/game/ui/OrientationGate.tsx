// Tela de "gire o aparelho" (044/T033 — US4/D6 do plan, D-039). O tabuleiro só é servido
// em paisagem (SRS §12.6): em retrato, este componente cobre a árvore com um aviso, SEM
// desmontar `children`.
//
// A razão de nunca desmontar é dura (D6): `children` é a árvore inteira, incluindo o
// `OnlineGate` — desmontá-lo dispararia o `dispose()` da sessão online e a mesa registraria
// uma saída só porque alguém girou o celular, pausando a partida de todo mundo. Por isso
// `children` fica na MESMA posição do JSX em toda renderização; só o aviso por cima é
// condicional. Nenhum estado React entra no caminho crítico — `usePortrait()` só decide se
// o aviso aparece, nunca se a árvore de baixo existe.
//
// Acessibilidade: o aviso É uma tela do caminho de jogo (D-039), então reusa o MESMO
// primitivo `Overlay`/`ModalShell` (shell.tsx) que todo modal do jogo usa — foco ao
// aparecer, restauração ao sumir, `role="dialog"`/`aria-modal`, tudo de graça, sem
// reimplementar nada de `a11y/dialog.ts`.
import { useSyncExternalStore, type ReactNode } from 'react'
import { RotateCw } from 'lucide-react'
import { Overlay, ModalShell } from '@/game/ui/shell'

const QUERY = '(orientation: portrait)'

// Sem `window.matchMedia` (SSR, ambiente de teste sem polyfill) o produto não trava: a
// suposição segura é "não é retrato" — o mesmo espírito defensivo que `motion-dom` usa pro
// freio de `prefers-reduced-motion` (`if (window.matchMedia) … else prefersReducedMotion =
// false`).
function hasMatchMedia(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
}

function subscribe(onChange: () => void): () => void {
  if (!hasMatchMedia()) return () => {}
  const mql = window.matchMedia(QUERY)
  mql.addEventListener('change', onChange)
  return () => mql.removeEventListener('change', onChange)
}

function getSnapshot(): boolean {
  if (!hasMatchMedia()) return false
  return window.matchMedia(QUERY).matches
}

// App 100% client (sem SSR) — o snapshot do servidor nunca é usado de verdade, mas
// `useSyncExternalStore` exige o terceiro argumento.
function getServerSnapshot(): boolean {
  return false
}

function usePortrait(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

export function OrientationGate({ children }: { children: ReactNode }) {
  const portrait = usePortrait()
  return (
    <>
      {children}
      {portrait && <RotateNotice />}
    </>
  )
}

// z bem acima de tudo (modal 60 · trade 65 · carta 66 · notice 67 · pregão 68 · fim de jogo
// 70) — o aviso de rotação cobre até a tela de fim de jogo, porque a regra "paisagem é a
// única orientação servida" vale o tempo todo, inclusive depois da partida acabar.
const Z_ORIENTATION_GATE = 200

function RotateNotice() {
  return (
    <Overlay z={Z_ORIENTATION_GATE} ariaLabel="Gire o aparelho">
      <ModalShell className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-3 px-6 py-8 text-center">
          <RotateCw size={40} className="text-gold" aria-hidden />
          <p className="display text-xl text-cream">Gire o aparelho</p>
          <p className="label text-cream-muted normal-case leading-snug">
            O tabuleiro só cabe direito na horizontal. Sua partida continua exatamente do
            jeito que estava — é só girar a tela.
          </p>
        </div>
      </ModalShell>
    </Overlay>
  )
}
