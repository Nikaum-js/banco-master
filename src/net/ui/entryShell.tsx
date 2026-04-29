// Casca das telas de ENTRADA (home, identidade, sala, reentrada) — a "sala de mapas" do
// Atlas da Meia-Noite. Antes, essas telas pintavam um `bg-coffee-950` chapado por cima do
// graticule que o body já desenha e reusavam a casca de modal do jogo (faixa dourada de
// ModalHeader) — genérico e fora do mundo do tabuleiro. Aqui o palco é TRANSPARENTE (a
// carta náutica do fundo aparece) e vira uma CENA VIVA: rotas com aviões em voo, um
// horizonte de cidade fechando o rodapé com janelas piscando, balão subindo, nuvens à
// deriva, marcos de cidades e coordenadas de carta — tudo em latão apagado, atrás do
// conteúdo. O painel (.entry-panel, index.css) carrega as marcas de registro dos cantos —
// o mesmo cromo das casas do tabuleiro.
//
// Movimento: CSS Motion Path (`offset-path`/`.entry-flyer`) — SMIL dinâmico congela no
// Chromium. Tudo decorativo: some sob `prefers-reduced-motion` (voadores) ou congela de
// forma composta (nuvens), e nada disso entra na árvore de acessibilidade.
import { createContext, useContext, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { motion, useMotionValue, useSpring, useTransform, type MotionValue } from 'motion/react'
import { cn } from '@/lib/utils'
import { useMotion } from '@/game/ui/motion'

// ---------------------------------------------------------------------
// Rosa dos ventos — anéis graduados + estrela de 8 pontas, gerada por rotação.
// ---------------------------------------------------------------------
export function CompassRose({ size, className }: { size?: number | string; className?: string }) {
  const ticks = Array.from({ length: 72 }, (_, i) => i * 5)
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} fill="none" stroke="currentColor" className={className} aria-hidden="true">
      <circle cx="100" cy="100" r="97" strokeWidth="0.7" />
      <circle cx="100" cy="100" r="88" strokeWidth="0.5" strokeDasharray="1.5 3.5" />
      <circle cx="100" cy="100" r="58" strokeWidth="0.5" />
      <g strokeWidth="0.6">
        {ticks.map((a) => (
          <line key={a} x1="100" y1={a % 45 === 0 ? 6.5 : 9.5} x2="100" y2="13" transform={`rotate(${a} 100 100)`} />
        ))}
      </g>
      {[0, 90, 180, 270].map((a) => (
        <path key={a} d="M100 16 106 94l-6 6-6-6Z" strokeWidth="0.8" transform={`rotate(${a} 100 100)`} />
      ))}
      {[45, 135, 225, 315].map((a) => (
        <path key={a} d="M100 44l4.5 51.5-4.5 4.5-4.5-4.5Z" strokeWidth="0.7" transform={`rotate(${a} 100 100)`} />
      ))}
      <circle cx="100" cy="100" r="3.2" strokeWidth="0.8" />
    </svg>
  )
}

// ---------------------------------------------------------------------
// Aviões — silhueta de avião em line art, centrada e apontando +x,
// com rastro de condensação — pronta pra seguir rota com `offset-rotate: auto`.
// ---------------------------------------------------------------------
function PlaneMark({ scale = 1 }: { scale?: number }) {
  return (
    <g transform={`scale(${scale})`}>
      <line x1="-46" y1="0" x2="-30" y2="0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeDasharray="2 5" opacity="0.35" />
      <line x1="-28" y1="0" x2="-14" y2="0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeDasharray="3 4" opacity="0.6" />
      <g transform="rotate(90)">
        <g transform="translate(-16 -16)">
          <path
            d="M16 3c1.3 1.9 1.4 3.9 1.4 5.9v5.3L29 19.9v2.9l-11.6-3.1v5.2l3.5 2.8v2.1L16 28.5l-4.9 1.3v-2.1l3.5-2.8v-5.2L3 22.8v-2.9l11.6-5.7V8.9c0-2 .1-4 1.4-5.9Z"
            fill="currentColor"
            stroke="none"
          />
        </g>
      </g>
    </g>
  )
}

