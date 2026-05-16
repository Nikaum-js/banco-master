// ESTILO 2 — "Fliperama Neon": as duas telas que antes eram separadas ("Metrópole Neon" e
// "Fliperama") viviam no mesmo mundo — cidade acesa à noite, roxo/ciano/rosa, letreiro
// grande — e competiam pelo mesmo lugar. Esta é uma só, montada com o melhor lado de cada:
//
//   da METRÓPOLE  →  sol partido apoiado no horizonte, piso em grade fugindo pro ponto de
//                    fuga, skyline com janelas nas cores dos grupos e torres-mastro com
//                    baliza, névoa de horizonte e o TICKER de cidades e preços que sai do
//                    tabuleiro de verdade (`homeShared.CITIES`).
//   do FLIPERAMA  →  letreiro em PIXEL (matriz 5×7 desenhada em retângulos) que BOOTA pixel
//                    a pixel, o tubo de imagem por cima (varredura, barra de sincronia,
//                    cantos escuros), o placar no topo, "insert coin" piscando, moedas
//                    caindo em passos e o hardware do gabinete no painel: canto reto,
//                    contorno grosso, botão com espessura que afunda.
//
// As duas coisas se somam num ponto específico: o letreiro de pixel ganhou o GLOW de tubo de
// neon (franja ciano/rosa + halo violeta), que nenhum dos dois tinha sozinho.
//
// Ficou de fora por escolha: as faíscas subindo (as moedas caindo já dão o movimento
// vertical, e duas coisas em sentidos opostos viravam sujeira) e o xadrez de chão do
// fliperama (a grade em perspectiva faz o mesmo trabalho melhor).
import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useMotion, MOTION, EASE } from '@/game/ui/motion'
import { CITIES, COMMIT_SHA, NAME_MAX, STATS, useHomeForm, type HomeActions } from './homeShared'
import { NeonBackdrop } from './NeonBackdrop'

// ---------------------------------------------------------------------
// Letreiro de pixel — matriz 5×7 por letra, só as dez de "BANCO MASTER".
// Por que matriz e não fonte: fonte pixel de verdade é um arquivo a mais no bundle e ainda
// escala com antialias no meio. Dez letras cabem em 70 bytes de string, e o desenho fica
// nítido em qualquer tamanho porque são retângulos.
// ---------------------------------------------------------------------
const GLYPHS: Record<string, string[]> = {
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  N: ['10001', '11001', '11001', '10101', '10011', '10011', '10001'],
  C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
}

const LINE1 = 'BANCO'
const LINE2 = 'MASTER'
const GLYPH_W = 5
const GAP = 1
const W2 = LINE2.length * (GLYPH_W + GAP) - GAP
const WORD_W = Math.max(LINE1.length * (GLYPH_W + GAP) - GAP, W2)
const WORD_H = 7 * 2 + 2 // duas linhas de 7 pixels com 2 de respiro

// Um pixel por retângulo, com o atraso crescendo da esquerda pra direita e de cima pra
// baixo: é isso que faz o letreiro "carregar" como um cartucho lendo a ROM.
function pixels(word: string, row: number, colorOf: (x: number) => string) {
  const out: { key: string; x: number; y: number; fill: string; delay: number }[] = []
  Array.from(word).forEach((ch, i) => {
    const g = GLYPHS[ch]
    if (!g) return
    g.forEach((line, y) => {
      Array.from(line).forEach((bit, x) => {
        if (bit !== '1') return
        const gx = i * (GLYPH_W + GAP) + x
        out.push({ key: `${row}-${i}-${x}-${y}`, x: gx, y, fill: colorOf(gx), delay: gx * 0.035 + y * 0.012 })
      })
    })
  })
  return out
}

function PixelWordmark() {
  const { reduced } = useMotion()
  // "BANCO" em ciano; "MASTER" na rampa quente do arcade. A cor varia por COLUNA, então o
  // gradiente é feito de pixels, não de um degradê suavizado (que trairia o estilo).
  const cool = () => 'var(--color-group-skyblue)'
  const hot = (x: number) => {
    const ramp = ['var(--color-group-yellow)', 'var(--color-group-orange)', 'var(--color-group-red)', 'var(--color-group-pink)']
    return ramp[Math.min(ramp.length - 1, Math.floor((x / W2) * ramp.length))]
  }
  const all = [...pixels(LINE1, 0, cool), ...pixels(LINE2, 1, hot).map((p) => ({ ...p, y: p.y + 9 }))]

  return (
    <h1 className="neon-pixelmark">
      <span className="sr-only">Banco Master</span>
      <svg viewBox={`-0.5 -0.5 ${WORD_W + 1} ${WORD_H + 1}`} aria-hidden="true" shapeRendering="crispEdges">
        {all.map((p) => (
          <motion.rect
            key={p.key}
            x={p.x}
            y={p.y}
            width={1}
            height={1}
            fill={p.fill}
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={reduced ? { duration: 0 } : { duration: 0.001, delay: p.delay }}
          />
        ))}
      </svg>
    </h1>
  )
}

