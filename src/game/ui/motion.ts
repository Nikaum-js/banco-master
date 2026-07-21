// Vocabulário único de movimento (044, US5 / D7 do plan) — duração, curva e o freio de
// `prefers-reduced-motion` vêm de um lugar só. Antes, 7 pontos avulsos chamavam
// `useReducedMotion` e decidiam o freio por conta própria (`src/boards/shared.tsx`,
// `src/game/ui/cards/HandPanel.tsx`); componente novo que esquecesse simplesmente não
// freava. Daqui pra frente, quem usa `useMotion()` ganha o freio de graça.
//
// Os MESMOS números vivem em dois lugares por necessidade, não por descuido: CSS
// (`src/index.css`, tokens `--motion-*`/`--ease-*`) e `motion/react` são dois runtimes que
// não se leem — motion anima em JS, com duração em SEGUNDOS; CSS resolve `var()` sozinho.
// Mudou um valor aqui? Muda o par em `index.css` (e vice-versa).
import { useReducedMotion, type Transition } from 'motion/react'

// Espelha --motion-fast/--motion-base/--motion-slow (ali em ms; aqui em segundos).
export const MOTION = {
  fast: 0.12,
  base: 0.2,
  slow: 0.42,
} as const

// Espelha --ease-standard/--ease-emphasis. Tipado como tupla (não `number[]`) porque é
// isso que `Transition.ease` de curva cúbica espera.
export const EASE: { standard: [number, number, number, number]; emphasis: [number, number, number, number] } = {
  standard: [0.4, 0, 0.2, 1],
  emphasis: [0.16, 1, 0.3, 1],
}

const ENTER: Transition = { duration: MOTION.base, ease: EASE.emphasis }
const LEAVE: Transition = { duration: MOTION.fast, ease: EASE.standard }
const ZERO: Transition = { duration: 0 }

// Monta um conjunto initial/animate/exit pronto pra `motion.div`. Deixado sem anotação de
// tipo de propósito: o retorno fica com o tipo LITERAL inferido (mesma forma que um objeto
// escrito na mão no JSX teria) — é o que o prop `animate`/`initial` do framer-motion
// realmente aceita. Uma interface nominal aqui colide com o tipo de alvo dele (índice de
// custom property `--x`) e o typecheck quebra sem que o comportamento em runtime mude nada.
function motionSet<I extends object, A extends object>(initial: I, enterTarget: A, exitTarget: A) {
  return {
    initial,
    animate: { ...enterTarget, transition: ENTER },
    exit: { ...exitTarget, transition: LEAVE },
  }
}

// Véu que aparece/some — Overlay, backdrop de notice, item que só precisa de opacidade.
export const fade = motionSet({ opacity: 0 }, { opacity: 1 }, { opacity: 0 })

// Cartão/modal que entra com um pequeno realce de escala — ModalShell-like.
export const pop = motionSet({ opacity: 0, scale: 0.92 }, { opacity: 1, scale: 1 }, { opacity: 0, scale: 0.92 })

// Item de lista que desliza de cima — entrada de log, linha nova.
export const slideUp = motionSet({ opacity: 0, y: 8 }, { opacity: 1, y: 0 }, { opacity: 0, y: 8 })

// Freia um conjunto: os valores-alvo (o FATO) continuam os mesmos — só a duração da
// transição zera. É a mesma garantia do bloco `@media (prefers-reduced-motion)` do CSS:
// apagar o movimento, nunca a informação (D7 do plan).
function brake<T extends { initial: object; animate: object; exit: object }>(set: T): T {
  return {
    ...set,
    animate: { ...set.animate, transition: ZERO },
    exit: { ...set.exit, transition: ZERO },
  } as T
}

const BRAKED = {
  fade: brake(fade),
  pop: brake(pop),
  slideUp: brake(slideUp),
}

// Hook único: consulta `useReducedMotion` e devolve as três variantes do vocabulário —
// já freadas quando o usuário pediu menos movimento, senão intactas. `reduced` também sai
// junto pra quem precisa condicionar algo além das três variantes prontas (ex.: ligar/
// desligar um `animate` de loop ambiente, que não é enter/exit e por isso não é variante).
export function useMotion() {
  const reduced = useReducedMotion() ?? false
  return {
    reduced,
    fade: reduced ? BRAKED.fade : fade,
    pop: reduced ? BRAKED.pop : pop,
    slideUp: reduced ? BRAKED.slideUp : slideUp,
  }
}
