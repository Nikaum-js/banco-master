// Tela inicial (spec 038, US4 — FR-021). Antes desta spec, a única porta de entrada do
// multiplayer era digitar `?host=1` / `?room=<id>` na barra de endereços — inviável para
// qualquer pessoa fora do desenvolvimento.
//
// Ordem da tela (revisão de UI, referência: richup.io): NOME primeiro, uma ação primária
// grande logo abaixo, e as saídas de baixo peso (entrar por link, jogar local) numa fila
// secundária. O nome perguntado aqui é lembrado (`rememberPlayerName`) e chega preenchido
// na tela de identidade — no fluxo antigo, criar uma sala pedia o nome só no passo 2, e a
// primeira coisa que a home mostrava era um botão sem nenhum contexto de quem você é.
//
// O campo de link some por padrão: quem recebe um convite clica no link, não cola. Deixá-lo
// sempre aberto dava a duas ações de peso muito diferente o mesmo tamanho na tela.
//
// Visual: letreiro de pôster de viagem sobre a "sala de mapas" (entryShell) — o wordmark
// vive FORA do painel, grande, com o filete de latão, e o painel é um CARTÃO DE EMBARQUE:
// passageiro, ação de embarcar, perfuração e código de barras. A metáfora não é enfeite
// solto — ela nomeia cada campo que já existia ("seu nome" → passageiro) e amarra a home
// ao tema "Cidades do Mundo", que o letreiro de partidas (DepartureFlap) completa com os
// destinos vindos do tabuleiro de verdade.
import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Button } from '@/game/ui/primitives'
import { extractRoomId, rememberPlayerName, recallPlayerName, NAME_MAX } from '@/net/session'
import { BOARD, GROUPS } from '@/lib/boardData'
import { useMotion, MOTION, EASE } from '@/game/ui/motion'
import { PieceGlyph } from './pieceGlyphs'
import { DepartureFlap } from './departureFlap'
import { EntryPanel, EntryStage, OrnamentRule } from './entryShell'

// Injetado pelo `vite.config.ts` a partir do sha do commit publicado (Vercel/Actions).
const COMMIT_SHA = (import.meta.env.VITE_COMMIT_SHA as string | undefined) ?? ''

const MAX_PLAYERS = 8
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

