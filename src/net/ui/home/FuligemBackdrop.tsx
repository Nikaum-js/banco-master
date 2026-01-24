// Cenário da Cidade da Fuligem (055/D-069). A home e todas as telas de entrada
// (identidade, lobby, erro e reentrada) usam exatamente este palco — o mesmo papel que o
// cenário do Atlas cumpre no outro mapa.
//
// A cidade em planos: fábricas ao fundo (fuligem clara), o COMPLEXO PRINCIPAL à frente com
// as janelas de fornalha, chaminés soltando fumaça devagar, trilhos com um trem de carga
// cruzando o horizonte, postes elétricos antigos e névoa por cima. Disciplina de
// desempenho (FR-012): gerador semeado e determinístico, POUCOS elementos animados (fumaça
// = 9 sopros, trem = 1 grupo, fornalhas piscando = amostra pequena), tudo por
// transform/opacity em classes CSS que congelam sob prefers-reduced-motion.
//
// NO LOBBY, a fábrica é o placar da mesa: cada assento ocupado acende uma seção do
// complexo principal na cor daquele jogador (estado → luz; sem timeline por janela).
import { useRoomStore } from '@/net/roomStore'

const PATTERN_W = 1440

function seeded(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

interface Mill {
  x: number
  w: number
  h: number
  stack: boolean
  windows: { x: number; y: number; flicker: boolean; delay: number }[]
}

// Fábricas de um plano: blocos com telhado em dente de serra, algumas com chaminé.
function mills(seed: number, minH: number, maxH: number, windowOdds: number): Mill[] {
  const rnd = seeded(seed)
  const out: Mill[] = []
  let x = 8
  while (x < PATTERN_W - 140) {
    const w = (10 + Math.round(rnd() * 10)) * 8
    const h = (Math.round(minH / 8) + Math.round((rnd() * (maxH - minH)) / 8)) * 8
    const windows: Mill['windows'] = []
    for (let wy = 20; wy < h - 14; wy += 30) {
      for (let wx = 10; wx < w - 14; wx += 26) {
        if (rnd() > windowOdds) {
          const delay = Math.round(rnd() * 9000)
          windows.push({ x: wx, y: wy, flicker: delay % 11 === 0, delay })
        }
      }
    }
    out.push({ x, w, h, stack: rnd() > 0.55, windows })
    x += w + 10 + Math.round(rnd() * 3) * 8
  }
  return out
}

const FAR = mills(4451, 96, 176, 0.62)
const NEAR = mills(7817, 120, 220, 0.55)

// Sopros de fumaça: TRÊS chaminés do plano próximo, três sopros cada (9 elementos no
// total). O delay negativo espalha a fase; a animação vive na classe `.fuligem-smoke`.
const SMOKE_STACKS = [0, 2, 4]

function sawtooth(width: number): string {
  const teeth = Math.max(2, Math.floor(width / 28))
  const step = width / teeth
  let d = `M0 0`
  for (let i = 0; i < teeth; i++) d += ` l${step * 0.6} -12 l${step * 0.4} 12`
  return d
}

function MillBand({ list, base, ink, className, opacity }: {
  list: Mill[]
  base: number
  ink: string
  className?: string
  opacity: number
}) {
  return (
    <g className={className} opacity={opacity}>
      {list.map((mill, index) => (
        <g key={mill.x} transform={`translate(${mill.x} ${base - mill.h})`}>
          <rect width={mill.w} height={mill.h + 16} fill={ink} />
          <path d={sawtooth(mill.w)} fill={ink} stroke="none" />
          {mill.stack && (
            <>
              <path d={`M${mill.w * 0.72} 0 l3 -${52 + (index % 3) * 14} h12 l3 ${52 + (index % 3) * 14}`} fill={ink} />
              {SMOKE_STACKS.includes(index) && (
                <g
                  className="fuligem-smoke"
                  style={{ animationDelay: `${-index * 5200}ms` }}
                  transform={`translate(${mill.w * 0.72 + 9} ${-(56 + (index % 3) * 14)})`}
                >
                  <circle r="7" cy="0" fill="var(--color-starlight)" opacity="0.10" />
                  <circle r="10" cy="-16" fill="var(--color-starlight)" opacity="0.07" />
                  <circle r="14" cy="-36" fill="var(--color-starlight)" opacity="0.045" />
                </g>
              )}
            </>
          )}
          {mill.windows.map((win) => (
            <rect
              key={`${win.x}-${win.y}`}
              className={win.flicker ? 'fuligem-furnace' : undefined}
              x={win.x}
              y={win.y}
              width="10"
              height="7"
              fill="var(--color-brass)"
              opacity="0.8"
              style={win.flicker ? { animationDelay: `${win.delay}ms` } : undefined}
            />
          ))}
        </g>
      ))}
    </g>
  )
}

// O COMPLEXO PRINCIPAL — a fábrica do lobby, com oito seções de janela (uma por assento).
// Sem sala (home), as seções ficam apagadas: vidro escuro.
function MainWorks({ seatColors, gatesOpen }: { seatColors: (string | null)[]; gatesOpen: boolean }) {
  const x = 470
  const base = 700
  const w = 500
  const h = 168
  return (
    <g transform={`translate(${x} ${base - h})`}>
      <rect width={w} height={h + 20} fill="#070605" />
      <path d={sawtooth(w)} fill="#070605" />
      {/* portões centrais — abrem na transição lobby → partida (CSS, congela sob
          movimento reduzido: o fato "aberto/fechado" permanece via data-open) */}
      <g className="fuligem-gates" data-open={gatesOpen ? '' : undefined}>
        <rect x={w / 2 - 34} y={h - 62} width={32} height={62} fill="#0f0c09" stroke="var(--color-brass)" strokeOpacity="0.35" strokeWidth="1.5" />
        <rect x={w / 2 + 2} y={h - 62} width={32} height={62} fill="#0f0c09" stroke="var(--color-brass)" strokeOpacity="0.35" strokeWidth="1.5" />
      </g>
      {/* oito seções de janela: assento ocupado acende na cor do jogador */}
      {Array.from({ length: 8 }, (_, i) => {
        const sx = 18 + i * 58
        const lit = seatColors[i]
        return (
          <g key={i} data-fuligem-seat={i} data-lit={lit ? '' : undefined}>
            <rect x={sx} y={26} width={40} height={30} rx={2}
              fill={lit ?? '#0d0a08'}
              opacity={lit ? 0.92 : 1}
              stroke={lit ? 'none' : 'rgb(240 231 212 / 0.08)'}
            />
            <path d={`M${sx} 41h40M${sx + 13} 26v30M${sx + 27} 26v30`} stroke="#070605" strokeWidth="2" />
            {lit && <rect x={sx - 4} y={22} width={48} height={38} rx={4} fill={lit} opacity="0.18" />}
          </g>
        )
      })}
      {/* chaminé-mestra */}
      <path d="M64 0l4 -84h16l4 84" fill="#070605" />
      <g className="fuligem-smoke" style={{ animationDelay: '-2600ms' }} transform="translate(76 -90)">
        <circle r="8" cy="0" fill="var(--color-starlight)" opacity="0.1" />
        <circle r="12" cy="-20" fill="var(--color-starlight)" opacity="0.06" />
        <circle r="16" cy="-42" fill="var(--color-starlight)" opacity="0.04" />
      </g>
    </g>
  )
}

// Postes elétricos antigos ligados por catenárias — a eletricidade chegando (estático).
function PowerPoles() {
  const poles = [140, 420, 760, 1080, 1360]
  return (
    <g stroke="#0a0807" strokeWidth="5" opacity="0.9">
      {poles.map((x) => (
        <g key={x}>
          <path d={`M${x} 828V678`} />
          <path d={`M${x - 26} 694h52M${x - 18} 710h36`} strokeWidth="4" />
        </g>
      ))}
      <path
        d={poles.slice(0, -1).map((x, i) => `M${x} 696 Q ${(x + poles[i + 1]) / 2} 726 ${poles[i + 1]} 696`).join(' ')}
        fill="none"
        stroke="#0a0807"
        strokeWidth="1.6"
      />
    </g>
  )
}

// Trem de carga cruzando ao fundo — UM grupo, uma animação de transform bem lenta.
function CargoTrain() {
  const cars = [0, 62, 124, 186, 248]
  return (
    <g className="fuligem-train" aria-hidden="true">
      <g fill="#080606">
        <rect x="-320" y="666" width="74" height="26" rx="3" />
        <rect x="-306" y="650" width="26" height="18" rx="2" />
        <circle cx="-300" cy="694" r="6" fill="#050403" />
        <circle cx="-262" cy="694" r="6" fill="#050403" />
        {cars.map((dx) => (
          <g key={dx}>
            <rect x={-238 + dx} y="672" width="54" height="20" rx="2" />
            <circle cx={-228 + dx} cy="694" r="5" fill="#050403" />
            <circle cx={-194 + dx} cy="694" r="5" fill="#050403" />
          </g>
        ))}
        <rect x="-310" y="644" width="8" height="8" fill="var(--color-brass)" opacity="0.85" />
      </g>
    </g>
  )
}

export function FuligemBackdrop({ className }: { className?: string }) {
  // Só o lobby/partida têm sala; na home o seletor devolve null e as seções ficam apagadas.
  const seats = useRoomStore((s) => s.room?.seats)
  const status = useRoomStore((s) => s.room?.status)
  const seatColors = Array.from({ length: 8 }, (_, i) => seats?.[i]?.color ?? null)
  const gatesOpen = status !== undefined && status !== 'lobby'

  return (
    <div
      className={`pointer-events-none fixed inset-0 overflow-hidden ${className ?? ''}`}
      data-entry-backdrop="fuligem"
      aria-hidden="true"
    >
      <div className="fuligem-sky" />
      <svg
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMax slice"
        className="absolute inset-0 h-full w-full"
      >
        <MillBand list={FAR} base={620} ink="#0d0b09" opacity={0.5} />
        <CargoTrain />
        <line x1="0" y1="700" x2="1440" y2="700" stroke="#0a0807" strokeWidth="3" />
        <MillBand list={NEAR} base={760} ink="#070605" opacity={0.96} />
        <MainWorks seatColors={seatColors} gatesOpen={gatesOpen} />
        <PowerPoles />
      </svg>
      <div className="fuligem-haze" />
      <div className="fuligem-vignette" />
    </div>
  )
}
