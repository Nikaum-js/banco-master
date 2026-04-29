// ESTILO 1 — "Atlas da Meia-Noite": carta náutica noturna, letreiro de pôster de viagem
// e o painel como CARTÃO DE EMBARQUE (embarque, perfuração, código de barras).
// A metáfora amarra a home ao
// tema "Cidades do Mundo", que o letreiro split-flap completa com destinos vindos do
// tabuleiro de verdade. O cenário (rotas, horizonte de cidade, rosa dos ventos, lanterna de
// cursor) vive em `entryShell.tsx`, compartilhado com o lobby.
import { AnimatePresence, motion } from 'motion/react'
import { Button } from '@/game/ui/primitives'
import { useMotion, MOTION, EASE } from '@/game/ui/motion'
import { DepartureFlap } from '../departureFlap'
import { EntryPanel, EntryStage, OrnamentRule } from '../entryShell'
import { COMMIT_SHA, MAX_PLAYERS, NAME_MAX, STATS, TAGLINE, useHomeForm, type HomeActions } from './homeShared'

// Bússola do CTA — puramente decorativa (gira no hover). Ficava no catálogo de peças, que
// saiu com D-044; a arte veio junto pra cá porque o botão é o único lugar que a usava.
function CompassGlyph({ size = 17, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="16" cy="16" r="12.2" />
      <path d="M16 3.8v2.4M28.2 16h-2.4M16 28.2v-2.4M3.8 16h2.4" />
      <path d="M21.9 10.1 18 18l-7.9 3.9L14 14Z" />
      <circle cx="16" cy="16" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  )
}

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
// tela tem ~390px de altura, e um letreiro dimensionado só por `vw` empurrava o cartão
// de embarque inteiro para fora da dobra.
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

export function HomeAtlas(actions: HomeActions) {
  const { reduced } = useMotion()
  const f = useHomeForm(actions)

  return (
    <EntryStage>
      <header className="text-center">
        <p className="label text-brass tracking-caps text-[0.7rem]">Cidades do Mundo</p>
        <Wordmark />
        <OrnamentRule className="mt-3 mx-auto w-64 max-w-full [@media(max-height:640px)]:hidden" />
        <p className="text-starlight-muted text-sm mt-3">{TAGLINE}</p>
      </header>

      {/* Em tela baixa (paisagem de celular) o letreiro é a primeira coisa a sair: é
          ambiente, e o cartão de embarque tem que caber sem rolagem. */}
      <DepartureFlap className="[@media(max-height:640px)]:hidden" />

      <EntryPanel className="max-w-sm">
        {/* Cabeçalho do bilhete: o que este painel é, e o "voo" (o tabuleiro). */}
        <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-2.5">
          <p className="label text-brass tracking-caps text-[0.55rem]">Cartão de embarque</p>
          <p className="label text-starlight-muted/70 text-[0.55rem] tabular-nums">voo BM-{String(STATS.squares).padStart(3, '0')}</p>
        </div>

        <div className="px-5 pb-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <label htmlFor="home-name" className="label text-brass">
                Nome
              </label>
              {/* o contador só existe depois que há o que contar */}
              {f.name.length > 0 && (
                <span className="label text-starlight-muted/60 text-[0.55rem] tabular-nums">
                  {f.name.length}/{NAME_MAX}
                </span>
              )}
            </div>
            <input
              id="home-name"
              value={f.name}
              onChange={(e) => f.setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') f.create()
              }}
              placeholder="Ex.: Marco Polo"
              maxLength={NAME_MAX}
              autoFocus
              className="entry-input text-center text-base tracking-wide"
            />
          </div>

          <div className="relative">
            <Button variant="ghost" onClick={f.create} className="cta-embark group w-full py-3 text-sm gap-2.5">
              <CompassGlyph
                size={17}
                className="text-brass transition-transform duration-500 ease-[var(--ease-paper)] group-hover:rotate-[140deg]"
              />
              Começar uma partida
            </Button>
          </div>

          <Button
            variant="ghost"
            className="w-full py-2.5 border-transparent bg-transparent text-starlight-muted hover:text-brass hover:border-brass/40"
            aria-expanded={f.joinOpen}
            // Só referencia o campo quando ele existe: `aria-controls` apontando para um id
            // ausente é violação de `aria-valid-attr-value` no axe (gate de a11y, 044).
            aria-controls={f.joinOpen ? 'join-room-field' : undefined}
            onClick={f.toggleJoin}
          >
            Entrar com convite
          </Button>

          {/* A gaveta abre em altura, não em corte: o painel cresce junto e nada
              salta. Sob movimento reduzido ela simplesmente aparece. */}
          <AnimatePresence initial={false}>
            {f.joinOpen && (
              <motion.div
                id="join-room-field"
                key="join"
                initial={reduced ? false : { opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
                transition={reduced ? { duration: 0 } : { duration: MOTION.base, ease: EASE.emphasis }}
                className="overflow-hidden"
              >
                <div className="flex flex-col gap-1.5 pt-0.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <label htmlFor="join-room" className="label text-brass">
                      Link ou código recebido
                    </label>
                    {!f.pasteFailed && (
                      <button
                        type="button"
                        onClick={() => void f.pasteLink()}
                        className="label text-brass/80 hover:text-brass underline underline-offset-2 decoration-dotted text-[0.55rem]"
                      >
                        Colar
                      </button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input
                      id="join-room"
                      value={f.link}
                      onChange={(e) => f.setLink(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') f.join()
                      }}
                      placeholder="Cole aqui o link da sala"
                      autoFocus
                      className="entry-input flex-1 min-w-0"
                    />
                    <Button disabled={!f.roomId} onClick={f.join}>
                      Entrar
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Talão do bilhete: perfuração, código de barras e os "dados do voo" — é o
            rodapé do painel virando parte da metáfora em vez de sobra. A linha vai de
            borda a borda: os furos precisam morder a moldura, não flutuar dentro dela. */}
        <div className="pass-perf px-5 pt-3.5 pb-4 flex items-end justify-between gap-5 [@media(max-height:640px)]:hidden">
          <span className="pass-barcode w-32 max-w-[45%]" aria-hidden="true" />
          <div className="flex items-end gap-5">
            <div className="text-right">
              <p className="label text-starlight-muted/60 text-[0.5rem]">Assentos</p>
              <p className="display text-starlight/80 text-lg leading-none tabular-nums">{MAX_PLAYERS}</p>
            </div>
            <div className="text-right">
              <p className="label text-starlight-muted/60 text-[0.5rem]">Portão</p>
              <p className="display text-brass/90 text-lg leading-none tabular-nums">{f.gate}</p>
            </div>
          </div>
        </div>
      </EntryPanel>

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
