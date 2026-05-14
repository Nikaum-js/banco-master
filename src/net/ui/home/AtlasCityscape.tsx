// Horizonte do Atlas da Meia-Noite. A cidade deixa de ser uma fileira de
// retângulos genéricos e vira um terminal cosmopolita visto à distância:
// coroas art déco, caixas-d'água, antenas, marquises e fachadas iluminadas.
//
// A geometria é fixa para a composição não mudar entre renders. Só uma pequena
// fração das janelas pulsa; o restante da sensação de vida vem de dois rastros
// de tráfego no chão. Tudo é SVG decorativo, sem custo de layout ou leitura por
// tecnologia assistiva.

type Roof = 'flat' | 'steps' | 'spire' | 'crown'

interface Building {
  x: number
  width: number
  height: number
  roof: Roof
  columns: number
  rows: number
  waterTank?: boolean
  storefront?: boolean
}

const FAR_BUILDINGS: readonly Building[] = [
  { x: -36, width: 92, height: 168, roof: 'steps', columns: 4, rows: 6 },
  { x: 62, width: 72, height: 116, roof: 'flat', columns: 3, rows: 4 },
  { x: 140, width: 108, height: 204, roof: 'crown', columns: 5, rows: 8 },
  { x: 254, width: 82, height: 142, roof: 'flat', columns: 3, rows: 5, waterTank: true },
  { x: 342, width: 116, height: 236, roof: 'spire', columns: 5, rows: 9 },
  { x: 464, width: 68, height: 126, roof: 'steps', columns: 3, rows: 4 },
  { x: 538, width: 104, height: 178, roof: 'flat', columns: 5, rows: 6 },
  { x: 648, width: 86, height: 224, roof: 'crown', columns: 4, rows: 8 },
  { x: 740, width: 120, height: 152, roof: 'steps', columns: 5, rows: 5 },
  { x: 866, width: 74, height: 194, roof: 'spire', columns: 3, rows: 7 },
  { x: 946, width: 114, height: 132, roof: 'flat', columns: 5, rows: 4, waterTank: true },
  { x: 1066, width: 88, height: 244, roof: 'steps', columns: 4, rows: 9 },
  { x: 1160, width: 126, height: 176, roof: 'crown', columns: 6, rows: 6 },
  { x: 1292, width: 72, height: 138, roof: 'flat', columns: 3, rows: 5 },
  { x: 1370, width: 106, height: 214, roof: 'spire', columns: 5, rows: 8 },
] as const

const NEAR_BUILDINGS: readonly Building[] = [
  { x: -54, width: 126, height: 246, roof: 'flat', columns: 5, rows: 8, storefront: true },
  { x: 78, width: 94, height: 186, roof: 'steps', columns: 4, rows: 6, storefront: true },
  { x: 178, width: 118, height: 220, roof: 'crown', columns: 5, rows: 7, storefront: true },
  { x: 302, width: 86, height: 278, roof: 'spire', columns: 4, rows: 10 },
  { x: 394, width: 134, height: 194, roof: 'flat', columns: 6, rows: 6, waterTank: true, storefront: true },
  { x: 534, width: 98, height: 252, roof: 'steps', columns: 4, rows: 9 },
  { x: 638, width: 124, height: 176, roof: 'crown', columns: 5, rows: 5, storefront: true },
  { x: 768, width: 82, height: 226, roof: 'flat', columns: 3, rows: 8 },
  { x: 856, width: 138, height: 270, roof: 'steps', columns: 6, rows: 10 },
  { x: 1000, width: 104, height: 202, roof: 'crown', columns: 4, rows: 7, storefront: true },
  { x: 1110, width: 88, height: 294, roof: 'spire', columns: 4, rows: 11 },
  { x: 1204, width: 132, height: 214, roof: 'flat', columns: 6, rows: 7, waterTank: true, storefront: true },
  { x: 1342, width: 112, height: 258, roof: 'steps', columns: 5, rows: 9 },
] as const

function hash(...values: number[]): number {
  return values.reduce((value, part) => ((value * 31 + part * 17) >>> 0), 2166136261)
}

function roofPath(building: Building): string {
  const w = building.width
  const h = building.height

  switch (building.roof) {
    case 'steps':
      return `M0 18H${w * 0.2}V10H${w * 0.36}V3H${w * 0.64}V10H${w * 0.8}V18H${w}V${h}H0Z`
    case 'spire':
      return `M0 22H${w * 0.25}L${w * 0.5} 0L${w * 0.75} 22H${w}V${h}H0Z`
    case 'crown':
      return `M0 20H${w * 0.18}V9H${w * 0.32}L${w * 0.5} 0L${w * 0.68} 9H${w * 0.82}V20H${w}V${h}H0Z`
    default:
      return `M0 14H${w}V${h}H0Z`
  }
}

