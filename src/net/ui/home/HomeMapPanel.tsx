import { AnimatePresence, motion } from 'motion/react'
import {
  ArrowRight,
  Globe2,
  Link2,
  Map,
  Ticket,
} from 'lucide-react'
import { Button } from '@/game/ui/primitives'
import { EASE, MOTION } from '@/game/ui/motion'
import type { BoardTheme } from '@/game/ui/theme/boardTheme'
import { cn } from '@/lib/utils'
import { EntryPanel } from '../entryShell'
import {
  HOME_MAPS,
  NAME_MAX,
  type HomeMapFact,
  type HomeForm,
} from './homeShared'

type HomeMapSkin = 'atlas' | 'fuligem'

function CityNetwork({ skin }: { skin: HomeMapSkin }) {
  if (skin === 'fuligem') {
    // Prévia da Cidade da Fuligem: o complexo fabril em silhueta, a linha férrea
    // costurando os bairros e os nós de propriedade — mesmo vocabulário de nós do Atlas.
    return (
      <svg
        viewBox="0 0 280 190"
        className="home-map-panel__network home-map-panel__network--fuligem"
        fill="none"
        aria-hidden="true"
      >
        <path className="home-map-panel__fuligem-ground" d="M14 152H266" />
        <g className="home-map-panel__fuligem-mills">
          <path d="M30 152v-44h16l8 -10v10h10l8 -10v10h12v44Z" />
          <path d="M104 152v-34h34l10 -12v12h10v34Z" />
          <path d="M188 152v-52h14v-16h10v16h14v52Z" />
          <path d="M226 100l3 -26h6l3 26" />
          <path d="M96 84l2.4 -22h5l2.4 22" />
        </g>
        <g className="home-map-panel__fuligem-windows">
          <rect x="40" y="120" width="8" height="6" />
          <rect x="58" y="120" width="8" height="6" />
          <rect x="114" y="130" width="8" height="6" />
          <rect x="132" y="130" width="8" height="6" />
          <rect x="198" y="116" width="8" height="6" />
          <rect x="212" y="132" width="8" height="6" />
        </g>
        <path className="home-map-panel__fuligem-rail" d="M14 166H266M26 160l8 12M62 160l8 12M98 160l8 12M134 160l8 12M170 160l8 12M206 160l8 12M242 160l8 12" />
        <path className="home-map-panel__route home-map-panel__route--flow" d="M28 140 78 96l62 -24 66 22 46 44" />
        {[
          [28, 140],
          [78, 96],
          [140, 72],
          [206, 94],
          [252, 138],
        ].map(([cx, cy], index) => (
          <g key={`${cx}-${cy}`} className={index === 2 ? 'home-map-panel__node--active' : undefined}>
            <circle cx={cx} cy={cy} r="10" className="home-map-panel__node-halo" />
            <circle cx={cx} cy={cy} r="4.5" className="home-map-panel__node-core" />
          </g>
        ))}
      </svg>
    )
  }

  return (
    <svg
      viewBox="0 0 280 190"
      className="home-map-panel__network home-map-panel__network--atlas"
      fill="none"
      aria-hidden="true"
    >
      <circle className="home-map-panel__globe" cx="140" cy="95" r="82" />
      <path className="home-map-panel__meridian" d="M58 95h164M140 13c-28 22-43 50-43 82s15 60 43 82M140 13c28 22 43 50 43 82s-15 60-43 82M73 49c19 13 42 19 67 19s48-6 67-19M73 141c19-13 42-19 67-19s48 6 67 19" />
      <g className="home-map-panel__land">
        <path d="m74 55 19-14 18 5 6 12 15 6-4 17-14 5-8 21-13-7-5-16-15-7Z" />
        <path d="m122 113 17-7 14 9-3 18-9 23-10-6-5-19Z" />
        <path d="m150 51 20-8 20 9 17 2 7 13-15 10-6 17-17-2-10-13-17-8Z" />
        <path d="m188 121 17-3 12 10-5 15-20 2-8-11Z" />
      </g>
      <path className="home-map-panel__route home-map-panel__route--flow" d="M54 125 92 72l56 31 50-49 30 67" />
      <path className="home-map-panel__route home-map-panel__route--muted" d="m92 72 8 62 48-31 40 42" />
      {[
        [54, 125, 5],
        [92, 72, 7],
        [100, 134, 4],
        [148, 103, 5],
        [198, 54, 8],
        [188, 145, 5],
        [228, 121, 6],
      ].map(([cx, cy, radius]) => (
        <g
          key={`${cx}-${cy}`}
          className={radius === 8 ? 'home-map-panel__node--active' : undefined}
        >
          <circle
            cx={cx}
            cy={cy}
            r={radius + 5}
            className="home-map-panel__node-halo"
          />
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            className="home-map-panel__node-core"
          />
          <circle cx={cx} cy={cy} r="1.8" fill="var(--home-map-hot)" stroke="none" />
        </g>
      ))}
    </svg>
  )
}

const MAP_FACT_ICONS = {
  squares: Map,
  countries: Globe2,
  'bus-ticket': Ticket,
} as const

