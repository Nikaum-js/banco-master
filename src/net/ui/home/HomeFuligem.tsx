// ESTILO 2 — "Cidade da Fuligem" (055/D-069): a home da Revolução Industrial. Edição
// física premium: painel de ferro e madeira, letreiro de placa fundida, a cidade escura
// em planos ao fundo (FuligemBackdrop) com fornalhas acesas e o trem cruzando.
//
// A estrutura de entrada é a MESMA do Atlas — letreiro, mapa selecionado à esquerda e
// criação da sala à direita — porque a home é sempre a mesma coisa (homeShared); só o
// mundo muda. O palco é próprio (não `EntryStage`): as duas homes ficam montadas juntas
// sob <Activity> e cada uma precisa do SEU cenário, não do cenário do store global.
import { motion } from 'motion/react'
import { useMotion, MOTION, EASE } from '@/game/ui/motion'
import { COMMIT_SHA, TAGLINE, type HomeForm } from './homeShared'
import { FuligemBackdrop } from './FuligemBackdrop'
import { HomeMapPanel } from './HomeMapPanel'
import type { BoardTheme } from '@/game/ui/theme/boardTheme'

const WORDMARK = [
  { text: 'Magnata', tone: 'text-starlight' },
  { text: 'Imobiliário', tone: 'text-brass' },
] as const

// Placa fundida: as letras "assentam" com um leve queda de peso, como tipos de metal
// batidos numa chapa — parente do letreiro do Atlas, com gesto de prensa em vez de voo.
function PlateWordmark() {
  const { reduced } = useMotion()
  let n = 0
  return (
    <h1 className="display leading-[0.88] mt-2.5 text-[clamp(2.5rem,min(10vw,14vh),5.25rem)]">
      <span className="sr-only">Magnata Imobiliário</span>
      <span aria-hidden="true" className="fuligem-wordmark relative inline-block">
        {WORDMARK.map((word, w) => (
          <span key={word.text} className={word.tone}>
            {w > 0 && <span className="inline-block w-[0.22em]" />}
            {Array.from(word.text).map((ch, c) => {
              const delay = n++ * 0.04
              return (
                <motion.span
                  key={`${word.text}-${c}`}
                  className="inline-block"
                  initial={reduced ? false : { opacity: 0, y: '-0.3em', scale: 1.12 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={reduced ? { duration: 0 } : { duration: MOTION.base, ease: EASE.emphasis, delay }}
                >
                  {ch}
                </motion.span>
              )
            })}
          </span>
        ))}
      </span>
    </h1>
  )
}

export function HomeFuligem({
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
    <div className="fuligem-stage fixed inset-0 z-[70] overflow-y-auto overscroll-contain">
      <FuligemBackdrop />

      <div className="relative z-40 min-h-full flex flex-col items-center justify-center gap-6 p-4 py-12 [@media(max-height:640px)]:gap-2 [@media(max-height:640px)]:py-3">
        <header className="text-center">
          <p className="label text-brass tracking-caps text-[0.7rem]">Cidade da Fuligem</p>
          <PlateWordmark />
          {/* filete rebitado — o ornamento estrutural deste mundo */}
          <div className="fuligem-rivet-rule mt-3 mx-auto w-64 max-w-full [@media(max-height:640px)]:hidden" aria-hidden="true" />
          <p className="text-starlight-muted text-sm mt-3">{TAGLINE}</p>
        </header>

        <HomeMapPanel
          f={f}
          reduced={reduced}
          skin="fuligem"
          onChangeMap={onChangeMap}
          onMapIntent={onMapIntent}
          mapChanging={mapChanging}
        />

        {COMMIT_SHA && <p className="label text-starlight-muted/60 text-[0.62rem]">ver {COMMIT_SHA.slice(0, 7)}</p>}
      </div>
    </div>
  )
}
