// Tela inicial (spec 038, US4 — FR-021). Antes desta spec, a única porta de entrada do
// multiplayer era digitar `?host=1` / `?room=<id>` na barra de endereços — inviável para
// qualquer pessoa fora do desenvolvimento.
//
// A ordem da tela é a mesma nos dois estilos (revisão de UI, referência: richup.io): NOME
// primeiro, uma ação primária logo abaixo e a entrada por convite como caminho secundário.
// O modo local continua existindo apenas como andaime por URL para desenvolvimento e testes.
// O nome perguntado aqui é lembrado
// (`rememberPlayerName`) e chega preenchido na tela de identidade. O campo de link some por
// padrão: quem recebe um convite clica no link, não cola.
//
// A PELE vem do mapa ativo (`game/ui/theme/boardTheme.ts`), que é o MESMO eixo do mapa
// jogável (055/D-069): selecionar o mapa na home troca palco, painel e movimento — e é o
// valor que `OnlineGate` carrega até a criação da sala. A lógica (nome lembrado, extração
// do id da sala, colar do clipboard) mora em `home/homeShared.ts`, uma vez só: as duas
// homes desenham o mesmo formulário de jeitos diferentes.
import { motion } from 'motion/react'
import { Activity, useEffect, useState } from 'react'
import { Map } from 'lucide-react'
import { useMotion, MOTION, EASE } from '@/game/ui/motion'
import { useBoardTheme, type BoardTheme } from '@/game/ui/theme/boardTheme'
import { HomeAtlas } from './home/HomeAtlas'
import { HomeFuligem } from './home/HomeFuligem'
import { HOME_MAPS, useHomeForm, type HomeActions } from './home/homeShared'

const SCREEN = {
  atlas: HomeAtlas,
  fuligem: HomeFuligem,
} as const

export function HomeScreen(actions: HomeActions) {
  const { reduced } = useMotion()
  // A seleção da home É o mapa ativo do store (D-069) — é dele que `OnlineGate` lê o
  // valor que grava na sala. Sala publicada continua vencendo (roomStore.setRoom).
  const theme = useBoardTheme((s) => s.theme)
  const setTheme = useBoardTheme((s) => s.setTheme)
  const [mountedThemes, setMountedThemes] = useState<BoardTheme[]>(() => [theme])
  const [themeTransition, setThemeTransition] = useState<{
    target: BoardTheme
    phase: 'cover' | 'reveal'
  } | null>(null)
  // Acima da troca de pele: nome, convite e gaveta permanecem intactos quando
  // o seletor de mapa alterna Atlas ⇄ Fuligem.
  const f = useHomeForm(actions)

  // Cada palco tem mais de mil nós decorativos. Depois da primeira montagem, mantê-lo no
  // DOM e tirá-lo apenas da renderização evita reconstruir todo o SVG a cada comparação.
  // O segundo mapa é preparado quando o browser estiver ocioso, fora da interação.
  useEffect(() => {
    const mountAllThemes = () => {
      setMountedThemes((current) => (
        current.length === Object.keys(SCREEN).length ? current : ['atlas', 'fuligem']
      ))
    }

    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(mountAllThemes, { timeout: 1_500 })
      return () => window.cancelIdleCallback(id)
    }

    const id = window.setTimeout(mountAllThemes, 800)
    return () => window.clearTimeout(id)
  }, [])

  function changeMap(target: BoardTheme): void {
    if (target === theme || themeTransition) return
    setMountedThemes((current) => (
      current.includes(target) ? current : [...current, target]
    ))
    if (reduced) {
      setTheme(target)
      return
    }
    setThemeTransition({ target, phase: 'cover' })
  }

  function advanceThemeTransition(): void {
    if (!themeTransition) return
    if (themeTransition.phase === 'cover') {
      // A prévia só muda quando a cortina cobre tudo. Assim a fonte do mundo
      // novo nunca recalcula a tela antiga diante da pessoa.
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
              <Screen
                f={f}
                onChangeMap={changeMap}
                mapChanging={active && themeTransition !== null}
              />
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
