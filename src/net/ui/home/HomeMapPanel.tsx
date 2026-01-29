import { AnimatePresence, motion } from 'motion/react'
import {
  ArrowLeft,
  ArrowRight,
  Globe2,
  Link2,
  LockKeyhole,
  Map,
  Radio,
  Users,
} from 'lucide-react'
import { Button } from '@/game/ui/primitives'
import { EASE, MOTION } from '@/game/ui/motion'
import {
  BOARD_THEMES,
  useBoardTheme,
  type BoardTheme,
} from '@/game/ui/theme/boardTheme'
import { cn } from '@/lib/utils'
import { EntryPanel } from '../entryShell'
import {
  HOME_MAPS,
  MAX_PLAYERS,
  NAME_MAX,
  STATS,
  type HomeForm,
} from './homeShared'

type HomeMapSkin = 'atlas' | 'neon'

function CityNetwork({ skin }: { skin: HomeMapSkin }) {
  if (skin === 'neon') {
    return (
      <svg
        viewBox="0 0 280 190"
        className="home-map-panel__network home-map-panel__network--neon"
        fill="none"
        aria-hidden="true"
      >
        <path className="home-map-panel__neon-horizon" d="M18 55H262" />
        <g className="home-map-panel__neon-grid">
          <path d="M140 55 16 178M140 55 57 178M140 55 99 178M140 55v123M140 55l41 123M140 55l83 123M140 55l124 123" />
          <path d="M49 84h182M34 108h212M24 139h232M16 178h248" />
        </g>
        <g className="home-map-panel__neon-blocks">
          <path d="m52 91 20-11 20 11v27l-20 11-20-11Z" />
          <path d="m111 69 29-16 29 16v37l-29 16-29-16Z" />
          <path d="m189 95 20-11 20 11v25l-20 11-20-11Z" />
          <path d="m92 135 17-9 17 9v21l-17 9-17-9Z" />
          <path d="m151 139 18-10 18 10v22l-18 10-18-10Z" />
        </g>
        <path className="home-map-panel__route home-map-panel__route--flow" d="M28 153 72 104l68-35 69 38 45 46" />
        {[
          [28, 153],
          [72, 104],
          [140, 69],
          [209, 107],
          [254, 153],
        ].map(([cx, cy], index) => (
          <g key={`${cx}-${cy}`} className={index === 2 ? 'home-map-panel__node--active' : undefined}>
            <circle cx={cx} cy={cy} r="10" className="home-map-panel__node-halo" />
            <path
              d={`M${cx} ${cy - 6} ${cx + 6} ${cy} ${cx} ${cy + 6} ${cx - 6} ${cy}Z`}
              className="home-map-panel__node-core"
            />
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

function MapFacts() {
  return (
    <div className="home-map-panel__stats">
      <div>
        <Globe2 aria-hidden />
        <strong>{STATS.countries}</strong>
        <span>países</span>
      </div>
      <div>
        <Users aria-hidden />
        <strong>{MAX_PLAYERS}</strong>
        <span>jogadores</span>
      </div>
      <div>
        <Radio aria-hidden />
        <strong className="home-map-panel__stat-text">Multiplayer</strong>
      </div>
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
  const theme = useBoardTheme((state) => state.theme)
  const nextTheme = BOARD_THEMES[(BOARD_THEMES.indexOf(theme) + 1) % BOARD_THEMES.length]
  const map = HOME_MAPS[theme]
  const nextMap = HOME_MAPS[nextTheme]
  const fieldId = `${skin}-home-invite`
  const inputClass = skin === 'neon'
    ? 'neon-input min-w-0 flex-1 tracking-normal normal-case text-left'
    : 'entry-input min-w-0 flex-1'

  return (
    <EntryPanel
      className={cn(
        'home-map-panel max-w-[47rem]',
        skin === 'neon' && 'home-map-panel--neon',
      )}
    >
      <div className="grid md:grid-cols-[0.92fr_1.08fr]">
        <section className="home-map-panel__canvas">
          <div className="home-map-panel__map-head">
            <div>
              <p className="home-map-panel__eyebrow">
                {map.playable ? 'Mapa selecionado' : 'Prévia de mapa'}
              </p>
              <h2>{map.name}</h2>
            </div>
            <button
              type="button"
              className="home-map-panel__theme-button"
              title={`${nextMap.playable ? 'Selecionar' : 'Pré-visualizar'} ${nextMap.name}`}
              aria-label={`${nextMap.playable ? 'Selecionar' : 'Pré-visualizar'} o mapa ${nextMap.name}`}
              disabled={mapChanging}
              onClick={() => onChangeMap(nextTheme)}
            >
              <Map size={21} aria-hidden />
            </button>
          </div>

          <div className="home-map-panel__preview">
            <CityNetwork skin={skin} />
            <span className="home-map-panel__preview-index" aria-hidden>
              {theme === 'atlas' ? 'MAPA 01' : 'CONCEITO 02'}
            </span>
          </div>

          {map.playable ? (
            <MapFacts />
          ) : (
            <div className="home-map-panel__availability">
              <LockKeyhole aria-hidden />
              <div>
                <strong>Em desenvolvimento</strong>
                <span>Criação de salas bloqueada</span>
              </div>
            </div>
          )}
        </section>

        {map.playable ? (
          <section className="home-map-panel__form">
            <p className="home-map-panel__eyebrow">Prepare a partida</p>
            <h2>Entre na disputa por cidades</h2>
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
        ) : (
          <section className="home-map-panel__form home-map-panel__locked">
            <p className="home-map-panel__eyebrow">Mapa em desenvolvimento</p>
            <h2>Metrópole Neon ainda não aceita partidas</h2>
            <p className="home-map-panel__intro">
              Esta é uma prévia visual. Para criar uma sala agora, volte ao mapa Cidades do Mundo.
            </p>
            <Button
              onClick={() => onChangeMap('atlas')}
              disabled={mapChanging}
              className="home-map-panel__primary mt-6"
            >
              <ArrowLeft size={16} aria-hidden />
              Selecionar Cidades do Mundo
            </Button>
          </section>
        )}
      </div>
    </EntryPanel>
  )
}
