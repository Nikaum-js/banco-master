// A home inicial paga apenas pelo Atlas. A Cidade da Fuligem entra quando o seletor recebe
// hover/foco/toque e permanece montada depois da primeira visita para preservar formulário
// e eliminar o travamento das trocas seguintes.
import { Activity, lazy, Suspense, useState } from 'react'
import { motion } from 'motion/react'
import { Map } from 'lucide-react'
import { importWithReload } from '@/app/lazyImportRecovery'
import { useMotion, MOTION, EASE } from '@/game/ui/motion'
import { useBoardTheme, type BoardTheme } from '@/game/ui/theme/boardTheme'
import { HomeAtlas } from './home/HomeAtlas'
import { HOME_MAPS, useHomeForm, type HomeActions } from './home/homeShared'

type FuligemModule = typeof import('./home/HomeFuligem')
let fuligemModule: Promise<{ default: FuligemModule['HomeFuligem'] }> | null = null

function loadHomeFuligem(): Promise<{ default: FuligemModule['HomeFuligem'] }> {
  fuligemModule ??= importWithReload(() =>
    import('./home/HomeFuligem').then((module) => ({ default: module.HomeFuligem })),
  )
  return fuligemModule
}

const HomeFuligem = lazy(loadHomeFuligem)

function preloadTheme(theme: BoardTheme): Promise<void> {
  if (theme === 'atlas') return Promise.resolve()
  return loadHomeFuligem().then(() => undefined)
}

const SCREEN = {
  atlas: HomeAtlas,
  fuligem: HomeFuligem,
} as const

function ThemeLoading() {
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-ink-900 p-6">
      <p role="status" className="label text-brass">Preparando o mapa…</p>
    </div>
  )
}

export function HomeScreen(actions: HomeActions) {
  const { reduced } = useMotion()
  const theme = useBoardTheme((state) => state.theme)
  const setTheme = useBoardTheme((state) => state.setTheme)
  const [mountedThemes, setMountedThemes] = useState<BoardTheme[]>(() => [theme])
  const [preparingTheme, setPreparingTheme] = useState<BoardTheme | null>(null)
  const [themeTransition, setThemeTransition] = useState<{
    target: BoardTheme
    phase: 'cover' | 'reveal'
  } | null>(null)
  const form = useHomeForm(actions)

  function prepareTheme(target: BoardTheme): void {
    void preloadTheme(target)
  }

  async function changeMap(target: BoardTheme): Promise<void> {
    if (target === theme || themeTransition || preparingTheme) return
    setPreparingTheme(target)
    try {
      await preloadTheme(target)
    } finally {
      setPreparingTheme(null)
    }
    setMountedThemes((current) => current.includes(target) ? current : [...current, target])
    if (reduced) {
      setTheme(target)
      return
    }
    setThemeTransition({ target, phase: 'cover' })
  }

  function advanceThemeTransition(): void {
    if (!themeTransition) return
    if (themeTransition.phase === 'cover') {
      setTheme(themeTransition.target)
      setThemeTransition({ ...themeTransition, phase: 'reveal' })
      return
    }
    setThemeTransition(null)
  }

  return (
    <div className="contents" data-home-switching={themeTransition ? '' : undefined}>
      {mountedThemes.map((mountedTheme) => {
        const Screen = SCREEN[mountedTheme]
        const active = mountedTheme === theme
        return (
          <Activity key={mountedTheme} mode={active ? 'visible' : 'hidden'}>
            <motion.div
              data-home-screen
              data-home-theme={mountedTheme}
              hidden={!active}
              aria-hidden={!active}
              initial={reduced ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={reduced ? { duration: 0 } : { duration: MOTION.slow, ease: EASE.standard }}
            >
              <Suspense fallback={<ThemeLoading />}>
                <Screen
                  f={form}
                  onChangeMap={(target) => void changeMap(target)}
                  onMapIntent={prepareTheme}
                  mapChanging={active && (preparingTheme !== null || themeTransition !== null)}
                />
              </Suspense>
            </motion.div>
          </Activity>
        )
      })}

      {themeTransition && (
        <motion.div
          className={`home-theme-transition home-theme-transition--${themeTransition.target}`}
          data-theme-transition={themeTransition.phase}
          initial={{ x: '-100%' }}
          animate={{ x: themeTransition.phase === 'cover' ? 0 : '100%' }}
          transition={{
            duration: themeTransition.phase === 'cover' ? 0.28 : 0.38,
            delay: themeTransition.phase === 'reveal' ? 0.04 : 0,
            ease: EASE.emphasis,
          }}
          onAnimationComplete={advanceThemeTransition}
          aria-hidden="true"
        >
          <motion.div
            className="home-theme-transition__content"
            animate={{ opacity: themeTransition.phase === 'cover' ? 1 : 0 }}
            transition={{ duration: 0.14 }}
          >
            <div className="home-theme-transition__map">
              <Map size={30} />
            </div>
            <span>Carregando mapa</span>
            <strong>{HOME_MAPS[themeTransition.target].name}</strong>
            <div className="home-theme-transition__route">
              <i />
              <i />
              <i />
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  )
}