function RooftopDetails({ building }: { building: Building }) {
  const center = building.width / 2

  return (
    <g className="entry-city-rooftop">
      {building.waterTank && (
        <g transform={`translate(${center - 14} -16)`}>
          <path d="M3 14 0 30M25 14l3 16M0 30h28" />
          <path d="M2 1h24v14H2z" fill="var(--color-ink-800)" />
          <ellipse cx="14" cy="1" rx="12" ry="3.5" fill="var(--color-ink-700)" />
          <ellipse cx="14" cy="15" rx="12" ry="3.5" />
        </g>
      )}
      {building.roof === 'flat' && !building.waterTank && (
        <g transform={`translate(${building.width * 0.2} 5)`}>
          <rect width={building.width * 0.22} height="9" fill="var(--color-ink-700)" />
          <path d={`M0 0h${building.width * 0.22}M4 9V0M${building.width * 0.22 - 4} 9V0`} />
        </g>
      )}
    </g>
  )
}

function FacadeWindows({
  building,
  buildingIndex,
  layer,
}: {
  building: Building
  buildingIndex: number
  layer: 'far' | 'near'
}) {
  const top = building.roof === 'flat' ? 30 : 38
  const bottomReserve = building.storefront ? 42 : 18
  const usableHeight = Math.max(30, building.height - top - bottomReserve)
  const rowGap = usableHeight / building.rows
  const columnGap = (building.width - 18) / building.columns

  return (
    <>
      {Array.from({ length: building.rows }, (_, row) =>
        Array.from({ length: building.columns }, (_, column) => {
          const seed = hash(buildingIndex + 1, row + 3, column + 7, layer === 'near' ? 19 : 5)
          const lit = seed % 10 > (layer === 'near' ? 3 : 5)
          const pulse = lit && seed % 7 === 0
          const wake = !lit && seed % 23 === 0
          const width = Math.max(4, Math.min(8, columnGap - 6))
          const x = 9 + column * columnGap + (columnGap - width) / 2
          const y = top + row * rowGap + Math.max(2, (rowGap - 8) / 2)
          const animationClass = pulse
            ? ' entry-city-window--pulse'
            : wake
              ? ' entry-city-window--wake'
              : ''

          return (
            <rect
              key={`${row}-${column}`}
              className={`entry-city-window entry-city-window--${layer}${animationClass}`}
              x={x}
              y={y}
              width={width}
              height={layer === 'near' ? 7 : 5}
              rx="0.7"
              fill={lit || wake ? 'var(--color-brass-glow)' : 'var(--color-ink-400)'}
              opacity={lit ? (layer === 'near' ? 0.55 : 0.3) : 0.14}
              style={
                pulse || wake
                  ? {
                      animationDelay: `${-(seed % 17000)}ms`,
                      animationDuration: `${12 + (seed % 10)}s`,
                    }
                  : undefined
              }
            />
          )
        }),
      )}
    </>
  )
}

function Storefront({ building, index }: { building: Building; index: number }) {
  if (!building.storefront) return null

  const bays = Math.max(2, Math.floor(building.width / 30))
  const bayWidth = (building.width - 12) / bays

  return (
    <g transform={`translate(6 ${building.height - 34})`}>
      <path d={`M0 0H${building.width - 12}`} className="entry-city-cornice" />
      {Array.from({ length: bays }, (_, bay) => {
        const lit = hash(index, bay, 73) % 4 !== 0
        return (
          <g key={bay} transform={`translate(${bay * bayWidth} 5)`}>
            <rect
              x="2"
              width={bayWidth - 5}
              height="22"
              rx="1"
              fill={lit ? 'var(--color-brass)' : 'var(--color-ink-600)'}
              opacity={lit ? 0.2 : 0.12}
            />
            <path d={`M${bayWidth / 2} 0v22`} opacity="0.28" />
            <path d={`M0 0h${bayWidth - 1}l-3 5H3Z`} fill="var(--color-ink-600)" />
          </g>
        )
      })}
    </g>
  )
}

