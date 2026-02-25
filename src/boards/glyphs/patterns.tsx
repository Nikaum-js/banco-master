// PADRÕES DE FUNDO DO MIOLO — card 7 do review de arquitetura (2026-07-25).
//
// Um CENÁRIO por tema, não uma textura: o miolo do tabuleiro é o maior vão vazio da tela,
// e é ali que o tema se apresenta. Antes daqui eram tramas quase invisíveis (opacidade
// ~0.08) — o desenho existia e ninguém via, então o tabuleiro parecia não ter tema nenhum
// enquanto a tela de entrada tinha personalidade de sobra.
//
//   atlas   → `ChartPattern`   carta náutica: rosa dos ventos graduada, equador, rotas
//   fuligem → `FoundryPattern` pátio da fábrica: silhueta industrial, ferrovia, engrenagem
//
// Tudo é SVG decorativo, sem lógica, e o conteúdo (dados, histórico) fica por cima com
// fundo próprio. O que gira usa a classe `.bm-spin-slow` (index.css), que para sob
// `prefers-reduced-motion` — SMIL não para, e movimento de fundo não é informação.
import { AirlinerMark } from '@/net/ui/entryShell'

// ---------------------------------------------------------------------
// ATLAS — o mapa selecionado, aberto sobre a mesa
//
// A home vende "Cidades do Mundo" num globo de continentes facetados com a
// malha de rotas acesa (HomeMapPanel). O miolo do tabuleiro é esse mapa
// DESDOBRADO: os continentes no mesmo traço low-poly, as cidades da própria
// mesa como nós, as rotas em operação (tracejado fluindo, avião a caminho) e
// a rosa dos ventos rebaixada a instrumento de canto — antes ela ERA o miolo
// e não contava história nenhuma. Escala gráfica no canto oposto equilibra.
// ---------------------------------------------------------------------

// Continentes facetados — mesmo vocabulário dos landmasses do globo da home
// (segmentos retos, nada de litoral realista). Coordenadas na carta 0-100.
const CHART_LANDS = [
  // América do Norte, descendo pela América Central
  'M6 28 11 19 20 14 29 16 33 22 30 27 24 28 22 33 17 36 19 41 23 46 20 49 16 44 13 38 8 33Z',
  // América do Sul
  'M24 50 30 48 34 52 33 59 29 68 26 74 23 70 22 61 21 54Z',
  // Europa
  'M44 22 48 17 53 15 57 18 55 22 51 24 48 27 44 26Z',
  // África
  'M44 30 52 28 58 31 57 38 54 44 51 52 47 56 43 50 41 42 42 34Z',
  // Ásia, com a península descendo ao sul
  'M58 16 66 12 76 12 85 16 89 22 86 28 80 26 76 32 70 38 68 44 64 46 62 40 60 34 58 28 56 22Z',
  // Japão
  'M88 30 91 27 92 31 89 34Z',
  // Oceania
  'M78 62 85 60 91 64 89 70 82 72 77 68Z',
] as const

// Cidades da mesa sobre a carta. `live` = nó pulsando (hub em operação).
const CHART_CITIES: { x: number; y: number; live?: boolean }[] = [
  { x: 9, y: 27 },              // Los Angeles
  { x: 26, y: 25, live: true }, // Nova York
  { x: 24, y: 33 },             // Miami
  { x: 30, y: 65, live: true }, // Rio
  { x: 50, y: 19, live: true }, // Berlim
  { x: 52, y: 31 },             // Cairo
  { x: 62, y: 33 },             // Dubai
  { x: 78, y: 33 },             // Hong Kong
  { x: 89, y: 29 },             // Tóquio
  { x: 88, y: 68 },             // Sydney
]

// Malha de rotas entre os nós. `flow` anima o tracejado (linha em operação).
const CHART_ROUTES: { d: string; flow?: boolean }[] = [
  { d: 'M9 27 Q17 19 26 25' },
  { d: 'M26 25 Q38 13 50 19', flow: true },
  { d: 'M24 33 Q25 48 30 65' },
  { d: 'M30 65 Q44 50 52 31', flow: true },
  { d: 'M50 19 Q58 24 62 33' },
  { d: 'M62 33 Q70 29 78 33' },
  { d: 'M78 33 Q84 27 89 29' },
  { d: 'M89 29 Q95 49 88 68', flow: true },
]