// Céu de rotas — três arcos pontilhados com escalas marcadas e um avião em voo por
// rota. Os `begin` negativos largam cada avião já no meio do caminho — a cena nasce
// em movimento, não em fila.
const ROUTES = [
  {
    d: 'M-40 640C260 520 420 700 690 560S1150 300 1500 380',
    dur: '75s',
    begin: '-20s',
    scale: 1.25,
    opacity: 0.42,
    cities: [
      [150, 595],
      [480, 610],
      [910, 455],
      [1265, 352],
    ],
  },
  {
    d: 'M1480 175C1180 255 980 115 720 205S260 415 -60 325',
    dur: '105s',
    begin: '-64s',
    scale: 0.85,
    opacity: 0.3,
    cities: [
      [1180, 222],
      [790, 180],
      [380, 330],
    ],
  },
  {
    d: 'M-60 110C300 40 720 190 1060 100S1330 150 1520 90',
    dur: '92s',
    begin: '-48s',
    scale: 0.72,
    opacity: 0.26,
    cities: [
      [320, 76],
      [880, 138],
    ],
  },
] as const

function SkyRoutes({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" fill="none" className={className} aria-hidden="true">
      {ROUTES.map((r) => (
        <g key={r.d}>
          <path d={r.d} stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 9" strokeLinecap="round" opacity="0.14" />
          {r.cities.map(([x, y]) => (
            <g key={`${x}-${y}`} opacity="0.16" stroke="currentColor">
              <circle cx={x} cy={y} r="3" fill="currentColor" stroke="none" />
              <circle cx={x} cy={y} r="8" strokeWidth="1" strokeDasharray="2 3" />
            </g>
          ))}
          <g
            className="entry-flyer"
            opacity={r.opacity}
            style={{ offsetPath: `path('${r.d}')`, offsetRotate: 'auto', animationDuration: r.dur, animationDelay: r.begin }}
          >
            <PlaneMark scale={r.scale} />
          </g>
        </g>
      ))}
    </svg>
  )
}

// ---------------------------------------------------------------------
// Horizonte de cidades — a linha do rodapé da carta. Substituiu a "trilha de
// tabuleiro" (fileira de casas com um peão passeando em cima): peça de jogo
// desenhada em tamanho grande atrás da interface competia com o cartão de
// embarque e lia como sobra de layout, não como cenário. Silhueta de cidade é
// AMBIENTE — diz "Cidades do Mundo" sem imitar o tabuleiro.
//
// As janelas acesas piscam em ritmos diferentes (`.entry-window`), com o atraso
// vindo do mesmo gerador determinístico que planta os prédios: o skyline é o
// mesmo em todo carregamento (não pisca de forma diferente a cada render).
// ---------------------------------------------------------------------

// LCG minúsculo — aleatório REPETÍVEL. `Math.random` no corpo do componente
// redesenharia a cidade a cada render.
function seeded(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

interface Building {
  x: number
  w: number
  h: number
  spire: boolean
  windows: { x: number; y: number; delay: number }[]
}

// Uma fileira de prédios cobrindo a largura da carta: largura e altura sorteadas
// numa faixa, janelas em grade dentro de cada prédio (só uma fração acesa).
function skyline(seed: number, count: number, minH: number, maxH: number): Building[] {
  const rnd = seeded(seed)
  const out: Building[] = []
  let x = -40
  for (let i = 0; i < count; i++) {
    const w = 46 + Math.round(rnd() * 66)
    const h = minH + Math.round(rnd() * (maxH - minH))
    const windows: { x: number; y: number; delay: number }[] = []
    for (let wy = 14; wy < h - 10; wy += 17) {
      for (let wx = 9; wx < w - 12; wx += 15) {
        if (rnd() > 0.45) windows.push({ x: wx, y: wy, delay: Math.round(rnd() * 9000) })
      }
    }
    out.push({ x, w, h, spire: rnd() > 0.8, windows })
    x += w + 4 + Math.round(rnd() * 16)
    if (x > 1500) break
  }
  return out
}

const SKYLINE_FAR = skyline(20260727, 26, 90, 210)
const SKYLINE_NEAR = skyline(41112, 20, 130, 300)

function CityBand({ buildings, base, opacity }: { buildings: Building[]; base: number; opacity: number }) {
  return (
    <g opacity={opacity}>
      {buildings.map((b) => (
        <g key={`${b.x}-${b.h}`} transform={`translate(${b.x} ${base - b.h})`}>
          <rect width={b.w} height={b.h + 40} fill="var(--color-ink-950)" fillOpacity="0.55" />
          <rect width={b.w} height={b.h} stroke="currentColor" strokeWidth="1.1" fill="none" />
          {b.spire && <path d={`M${b.w / 2} 0v-26`} stroke="currentColor" strokeWidth="1.1" />}
          {b.windows.map((w) => (
            <rect
              key={`${w.x}-${w.y}`}
              className="entry-window"
              x={w.x}
              y={w.y}
              width="6"
              height="8"
              fill="currentColor"
              style={{ animationDelay: `${w.delay}ms` }}
            />
          ))}
        </g>
      ))}
    </g>
  )
}

function CityHorizon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMax slice" fill="none" className={className} aria-hidden="true">
      {/* brilho de cidade subindo do horizonte */}
      <defs>
        <linearGradient id="entry-glow" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.16" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="0" y="560" width="1440" height="340" fill="url(#entry-glow)" />
      <CityBand buildings={SKYLINE_FAR} base={830} opacity={0.2} />
      <CityBand buildings={SKYLINE_NEAR} base={900} opacity={0.34} />
    </svg>
  )
}

