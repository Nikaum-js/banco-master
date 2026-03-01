// PADRÕES DE FUNDO DO MIOLO — card 7 do review de arquitetura (2026-07-25).
//
// Um CENÁRIO por tema, não uma textura: o miolo do tabuleiro é o maior vão vazio da tela,
// e é ali que o tema se apresenta. Antes daqui eram tramas quase invisíveis (opacidade
// ~0.08) — o desenho existia e ninguém via, então o tabuleiro parecia não ter tema nenhum
// enquanto a tela de entrada tinha personalidade de sobra.
//
//   atlas → `ChartPattern` carta náutica: rosa dos ventos graduada, equador, rotas
//   neon  → `GridPattern`  poente synthwave: sol partido, grade em fuga, skyline
//
// Tudo é SVG decorativo, sem lógica, e o conteúdo (dados, histórico) fica por cima com
// fundo próprio. O que gira usa a classe `.bm-spin-slow` (index.css), que para sob
// `prefers-reduced-motion` — SMIL não para, e movimento de fundo não é informação.

// ---------------------------------------------------------------------
// ATLAS — carta náutica noturna
// ---------------------------------------------------------------------

// Fixos de navegação — cruzetas discretas espalhadas pela carta.
const CHART_FIXES: [number, number][] = [
  [12, 16], [30, 9], [68, 12], [88, 20], [9, 55], [92, 58], [16, 84], [45, 92], [80, 86],
]

// Rosa dos ventos: 8 pontas maiores + 8 menores e um aro de 72 traços. Sai de rotação, não
// de polígonos escritos na mão — um ângulo errado apareceria como rosa torta.
const ROSE_MAJOR = [0, 45, 90, 135, 180, 225, 270, 315]
const ROSE_MINOR = [22.5, 67.5, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5]
const ROSE_TICKS = Array.from({ length: 72 }, (_, i) => i * 5)

export function ChartPattern() {
  const grid = [8, 24, 40, 56, 72, 88]
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      {/* graticule — meridianos e paralelos com curvatura sutil */}
      <g stroke="var(--color-starlight)" strokeWidth="0.16" fill="none" opacity="0.12">
        {grid.map((x) => <path key={`m${x}`} d={`M ${x} 0 Q ${x + 3.5} 50 ${x} 100`} />)}
        {grid.map((y) => <path key={`p${y}`} d={`M 0 ${y} Q 50 ${y + 3.5} 100 ${y}`} />)}
      </g>

      {/* Equador graduado — a linha que diz que isto é uma CARTA, não uma grade */}
      <g stroke="var(--color-brass)" opacity="0.22">
        <path d="M 0 50 H 100" strokeWidth="0.18" strokeDasharray="2 2.5" />
        {Array.from({ length: 20 }, (_, i) => i * 5).map((x) => (
          <line key={x} x1={x} y1="49" x2={x} y2="51" strokeWidth={x % 25 === 0 ? 0.3 : 0.14} />
        ))}
      </g>

      {/* ROSA DOS VENTOS — o instrumento no meio da mesa. O aro graduado fica parado e a
          estrela gira: é o mostrador que anda, não a carta. */}
      <g opacity="0.3">
        <circle cx="50" cy="50" r="40" fill="none" stroke="var(--color-brass)" strokeWidth="0.22" />
        <circle cx="50" cy="50" r="37.5" fill="none" stroke="var(--color-brass)" strokeWidth="0.12" strokeDasharray="0.6 1.4" />
        <g stroke="var(--color-brass)">
          {ROSE_TICKS.map((a) => (
            <line
              key={a}
              x1="50"
              y1={a % 45 === 0 ? 10.5 : a % 15 === 0 ? 11.4 : 12.2}
              x2="50"
              y2="13"
              strokeWidth={a % 45 === 0 ? 0.3 : 0.14}
              transform={`rotate(${a} 50 50)`}
            />
          ))}
        </g>
      </g>
      <g className="bm-spin-slow" opacity="0.2" style={{ transformOrigin: '50px 50px' }}>
        {ROSE_MINOR.map((a) => (
          <polygon key={a} points="50,26 51.4,48.6 50,50 48.6,48.6" fill="var(--color-brass)" transform={`rotate(${a} 50 50)`} />
        ))}
        {ROSE_MAJOR.map((a) => (
          <g key={a} transform={`rotate(${a} 50 50)`}>
            <polygon points="50,14 52.6,47.4 50,50 47.4,47.4" fill="var(--color-brass)" />
            <polygon points="50,14 52.6,47.4 50,50" fill="var(--color-brass-glow)" opacity="0.32" />
          </g>
        ))}
        <circle cx="50" cy="50" r="3.2" fill="none" stroke="var(--color-brass)" strokeWidth="0.4" />
        <circle cx="50" cy="50" r="0.9" fill="var(--color-brass-glow)" />
      </g>

      {/* fixos de navegação — cruzetas de posição */}
      <g stroke="var(--color-brass-glow)" strokeWidth="0.28" opacity="0.4" strokeLinecap="round">
        {CHART_FIXES.map(([x, y], i) => (
          <g key={i}>
            <line x1={x - 1.1} y1={y} x2={x + 1.1} y2={y} />
            <line x1={x} y1={y - 1.1} x2={x} y2={y + 1.1} />
          </g>
        ))}
      </g>

      {/* rotas traçadas entre portos, com a proa marcada em cada uma */}
      <g stroke="var(--color-brass)" strokeWidth="0.22" strokeDasharray="1 1.6" fill="none" opacity="0.28">
        <path d="M 12 16 Q 40 26 68 12" />
        <path d="M 9 55 Q 48 62 88 20" />
        <path d="M 16 84 Q 56 68 92 58" />
      </g>
      <g fill="var(--color-brass)" opacity="0.34">
        {([[12, 16], [68, 12], [9, 55], [88, 20], [16, 84], [92, 58]] as const).map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="0.7" />
        ))}
        <polygon points="40,25 42.2,26.4 40,27.8" opacity="0.8" />
        <polygon points="48,61 50.2,62.4 48,63.8" opacity="0.8" />
        <polygon points="56,68 58.2,69.4 56,70.8" opacity="0.8" />
      </g>
    </svg>
  )
}

