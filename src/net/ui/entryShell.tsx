// Casca das telas de ENTRADA (home, identidade, sala, reentrada). O cenário acompanha o
// tema do app: Atlas recebe uma carta de ESPAÇO AÉREO (rotas, radar, pista e aeronaves);
// Neon reutiliza sua metrópole arcade. Essa escolha acontece aqui porque as telas depois
// da home também passam por `EntryStage` — deixar o palco fixo no Atlas vazava um tema no
// outro.
import { createContext, useContext, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { motion, useMotionValue, useSpring, useTransform, type MotionValue } from 'motion/react'
import { cn } from '@/lib/utils'
import { useMotion } from '@/game/ui/motion'
import { useBoardTheme } from '@/game/ui/theme/boardTheme'
import { AtlasCityscape } from './home/AtlasCityscape'
import { NeonBackdrop } from './home/NeonBackdrop'

const RADAR_TICKS = Array.from({ length: 48 }, (_, i) => i * 7.5)
const RUNWAY_LIGHTS = [578, 628, 680, 734, 790, 848] as const

function RadarScope({ x, y, scale }: { x: number; y: number; scale: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} stroke="currentColor">
      <circle r="160" strokeWidth="1" opacity="0.23" />
      <circle r="112" strokeWidth="0.8" strokeDasharray="3 7" opacity="0.18" />
      <circle r="62" strokeWidth="0.8" opacity="0.18" />
      <path d="M-160 0H160M0-160V160M-113-113 113 113M113-113-113 113" strokeWidth="0.65" opacity="0.12" />
      <g opacity="0.27">
        {RADAR_TICKS.map((angle) => (
          <line
            key={angle}
            x1="0"
            y1="-160"
            x2="0"
            y2={angle % 45 === 0 ? -149 : -154}
            transform={`rotate(${angle})`}
          />
        ))}
      </g>
      <path d="M0 0 16-156A157 157 0 0 1 96-126Z" fill="currentColor" fillOpacity="0.035" stroke="none" />
      <g fill="currentColor" stroke="none" opacity="0.38">
        <circle cx="-76" cy="-54" r="3" />
        <circle cx="46" cy="-96" r="2.5" />
        <circle cx="104" cy="28" r="3" />
      </g>
    </g>
  )
}

// Aeronave top-down: fuselagem, asas enflechadas, estabilizadores, turbinas, janelas,
// cockpit, luzes de navegação e duas trilhas de condensação. O pai segue a rota; só o
// miolo faz a oscilação curta de atitude, mantendo a animação em transform/opacity.
function AirlinerMark({ scale }: { scale: number }) {
  const windows = [-28, -16, -4, 8, 20, 32]
  return (
    <g transform={`scale(${scale})`}>
      <g className="entry-aircraft__airframe">
        <g className="entry-aircraft__wake" stroke="currentColor" strokeLinecap="round">
          <path d="M-126-3H-48" strokeWidth="1.4" strokeDasharray="18 10" />
          <path d="M-126 3H-48" strokeWidth="1.4" strokeDasharray="18 10" />
        </g>

        <g fill="var(--color-ink-900)" fillOpacity="0.88" stroke="currentColor" strokeLinejoin="round">
          <path d="M-9-3-27-34-14-36 20-5 39-3 21-1Z" strokeWidth="1.2" />
          <path d="M-9 3-27 34-14 36 20 5 39 3 21 1Z" strokeWidth="1.2" />
          <path d="M-36-3-49-17-40-19-24-4Z" strokeWidth="1.1" />
          <path d="M-36 3-49 17-40 19-24 4Z" strokeWidth="1.1" />
          <path
            d="M-54-4.5C-37-7 33-7 50-4.2L61 0 50 4.2C33 7-37 7-54 4.5L-61 1.2V-1.2Z"
            strokeWidth="1.4"
          />
          <ellipse cx="5" cy="-14" rx="7.5" ry="3.8" strokeWidth="1.1" />
          <ellipse cx="5" cy="14" rx="7.5" ry="3.8" strokeWidth="1.1" />
        </g>

        <g fill="currentColor" stroke="none" opacity="0.68">
          {windows.map((cx) => (
            <g key={cx}>
              <circle cx={cx} cy="-4.7" r="1.05" />
              <circle cx={cx} cy="4.7" r="1.05" />
            </g>
          ))}
          <path d="M43-4.5 50-3.4 53-1.6 43-2Z" />
          <path d="M43 4.5 50 3.4 53 1.6 43 2Z" />
        </g>

        <circle className="entry-aircraft__beacon" cx="-27" cy="-34" r="2.4" fill="var(--color-signal-glow)" />
        <circle className="entry-aircraft__beacon entry-aircraft__beacon--alt" cx="-27" cy="34" r="2.4" fill="var(--color-starlight)" />
      </g>
    </g>
  )
}

const FLIGHT_ROUTES = [
  {
    d: 'M-170 700C170 615 360 750 640 605S1070 300 1580 410',
    duration: '58s',
    delay: '-23s',
    rest: '39%',
    scale: 1.04,
    opacity: 0.52,
    waypoints: [
      [126, 647],
      [398, 682],
      [832, 490],
      [1220, 348],
    ],
  },
  {
    d: 'M1570 72C1240 142 1015 42 740 96S280 210-150 132',
    duration: '78s',
    delay: '-34s',
    rest: '48%',
    scale: 0.78,
    opacity: 0.44,
    waypoints: [
      [1290, 124],
      [940, 72],
      [602, 132],
      [220, 188],
    ],
  },
] as const

