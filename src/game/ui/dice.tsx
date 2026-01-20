// Dado 3D — cubo real com 6 faces posicionadas via translateZ.
// Padrão consagrado (David DeSandro / daily-dev-tips): cada face é um
// <div> absoluto rotacionado pro seu lado e empurrado pra fora com
// translateZ(metade_do_cubo). transform-style: preserve-3d no cubo
// + perspective no scene preserva profundidade.
//
// Extraído de `boards/shared.tsx` para a disputa de largada (OpeningRolls)
// reusar a MESMA coreografia de arremesso do tabuleiro — as telas de entrada
// não importam o tabuleiro inteiro (mesmo motivo do PlayerFace ser standalone).
import { useEffect } from 'react'
import { motion, useAnimate } from 'motion/react'
import { Crown } from 'lucide-react'
import { useMotion } from '@/game/ui/motion'
import type { SpeedFace } from '@/game/ui/diceFaces'

export const ROLL_DURATION_MS = 1050

const DIE_PX = 56               // w-14 / h-14
const HALF = DIE_PX / 2

// Rotação a aplicar no CUBO INTEIRO pra trazer a face do valor N pra câmera.
// Layout de d6 ocidental: faces opostas somam 7 (1↔6, 2↔5, 3↔4).
const FACE_REST: Record<number, [number, number]> = {
  1: [   0,   0 ], // frente
  2: [   0, -90 ], // direita
  3: [ -90,   0 ], // topo
  4: [  90,   0 ], // base
  5: [   0,  90 ], // esquerda
  6: [   0, 180 ], // fundo
}

const DOT_LAYOUT: Record<number, number[]> = {
  1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9],
  5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9],
}

function DotFace({ value, transform }: { value: number; transform: string }) {
  const dots = DOT_LAYOUT[value]
  return (
    <div
      className="absolute inset-0 grid grid-cols-3 grid-rows-3 gap-1 p-2 bg-cream rounded-[var(--radius-card)]"
      style={{
        transform,
        backfaceVisibility: 'hidden',
        boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.25), inset 0 -2px 3px rgba(0,0,0,0.15)',
      }}
    >
      {[1,2,3,4,5,6,7,8,9].map(i => (
        <div key={i} className="flex items-center justify-center">
          {dots.includes(i) && <span className="w-2 h-2 rounded-full bg-coffee-950" />}
        </div>
      ))}
    </div>
  )
}

function SpeedFaceContent({ kind, transform }: { kind: SpeedFace; transform: string }) {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center bg-gold rounded-[var(--radius-card)]"
      style={{
        transform,
        backfaceVisibility: 'hidden',
        boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.3), inset 0 -2px 3px rgba(0,0,0,0.18)',
      }}
    >
      {kind === 'one'   && <span className="display text-coffee-950 text-3xl leading-none">1</span>}
      {kind === 'two'   && <span className="display text-coffee-950 text-3xl leading-none">2</span>}
      {kind === 'three' && <span className="display text-coffee-950 text-3xl leading-none">3</span>}
      {kind === 'mr'    && <Crown size={28} className="text-coffee-950" strokeWidth={1.75} fill="currentColor" />}
      {kind === 'bus'   && <span className="display text-coffee-950 text-xl leading-none">BUS</span>}
    </div>
  )
}

// Hook compartilhado: dispara o tumble quando rollKey muda — coreografia
// "queda do copo", SINCRONIZADA com o áudio do dice-roll (0→0,42s chacoalho;
// 0,42s arremesso; quiques; assenta em ~1s = ROLL_DURATION_MS).
// Acumula 720° a cada roll (2 voltas) e termina na rotação de repouso da face
// desejada — motion interpola monotonamente, então o cubo sempre gira "pra
// frente" e pousa exatamente na face certa.
//
// 044/T076 (FR-021): esta coreografia NUNCA consultou `prefers-reduced-motion` — rodava o
// tombo inteiro (~1,05s) mesmo para quem pediu menos movimento, ficando mais visível depois
// da T071 (o peão já sai andando com o gate zerado, enquanto o dado ainda tombava). Sob
// movimento reduzido, `reduced` crava o cubo direto na rotação de repouso da face sorteada
// com `duration: 0` — mesmo freio do D7 (o vocabulário de `motion.ts`): o FATO (a face) fica
// legível na hora, só o chacoalho/quique somem.
function useDieAnimation(value: number, rollKey: number, reduced: boolean) {
  const [scope, animate] = useAnimate()

  useEffect(() => {
    if (rollKey === 0 || !scope.current) return
    const el = scope.current
    const [rx, ry] = FACE_REST[value]
    if (reduced) {
      void animate(el, { y: 0, rotateX: rx, rotateY: ry }, { duration: 0 })
      return
    }
    const base = rollKey * 720
    const run = async () => {
      // Fase 1 — chacoalho: o dado sobe e gira solto no ar ("dentro do copo").
      await animate(
        el,
        { y: [0, -70, -74, -68, -72, -70], rotateX: base - 340, rotateY: base - 320 },
        {
          duration: 0.42,
          ease: 'linear',
          y: { duration: 0.42, times: [0, 0.2, 0.4, 0.6, 0.8, 1], ease: 'easeOut' },
        },
      )
      // Fase 2 — despenca na mesa com dois quiques e trava na face sorteada.
      await animate(
        el,
        { y: [-70, 0, -18, 0, -6, 0], rotateX: base + rx, rotateY: base + ry },
        {
          duration: 0.63,
          ease: [0.16, 0.84, 0.44, 1],
          y: { duration: 0.63, times: [0, 0.3, 0.5, 0.68, 0.84, 1], ease: 'easeOut' },
        },
      )
    }
    void run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rollKey, reduced])

  return scope
}

