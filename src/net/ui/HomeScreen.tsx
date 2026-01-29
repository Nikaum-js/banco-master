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
// A PELE vem do tema do app (`game/ui/theme/boardTheme.ts`), não de um seletor próprio: a
// tela de entrada é parte do tema, e trocar de visual no ícone do mapa
// troca a home junto — Atlas da Meia-Noite ou Fliperama Neon, cada uma com palco, painel e
// movimento próprios. A lógica (nome lembrado, extração do id da sala, colar do clipboard)
// mora em `home/homeShared.ts`, uma vez só: as duas desenham o mesmo formulário de jeitos
// diferentes.
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { Map } from 'lucide-react'
import { useMotion, MOTION, EASE } from '@/game/ui/motion'
import {
  useBoardTheme,
  type BoardTheme,
} from '@/game/ui/theme/boardTheme'
import { HomeAtlas } from './home/HomeAtlas'
import { HomeNeonArcade } from './home/HomeNeonArcade'
import { HOME_MAPS, useHomeForm, type HomeActions } from './home/homeShared'

const SCREEN = {
  atlas: HomeAtlas,
  neon: HomeNeonArcade,
} as const

export function HomeScreen(actions: HomeActions) {
  const { reduced } = useMotion()
  const theme = useBoardTheme((s) => s.theme)
  const Screen = SCREEN[theme]
  const [themeTransition, setThemeTransition] = useState<{
    target: BoardTheme
    phase: 'cover' | 'reveal'
  } | null>(null)
  // Acima da troca de pele: nome, convite e gaveta permanecem intactos quando
  // o seletor de mapa alterna Atlas ⇄ Neon.
  const f = useHomeForm(actions)

  function changeMap(target: BoardTheme): void {
    if (target === theme || themeTransition) return
    if (reduced) {
      useBoardTheme.getState().setTheme(target)
      return
    }
    setThemeTransition({ target, phase: 'cover' })
  }

  function advanceThemeTransition(): void {
    if (!themeTransition) return
    if (themeTransition.phase === 'cover') {
      // O tema global só muda quando a cortina cobre tudo. Assim a fonte do
      // mundo novo nunca recalcula a tela antiga diante da pessoa.
      useBoardTheme.getState().setTheme(themeTransition.target)
      setThemeTransition({ ...themeTransition, phase: 'reveal' })
      return
    }
    setThemeTransition(null)
  }

  return (
    <>
      {/* Sem `mode="wait"`: os dois palcos são `fixed inset-0`, então deixá-los coexistir
          por um instante é o que dá a dissolvência de um para o outro — esperar o primeiro
          sair deixaria um frame de tela vazia no meio da comparação. */}
      <AnimatePresence initial={false}>
        <motion.div
          key={theme}
          data-home-screen
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0 }}
          transition={reduced ? { duration: 0 } : { duration: MOTION.slow, ease: EASE.standard }}
        >
          <Screen
            f={f}
            onChangeMap={changeMap}
            mapChanging={themeTransition !== null}
          />
        </motion.div>
      </AnimatePresence>

      {themeTransition && (
        <motion.div
          className={`home-theme-transition home-theme-transition--${themeTransition.target}`}
          data-theme-transition={themeTransition.phase}
          initial={{ clipPath: 'polygon(0 0, 0 0, -12% 100%, -12% 100%)' }}
          animate={{
            clipPath: themeTransition.phase === 'cover'
              ? 'polygon(0 0, 112% 0, 100% 100%, 0 100%)'
              : 'polygon(100% 0, 112% 0, 100% 100%, 100% 100%)',
          }}
          transition={{
            duration: themeTransition.phase === 'cover' ? 0.42 : 0.62,
            delay: themeTransition.phase === 'reveal' ? 0.16 : 0,
            ease: EASE.emphasis,
          }}
          onAnimationComplete={advanceThemeTransition}
          aria-hidden="true"
        >
          <motion.div
            className="home-theme-transition__content"
            animate={{ opacity: themeTransition.phase === 'cover' ? 1 : 0 }}
            transition={{ duration: 0.18 }}
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
    </>
  )
}