// Rosa dos ventos de canto: 4 pontas maiores + 4 menores e aro de 24 traços.
// Sai de rotação, não de polígonos na mão — ângulo errado vira rosa torta.
const ROSE_MAJOR = [0, 90, 180, 270]
const ROSE_MINOR = [45, 135, 225, 315]
const ROSE_TICKS = Array.from({ length: 24 }, (_, i) => i * 15)
const ROSE_CX = 13.5
const ROSE_CY = 80.5

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
      <g stroke="var(--color-brass)" opacity="0.2">
        <path d="M 0 50 H 100" strokeWidth="0.18" strokeDasharray="2 2.5" />
        {Array.from({ length: 20 }, (_, i) => i * 5).map((x) => (
          <line key={x} x1={x} y1="49" x2={x} y2="51" strokeWidth={x % 25 === 0 ? 0.3 : 0.14} />
        ))}
      </g>

      {/* CONTINENTES — o mundo que dá nome ao jogo, no traço facetado da home */}
      <g
        fill="color-mix(in srgb, var(--color-brass) 7%, transparent)"
        stroke="color-mix(in srgb, var(--color-brass) 34%, transparent)"
        strokeWidth="0.22"
        strokeLinejoin="round"
      >
        {CHART_LANDS.map((d) => <path key={d} d={d} />)}
      </g>

      {/* MALHA DE ROTAS — tracejado fluindo nas linhas em operação */}
      <g stroke="var(--color-brass)" strokeWidth="0.24" strokeDasharray="1 1.6" fill="none" opacity="0.34">
        {CHART_ROUTES.map((route) => (
          <path key={route.d} d={route.d} className={route.flow ? 'bm-route-flow' : undefined} />
        ))}
      </g>

      {/* NÓS DAS CIDADES — halo + núcleo, hubs vivos pulsando */}
      {CHART_CITIES.map(({ x, y, live }) => (
        <g key={`${x}-${y}`} className={live ? 'bm-chart-node' : undefined} opacity="0.75">
          <circle cx={x} cy={y} r="1.5" fill="color-mix(in srgb, var(--color-brass) 12%, transparent)" />
          <circle cx={x} cy={y} r="0.55" fill="var(--color-ink-950)" stroke="var(--color-brass)" strokeWidth="0.22" />
        </g>
      ))}

      {/* AVIÃO DE LINHA — a mesma aeronave da tela inicial, em miniatura, num voo
          transcontinental que ENTRA e SAI da carta: o reinício do loop acontece fora
          do viewBox, então nunca teleporta à vista. A rota dele fica pintada bem
          fraca, como as da home. `.entry-flyer` já trata movimento reduzido e falta
          de offset-path; o balanço/beacon vêm das classes internas do AirlinerMark. */}
      <path
        d="M-16 34 Q25 20 55 24 Q85 28 116 12"
        stroke="var(--color-brass)"
        strokeWidth="0.2"
        strokeDasharray="0.7 2.4"
        strokeLinecap="round"
        fill="none"
        opacity="0.14"
      />
      <g
        className="entry-flyer entry-aircraft"
        opacity="0.55"
        style={{
          color: 'var(--color-brass)',
          offsetPath: "path('M-16 34 Q25 20 55 24 Q85 28 116 12')",
          offsetRotate: 'auto',
          animationDuration: '75s',
          animationDelay: '-30s',
        }}
      >
        <AirlinerMark scale={0.05} facing={1} />
      </g>

      {/* ROSA DOS VENTOS — de miolo a instrumento: pequena, no canto da prancheta.
          O aro graduado fica parado e a estrela gira — o mostrador anda, não a carta. */}
      <g opacity="0.42">
        <circle cx={ROSE_CX} cy={ROSE_CY} r="8" fill="none" stroke="var(--color-brass)" strokeWidth="0.24" />
        <circle cx={ROSE_CX} cy={ROSE_CY} r="7" fill="none" stroke="var(--color-brass)" strokeWidth="0.13" strokeDasharray="0.5 1.1" />
        <g stroke="var(--color-brass)">
          {ROSE_TICKS.map((a) => (
            <line
              key={a}
              x1={ROSE_CX}
              y1={ROSE_CY - 8}
              x2={ROSE_CX}
              y2={a % 90 === 0 ? ROSE_CY - 6.2 : a % 45 === 0 ? ROSE_CY - 6.8 : ROSE_CY - 7.3}
              strokeWidth={a % 90 === 0 ? 0.3 : 0.15}
              transform={`rotate(${a} ${ROSE_CX} ${ROSE_CY})`}
            />
          ))}
        </g>
      </g>
      <g className="bm-spin-slow" opacity="0.4" style={{ transformOrigin: `${ROSE_CX}px ${ROSE_CY}px` }}>
        {ROSE_MINOR.map((a) => (
          <polygon
            key={a}
            points={`${ROSE_CX},${ROSE_CY - 3.6} ${ROSE_CX + 0.5},${ROSE_CY - 0.5} ${ROSE_CX},${ROSE_CY} ${ROSE_CX - 0.5},${ROSE_CY - 0.5}`}
            fill="var(--color-brass)"
            transform={`rotate(${a} ${ROSE_CX} ${ROSE_CY})`}
          />
        ))}
        {ROSE_MAJOR.map((a) => (
          <g key={a} transform={`rotate(${a} ${ROSE_CX} ${ROSE_CY})`}>
            <polygon
              points={`${ROSE_CX},${ROSE_CY - 6} ${ROSE_CX + 0.8},${ROSE_CY - 0.8} ${ROSE_CX},${ROSE_CY} ${ROSE_CX - 0.8},${ROSE_CY - 0.8}`}
              fill="var(--color-brass)"
            />
            <polygon
              points={`${ROSE_CX},${ROSE_CY - 6} ${ROSE_CX + 0.8},${ROSE_CY - 0.8} ${ROSE_CX},${ROSE_CY}`}
              fill="var(--color-brass-glow)"
              opacity="0.32"
            />
          </g>
        ))}
        <circle cx={ROSE_CX} cy={ROSE_CY} r="1.1" fill="none" stroke="var(--color-brass)" strokeWidth="0.3" />
        <circle cx={ROSE_CX} cy={ROSE_CY} r="0.4" fill="var(--color-brass-glow)" />
      </g>

      {/* ESCALA GRÁFICA — o carimbo de carta técnica no canto oposto à rosa */}
      <g opacity="0.4" stroke="var(--color-brass)" strokeWidth="0.22">
        <line x1="76" y1="88" x2="92" y2="88" />
        {[76, 80, 84, 88, 92].map((x) => (
          <line key={x} x1={x} y1="87.2" x2={x} y2="88.8" />
        ))}
        <rect x="80" y="87.55" width="4" height="0.9" fill="var(--color-brass)" stroke="none" opacity="0.55" />
      </g>
    </svg>
  )
}

