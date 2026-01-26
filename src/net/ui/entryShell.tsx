// Casca das telas de ENTRADA (home, identidade, sala, reentrada) — a "sala de mapas" do
// Atlas da Meia-Noite. Antes, essas telas pintavam um `bg-coffee-950` chapado por cima do
// graticule que o body já desenha e reusavam a casca de modal do jogo (faixa dourada de
// ModalHeader) — genérico e fora do mundo do tabuleiro. Aqui o palco é TRANSPARENTE (a
// carta náutica do fundo aparece) e vira uma CENA VIVA: rotas com aviões em voo, uma
// trilha de tabuleiro cruzando o rodapé com um token passeando, balão subindo, nuvens à
// deriva, marcos de cidades e coordenadas de carta — tudo em latão apagado, atrás do
// conteúdo. O painel (.entry-panel, index.css) carrega as marcas de registro dos cantos —
// o mesmo cromo das casas do tabuleiro.
//
// Movimento: CSS Motion Path (`offset-path`/`.entry-flyer`) — SMIL dinâmico congela no
// Chromium. Tudo decorativo: some sob `prefers-reduced-motion` (voadores) ou congela de
// forma composta (nuvens), e nada disso entra na árvore de acessibilidade.
import type { ReactNode } from 'react'
import { motion } from 'motion/react'
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
// Aviões — a silhueta da peça `aviao` (pieceGlyphs), centrada e apontando +x,
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
// Trilha de tabuleiro — um CAMINHO de casas serpenteando pelo rodapé inteiro da
// carta, com a stripe colorida dos grupos, dados e cartas largados ao lado e um
// token de latão passeando de casa em casa. As posições saem das mesmas bézieres
// que o token percorre — a trilha e o passeio nunca desgarram.
// ---------------------------------------------------------------------
type Pt = { x: number; y: number }
const TRAIL_SEGS: [Pt, Pt, Pt, Pt][] = [
  [{ x: -30, y: 850 }, { x: 180, y: 740 }, { x: 300, y: 900 }, { x: 520, y: 810 }],
  [{ x: 520, y: 810 }, { x: 740, y: 720 }, { x: 820, y: 900 }, { x: 1040, y: 800 }],
  [{ x: 1040, y: 800 }, { x: 1260, y: 700 }, { x: 1360, y: 880 }, { x: 1520, y: 790 }],
]
const TRAIL_GROUPS = ['brown', 'skyblue', 'pink', 'orange', 'red', 'yellow', 'green', 'navy', 'purple'] as const

function cubicAt([p0, p1, p2, p3]: [Pt, Pt, Pt, Pt], t: number): { x: number; y: number; angle: number } {
  const u = 1 - t
  const x = u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x
  const y = u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y
  const dx = 3 * u * u * (p1.x - p0.x) + 6 * u * t * (p2.x - p1.x) + 3 * t * t * (p3.x - p2.x)
  const dy = 3 * u * u * (p1.y - p0.y) + 6 * u * t * (p2.y - p1.y) + 3 * t * t * (p3.y - p2.y)
  return { x, y, angle: (Math.atan2(dy, dx) * 180) / Math.PI }
}

// Carta de propriedade em miniatura — retrato com stripe de grupo no topo.
function CardMark({ group }: { group: (typeof TRAIL_GROUPS)[number] }) {
  return (
    <g stroke="currentColor" strokeWidth="1.2">
      <rect x="-13" y="-18" width="26" height="36" rx="2" />
      <rect x="-13" y="-18" width="26" height="9" fill={`var(--color-group-${group})`} opacity="0.45" stroke="none" />
      <g opacity="0.6">
        <line x1="-8" y1="-2" x2="8" y2="-2" />
        <line x1="-8" y1="4" x2="8" y2="4" />
        <line x1="-8" y1="10" x2="4" y2="10" />
      </g>
    </g>
  )
}

// Dado — quadrado arredondado com pips.
function DieMark({ pips }: { pips: [number, number][] }) {
  return (
    <g stroke="currentColor" strokeWidth="1.2">
      <rect x="-11" y="-11" width="22" height="22" rx="3.5" />
      <g fill="currentColor" stroke="none">
        {pips.map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="1.8" />
        ))}
      </g>
    </g>
  )
}

// Uma casa da trilha, com a ANATOMIA das casas do tabuleiro de verdade: stripe do grupo
// com filete de separação, "linhas de texto" (nome/aluguel), risco de preço no rodapé e —
// em algumas — construção em cima da stripe (casas verdes, hotel vermelho, como no jogo).
// A cada 8, uma casa ESPECIAL de canto, maior: moeda de GO, carta de sorte, dados.
const TRAIL_SPECIALS = ['coin', 'carta', 'dice'] as const

function TrailHouse({ x = 0, wide = false }: { x?: number; wide?: boolean }) {
  return wide ? (
    <path d="M-5 -9v-5l5-4 5 4v5Z" transform={`translate(${x} 0)`} fill="var(--color-group-red)" fillOpacity="0.55" strokeWidth="1" />
  ) : (
    <path d="M-4 -9v-4l4-3.5 4 3.5v4Z" transform={`translate(${x} 0)`} fill="var(--color-group-green)" fillOpacity="0.55" strokeWidth="1" />
  )
}

