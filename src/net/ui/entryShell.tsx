// Casca das telas de ENTRADA (home, identidade, sala, reentrada). O cenário acompanha o
// tema do app: Atlas recebe uma carta de ESPAÇO AÉREO (rotas, pista e aeronaves);
// Fuligem reutiliza seu pátio de fábricas. Essa escolha acontece aqui porque as telas depois
// da home também passam por `EntryStage` — deixar o palco fixo no Atlas vazava um tema no
// outro.
import { createContext, lazy, Suspense, useContext, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { motion, useMotionValue, useSpring, useTransform, type MotionValue } from 'motion/react'
import { importWithReload } from '@/app/lazyImportRecovery'
import { cn } from '@/lib/utils'
import { useMotion } from '@/game/ui/motion'
import { useBoardTheme, useMapCatalog } from '@/game/ui/theme/boardTheme'
import { AtlasCityscape } from './home/AtlasCityscape'

type FuligemModule = typeof import('./home/FuligemBackdrop')
let fuligemModule: Promise<{ default: FuligemModule['FuligemBackdrop'] }> | null = null
const FuligemBackdrop = lazy(() => {
  fuligemModule ??= importWithReload(() =>
    import('./home/FuligemBackdrop').then((module) => ({ default: module.FuligemBackdrop })),
  )
  return fuligemModule
})

const RUNWAY_LIGHTS = [578, 628, 680, 734, 790, 848] as const

// Aeronave em perspectiva lateral 3/4: a asa próxima é maior, a asa oposta recua,
// a fuselagem tem ventre e linha de luz, e as turbinas aparecem sob as asas. O pai
// segue a rota; só o miolo oscila, mantendo a animação em transform/opacity.
// Exportada porque o palco do tabuleiro (boards/StageBackdrop) voa a mesma frota.
export function AirlinerMark({ scale, facing }: { scale: number; facing: 1 | -1 }) {
  const windows = [-32, -21, -10, 1, 12, 23, 34]
  return (
    <g transform={`scale(${scale * facing} ${scale})`}>
      <g className="entry-aircraft__airframe">
        <g className="entry-aircraft__wake" stroke="currentColor" strokeLinecap="round">
          <path d="M-154 1H-61" strokeWidth="1.35" strokeDasharray="22 12" />
          <path d="M-142 7H-56" strokeWidth="1.1" strokeDasharray="17 13" opacity="0.65" />
        </g>

        {/* Asa distante e estabilizador traseiro: menos contraste cria a
            profundidade antes mesmo da asa dianteira aparecer. */}
        <g fill="var(--color-ink-700)" fillOpacity="0.78" stroke="currentColor" strokeLinejoin="round">
          <path d="M5-5-27-30-10-34 37-4 23-1Z" strokeWidth="1.05" />
          <path d="M-39 1-58-14-47-17-25 3Z" strokeWidth="1" />
        </g>

        {/* Cauda vertical atrás da fuselagem. */}
        <path
          d="M-49 4-62-25-49-28-27 5Z"
          fill="var(--color-ink-700)"
          fillOpacity="0.92"
          stroke="currentColor"
          strokeWidth="1.15"
          strokeLinejoin="round"
        />

        {/* Corpo curvo, visto ligeiramente de baixo. */}
        <g stroke="currentColor" strokeLinejoin="round">
          <path
            d="M-63 4C-48-4-22-8 17-9 39-9 56-5 67 0L74 4 66 8C45 13-36 15-58 10Z"
            fill="var(--color-ink-800)"
            fillOpacity="0.96"
            strokeWidth="1.4"
          />
          <path d="M-51 1C-17-7 38-8 62-1" fill="none" stroke="var(--color-starlight)" strokeOpacity="0.34" strokeWidth="1" />
          <path d="M-54 10C-17 14 40 11 65 7" fill="none" stroke="var(--color-ink-950)" strokeOpacity="0.75" strokeWidth="2" />
        </g>

        {/* Asa dianteira domina a silhueta e traz as duas turbinas visíveis. */}
        <path
          d="M8 7-26 34-7 38 42 7 25 4Z"
          fill="var(--color-ink-900)"
          fillOpacity="0.98"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinejoin="round"
        />
        <path
          d="M-37 7-58 20-45 23-23 10Z"
          fill="var(--color-ink-900)"
          stroke="currentColor"
          strokeWidth="1.05"
          strokeLinejoin="round"
        />
        <g fill="var(--color-ink-950)" stroke="currentColor" strokeWidth="1">
          <g transform="translate(4 23) rotate(-7)">
            <path d="M-9-3C-5-6 8-6 12-2V3C7 6-5 6-9 3Z" />
            <ellipse cx="10.5" cy="0.5" rx="2.8" ry="3.4" fill="var(--color-brass-soft)" fillOpacity="0.55" />
          </g>
          <g transform="translate(27 13) rotate(-5) scale(.82)">
            <path d="M-9-3C-5-6 8-6 12-2V3C7 6-5 6-9 3Z" />
            <ellipse cx="10.5" cy="0.5" rx="2.8" ry="3.4" fill="var(--color-brass-soft)" fillOpacity="0.5" />
          </g>
        </g>

        <g fill="var(--color-brass-glow)" stroke="none" opacity="0.72">
          {windows.map((cx) => (
            <rect key={cx} x={cx} y="-2.3" width="4.6" height="2.4" rx="1" />
          ))}
          <path d="M48-4 58-2 62 0 49-0.5Z" />
        </g>

        <circle className="entry-aircraft__beacon" cx="-26" cy="35" r="2.5" fill="var(--color-signal-glow)" />
        <circle className="entry-aircraft__beacon entry-aircraft__beacon--alt" cx="-27" cy="-30" r="2.2" fill="var(--color-starlight)" />
      </g>
    </g>
  )
}

const FLIGHT_ROUTES = [
  {
    // A curva inteira fica acima da fachada mais alta (topo a y=546), já
    // considerando a envergadura. Antes ela descia a y=750 e o avião parecia
    // atravessar os prédios.
    d: 'M-170 462C170 360 380 462 650 360S1080 168 1580 246',
    duration: '58s',
    delay: '-23s',
    rest: '39%',
    scale: 1.04,
    opacity: 0.58,
    facing: 1,
  },
  {
    d: 'M1570 72C1240 142 1015 42 740 96S280 210-150 132',
    duration: '78s',
    delay: '-34s',
    rest: '48%',
    scale: 0.78,
    opacity: 0.44,
    facing: -1,
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
          <g
            className="entry-flyer entry-aircraft"
            opacity={route.opacity}
            style={{
              offsetPath: `path('${route.d}')`,
              // A rota distante corre da direita para a esquerda. Espelhar o
              // avião e mantê-lo nivelado evita que a vista lateral fique de
              // cabeça para baixo, efeito que a rotação automática de 180° causaria.
              offsetRotate: route.facing === 1 ? 'auto' : '0deg',
              offsetDistance: route.rest,
              animationDuration: route.duration,
              animationDelay: route.delay,
            }}
          >
            <AirlinerMark scale={route.scale} facing={route.facing} />
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
        theme === 'fuligem' && 'fuligem-stage',
      )}
      onPointerMove={track}
    >
      <ParallaxCtx.Provider value={theme === 'atlas' && !reduced ? { x: px, y: py } : null}>
        {theme === 'fuligem' ? (
          <Suspense fallback={<div className="fuligem-sky pointer-events-none fixed inset-0" aria-hidden="true" />}>
            <FuligemBackdrop />
          </Suspense>
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
      className={cn('atlas-surface atlas-surface--entry entry-panel w-full', className)}
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
  kicker,
  title,
  subtitle,
}: {
  kicker?: string
  title: string
  subtitle?: string
}) {
  const catalog = useMapCatalog()
  return (
    <header className="px-5 pt-5 text-center">
      <p className="label text-brass/90 tracking-caps text-[0.6rem]">
        {kicker ?? `Magnata Imobiliário · ${catalog.name}`}
      </p>
      <h2 className="display text-3xl leading-none mt-2">{title}</h2>
      {subtitle && <p className="text-starlight-muted text-[0.8rem] leading-snug mt-1.5">{subtitle}</p>}
      <OrnamentRule className="mt-4" />
    </header>
  )
}