export function HomeScreen({ onCreate, onJoin, onLocal }: { onCreate: () => void; onJoin: (roomId: string) => void; onLocal: () => void }) {
  const { reduced } = useMotion()
  const [name, setName] = useState(() => recallPlayerName())
  const [joinOpen, setJoinOpen] = useState(false)
  const [link, setLink] = useState('')
  const [pasteFailed, setPasteFailed] = useState(false)
  const roomId = extractRoomId(link)
  // Número do portão: sorteado uma vez por visita, só ornamento do bilhete.
  const [gate] = useState(() => String(1 + Math.floor(Math.random() * 24)).padStart(2, '0'))

  // O nome é opcional aqui — quem pular vai preenchê-lo no passo de identidade, que é
  // onde ele é de fato exigido. O que a home faz é só adiantá-lo.
  function go(action: () => void): void {
    rememberPlayerName(name)
    action()
  }

  // Atalho de quem recebeu o convite por fora (WhatsApp, Discord): colar sem sair do
  // teclado. A API de área de transferência pode ser negada ou nem existir — nesse caso
  // o botão se cala e o campo continua aceitando o Ctrl+V de sempre.
  async function pasteLink(): Promise<void> {
    try {
      const text = await navigator.clipboard.readText()
      if (text) setLink(text.trim())
      else setPasteFailed(true)
    } catch {
      setPasteFailed(true)
    }
  }

  return (
    <EntryStage>
      <header className="text-center">
        <p className="label text-brass tracking-caps text-[0.7rem]">Cidades do Mundo</p>
        <Wordmark />
        <OrnamentRule className="mt-3 mx-auto w-64 max-w-full [@media(max-height:640px)]:hidden" />
        <p className="text-starlight-muted text-sm mt-3">Banco imobiliário multiplayer — direto no navegador, sem instalar nada.</p>
      </header>

      {/* Em tela baixa (paisagem de celular) o letreiro é a primeira coisa a sair: é
          ambiente, e o cartão de embarque tem que caber sem rolagem. */}
      <DepartureFlap className="[@media(max-height:640px)]:hidden" />

      <EntryPanel className="max-w-sm">
        {/* Cabeçalho do bilhete: o que este painel é, e o "voo" (o tabuleiro). */}
        <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-2.5">
          <p className="label text-brass tracking-caps text-[0.55rem]">Cartão de embarque</p>
          <p className="label text-starlight-muted/70 text-[0.55rem] tabular-nums">
            voo BM-{String(BOARD.length).padStart(3, '0')}
          </p>
        </div>

        <div className="px-5 pb-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <label htmlFor="home-name" className="label text-brass">
                Passageiro
              </label>
              {/* o contador só existe depois que há o que contar */}
              {name.length > 0 && (
                <span className="label text-starlight-muted/60 text-[0.55rem] tabular-nums">
                  {name.length}/{NAME_MAX}
                </span>
              )}
            </div>
            <input
              id="home-name"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, NAME_MAX))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') go(onCreate)
              }}
              placeholder="Ex.: Marco Polo"
              maxLength={NAME_MAX}
              autoFocus
              className="entry-input text-center text-base tracking-wide"
            />
          </div>

          <div className="relative">
            {/* halo respirando atrás da ação principal — o único movimento dentro do
                painel, e ele existe para dizer por onde se começa */}
            <span className="cta-halo" aria-hidden="true" />
            <Button onClick={() => go(onCreate)} className="cta-embark group w-full py-3.5 text-base gap-2.5">
              <PieceGlyph
                id="bussola"
                size={18}
                className="transition-transform duration-500 ease-[var(--ease-paper)] group-hover:rotate-[140deg]"
              />
              Criar sala
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="secondary"
              aria-expanded={joinOpen}
              // Só referencia o campo quando ele existe: `aria-controls` apontando para um id
              // ausente é violação de `aria-valid-attr-value` no axe (gate de a11y, 044).
              aria-controls={joinOpen ? 'join-room-field' : undefined}
              onClick={() => setJoinOpen((v) => !v)}
            >
              Entrar com link
            </Button>
            <Button variant="secondary" onClick={() => go(onLocal)}>
              Jogar local
            </Button>
          </div>

          {/* A gaveta abre em altura, não em corte: o painel cresce junto e nada
              salta. Sob movimento reduzido ela simplesmente aparece. */}
          <AnimatePresence initial={false}>
            {joinOpen && (
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
                    {!pasteFailed && (
                      <button
                        type="button"
                        onClick={() => void pasteLink()}
                        className="label text-brass/80 hover:text-brass underline underline-offset-2 decoration-dotted text-[0.55rem]"
                      >
                        Colar
                      </button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input
                      id="join-room"
                      value={link}
                      onChange={(e) => setLink(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && roomId) go(() => onJoin(roomId))
                      }}
                      placeholder="Cole aqui o link da sala"
                      autoFocus
                      className="entry-input flex-1 min-w-0"
                    />
                    <Button disabled={!roomId} onClick={() => roomId && go(() => onJoin(roomId))}>
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
              <p className="display text-brass/90 text-lg leading-none tabular-nums">{gate}</p>
            </div>
          </div>
        </div>
      </EntryPanel>

      {/* Ficha técnica — os números vêm do tabuleiro, não de um texto solto: quantas
          casas e quantos países existem de fato. */}
      <footer className="flex flex-col items-center gap-2 [@media(max-height:640px)]:hidden">
        <p className="label text-starlight-muted/70 flex items-center gap-2.5 text-[0.55rem]">
          <span>{BOARD.length} casas</span>
          <span className="text-brass/50" aria-hidden="true">◆</span>
          <span>{Object.keys(GROUPS).length} países</span>
          <span className="text-brass/50" aria-hidden="true">◆</span>
          <span>até {MAX_PLAYERS} jogadores</span>
        </p>
        {/* Versão publicada (044, FR-048): é o que transforma "deu erro" em um relato
            que localiza a build. Vazio em desenvolvimento — aí não há o que identificar. */}
        {COMMIT_SHA && (
          <p className="label text-starlight-muted/70 text-[0.6rem] tracking-wider">versão {COMMIT_SHA.slice(0, 7)}</p>
        )}
      </footer>
    </EntryStage>
  )
}
