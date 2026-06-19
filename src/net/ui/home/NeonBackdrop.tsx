// Cenário compartilhado do Fliperama Neon. A home e todas as telas de entrada
// (identidade, lobby, erro e reentrada) usam exatamente este palco, evitando que
// a carta de aviação do Atlas apareça só porque a tela não é a home.

const NEON_WINDOW = ['skyblue', 'pink', 'yellow', 'purple', 'orange'] as const
const PATTERN_W = 1440

function seeded(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

interface Tower {
  x: number
  w: number
  h: number
  mast: boolean
  lights: { x: number; y: number; hue: string; delay: number; flicker: boolean }[]
}

function towers(seed: number, minH: number, maxH: number): Tower[] {
  const rnd = seeded(seed)
  const out: Tower[] = []
  let x = 0

  while (x < PATTERN_W - 160) {
    const w = (6 + Math.round(rnd() * 9)) * 8
    const h = (Math.round(minH / 8) + Math.round((rnd() * (maxH - minH)) / 8)) * 8
    const lights: Tower['lights'] = []

    for (let ly = 16; ly < h - 16; ly += 24) {
      for (let lx = 8; lx < w - 12; lx += 24) {
        if (rnd() > 0.34) {
          const hue = `var(--color-group-${NEON_WINDOW[Math.floor(rnd() * NEON_WINDOW.length)]})`
          const delay = Math.round(rnd() * 7000)
          lights.push({
            x: lx,
            y: ly,
            hue,
            delay,
            // A cidade continua viva sem manter centenas de timelines individuais.
            // O delay semeado também decide a amostra, preservando o cenário determinístico.
            flicker: delay % 9 === 0,
          })
        }
      }
    }

    out.push({ x, w, h, mast: rnd() > 0.72, lights })
    x += w + 8 + Math.round(rnd() * 2) * 8
  }

  return out
}

const FAR = towers(90210, 72, 152)
const NEAR = towers(31337, 88, 184)

function TowerBand({
  list,
  base,
  opacity,
  ink,
  className,
}: {
  list: Tower[]
  base: number
  opacity: number
  ink: string
  className: string
}) {
  const band = (offset: number) => (
    <g key={offset} transform={`translate(${offset} 0)`}>
      {list.map((tower) => (
        <g key={`${offset}-${tower.x}`} transform={`translate(${tower.x} ${base - tower.h})`}>
          <rect width={tower.w} height={tower.h + 16} fill={ink} />
          <rect
            width={tower.w}
            height={tower.h}
            fill="none"
            stroke="var(--color-group-purple)"
            strokeOpacity="0.5"
            strokeWidth="1"
          />
          {tower.mast && (
            <>
              <rect
                x={Math.round((tower.w * 0.28) / 8) * 8}
                y={-96}
                width={Math.round((tower.w * 0.44) / 8) * 8}
                height={96}
                fill={ink}
              />
              <rect
                x={Math.round((tower.w * 0.28) / 8) * 8}
                y={-96}
                width={Math.round((tower.w * 0.44) / 8) * 8}
                height={96}
                fill="none"
                stroke="var(--color-group-purple)"
                strokeOpacity="0.5"
                strokeWidth="1"
              />
              <path
                d={`M${tower.w / 2} -96v-24`}
                stroke="var(--color-group-pink)"
                strokeOpacity="0.6"
                strokeWidth="2"
              />
              <rect
                className="neon-beacon"
                x={tower.w / 2 - 4}
                y={-128}
                width="8"
                height="8"
                fill="var(--color-group-red)"
              />
            </>
          )}
          {tower.lights.map((light) => (
            <rect
              key={`${light.x}-${light.y}`}
              className={light.flicker ? 'neon-window' : undefined}
              x={light.x}
              y={light.y}
              width="8"
              height="8"
              fill={light.hue}
              style={light.flicker ? { animationDelay: `${light.delay}ms` } : undefined}
            />
          ))}
        </g>
      ))}
    </g>
  )

  return (
    <g className={className} opacity={opacity}>
      {[0, PATTERN_W].map(band)}
    </g>
  )
}

const COINS = Array.from({ length: 10 }, (_, i) => {
  const rnd = seeded(555 + i * 31)
  return {
    left: `${4 + Math.round(rnd() * 92)}%`,
    delay: `${-Math.round(rnd() * 9000)}ms`,
    dur: `${5 + Math.round(rnd() * 6)}s`,
  }
})

export function NeonBackdrop() {
  return (
    <div
      className="pointer-events-none fixed inset-0 overflow-hidden"
      data-entry-backdrop="neon"
      aria-hidden="true"
    >
      <div className="neon-sky" />
      <div className="neon-sun" />
      <svg
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMax slice"
        className="absolute inset-0 h-full w-full"
      >
        <TowerBand
          list={FAR}
          base={556}
          opacity={0.5}
          ink="#160c2e"
          className="neon-scroll neon-scroll--far"
        />
        <TowerBand
          list={NEAR}
          base={604}
          opacity={0.92}
          ink="#0b0620"
          className="neon-scroll neon-scroll--near"
        />
      </svg>
      <div className="neon-floor" />
      <div className="neon-haze" />
      {COINS.map((coin) => (
        <span
          key={coin.left + coin.delay}
          className="neon-coin"
          style={{ left: coin.left, animationDelay: coin.delay, animationDuration: coin.dur }}
        />
      ))}
      <div className="neon-scan" />
      <div className="neon-roll" />
      <div className="neon-crt" />
    </div>
  )
}
