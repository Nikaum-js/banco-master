import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, Link2, Map } from 'lucide-react'
import { Button } from '@/game/ui/primitives'
import { EASE, MOTION } from '@/game/ui/motion'
import {
  BOARD_THEMES,
  BOARD_THEME_LABEL,
  useBoardTheme,
} from '@/game/ui/theme/boardTheme'
import { cn } from '@/lib/utils'
import { EntryPanel } from '../entryShell'
import { MAX_PLAYERS, NAME_MAX, STATS, type HomeForm } from './homeShared'

type HomeMapSkin = 'atlas' | 'neon'

function CityNetwork() {
  return (
    <svg viewBox="0 0 280 190" className="h-auto w-full" fill="none" aria-hidden="true">
      <path className="home-map-panel__route" d="M23 145 72 98l54 18 43-66 82 27" />
      <path className="home-map-panel__route home-map-panel__route--muted" d="m72 98 13-54 84 6 39 100" />
      {[
        [23, 145, 5],
        [72, 98, 7],
        [85, 44, 4],
        [126, 116, 5],
        [169, 50, 8],
        [208, 150, 5],
        [251, 77, 6],
      ].map(([cx, cy, radius]) => (
        <g key={`${cx}-${cy}`}>
          <circle
            cx={cx}
            cy={cy}
            r={radius + 5}
            fill="var(--home-map-accent)"
            fillOpacity="0.08"
          />
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="var(--color-ink-950)"
            stroke="var(--home-map-accent)"
          />
          <circle cx={cx} cy={cy} r="1.8" fill="var(--home-map-hot)" stroke="none" />
        </g>
      ))}
      <path d="M14 171H266" stroke="var(--color-ink-400)" strokeDasharray="2 8" />
    </svg>
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
}: {
  f: HomeForm
  reduced: boolean
  skin: HomeMapSkin
}) {
  const theme = useBoardTheme((state) => state.theme)
  const nextTheme = BOARD_THEMES[(BOARD_THEMES.indexOf(theme) + 1) % BOARD_THEMES.length]
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
              <p className="home-map-panel__eyebrow">Mapa selecionado</p>
              <h3>Cidades do Mundo</h3>
              <span>Novos mapas em breve</span>
            </div>
            <button
              type="button"
              className="home-map-panel__theme-button"
              title={`Experimentar o visual ${BOARD_THEME_LABEL[nextTheme]}`}
              aria-label={`Mudar visual do mapa para ${BOARD_THEME_LABEL[nextTheme]}`}
              onClick={() => useBoardTheme.getState().cycle()}
            >
              <Map size={21} aria-hidden />
            </button>
          </div>

          <CityNetwork />

          <div className="home-map-panel__stats">
            <div>
              <strong>{STATS.countries}</strong>
              <span>países</span>
            </div>
            <div>
              <strong>{STATS.squares}</strong>
              <span>casas</span>
            </div>
            <div>
              <strong>{MAX_PLAYERS}</strong>
              <span>jogadores</span>
            </div>
          </div>
        </section>

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
      </div>
    </EntryPanel>
  )
}