export function HomeNeonArcade(actions: HomeActions) {
  const { reduced } = useMotion()
  const f = useHomeForm(actions)
  // O ticker precisa de uma volta contínua: a mesma lista DUAS vezes, e a animação desloca
  // exatamente metade da trilha — a emenda cai onde o conteúdo se repete.
  const [rail] = useState(() => [...CITIES, ...CITIES])

  return (
    <div className="neon-stage fixed inset-0 z-[70] overflow-y-auto overscroll-contain">
      <NeonBackdrop />

      {/* Placar do gabinete: os números do tabuleiro no lugar onde um arcade põe pontuação. */}
      <div className="neon-hud" aria-hidden="true">
        <span>
          1UP <b>{String(STATS.squares).padStart(5, '0')}</b>
        </span>
        <span className="neon-hud__mid">high score</span>
        <span>
          {STATS.players}P <b>{String(CITIES.length).padStart(5, '0')}</b>
        </span>
      </div>

      <div className="relative min-h-full flex flex-col items-center justify-center gap-6 p-4 py-12 [@media(max-height:640px)]:gap-2 [@media(max-height:640px)]:py-3">
        <header className="text-center">
          <PixelWordmark />
          <div className="neon-tube mt-5" aria-hidden="true" />
          <p className="neon-blink mt-3">insert coin · zero fichas</p>
          <p className="neon-sub mt-3">Compre cidades, negocie propriedades e domine o tabuleiro com seus amigos.</p>
        </header>

        <motion.div
          className="neon-card w-full max-w-sm"
          initial={reduced ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduced ? { duration: 0 } : { duration: MOTION.slow, ease: EASE.emphasis, delay: 0.32 }}
        >
          <span className="neon-marquee" aria-hidden="true" />
          <div className="neon-card__head">
            <p>player select</p>
            <p className="neon-tag tabular-nums">
              <span className="neon-dot" aria-hidden="true" />
              mesa {f.gate}
            </p>
          </div>

          <div className="p-5 flex flex-col gap-4 [@media(max-height:640px)]:p-3 [@media(max-height:640px)]:gap-2.5">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <label htmlFor="neon-name" className="neon-label">
                  Digite seu nome
                </label>
                {f.name.length > 0 && (
                  <span className="neon-label opacity-70 tabular-nums">
                    {f.name.length}/{NAME_MAX}
                  </span>
                )}
              </div>
              <input
                id="neon-name"
                value={f.name}
                onChange={(e) => f.setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') f.create()
                }}
                placeholder="Big Tokyo"
                maxLength={NAME_MAX}
                autoFocus
                className="neon-input"
              />
            </div>

            <button type="button" onClick={f.create} className="neon-cta">
              <span className="neon-cta__arrow" aria-hidden="true" />
              Começar uma partida
            </button>

            <button
              type="button"
              className="neon-ghost"
              aria-expanded={f.joinOpen}
              aria-controls={f.joinOpen ? 'neon-join' : undefined}
              onClick={f.toggleJoin}
            >
              Entrar com convite
            </button>

            <AnimatePresence initial={false}>
              {f.joinOpen && (
                <motion.div
                  id="neon-join"
                  key="join"
                  initial={reduced ? false : { opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
                  transition={reduced ? { duration: 0 } : { duration: MOTION.base, ease: EASE.emphasis }}
                  className="overflow-hidden"
                >
                  <div className="flex flex-col gap-1.5 pt-0.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <label htmlFor="neon-link" className="neon-label">
                        Link ou código recebido
                      </label>
                      {!f.pasteFailed && (
                        <button type="button" onClick={() => void f.pasteLink()} className="neon-label underline underline-offset-2">
                          Colar
                        </button>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <input
                        id="neon-link"
                        value={f.link}
                        onChange={(e) => f.setLink(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') f.join()
                        }}
                        placeholder="Cole aqui o link da sala"
                        autoFocus
                        className="neon-input flex-1 min-w-0 tracking-normal normal-case text-left"
                      />
                      <button type="button" disabled={!f.roomId} onClick={f.join} className="neon-ghost neon-ghost--go">
                        Entrar
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {COMMIT_SHA && <p className="neon-label opacity-60">ver {COMMIT_SHA.slice(0, 7)}</p>}
      </div>

      {/* Ticker da bolsa de imóveis — as cidades e os preços do tabuleiro correndo no rodapé
          da cidade. Fica FORA da árvore de acessibilidade: é ambiente. */}
      <div className="neon-ticker" aria-hidden="true">
        <div className="neon-ticker__rail">
          {rail.map((c, i) => (
            <span key={`${c.name}-${i}`} className="neon-ticker__item">
              <span className="neon-ticker__pip" style={{ backgroundColor: `var(--color-group-${c.group})` }} />
              {c.short}
              <b>${c.price}</b>
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
