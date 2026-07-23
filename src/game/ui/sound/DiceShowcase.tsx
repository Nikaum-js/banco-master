// DiceShowcase (dev) — tela de escolha da animação dos dados (?dados na URL).
// Três coreografias lado a lado, todas SINCRONIZADAS com o áudio do dice-roll
// (0→0,42s chacoalho no copo · 0,42s arremesso · quiques · assenta em ~1s).
// O cubo é o MESMO do jogo (DotFace/FACE_REST de boards/shared). Ao escolher,
// a variante vencedora vira a animação oficial do Dice e esta tela sai.
import { useEffect, useRef, useState } from 'react'
import { motion, useAnimate } from 'motion/react'
import { DotFace, FACE_REST, DIE_PX, HALF } from '@/boards/shared'
import { ensureUnlockListener, play, setMasterGain } from './engine'

export type DiceVariant = 'chacoalho' | 'queda' | 'deslize'

const SHAKE_S = 0.42 // duração do chacoalho no áudio
const TOSS_S = 0.63  // arremesso até assentar (total ~1,05s = ROLL_DURATION_MS)

// Coreografia por variante: fase 1 (chacoalho) + fase 2 (arremesso), aplicadas
// em dois níveis — wrapper (posição/escala) e cubo (rotações 3D).
async function runVariant(
  variant: DiceVariant,
  wrapper: HTMLElement,
  cube: HTMLElement,
  animate: ReturnType<typeof useAnimate>[1],
  value: number,
  spin: number, // voltas acumuladas (spin*720) — o cubo sempre gira "pra frente"
  delay: number, // dessincroniza levemente os dois dados da dupla
) {
  const [rx, ry] = FACE_REST[value]
  const endX = spin * 720 + rx
  const endY = spin * 720 + ry

  if (variant === 'chacoalho') {
    // Mão invisível vibra o dado contra a mesa, depois lança pro alto.
    const p1 = animate(
      wrapper,
      { x: [0, -5, 4, -6, 5, -4, 3, 0], y: [0, -3, -1, -4, -2, -5, -1, 0] },
      { duration: SHAKE_S, ease: 'linear', delay },
    )
    animate(cube, { rotateZ: [0, -8, 7, -9, 8, -6, 5, 0] }, { duration: SHAKE_S, ease: 'linear', delay })
    await p1
    const p2 = animate(
      wrapper,
      { y: [0, -46, 0, -10, 0], scale: [1, 1, 1.05, 1, 1] },
      { duration: TOSS_S, times: [0, 0.35, 0.62, 0.8, 1], ease: [0.3, 0, 0.4, 1] },
    )
    animate(cube, { rotateX: endX, rotateY: endY }, { duration: TOSS_S, ease: [0.16, 0.84, 0.44, 1] })
    await p2
  } else if (variant === 'queda') {
    // Dado tomba do copo lá do alto: gira solto no ar e despenca com 2 quiques.
    const p1 = animate(
      wrapper,
      { y: [-70, -74, -68, -72, -70], x: [0, 3, -2, 2, 0] },
      { duration: SHAKE_S, ease: 'linear', delay },
    )
    animate(cube, { rotateX: [0, 360], rotateY: [15, 340] }, { duration: SHAKE_S, ease: 'linear', delay })
    await p1
    const p2 = animate(
      wrapper,
      { y: [-70, 0, -18, 0, -6, 0], scale: [1, 1.08, 1, 1.04, 1, 1] },
      { duration: TOSS_S, times: [0, 0.3, 0.5, 0.68, 0.84, 1], ease: 'easeOut' },
    )
    animate(cube, { rotateX: endX, rotateY: endY }, { duration: TOSS_S, ease: [0.2, 0.7, 0.4, 1] })
    await p2
  } else {
    // Craps: chacoalha fora da mesa e entra DESLIZANDO até travar na face.
    const p1 = animate(
      wrapper,
      { x: [-70, -75, -68, -74, -70], y: [0, -3, -1, -4, 0] },
      { duration: SHAKE_S, ease: 'linear', delay },
    )
    animate(cube, { rotateZ: [0, 10, -8, 9, 0] }, { duration: SHAKE_S, ease: 'linear', delay })
    await p1
    const p2 = animate(
      wrapper,
      { x: [-70, 10, 0], y: [0, -12, 0], scale: [1, 1.03, 1] },
      { duration: TOSS_S, times: [0, 0.55, 1], ease: [0.2, 0.8, 0.3, 1] },
    )
    animate(cube, { rotateX: endX, rotateY: endY, rotateZ: 0 }, { duration: TOSS_S, ease: [0.16, 0.84, 0.44, 1] })
    await p2
  }
}