function MapFacts({
  mapName,
  facts,
}: {
  mapName: string
  facts: readonly HomeMapFact[]
}) {
  return (
    <div
      className="home-map-panel__stats"
      aria-label={`Características do mapa ${mapName}`}
    >
      {facts.map((fact) => {
        const Icon = MAP_FACT_ICONS[fact.kind]
        return (
          <div key={fact.kind}>
            <Icon aria-hidden />
            <strong>{fact.value}</strong>
            <span>{fact.label}</span>
          </div>
        )
      })}
    </div>
  )
}

function NameCounter({ length }: { length: number }) {
  if (length === 0) return null
  return (
    <span className="home-map-panel__counter tabular-nums">
      {length}/{NAME_MAX}
    </span>
  )
}

export function HomeMapPanel({
  f,
  reduced,
  skin,
  onChangeMap,
  mapChanging,
}: {
  f: HomeForm
  reduced: boolean
  skin: HomeMapSkin
  onChangeMap: (theme: BoardTheme) => void
  mapChanging: boolean
}) {
  const theme: BoardTheme = skin
  const nextTheme: BoardTheme = theme === 'atlas' ? 'fuligem' : 'atlas'
  const map = HOME_MAPS[theme]
  const nextMap = HOME_MAPS[nextTheme]
  const fieldId = `${skin}-home-invite`
  const inputClass = 'entry-input min-w-0 flex-1'

  return (
    <EntryPanel
      className={cn(
        'home-map-panel max-w-[47rem]',
        skin === 'fuligem' && 'home-map-panel--fuligem',
      )}
    >
      <div className="grid md:grid-cols-[0.92fr_1.08fr]">
        <section className="home-map-panel__canvas">
          <div className="home-map-panel__map-head">
            <div>
              <p className="home-map-panel__eyebrow">Mapa selecionado</p>
              <h2>{map.name}</h2>
            </div>
            <button
              type="button"
              className="home-map-panel__theme-button"
              title={`Selecionar ${nextMap.name}`}
              aria-label={`Selecionar o mapa ${nextMap.name}`}
              disabled={mapChanging}
              onClick={() => onChangeMap(nextTheme)}
            >
              <Map size={21} aria-hidden />
            </button>
          </div>

          <div className="home-map-panel__preview">
            <CityNetwork skin={skin} />
            <span className="home-map-panel__preview-index" aria-hidden>
              {theme === 'atlas' ? 'MAPA 01' : 'MAPA 02'}
            </span>
          </div>

          <MapFacts mapName={map.name} facts={map.facts} />
        </section>

        <section className="home-map-panel__form">
            <p className="home-map-panel__eyebrow">Prepare a partida</p>
            <h2>{skin === 'fuligem' ? 'Entre na disputa pelos bairros' : 'Entre na disputa por cidades'}</h2>
            <p className="home-map-panel__intro">
              Defina seu nome para criar uma sala e convidar seus amigos.
            </p>

            <div className="mt-5">
              <div className="mb-1.5 flex items-baseline justify-between gap-2">
                <label htmlFor={`${skin}-home-name`} className="home-map-panel__label">
                  Seu nome
                </label>
                <NameCounter length={f.name.length} />
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  id={`${skin}-home-name`}
                  value={f.name}
                  onChange={(event) => f.setName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') f.create()
                  }}
                  placeholder="Ex.: Nikaum"
                  maxLength={NAME_MAX}
                  autoFocus
                  className={inputClass}
                />
                <Button onClick={f.create} className="home-map-panel__primary px-5">
                  Criar sala
                  <ArrowRight size={16} aria-hidden />
                </Button>
              </div>
            </div>

            <button
              type="button"
              className="home-map-panel__invite"
              aria-expanded={f.joinOpen}
              aria-controls={f.joinOpen ? fieldId : undefined}
              onClick={f.toggleJoin}
            >
              <Link2 size={15} aria-hidden />
              Entrar com convite
              <ArrowRight size={15} aria-hidden />
            </button>

            <AnimatePresence initial={false}>
              {f.joinOpen && (
                <motion.div
                  id={fieldId}
                  key={fieldId}
                  initial={reduced ? false : { opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
                  transition={reduced ? { duration: 0 } : { duration: MOTION.base, ease: EASE.emphasis }}
                  className="overflow-hidden"
                >
                  <div className="flex flex-col gap-1.5 pt-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <label htmlFor={`${fieldId}-input`} className="home-map-panel__label">
                        Link ou código do convite
                      </label>
                      {!f.pasteFailed && (
                        <button
                          type="button"
                          onClick={() => void f.pasteLink()}
                          className="home-map-panel__paste"
                        >
                          Colar
                        </button>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <input
                        id={`${fieldId}-input`}
                        value={f.link}
                        onChange={(event) => f.setLink(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') f.join()
                        }}
                        placeholder="Cole aqui o convite"
                        autoFocus
                        className={inputClass}
                      />
                      <Button
                        disabled={!f.roomId}
                        onClick={f.join}
                        className="home-map-panel__join"
                      >
                        Entrar
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
        </section>
      </div>
    </EntryPanel>
  )
}