// ---------------------------------------------------------------------
// Cenário do atlas — balão subindo, nuvens à deriva, marcos de cidades e as
// coordenadas de carta (Equador, paralelos) que amarram tudo no vocabulário
// de navegação.
// ---------------------------------------------------------------------
function BalloonMark({ scale = 1 }: { scale?: number }) {
  return (
    <g transform={`scale(${scale}) translate(-16 -16)`} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 2.8c5.6 0 9.4 3.7 9.4 8.5 0 4.9-4.2 8.2-6.6 11.2h-5.6C10.8 19.5 6.6 16.2 6.6 11.3c0-4.8 3.8-8.5 9.4-8.5Z" />
      <path d="M12.6 3.6c-1.7 3.2-1.7 15.7.6 18.9M19.4 3.6c1.7 3.2 1.7 15.7-.6 18.9M16 2.8v19.7" />
      <path d="M13 22.5l-.5 3M19 22.5l.5 3" />
      <rect x="12" y="25.5" width="8" height="3.9" rx="1" />
    </g>
  )
}

function CloudMark({ scale = 1 }: { scale?: number }) {
  return (
    <g transform={`scale(${scale})`}>
      <path
        d="M6 18c-5-1.5-5.5-9 1-10.5.5-5.5 9-7.5 12.5-3 4.5-4.5 12-1.5 11.5 4 5 .5 5.5 8 .5 9.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </g>
  )
}

// Marcos de cidade — torre, pirâmide e farol, plantados nas escalas das rotas:
// é o "Cidades do Mundo" desenhado na carta.
function TowerMark() {
  return (
    <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 2v3M11.5 28 16 5l4.5 23M9 28h14M12.4 19.5h7.2M13.7 12.5h4.6" />
    </g>
  )
}
function PyramidMark() {
  return (
    <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.5 27 16 5.5 28.5 27Z" />
      <path d="M16 5.5 20.5 27" />
    </g>
  )
}
function LighthouseMark() {
  return (
    <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.6 11.8 10.6 27h10.8l-2-15.2" />
      <path d="M12.1 16.2h7.8M11.5 20.8h9" />
      <path d="M12.6 11.8V8.4h6.8v3.4" />
      <path d="M11.6 8.4 16 4.6l4.4 3.8" />
      <path d="M7.8 27h16.4" />
      <path d="M10.4 8.2 5.6 6.4M21.6 8.2l4.8-1.8" />
    </g>
  )
}

const CLOUDS = [
  { base: 60, y: 108, scale: 2, dur: '150s', delay: '-30s', opacity: 0.12 },
  { base: 430, y: 248, scale: 1.4, dur: '190s', delay: '-110s', opacity: 0.1 },
  { base: 40, y: 606, scale: 1.7, dur: '170s', delay: '-70s', opacity: 0.1 },
] as const

