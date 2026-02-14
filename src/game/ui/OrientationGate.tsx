// Tela de "gire o aparelho" (044/T033 — US4/D6 do plan, D-039). O tabuleiro só é servido
// em paisagem (SRS §12.6): em retrato ABAIXO DO LIMIAR de largura, este componente cobre
// a árvore com um aviso, SEM desmontar `children`.
//
// A razão de nunca desmontar é dura (D6): `children` é a árvore inteira, incluindo o
// `OnlineGate` — desmontá-lo dispararia o `dispose()` da sessão online e a mesa registraria
// uma saída só porque alguém girou o celular, pausando a partida de todo mundo. Por isso
// `children` fica na MESMA posição do JSX em toda renderização; só o aviso por cima é
// condicional. Nenhum estado React entra no caminho crítico — `useNeedsRotate()` só decide
// se o aviso aparece, nunca se a árvore de baixo existe.
//
// T075 (achado da Fase 4): o aviso disparava em QUALQUER retrato — um monitor vertical ou
// um tablet em pé, onde a mesa CABE (porque `.board-stage` já empilha os painéis abaixo de
// 1100px, index.css), recebia "gire o aparelho" sem motivo nenhum. D6 do plan já previa
// "retrato ABAIXO DO LIMIAR" — o limiar é exatamente esse mesmo breakpoint de 1100px, para
// o aviso e o CSS concordarem sobre quando a mesa deixa de caber em 3 colunas.
//
// Acessibilidade: o aviso É uma tela do caminho de jogo (D-039), então reusa o MESMO
// primitivo `Overlay`/`ModalShell` (shell.tsx) que todo modal do jogo usa — foco ao
// aparecer, restauração ao sumir, `role="dialog"`/`aria-modal`, tudo de graça, sem
// reimplementar nada de `a11y/dialog.ts`.
import { type ReactNode } from 'react'
import { RotateCw } from 'lucide-react'
import { Overlay, ModalShell } from '@/game/ui/shell'
import { useMediaQuery } from '@/game/ui/media'

// Mesmo limiar que `.board-stage` usa pra empilhar os painéis (index.css, `@media
// (max-width: 1100px)`): abaixo dele a mesa não cabe em 3 colunas — girar ajuda. Dali pra
// cima ela já cabe empilhada, então o aviso seria falso alarme.
const QUERY = '(orientation: portrait) and (max-width: 1100px)'

// A tolerância a ambiente sem `window.matchMedia` (SSR, teste sem polyfill) vive no hook
// compartilhado `@/game/ui/media`: ali, "não casa" é a suposição segura.
function useNeedsRotate(): boolean {
  return useMediaQuery(QUERY)
}

export function OrientationGate({ children }: { children: ReactNode }) {
  const needsRotate = useNeedsRotate()
  return (
    <>
      {children}
      {needsRotate && <RotateNotice />}
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
            jeito que estava. É só girar a tela.
          </p>
        </div>
      </ModalShell>
    </Overlay>
  )
}
