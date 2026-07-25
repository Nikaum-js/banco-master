// PADRÕES DE FUNDO — card 7 do review de arquitetura (2026-07-25).
//
// Carta náutica e guilloché do miolo do tabuleiro. SVG decorativo, sem lógica.

// Fixos de navegação — cruzetas discretas espalhadas pela carta.
export const CHART_FIXES: [number, number][] = [
  [12, 16], [30, 9], [68, 12], [88, 20], [9, 55], [92, 58], [16, 84], [45, 92], [80, 86],
]

// Carta náutica noturna no fundo do centro: malha de graticule levemente
// curva, rosa-dos-ventos de latão girando bem devagar e fixos de navegação.
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

      {/* rosa-dos-ventos — 8 pontas, rotação de 4 min por volta */}
      <g opacity="0.075">
        <circle cx="50" cy="50" r="31" fill="none" stroke="var(--color-brass)" strokeWidth="0.35" />
        <circle cx="50" cy="50" r="25.5" fill="none" stroke="var(--color-brass)" strokeWidth="0.2" strokeDasharray="0.8 1.6" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
          <polygon
            key={a}
            points="50,21.5 52.4,46 50,50 47.6,46"
            fill="var(--color-brass)"
            transform={`rotate(${a} 50 50)`}
          />
        ))}
        <circle cx="50" cy="50" r="2.4" fill="none" stroke="var(--color-brass)" strokeWidth="0.45" />
        <animateTransform attributeName="transform" type="rotate" from="0 50 50" to="360 50 50" dur="240s" repeatCount="indefinite" />
      </g>

      {/* fixos de navegação — cruzetas de posição */}
      <g stroke="var(--color-brass-glow)" strokeWidth="0.28" opacity="0.35" strokeLinecap="round">
        {CHART_FIXES.map(([x, y], i) => (
          <g key={i}>
            <line x1={x - 1.1} y1={y} x2={x + 1.1} y2={y} />
            <line x1={x} y1={y - 1.1} x2={x} y2={y + 1.1} />
          </g>
        ))}
      </g>

      {/* rotas traçadas entre portos — arcos tracejados com pontos de escala */}
      <g stroke="var(--color-brass)" strokeWidth="0.22" strokeDasharray="1 1.6" fill="none" opacity="0.2">
        <path d="M 12 16 Q 40 26 68 12" />
        <path d="M 9 55 Q 48 62 88 20" />
        <path d="M 16 84 Q 56 68 92 58" />
      </g>
      <g fill="var(--color-brass)" opacity="0.28">
        {([[12, 16], [68, 12], [9, 55], [88, 20], [16, 84], [92, 58]] as const).map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="0.7" />
        ))}
      </g>
    </svg>
  )
}

// Padrão do Café Coado: rosácea guilloché de cédula antiga no centro,
// florões nos cantos e anéis de xícara manchando o papel da mesa.
export function GuillochePattern() {
  const petals = Array.from({ length: 24 }, (_, i) => i * 15)
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      {/* rosácea gravada — elipses entrelaçadas em duas ordens */}
      <g fill="none" stroke="var(--color-brass)" strokeWidth="0.18" opacity="0.09">
        {petals.map((a) => <ellipse key={a} cx="50" cy="50" rx="30" ry="10" transform={`rotate(${a} 50 50)`} />)}
        {petals.map((a) => <ellipse key={`i${a}`} cx="50" cy="50" rx="18" ry="5.5" transform={`rotate(${a + 7.5} 50 50)`} />)}
      </g>
      <g fill="none" stroke="var(--color-brass)" opacity="0.11">
        <circle cx="50" cy="50" r="32" strokeWidth="0.35" />
        <circle cx="50" cy="50" r="34" strokeWidth="0.16" strokeDasharray="0.5 1" />
      </g>
      {/* manchas de café — anéis de fundo de xícara */}
      <g fill="none" stroke="#8c5a2b" opacity="0.12">
        <circle cx="19" cy="22" r="7.5" strokeWidth="1.2" />
        <circle cx="19" cy="22" r="6.3" strokeWidth="0.4" />
        <circle cx="84" cy="79" r="5.5" strokeWidth="1" />
        <circle cx="84" cy="79" r="4.6" strokeWidth="0.35" />
      </g>
      {/* florões de canto */}
      <g fill="var(--color-brass)" opacity="0.13">
        {([[9, 9], [91, 9], [9, 91], [91, 91]] as const).map(([x, y], i) => (
          <path key={i} d={`M ${x} ${y - 2.6} Q ${x + 2.6} ${y} ${x} ${y + 2.6} Q ${x - 2.6} ${y} ${x} ${y - 2.6} Z`} />
        ))}
      </g>
    </svg>
  )
}