function BuildingGlyph({
  building,
  index,
  layer,
}: {
  building: Building
  index: number
  layer: 'far' | 'near'
}) {
  const verticalRibs = Math.max(2, Math.floor(building.width / 28))

  return (
    <g transform={`translate(${building.x} ${-building.height})`}>
      <path
        d={roofPath(building)}
        className="entry-city-building"
        fill={layer === 'near' ? 'var(--color-ink-900)' : 'var(--color-ink-800)'}
      />
      <path
        d={`M${building.width * 0.76} 20H${building.width}V${building.height}H${building.width * 0.88}Z`}
        fill="var(--color-ink-950)"
        opacity={layer === 'near' ? 0.46 : 0.28}
        stroke="none"
      />
      <path d={`M0 26H${building.width}`} className="entry-city-cornice" />
      <path d={`M0 ${building.height - 39}H${building.width}`} className="entry-city-cornice" />
      {Array.from({ length: verticalRibs - 1 }, (_, rib) => (
        <path
          key={rib}
          d={`M${((rib + 1) * building.width) / verticalRibs} 27V${building.height}`}
          className="entry-city-rib"
        />
      ))}
      <FacadeWindows building={building} buildingIndex={index} layer={layer} />
      <Storefront building={building} index={index} />
      <RooftopDetails building={building} />
    </g>
  )
}

const NAVIGATION_MASTS = [
  { x: 112, base: 840, height: 350, width: 66 },
  { x: 424, base: 840, height: 430, width: 78 },
  { x: 1018, base: 840, height: 398, width: 72 },
  { x: 1324, base: 840, height: 326, width: 62 },
] as const

// Torres de navegação ficam ATRÁS do skyline e sobem muito além dos telhados.
// A treliça, os estais e os braços horizontais dão escala sem virar um novo
// símbolo flutuando no céu.
function NavigationMasts() {
  return (
    <g className="entry-city-masts" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      {NAVIGATION_MASTS.map((mast) => {
        const top = mast.base - mast.height
        const center = mast.x + mast.width / 2
        const sections = Math.floor(mast.height / 38)

        return (
          <g key={mast.x}>
            <path d={`M${mast.x} ${mast.base} ${center} ${top} ${mast.x + mast.width} ${mast.base}Z`} />
            <path d={`M${center} ${top}V${mast.base}`} opacity="0.46" />
            <path d={`M${center - 8} ${top + 30}h16M${center - 15} ${top + 58}h30`} />
            <path d={`M${center - 24} ${top + 92}h48M${center - 32} ${top + 130}h64`} />
            <path d={`M${center} ${top - 28}V${top + 8}`} />
            <path d={`M${center - 13} ${top - 12}h26M${center - 20} ${top - 2}h40`} />
            <path d={`M${center} ${top + 55} ${mast.x - 78} ${mast.base}`} opacity="0.34" />
            <path d={`M${center} ${top + 55} ${mast.x + mast.width + 78} ${mast.base}`} opacity="0.34" />
            {Array.from({ length: sections }, (_, section) => {
              const y = top + 32 + section * 38
              const progress = (y - top) / mast.height
              const left = center - (mast.width / 2) * progress
              const right = center + (mast.width / 2) * progress
              return (
                <g key={section}>
                  <path d={`M${left} ${y}H${right}`} />
                  <path d={`M${left} ${y} ${right} ${Math.min(mast.base, y + 38)}`} opacity="0.52" />
                  <path d={`M${right} ${y} ${left} ${Math.min(mast.base, y + 38)}`} opacity="0.52" />
                </g>
              )
            })}
            <circle
              className="entry-city-beacon"
              cx={center}
              cy={top - 31}
              r="3"
              fill="var(--color-signal-glow)"
              stroke="none"
            />
          </g>
        )
      })}
    </g>
  )
}

function CityBand({
  buildings,
  base,
  layer,
}: {
  buildings: readonly Building[]
  base: number
  layer: 'far' | 'near'
}) {
  return (
    <g
      transform={`translate(0 ${base})`}
      className={`entry-city-band entry-city-band--${layer}`}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {buildings.map((building, index) => (
        <BuildingGlyph key={`${building.x}-${building.height}`} building={building} index={index} layer={layer} />
      ))}
    </g>
  )
}

const CARS = [
  { lane: 'eastbound', delay: '-4s', duration: '22s', tone: 'var(--color-brass)', scale: 1 },
  { lane: 'eastbound', delay: '-16s', duration: '29s', tone: 'var(--color-starlight-muted)', scale: 0.9 },
  { lane: 'westbound', delay: '-9s', duration: '25s', tone: 'var(--color-signal)', scale: 0.94 },
  { lane: 'westbound', delay: '-21s', duration: '32s', tone: 'var(--color-brass-soft)', scale: 0.84 },
] as const