// ---------------------------------------------------------------------
// FLIPERAMA — o poente synthwave, o mesmo da tela de entrada
// ---------------------------------------------------------------------

const HORIZON = 60
// Skyline em blocos, longe do centro pros dois lados: [x, largura, altura].
const NEON_BLOCKS: [number, number, number][] = [
  [0, 8, 14], [9, 6, 22], [16, 7, 10], [24, 5, 17],
  [71, 6, 16], [78, 7, 11], [86, 6, 21], [93, 7, 13],
]
const NEON_RAYS = Array.from({ length: 13 }, (_, i) => -60 + i * 10)

export function GridPattern() {
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      {/* céu: estrelas ralas no alto */}
      <g fill="var(--color-starlight)" opacity="0.35">
        {([[14, 12], [31, 7], [46, 15], [63, 9], [79, 14], [88, 6], [22, 22], [72, 24]] as const).map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="0.4" />
        ))}
      </g>

      {/* SOL PARTIDO apoiado no horizonte — cúpula com as fendas engrossando pra baixo,
          a mesma da home: é a assinatura do tema. */}
      <defs>
        <linearGradient id="bm-neon-sun" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-group-yellow)" />
          <stop offset="55%" stopColor="var(--color-group-orange)" />
          <stop offset="100%" stopColor="var(--color-group-pink)" />
        </linearGradient>
        <clipPath id="bm-neon-dome">
          <path d={`M 22 ${HORIZON} A 28 28 0 0 1 78 ${HORIZON} Z`} />
        </clipPath>
      </defs>
      <g opacity="0.32">
        <path d={`M 22 ${HORIZON} A 28 28 0 0 1 78 ${HORIZON} Z`} fill="url(#bm-neon-sun)" />
        <g clipPath="url(#bm-neon-dome)" fill="var(--color-ink-950)">
          {[
            [HORIZON - 17, 1.1],
            [HORIZON - 12, 1.6],
            [HORIZON - 7.5, 2.2],
            [HORIZON - 3, 3],
          ].map(([y, h]) => (
            <rect key={y} x="20" y={y} width="60" height={h} />
          ))}
        </g>
      </g>

      {/* skyline nas duas laterais, deixando o meio (onde o sol nasce) livre */}
      <g opacity="0.55">
        {NEON_BLOCKS.map(([x, w, h]) => (
          <g key={`${x}-${h}`}>
            <rect x={x} y={HORIZON - h} width={w} height={h} fill="var(--color-ink-950)" />
            <rect x={x} y={HORIZON - h} width={w} height={h} fill="none" stroke="var(--color-group-purple)" strokeWidth="0.16" opacity="0.7" />
            {[0.3, 0.6].map((f) => (
              <rect key={f} x={x + w * 0.25} y={HORIZON - h + h * f} width="1.1" height="1.1" fill="var(--color-group-skyblue)" opacity="0.8" />
            ))}
          </g>
        ))}
      </g>

      {/* linha do horizonte */}
      <line x1="0" y1={HORIZON} x2="100" y2={HORIZON} stroke="var(--color-group-pink)" strokeWidth="0.3" opacity="0.6" />

      {/* PISO EM GRADE: raios convergindo no ponto de fuga + travessas que se afastam
          (espaçamento crescente é o que faz a fuga; igual vira grade chapada) */}
      <g stroke="var(--color-group-skyblue)" strokeWidth="0.16" opacity="0.4">
        {NEON_RAYS.map((dx) => (
          <line key={dx} x1="50" y1={HORIZON} x2={50 + dx * 2.2} y2="100" />
        ))}
      </g>
      <g stroke="var(--color-group-pink)" strokeWidth="0.16" opacity="0.3">
        {[1.5, 4, 7.5, 12, 17.5, 24, 31.5, 40].map((d) => (
          <line key={d} x1="0" y1={HORIZON + d} x2="100" y2={HORIZON + d} />
        ))}
      </g>
    </svg>
  )
}