export function Dice({ value, rollKey }: { value: number; rollKey: number }) {
  const { reduced } = useMotion()
  const scope = useDieAnimation(value, rollKey, reduced)
  const [initRx, initRy] = FACE_REST[value]

  return (
    <div className="relative" style={{ width: DIE_PX, height: DIE_PX, perspective: 500 }}>
      <motion.div
        aria-hidden="true"
        className="dice-shadow absolute left-1/2 -translate-x-1/2 -bottom-1.5 w-10 h-1.5 rounded-full bg-black/60 blur-[3px]"
        animate={reduced ? { scaleX: 1, opacity: 0.55 } : rollKey > 0 ? { scaleX: [1, 0.4, 0.4, 1.15, 1, 1.08, 1], opacity: [0.55, 0.15, 0.15, 0.65, 0.5, 0.6, 0.55] } : { scaleX: 1, opacity: 0.55 }}
        transition={{ duration: reduced ? 0 : 1.05, times: [0, 0.08, 0.55, 0.6, 0.7, 0.85, 1] }}
      />
      <motion.div
        ref={scope}
        className="absolute inset-0"
        style={{ transformStyle: 'preserve-3d' }}
        initial={{ rotateX: initRx, rotateY: initRy }}
      >
        <DotFace value={1} transform={`rotateY(0deg)   translateZ(${HALF}px)`} />
        <DotFace value={2} transform={`rotateY(90deg)  translateZ(${HALF}px)`} />
        <DotFace value={3} transform={`rotateX(90deg)  translateZ(${HALF}px)`} />
        <DotFace value={4} transform={`rotateX(-90deg) translateZ(${HALF}px)`} />
        <DotFace value={5} transform={`rotateY(-90deg) translateZ(${HALF}px)`} />
        <DotFace value={6} transform={`rotateY(180deg) translateZ(${HALF}px)`} />
      </motion.div>
    </div>
  )
}

// Speed Die — terceiro dado, SRS §13.2. Faces: 1/2/3, Mr. BM, BUS.
// Cubo precisa de 6 faces, então Mr. BM aparece duas vezes (faces opostas).
export function SpeedDie({ face, rollKey }: { face: SpeedFace; rollKey: number }) {
  const FACE_INDEX: Record<SpeedFace, number> = {
    one: 1, two: 2, three: 3, mr: 4, bus: 5,
  }
  const value = FACE_INDEX[face]
  const { reduced } = useMotion()
  const scope = useDieAnimation(value, rollKey, reduced)
  const [initRx, initRy] = FACE_REST[value]

  return (
    <div className="relative" style={{ width: DIE_PX, height: DIE_PX, perspective: 500 }}>
      <motion.div
        aria-hidden="true"
        className="dice-shadow absolute left-1/2 -translate-x-1/2 -bottom-1.5 w-10 h-1.5 rounded-full bg-black/60 blur-[3px]"
        animate={reduced ? { scaleX: 1, opacity: 0.55 } : rollKey > 0 ? { scaleX: [1, 0.4, 0.4, 1.15, 1, 1.08, 1], opacity: [0.55, 0.15, 0.15, 0.65, 0.5, 0.6, 0.55] } : { scaleX: 1, opacity: 0.55 }}
        transition={{ duration: reduced ? 0 : 1.05, times: [0, 0.08, 0.55, 0.6, 0.7, 0.85, 1] }}
      />
      <motion.div
        ref={scope}
        className="absolute inset-0"
        style={{ transformStyle: 'preserve-3d' }}
        initial={{ rotateX: initRx, rotateY: initRy }}
      >
        <SpeedFaceContent kind="one"   transform={`rotateY(0deg)   translateZ(${HALF}px)`} />
        <SpeedFaceContent kind="two"   transform={`rotateY(90deg)  translateZ(${HALF}px)`} />
        <SpeedFaceContent kind="three" transform={`rotateX(90deg)  translateZ(${HALF}px)`} />
        <SpeedFaceContent kind="mr"    transform={`rotateX(-90deg) translateZ(${HALF}px)`} />
        <SpeedFaceContent kind="bus"   transform={`rotateY(-90deg) translateZ(${HALF}px)`} />
        <SpeedFaceContent kind="mr"    transform={`rotateY(180deg) translateZ(${HALF}px)`} />
      </motion.div>
    </div>
  )
}
