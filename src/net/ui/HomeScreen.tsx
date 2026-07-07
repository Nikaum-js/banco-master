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
import { useMotion, MOTION, EASE } from '@/game/ui/motion'
import { useBoardTheme } from '@/game/ui/theme/boardTheme'
import { HomeAtlas } from './home/HomeAtlas'
import { HomeNeonArcade } from './home/HomeNeonArcade'
import { useHomeForm, type HomeActions } from './home/homeShared'

const SCREEN = {
  atlas: HomeAtlas,
  neon: HomeNeonArcade,
} as const

export function HomeScreen(actions: HomeActions) {
  const { reduced } = useMotion()
  const theme = useBoardTheme((s) => s.theme)
  const Screen = SCREEN[theme]
  // Acima da troca de pele: nome, convite e gaveta permanecem intactos quando
  // o seletor de mapa alterna Atlas ⇄ Neon.
  const f = useHomeForm(actions)

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
          <Screen f={f} />
        </motion.div>
      </AnimatePresence>
    </>
  )
}