// ---------------------------------------------------------------------
// FULIGEM — o pátio da fábrica visto da mesa (055/D-069)
//
// Mesmo papel do ChartPattern no Atlas: o miolo é onde o mapa se apresenta.
// Silhueta industrial no horizonte com chaminés soltando fumaça PARADA (traço,
// não partícula), a linha férrea cortando o pátio, uma engrenagem-instrumento
// no canto (o análogo da rosa dos ventos — gira com `.bm-spin-slow`, que já
// congela sob prefers-reduced-motion) e um medidor simples no canto oposto.
// ---------------------------------------------------------------------

const FOUNDRY_HORIZON = 42

// Silhueta do complexo: [x, largura, altura] + chaminés como pares [x, altura].
const FOUNDRY_BLOCKS: [number, number, number][] = [
  [2, 14, 12], [17, 9, 18], [27, 12, 9], [58, 13, 15], [72, 10, 8], [83, 14, 13],
]
const FOUNDRY_STACKS: [number, number][] = [[8, 22], [21, 30], [63, 26], [88, 21]]

// Dentes da engrenagem-instrumento — mesmo truque da rosa: rotação, não polígono à mão.
const GEAR_TEETH = Array.from({ length: 12 }, (_, i) => i * 30)
const GEAR_CX = 86.5
const GEAR_CY = 82.5