function AtlasScenery({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" fill="none" className={className} aria-hidden="true">
      {/* Equador e paralelos — só traço e graduação, SEM <text>: axe mede contraste até
          de texto SVG decorativo, e rótulo apagado de propósito nunca passa no gate. */}
      <g stroke="currentColor" opacity="0.08">
        <path d="M0 460H1440" strokeWidth="1" strokeDasharray="3 12" />
        <path d="M0 190H1440M0 730H1440" strokeWidth="0.8" strokeDasharray="2 18" />
        <path d="M28 452v16M24 456h12M28 182v16M28 722v16" strokeWidth="1.2" />
      </g>

      {/* marcos das cidades, ancorados nas escalas das rotas */}
      <g opacity="0.22">
        <g transform="translate(1243 306) scale(1.5)">
          <TowerMark />
        </g>
        <g transform="translate(358 268) scale(1.35)">
          <PyramidMark />
        </g>
        <g transform="translate(128 528) scale(1.4)">
          <LighthouseMark />
        </g>
      </g>

      {/* nuvens à deriva — o pai anima (varredura), o filho posiciona */}
      {CLOUDS.map((c) => (
        <g key={`${c.base}-${c.y}`} className="entry-drift" style={{ animationDuration: c.dur, animationDelay: c.delay }} opacity={c.opacity}>
          <g transform={`translate(${c.base} ${c.y})`}>
            <CloudMark scale={c.scale} />
          </g>
        </g>
      ))}

      {/* balão de ar quente — sobe a carta inteira e reentra por baixo */}
      <g
        className="entry-flyer"
        opacity="0.28"
        style={{ offsetPath: "path('M1250 980C1150 700 1290 420 1100 -90')", offsetRotate: '0deg', animationDuration: '130s', animationDelay: '-34s' }}
      >
        <BalloonMark scale={1.9} />
      </g>
    </svg>
  )
}

// ---------------------------------------------------------------------
// Parallax de cursor — a carta ganha PROFUNDIDADE: cada camada da cena se
// desloca por um fator diferente do mesmo par de motion values normalizados
// (-1..1), então o que está "mais perto" (a trilha do rodapé) anda mais que o
// que está "mais longe" (as nuvens e os paralelos). Vale para o mouse apenas:
// dedo não paira sobre nada, e sob movimento reduzido as camadas ficam paradas.
// ---------------------------------------------------------------------
const ParallaxCtx = createContext<{ x: MotionValue<number>; y: MotionValue<number> } | null>(null)
const PARALLAX_SPRING = { stiffness: 45, damping: 18, mass: 0.7 } as const

function ParallaxLayer({ depth, className, children }: { depth: number; className?: string; children: ReactNode }) {
  const ctx = useContext(ParallaxCtx)
  // Fallback estável: sem contexto (ou com movimento reduzido) o layer usa um par
  // de valores parados — a ordem dos hooks não depende de haver parallax.
  const idleX = useMotionValue(0)
  const idleY = useMotionValue(0)
  const x = useTransform(ctx?.x ?? idleX, (v) => v * depth)
  const y = useTransform(ctx?.y ?? idleY, (v) => v * depth * 0.62)
  // O leve zoom mora AQUI, no mesmo transform do parallax: uma classe `scale-*` do
  // Tailwind seria descartada — motion escreve `transform` inline e ganha do CSS.
  return (
    <motion.div style={{ x, y, scale: 1.06 }} className={cn('absolute inset-0', className)}>
      {children}
    </motion.div>
  )
}

// Holofote — a mancha de luz de uma lupa correndo sobre a carta. É um gradiente
// ESTÁTICO movido por transform (composita na GPU); pintar um radial-gradient
// novo a cada frame custaria repaint de tela cheia.
function CursorLantern({ x, y }: { x: MotionValue<number>; y: MotionValue<number> }) {
  return (
    <motion.div
      style={{
        x,
        y,
        width: 720,
        height: 720,
        marginLeft: -360,
        marginTop: -360,
        background: 'radial-gradient(circle, rgb(217 166 80 / 0.13) 0%, rgb(217 166 80 / 0.05) 38%, transparent 70%)',
      }}
      className="absolute left-0 top-0 mix-blend-screen"
    />
  )
}