function TrailSquare({ i }: { i: number }) {
  const special = i % 8 === 0 ? TRAIL_SPECIALS[Math.floor(i / 8) % TRAIL_SPECIALS.length] : null

  if (special) {
    // casa de canto — maior, moldura dupla, motivo no centro
    return (
      <>
        <rect x="-21" y="-21" width="42" height="42" rx="2" strokeWidth="1.4" />
        <rect x="-17.5" y="-17.5" width="35" height="35" strokeWidth="0.6" opacity="0.6" />
        {special === 'coin' && (
          <>
            <circle r="10" strokeWidth="1.3" />
            <circle r="7.2" strokeWidth="0.6" strokeDasharray="1.5 2.2" />
            <path d="M-4 -2h8M-4 2h8" strokeWidth="1.2" />
          </>
        )}
        {special === 'carta' && (
          <g transform="rotate(8)">
            <rect x="-7.5" y="-10" width="15" height="20" rx="1.5" strokeWidth="1.2" />
            <path d="M0 -4 3.2 0 0 4 -3.2 0Z" strokeWidth="0.9" />
          </g>
        )}
        {special === 'dice' && (
          <g transform="rotate(-7)">
            <rect x="-9.5" y="-9.5" width="19" height="19" rx="3" strokeWidth="1.2" />
            <g fill="currentColor" stroke="none">
              <circle cx="-4.2" cy="-4.2" r="1.7" />
              <circle cx="0" cy="0" r="1.7" />
              <circle cx="4.2" cy="4.2" r="1.7" />
            </g>
          </g>
        )}
      </>
    )
  }

  return (
    <>
      <rect x="-18" y="-18" width="36" height="36" rx="2" strokeWidth="1.3" />
      <rect x="-15" y="-15" width="30" height="30" strokeWidth="0.55" opacity="0.5" />
      {/* stripe do grupo + filete de separação */}
      <rect x="-18" y="-18" width="36" height="10" fill={`var(--color-group-${TRAIL_GROUPS[i % TRAIL_GROUPS.length]})`} opacity="0.75" stroke="none" />
      <line x1="-18" y1="-8" x2="18" y2="-8" strokeWidth="0.9" opacity="0.8" />
      {/* construções sobre a stripe */}
      {i % 4 === 2 && <TrailHouse />}
      {i % 8 === 6 && (
        <>
          <TrailHouse x={-9} />
          <TrailHouse x={9} wide />
        </>
      )}
      {/* linhas de "texto" — nome e aluguel */}
      <line x1="-12" y1="-1" x2="12" y2="-1" strokeWidth="1.1" opacity="0.7" />
      <line x1="-9" y1="4.5" x2="9" y2="4.5" strokeWidth="1.1" opacity="0.45" />
      {/* risco de preço no rodapé */}
      <path d="M-8 12h2.5M-3.5 12h7M5.5 12h2.5" strokeWidth="1.2" opacity="0.75" />
    </>
  )
}

function BoardTrail({ className }: { className?: string }) {
  const squares = TRAIL_SEGS.flatMap((seg, si) =>
    Array.from({ length: 11 }, (_, i) => i)
      .filter((i) => si === 0 || i > 0) // a junta entre segmentos é a mesma casa — não duplicar
      .map((i) => cubicAt(seg, i / 10)),
  )
  return (
    <svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" fill="none" className={className} aria-hidden="true">
      {squares.map((s, i) => (
        <g key={i} transform={`translate(${s.x} ${s.y}) rotate(${s.angle})`} opacity="0.35" stroke="currentColor">
          <TrailSquare i={i} />
        </g>
      ))}

      {/* dados e cartas largados na mesa, ao lado da trilha */}
      <g opacity="0.3">
        <g transform="translate(212 652) rotate(-14)">
          <DieMark pips={[[-4.5, -4.5], [4.5, 4.5]]} />
        </g>
        <g transform="translate(246 668) rotate(11)">
          <DieMark pips={[[-4.5, -4.5], [4.5, -4.5], [0, 0], [-4.5, 4.5], [4.5, 4.5]]} />
        </g>
        <g transform="translate(1178 648) rotate(-9)">
          <CardMark group="green" />
        </g>
        <g transform="translate(1214 660) rotate(7)">
          <CardMark group="navy" />
        </g>
      </g>
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
// Palco de tela cheia: transparente sobre o graticule do body, com a cena
// decorativa fixa e o conteúdo centralizado (rola quando não cabe).
// ---------------------------------------------------------------------
export function EntryStage({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto overscroll-contain">
      <div className="pointer-events-none fixed inset-0" aria-hidden="true">
        <AtlasScenery className="absolute inset-0 w-full h-full text-brass" />
        <SkyRoutes className="absolute inset-0 w-full h-full text-brass" />
        <CompassRose size="min(72vmin, 560px)" className="absolute -right-[10vmin] -bottom-[14vmin] text-brass opacity-[0.1]" />
        <CompassRose size="24vmin" className="absolute left-[3vmin] top-[5vmin] text-brass opacity-[0.06]" />
        <BoardTrail className="absolute inset-0 w-full h-full text-brass" />
      </div>
      <div className="relative min-h-full flex flex-col items-center justify-center gap-7 p-4 py-10">{children}</div>
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
