// ESTILO 1 — "Atlas da Meia-Noite": carta náutica noturna, letreiro de pôster de viagem.
// A metáfora amarra a home ao
// tema "Cidades do Mundo", que o letreiro split-flap completa com destinos vindos do
// tabuleiro de verdade. O cenário (rotas, horizonte de cidade, rosa dos ventos, lanterna de
// cursor) vive em `entryShell.tsx`, compartilhado com o lobby.
import { motion } from 'motion/react'
import { useMotion, MOTION, EASE } from '@/game/ui/motion'
import { DepartureFlap } from '../departureFlap'
import { EntryStage, OrnamentRule } from '../entryShell'
import { COMMIT_SHA, TAGLINE, type HomeForm } from './homeShared'
import { HomeMapPanel } from './HomeMapPanel'

const WORDMARK = [
  { text: 'Banco', tone: 'text-starlight' },
  { text: 'Master', tone: 'text-brass' },
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
      <span className="sr-only">Banco Master</span>
      <span aria-hidden="true" className="relative inline-block">
        {letters(true, reduced)}
        {/* varredura de luz sobre as letras (CSS; some sob movimento reduzido) */}
        <span className="wordmark-shine">{letters(false, reduced)}</span>
      </span>
    </h1>
  )
}

export function HomeAtlas({ f }: { f: HomeForm }) {
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

      <HomeMapPanel f={f} reduced={reduced} skin="atlas" />

      {/* Benefícios concretos da sala online — informação útil antes de começar. */}
      <footer className="flex flex-col items-center gap-2 [@media(max-height:640px)]:hidden">
        <p className="label text-starlight-muted/70 flex items-center gap-2.5 text-[0.55rem]">
          <span>Multiplayer em tempo real</span>
          <span className="text-brass/50" aria-hidden="true">◆</span>
          <span>Convite por link</span>
          <span className="text-brass/50" aria-hidden="true">◆</span>
          <span>Partida salva automaticamente</span>
        </p>
        {/* Versão publicada (044, FR-048): é o que transforma "deu erro" em um relato
            que localiza a build. Vazio em desenvolvimento — aí não há o que identificar. */}
        {COMMIT_SHA && <p className="label text-starlight-muted/70 text-[0.6rem] tracking-wider">versão {COMMIT_SHA.slice(0, 7)}</p>}
      </footer>
    </EntryStage>
  )
}