// ---------------------------------------------------------------------
// Palco de tela cheia: transparente sobre o graticule do body, com a cena
// decorativa fixa e o conteúdo centralizado (rola quando não cabe).
// ---------------------------------------------------------------------
export function EntryStage({ children }: { children: ReactNode }) {
  const { reduced } = useMotion()
  const rawX = useMotionValue(0)
  const rawY = useMotionValue(0)
  const lampX = useMotionValue(-9999)
  const lampY = useMotionValue(-9999)
  const px = useSpring(rawX, PARALLAX_SPRING)
  const py = useSpring(rawY, PARALLAX_SPRING)
  const lx = useSpring(lampX, { stiffness: 90, damping: 22, mass: 0.5 })
  const ly = useSpring(lampY, { stiffness: 90, damping: 22, mass: 0.5 })

  function track(e: ReactPointerEvent<HTMLDivElement>): void {
    if (reduced || e.pointerType !== 'mouse') return
    rawX.set((e.clientX / window.innerWidth) * 2 - 1)
    rawY.set((e.clientY / window.innerHeight) * 2 - 1)
    lampX.set(e.clientX)
    lampY.set(e.clientY)
  }

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto overscroll-contain" onPointerMove={track}>
      <ParallaxCtx.Provider value={reduced ? null : { x: px, y: py }}>
        {/* A cena inteira é ampliada de leve: o deslocamento do parallax nunca
            descobre a borda da viewport. */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
          <ParallaxLayer depth={10}>
            <AtlasScenery className="absolute inset-0 w-full h-full text-brass" />
          </ParallaxLayer>
          <ParallaxLayer depth={20}>
            <SkyRoutes className="absolute inset-0 w-full h-full text-brass" />
          </ParallaxLayer>
          <ParallaxLayer depth={30}>
            <CompassRose size="min(72vmin, 560px)" className="absolute -right-[10vmin] -bottom-[14vmin] text-brass opacity-[0.1]" />
            <CompassRose size="24vmin" className="absolute left-[3vmin] top-[5vmin] text-brass opacity-[0.06]" />
          </ParallaxLayer>
          <ParallaxLayer depth={38}>
            <CityHorizon className="absolute inset-0 w-full h-full text-brass" />
          </ParallaxLayer>
          {!reduced && <CursorLantern x={lx} y={ly} />}
        </div>
        {/* Tela baixa aperta o ritmo vertical em vez de empurrar o painel pra fora
            da dobra — o mesmo conteúdo, com menos ar entre os blocos. */}
        <div className="relative min-h-full flex flex-col items-center justify-center gap-6 p-4 py-10 [@media(max-height:640px)]:gap-3 [@media(max-height:640px)]:py-4">
          {children}
        </div>
      </ParallaxCtx.Provider>
    </div>
  )
}

// Prancha do atlas — entrada em fade+subida (o freio de movimento reduzido zera).
export function EntryPanel({ className, children }: { className?: string; children: ReactNode }) {
  const { reduced } = useMotion()
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 26 }}
      className={cn('entry-panel w-full', className)}
    >
      {children}
    </motion.div>
  )
}

// Filete ornamental — par de linhas convergindo num losango de latão.
export function OrnamentRule({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)} aria-hidden="true">
      <span className="h-px flex-1 bg-gradient-to-r from-transparent to-brass/45" />
      <svg width="8" height="8" viewBox="0 0 8 8" className="text-brass/70 shrink-0">
        <rect x="1.2" y="1.2" width="5.6" height="5.6" transform="rotate(45 4 4)" fill="currentColor" />
      </svg>
      <span className="h-px flex-1 bg-gradient-to-l from-transparent to-brass/45" />
    </div>
  )
}

// Header de prancha — kicker em versalete de latão, título display, filete. Substitui a
// faixa dourada chapada do ModalHeader nessas telas: latão como FIO, não como placa.
export function EntryHeader({
  kicker = 'Banco Master · Cidades do Mundo',
  title,
  subtitle,
}: {
  kicker?: string
  title: string
  subtitle?: string
}) {
  return (
    <header className="px-5 pt-5 text-center">
      <p className="label text-brass/90 tracking-caps text-[0.6rem]">{kicker}</p>
      <h2 className="display text-3xl leading-none mt-2">{title}</h2>
      {subtitle && <p className="text-starlight-muted text-[0.8rem] leading-snug mt-1.5">{subtitle}</p>}
      <OrnamentRule className="mt-4" />
    </header>
  )
}