function AirspaceRoutes({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {FLIGHT_ROUTES.map((route, index) => (
        <g key={route.d}>
          <path
            d={route.d}
            stroke="currentColor"
            strokeWidth={index === 0 ? 1.8 : 1.25}
            strokeDasharray={index === 0 ? '3 10' : '2 12'}
            strokeLinecap="round"
            opacity={index === 0 ? 0.22 : 0.15}
          />
          {route.waypoints.map(([x, y]) => (
            <g key={`${x}-${y}`} transform={`translate(${x} ${y})`} stroke="currentColor" opacity="0.28">
              <circle r="9" strokeWidth="0.9" strokeDasharray="2 3" />
              <circle r="2.6" fill="currentColor" stroke="none" />
              <path d="M-14 0H-9M9 0h5M0-14v5M0 9v5" strokeWidth="0.8" />
            </g>
          ))}
          <g
            className="entry-flyer entry-aircraft"
            opacity={route.opacity}
            style={{
              offsetPath: `path('${route.d}')`,
              offsetRotate: 'auto',
              offsetDistance: route.rest,
              animationDuration: route.duration,
              animationDelay: route.delay,
            }}
          >
            <AirlinerMark scale={route.scale} />
          </g>
        </g>
      ))}
    </svg>
  )
}

function AviationChart({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="atlas-runway-glow" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.12" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>

      <g stroke="currentColor" opacity="0.1">
        <path d="M0 180H1440M0 450H1440M0 720H1440" strokeWidth="0.8" strokeDasharray="3 15" />
        <path d="M230 0V900M720 0V900M1210 0V900" strokeWidth="0.7" strokeDasharray="2 18" />
        <path d="M0 440h18M0 450h30M0 460h18M1410 440h30M1422 450h18M1410 460h30" />
      </g>

      <RadarScope x={118} y={116} scale={0.9} />
      <RadarScope x={1320} y={782} scale={1.22} />

      <g stroke="currentColor" opacity="0.2">
        <path d="M472 920 676 548M968 920 764 548" strokeWidth="1.3" />
        <path d="M530 814H910M565 750H875M600 686H840M635 622H805" strokeWidth="0.8" />
        <path d="M720 916V558" strokeWidth="1.2" strokeDasharray="24 18" />
        <path d="M689 566h62M696 578h48" strokeWidth="3" />
      </g>
      <path d="M430 900 675 540H765L1010 900Z" fill="url(#atlas-runway-glow)" />
      <g fill="currentColor">
        {RUNWAY_LIGHTS.map((y, index) => {
          const spread = (y - 540) * 0.43
          return (
            <g key={y} className="entry-runway-light" style={{ animationDelay: `${index * 180}ms` }}>
              <circle cx={720 - spread} cy={y} r="2.3" />
              <circle cx={720 + spread} cy={y} r="2.3" />
            </g>
          )
        })}
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
// Palco de tela cheia com cenário escolhido pelo mesmo store que troca o tabuleiro.
// O conteúdo é idêntico; somente a pele decorativa muda.
// ---------------------------------------------------------------------
export function EntryStage({ children }: { children: ReactNode }) {
  const { reduced } = useMotion()
  const theme = useBoardTheme((state) => state.theme)
  const rawX = useMotionValue(0)
  const rawY = useMotionValue(0)
  const lampX = useMotionValue(-9999)
  const lampY = useMotionValue(-9999)
  const px = useSpring(rawX, PARALLAX_SPRING)
  const py = useSpring(rawY, PARALLAX_SPRING)
  const lx = useSpring(lampX, { stiffness: 90, damping: 22, mass: 0.5 })
  const ly = useSpring(lampY, { stiffness: 90, damping: 22, mass: 0.5 })

  function track(e: ReactPointerEvent<HTMLDivElement>): void {
    if (theme !== 'atlas' || reduced || e.pointerType !== 'mouse') return
    rawX.set((e.clientX / window.innerWidth) * 2 - 1)
    rawY.set((e.clientY / window.innerHeight) * 2 - 1)
    lampX.set(e.clientX)
    lampY.set(e.clientY)
  }

  const content = (
    <div className="relative z-40 min-h-full flex flex-col items-center justify-center gap-6 p-4 py-10 [@media(max-height:640px)]:gap-3 [@media(max-height:640px)]:py-4">
      {children}
    </div>
  )

  return (
    <div
      className={cn(
        'fixed inset-0 z-[70] overflow-y-auto overscroll-contain',
        theme === 'neon' && 'neon-stage',
      )}
      onPointerMove={track}
    >
      <ParallaxCtx.Provider value={theme === 'atlas' && !reduced ? { x: px, y: py } : null}>
        {theme === 'neon' ? (
          <NeonBackdrop />
        ) : (
          <div
            className="pointer-events-none fixed inset-0 overflow-hidden"
            data-entry-backdrop="atlas"
            aria-hidden="true"
          >
            <ParallaxLayer depth={9} className="z-10">
              <AviationChart className="absolute inset-0 h-full w-full text-brass" />
            </ParallaxLayer>
            <ParallaxLayer depth={16} className="z-20">
              <AtlasCityscape className="absolute inset-0 h-full w-full text-brass" />
            </ParallaxLayer>
            {/* A aeronave fica depois (e acima) do skyline: ela cruza o céu e
                nunca desaparece atrás de uma fachada alta. */}
            <ParallaxLayer depth={28} className="z-30">
              <AirspaceRoutes className="absolute inset-0 h-full w-full text-brass" />
            </ParallaxLayer>
            {!reduced && <CursorLantern x={lx} y={ly} />}
          </div>
        )}
        {content}
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