function CarGlyph({
  direction,
  tone,
  scale,
}: {
  direction: 1 | -1
  tone: string
  scale: number
}) {
  return (
    <g transform={`scale(${direction * scale} ${scale})`} strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="0" cy="11" rx="27" ry="3.5" fill="var(--color-ink-abyss)" opacity="0.65" stroke="none" />
      <path
        d="M-27 6-22-2-9-5H9L20 0 27 3V10H-27Z"
        fill={tone}
        fillOpacity="0.72"
        stroke="var(--color-brass)"
        strokeOpacity="0.6"
      />
      <path d="M-8-3H8L17 1H-15Z" fill="var(--color-ink-700)" stroke="var(--color-starlight-muted)" strokeOpacity="0.32" />
      <path d="M0-3V1M-15 1h32" stroke="var(--color-starlight-muted)" strokeOpacity="0.34" />
      <circle cx="-17" cy="10" r="4.2" fill="var(--color-ink-950)" stroke="var(--color-ink-400)" />
      <circle cx="17" cy="10" r="4.2" fill="var(--color-ink-950)" stroke="var(--color-ink-400)" />
      <circle cx="-17" cy="10" r="1.5" fill="var(--color-brass-soft)" stroke="none" />
      <circle cx="17" cy="10" r="1.5" fill="var(--color-brass-soft)" stroke="none" />
      <circle className="entry-city-car__headlight" cx="27" cy="5" r="2.2" fill="var(--color-brass-glow)" stroke="none" />
      <rect x="-28" y="4" width="2.5" height="4" rx="1" fill="var(--color-signal-glow)" stroke="none" />
    </g>
  )
}

function StreetLife() {
  return (
    <g className="entry-city-street" stroke="currentColor">
      {/* Calçada e meio-fio separam claramente cidade e avenida. */}
      <rect x="0" y="832" width="1440" height="17" fill="var(--color-ink-700)" fillOpacity="0.8" stroke="none" />
      <path d="M0 835H1440M0 848H1440" opacity="0.42" />
      <path d="M0 841H1440" strokeDasharray="3 13" opacity="0.18" />

      {/* Duas pistas, com luz refletida no asfalto e faixa central. */}
      <rect x="0" y="849" width="1440" height="51" fill="var(--color-ink-abyss)" fillOpacity="0.92" stroke="none" />
      <rect x="0" y="849" width="1440" height="51" fill="url(#atlas-road-sheen)" stroke="none" />
      <path d="M0 874H1440" stroke="var(--color-brass)" strokeWidth="1.1" strokeDasharray="28 22" opacity="0.36" />
      <path d="M0 852H1440M0 897H1440" opacity="0.28" />

      {/* Postes ficam na calçada, atrás dos veículos. */}
      {Array.from({ length: 16 }, (_, index) => {
        const x = 24 + index * 94
        return (
          <g key={x} transform={`translate(${x} 816)`} opacity={index % 3 === 0 ? 0.5 : 0.3}>
            <path d="M0 32V2h9M0 27h8" />
            <path d="M9 2c5 0 5 7 0 7Z" fill="var(--color-brass)" fillOpacity="0.24" />
            <circle cx="10" cy="5" r="2.2" fill="var(--color-brass-glow)" stroke="none" />
          </g>
        )
      })}

      {CARS.map((car) => (
        <g
          key={`${car.lane}-${car.delay}`}
          className={`entry-city-car entry-city-car--${car.lane}`}
          style={{ animationDelay: car.delay, animationDuration: car.duration }}
        >
          <CarGlyph
            direction={car.lane === 'eastbound' ? 1 : -1}
            tone={car.tone}
            scale={car.scale}
          />
        </g>
      ))}
    </g>
  )
}

export function AtlasCityscape({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMidYMax slice"
      fill="none"
      className={className}
      data-entry-cityscape="atlas"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="atlas-city-haze" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="var(--color-brass)" stopOpacity="0.13" />
          <stop offset="48%" stopColor="var(--color-brass)" stopOpacity="0.035" />
          <stop offset="100%" stopColor="var(--color-brass)" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="atlas-road-sheen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-brass)" stopOpacity="0.055" />
          <stop offset="52%" stopColor="var(--color-ink-400)" stopOpacity="0.035" />
          <stop offset="100%" stopColor="var(--color-ink-950)" stopOpacity="0" />
        </linearGradient>
      </defs>

      <rect x="0" y="500" width="1440" height="400" fill="url(#atlas-city-haze)" />
      <NavigationMasts />
      <CityBand buildings={FAR_BUILDINGS} base={812} layer="far" />
      <CityBand buildings={NEAR_BUILDINGS} base={840} layer="near" />
      <StreetLife />
    </svg>
  )
}