function ShowDie({ variant, playKey, value, second }: { variant: DiceVariant; playKey: number; value: number; second?: boolean }) {
  const [wrapperRef, animate] = useAnimate<HTMLDivElement>()
  const cubeRef = useRef<HTMLDivElement>(null)
  const [initRx, initRy] = FACE_REST[value]

  useEffect(() => {
    if (playKey === 0 || !wrapperRef.current || !cubeRef.current) return
    void runVariant(variant, wrapperRef.current, cubeRef.current, animate, value, playKey, second ? 0.04 : 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playKey])

  return (
    <div className="relative" style={{ width: DIE_PX, height: DIE_PX, perspective: 500 }}>
      <motion.div ref={wrapperRef} className="absolute inset-0">
        <div ref={cubeRef} className="absolute inset-0" style={{ transformStyle: 'preserve-3d', transform: `rotateX(${initRx}deg) rotateY(${initRy}deg)` }}>
          <DotFace value={1} transform={`rotateY(0deg)   translateZ(${HALF}px)`} />
          <DotFace value={2} transform={`rotateY(90deg)  translateZ(${HALF}px)`} />
          <DotFace value={3} transform={`rotateX(90deg)  translateZ(${HALF}px)`} />
          <DotFace value={4} transform={`rotateX(-90deg) translateZ(${HALF}px)`} />
          <DotFace value={5} transform={`rotateY(-90deg) translateZ(${HALF}px)`} />
          <DotFace value={6} transform={`rotateY(180deg) translateZ(${HALF}px)`} />
        </div>
      </motion.div>
    </div>
  )
}

const VARIANTS: { id: DiceVariant; title: string; blurb: string }[] = [
  { id: 'chacoalho', title: 'Opção A — Chacoalho na mesa', blurb: 'O dado vibra na mesa durante o chacoalho e é lançado pro alto no arremesso, com quique curto.' },
  { id: 'queda', title: 'Opção B — Queda do copo', blurb: 'O dado gira solto no ar durante o chacoalho e despenca na mesa com dois quiques.' },
  { id: 'deslize', title: 'Opção C — Deslize de craps', blurb: 'O dado chacoalha fora da mesa e entra deslizando, travando na face como em mesa de craps.' },
]

export function DiceShowcase() {
  const [keys, setKeys] = useState<Record<DiceVariant, number>>({ chacoalho: 0, queda: 0, deslize: 0 })
  const [values, setValues] = useState<[number, number]>([3, 5])
  const busy = useRef(false)

  useEffect(() => {
    ensureUnlockListener()
    setMasterGain(1, false)
  }, [])

  function roll(v: DiceVariant) {
    if (busy.current) return
    busy.current = true
    setTimeout(() => (busy.current = false), 1100)
    setValues([1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)])
    play('dice-roll')
    setKeys((k) => ({ ...k, [v]: k[v] + 1 }))
  }

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-8 text-slate-100">
      <header className="mx-auto mb-8 max-w-5xl">
        <h1 className="text-2xl font-bold">Animações do dado</h1>
        <p className="mt-1 text-sm text-slate-400">
          Três coreografias sincronizadas com o áudio (chacoalho → arremesso → quiques). Clique em cada arena e
          compare; o primeiro clique da sessão pode sair do sincronismo (o áudio ainda está carregando) — repita.
        </p>
      </header>
      <main className="mx-auto grid max-w-5xl grid-cols-1 gap-4 lg:grid-cols-3">
        {VARIANTS.map(({ id, title, blurb }) => (
          <section key={id} className="flex flex-col rounded-xl border border-slate-700 bg-slate-900 p-4">
            <h2 className="text-sm font-semibold text-amber-400">{title}</h2>
            <p className="mt-1 min-h-10 text-xs text-slate-400">{blurb}</p>
            <div className="my-6 flex h-36 items-end justify-center gap-4 overflow-hidden rounded-lg bg-emerald-950/60 pb-6">
              <ShowDie variant={id} playKey={keys[id]} value={values[0]} />
              <ShowDie variant={id} playKey={keys[id]} value={values[1]} second />
            </div>
            <button
              type="button"
              onClick={() => roll(id)}
              className="rounded-lg border border-amber-500/50 bg-slate-800 px-3 py-2 text-sm font-medium transition hover:bg-slate-700 active:scale-95"
            >
              🎲 Rolar com som
            </button>
          </section>
        ))}
      </main>
    </div>
  )
}