export function FoundryPattern() {
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      {/* complexo fabril no horizonte — silhueta em tinta, janelas de fornalha acesas */}
      <g>
        {FOUNDRY_BLOCKS.map(([x, w, h]) => (
          <g key={`${x}-${h}`} opacity="0.5">
            <rect x={x} y={FOUNDRY_HORIZON - h} width={w} height={h} fill="var(--color-ink-abyss)" />
            <rect x={x} y={FOUNDRY_HORIZON - h} width={w} height={h} fill="none" stroke="var(--color-brass)" strokeOpacity="0.28" strokeWidth="0.18" />
            {[0.35, 0.68].map((f) => (
              <rect key={f} x={x + w * 0.3} y={FOUNDRY_HORIZON - h + h * f} width="1.4" height="1" fill="var(--color-brass)" opacity="0.75" />
            ))}
          </g>
        ))}
        {FOUNDRY_STACKS.map(([x, h]) => (
          <g key={x} opacity="0.55">
            <path d={`M ${x} ${FOUNDRY_HORIZON} L ${x + 0.9} ${FOUNDRY_HORIZON - h} h 1.6 L ${x + 3.4} ${FOUNDRY_HORIZON} Z`} fill="var(--color-ink-abyss)" />
            {/* fumaça: traço estático, nunca partícula (FR-012) */}
            <path
              d={`M ${x + 1.7} ${FOUNDRY_HORIZON - h - 1} q 2 -2.4 1 -4.6 q 2.6 0.6 3.4 -2.2`}
              fill="none"
              stroke="var(--color-starlight)"
              strokeOpacity="0.16"
              strokeWidth="1.1"
              strokeLinecap="round"
            />
          </g>
        ))}
        <line x1="0" y1={FOUNDRY_HORIZON} x2="100" y2={FOUNDRY_HORIZON} stroke="var(--color-brass)" strokeWidth="0.22" opacity="0.3" />
      </g>

      {/* linha férrea cortando o pátio — dormentes espaçando com a fuga */}
      <g stroke="var(--color-starlight)" opacity="0.2">
        <path d="M 34 100 L 46 42" strokeWidth="0.4" fill="none" />
        <path d="M 58 100 L 50 42" strokeWidth="0.4" fill="none" />
        {[92, 82, 73, 65, 58, 52, 47].map((y) => {
          const t = (100 - y) / 58
          const x1 = 34 + (46 - 34) * t
          const x2 = 58 + (50 - 58) * t
          return <line key={y} x1={x1 - 1} y1={y} x2={x2 + 1} y2={y} strokeWidth="0.5" />
        })}
      </g>

      {/* ENGRENAGEM-INSTRUMENTO — o mostrador do mundo, girando devagar no canto */}
      <g opacity="0.42">
        <circle cx={GEAR_CX} cy={GEAR_CY} r="8.2" fill="none" stroke="var(--color-brass)" strokeWidth="0.24" strokeDasharray="0.5 1.1" />
      </g>
      <g className="bm-spin-slow" opacity="0.45" style={{ transformOrigin: `${GEAR_CX}px ${GEAR_CY}px` }}>
        {GEAR_TEETH.map((a) => (
          <rect
            key={a}
            x={GEAR_CX - 0.7}
            y={GEAR_CY - 7.4}
            width="1.4"
            height="2"
            fill="var(--color-brass)"
            transform={`rotate(${a} ${GEAR_CX} ${GEAR_CY})`}
          />
        ))}
        <circle cx={GEAR_CX} cy={GEAR_CY} r="5.6" fill="none" stroke="var(--color-brass)" strokeWidth="0.5" />
        <circle cx={GEAR_CX} cy={GEAR_CY} r="1.4" fill="none" stroke="var(--color-brass)" strokeWidth="0.4" />
        {[0, 60, 120].map((a) => (
          <line
            key={a}
            x1={GEAR_CX}
            y1={GEAR_CY - 5.6}
            x2={GEAR_CX}
            y2={GEAR_CY - 1.4}
            stroke="var(--color-brass)"
            strokeWidth="0.4"
            transform={`rotate(${a} ${GEAR_CX} ${GEAR_CY})`}
          />
        ))}
      </g>

      {/* MEDIDOR — o carimbo técnico no canto oposto, par do "escala gráfica" do Atlas */}
      <g opacity="0.42" stroke="var(--color-brass)" strokeWidth="0.24" fill="none">
        <path d="M 10 90 a 6 6 0 0 1 12 0" />
        {[-60, -30, 0, 30, 60].map((a) => (
          <line
            key={a}
            x1="16"
            y1="84.6"
            x2="16"
            y2="85.6"
            transform={`rotate(${a} 16 90)`}
          />
        ))}
        <line x1="16" y1="90" x2="13.4" y2="86.4" strokeWidth="0.4" />
        <line x1="8.8" y1="90" x2="23.2" y2="90" />
      </g>
    </svg>
  )
}
