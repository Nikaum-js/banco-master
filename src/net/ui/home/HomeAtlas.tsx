// ESTILO 1 — "Atlas da Meia-Noite": carta náutica noturna, letreiro de pôster de viagem.
// A metáfora amarra a home ao
// tema "Cidades do Mundo", que o letreiro split-flap completa com destinos vindos do
// tabuleiro de verdade. O cenário (rotas, horizonte de cidade, rosa dos ventos, lanterna de
// cursor) vive em `entryShell.tsx`, compartilhado com o lobby.
import { motion } from 'motion/react'
import { useMotion, MOTION, EASE } from '@/game/ui/motion'
import { DepartureFlap } from '../departureFlap'
import { EntryStage, OrnamentRule } from '../entryShell'
import { TAGLINE, type HomeForm } from './homeShared'
import { HomeMapPanel } from './HomeMapPanel'
import type { BoardTheme } from '@/game/ui/theme/boardTheme'

const WORDMARK = [
  { text: 'Magnata', tone: 'text-starlight' },
  { text: 'Imobiliário', tone: 'text-brass' },
] as const

// Letra a letra, cada uma caindo com seu atraso — o letreiro monta na frente de quem
// chega em vez de simplesmente estar lá. O h1 carrega o texto inteiro para o leitor de
// tela (`sr-only`); as letras são a camada visual e ficam fora da árvore.
//
// A camada de brilho é uma CÓPIA do mesmo desenho de letras (mesmo markup, sem
// animação) com o gradiente recortado no texto — por isso as duas precisam sair da
// mesma função: qualquer divergência de espaçamento apareceria como brilho torto.
function letters(animated: boolean, reduced: boolean) {
  let n = 0
  return WORDMARK.map((word, w) => (
    <span key={word.text} className={animated ? word.tone : undefined}>
      {w > 0 && <span className="inline-block w-[0.22em]" />}
      {Array.from(word.text).map((ch, c) => {
        const delay = n++ * 0.045
        return animated ? (
          <motion.span
            key={`${word.text}-${c}`}
            className="inline-block"
            initial={reduced ? false : { opacity: 0, y: '0.42em', rotateX: -75 }}
            animate={{ opacity: 1, y: 0, rotateX: 0 }}
            transition={reduced ? { duration: 0 } : { duration: MOTION.slow, ease: EASE.emphasis, delay }}
          >
            {ch}
          </motion.span>
        ) : (
          <span key={`${word.text}-${c}`} className="inline-block">
            {ch}
          </span>
        )
      })}
    </span>
  ))
}

// O tamanho responde à ALTURA também (`vh` dentro do clamp): em paisagem de celular a
// tela tem ~390px de altura, e um letreiro dimensionado só por `vw` empurrava o
// formulário inteiro para fora da dobra.
function Wordmark() {
  const { reduced } = useMotion()
  return (
    <h1 className="display leading-[0.88] mt-2.5 text-[clamp(2.5rem,min(10vw,14vh),5.25rem)]">
      <span className="sr-only">Magnata Imobiliário</span>
      <span aria-hidden="true" className="relative inline-block">
        {letters(true, reduced)}
        {/* varredura de luz sobre as letras (CSS; some sob movimento reduzido) */}
        <span className="wordmark-shine">{letters(false, reduced)}</span>
      </span>
    </h1>
  )
}

export function HomeAtlas({
  f,
  onChangeMap,
  onMapIntent,
  mapChanging,
}: {
  f: HomeForm
  onChangeMap: (theme: BoardTheme) => void
  onMapIntent: (theme: BoardTheme) => void
  mapChanging: boolean
}) {
  const { reduced } = useMotion()

  return (
    <EntryStage>
      <header className="text-center">
        <p className="label text-brass tracking-caps text-[0.7rem]">Cidades do Mundo</p>
        <Wordmark />
        <OrnamentRule className="mt-3 mx-auto w-64 max-w-full [@media(max-height:640px)]:hidden" />
        <p className="text-starlight-muted text-sm mt-3">{TAGLINE}</p>
      </header>

      {/* Em tela baixa (paisagem de celular) o letreiro é a primeira coisa a sair: é
          ambiente, e o formulário precisa caber sem rolagem. */}
      <DepartureFlap className="[@media(max-height:640px)]:hidden" />

      <HomeMapPanel
        f={f}
        reduced={reduced}
        skin="atlas"
        onChangeMap={onChangeMap}
        onMapIntent={onMapIntent}
        mapChanging={mapChanging}
      />
    </EntryStage>
  )
}
