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

// ---------------------------------------------------------------------
// Cidade — a geração RICA da metrópole (janelas em cor de grupo, torres-mastro com baliza)
// quantizada na grade de 8px do fliperama, e desenhada em padrão que ROLA. Determinística
// (LCG semeado): a cidade é a mesma em todo carregamento, e cada janela guarda o próprio
// atraso de piscada.
// ---------------------------------------------------------------------
const NEON_WINDOW = ['skyblue', 'pink', 'yellow', 'purple', 'orange'] as const
const PATTERN_W = 1440 // largura do padrão = deslocamento da animação (.neon-scroll)

function seeded(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

interface Tower {
  x: number
  w: number
  h: number
  mast: boolean
  lights: { x: number; y: number; hue: string; delay: number }[]
}

// Alturas BAIXAS de propósito: o sol é uma cúpula de 26vmin apoiada no horizonte, e torre
// mais alta que ela esconderia o sol inteiro. As poucas torres com mastro são as que cortam
// a cúpula — e é esse recorte que faz a cidade parecer na frente do poente, não colada nele.
function towers(seed: number, minH: number, maxH: number): Tower[] {
  const rnd = seeded(seed)
  const out: Tower[] = []
  let x = 0
  // Para o padrão emendar sem costura, a última torre precisa terminar antes de PATTERN_W:
  // vão entre prédios é normal, vão um pouco maior na emenda é invisível.
  while (x < PATTERN_W - 160) {
    const w = (6 + Math.round(rnd() * 9)) * 8 // 48..120, na grade de 8
    const h = (Math.round(minH / 8) + Math.round((rnd() * (maxH - minH)) / 8)) * 8
    const lights: Tower['lights'][number][] = []
    for (let ly = 16; ly < h - 16; ly += 24) {
      for (let lx = 8; lx < w - 12; lx += 24) {
        if (rnd() > 0.34) {
          lights.push({
            x: lx,
            y: ly,
            hue: `var(--color-group-${NEON_WINDOW[Math.floor(rnd() * NEON_WINDOW.length)]})`,
            delay: Math.round(rnd() * 7000),
          })
        }
      }
    }
    out.push({ x, w, h, mast: rnd() > 0.72, lights })
    x += w + 8 + Math.round(rnd() * 2) * 8
  }
  return out
}

const FAR = towers(90210, 72, 152)
const NEAR = towers(31337, 88, 184)

function TowerBand({ list, base, opacity, ink, className }: { list: Tower[]; base: number; opacity: number; ink: string; className: string }) {
  const band = (offset: number) => (
    <g key={offset} transform={`translate(${offset} 0)`}>
      {list.map((t) => (
        <g key={`${offset}-${t.x}`} transform={`translate(${t.x} ${base - t.h})`}>
          <rect width={t.w} height={t.h + 16} fill={ink} />
          <rect width={t.w} height={t.h} fill="none" stroke="var(--color-group-purple)" strokeOpacity="0.5" strokeWidth="1" />
          {t.mast && (
            <>
              {/* torre-mastro: sobe bem acima da fileira e vira a silhueta que corta o sol */}
              <rect x={Math.round((t.w * 0.28) / 8) * 8} y={-96} width={Math.round((t.w * 0.44) / 8) * 8} height={96} fill={ink} />
              <rect
                x={Math.round((t.w * 0.28) / 8) * 8}
                y={-96}
                width={Math.round((t.w * 0.44) / 8) * 8}
                height={96}
                fill="none"
                stroke="var(--color-group-purple)"
                strokeOpacity="0.5"
                strokeWidth="1"
              />
              <path d={`M${t.w / 2} -96v-24`} stroke="var(--color-group-pink)" strokeOpacity="0.6" strokeWidth="2" />
              <rect className="neon-beacon" x={t.w / 2 - 4} y={-128} width="8" height="8" fill="var(--color-group-red)" />
            </>
          )}
          {t.lights.map((l) => (
            <rect
              key={`${l.x}-${l.y}`}
              className="neon-window"
              x={l.x}
              y={l.y}
              width="8"
              height="8"
              fill={l.hue}
              style={{ animationDelay: `${l.delay}ms` }}
            />
          ))}
        </g>
      ))}
    </g>
  )
  return (
    <g className={className} opacity={opacity}>
      {[0, PATTERN_W].map(band)}
    </g>
  )
}

const COINS = Array.from({ length: 10 }, (_, i) => {
  const rnd = seeded(555 + i * 31)
  return { left: `${4 + Math.round(rnd() * 92)}%`, delay: `${-Math.round(rnd() * 9000)}ms`, dur: `${5 + Math.round(rnd() * 6)}s` }
})

export function HomeNeonArcade(actions: HomeActions) {
  const { reduced } = useMotion()
  const f = useHomeForm(actions)
  // O ticker precisa de uma volta contínua: a mesma lista DUAS vezes, e a animação desloca
  // exatamente metade da trilha — a emenda cai onde o conteúdo se repete.
  const [rail] = useState(() => [...CITIES, ...CITIES])

  return (
    <div className="neon-stage fixed inset-0 z-[70] overflow-y-auto overscroll-contain">
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="neon-sky" />
        <div className="neon-sun" />
        {/* A cidade para ACIMA do rodapé: o terço de baixo é a avenida (piso em grade). */}
        <svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 w-full h-full">
          <TowerBand list={FAR} base={556} opacity={0.5} ink="#160c2e" className="neon-scroll neon-scroll--far" />
          <TowerBand list={NEAR} base={604} opacity={0.92} ink="#0b0620" className="neon-scroll neon-scroll--near" />
        </svg>
        <div className="neon-floor" />
        <div className="neon-haze" />
        {COINS.map((c) => (
          <span key={c.left + c.delay} className="neon-coin" style={{ left: c.left, animationDelay: c.delay, animationDuration: c.dur }} />
        ))}
        <div className="neon-scan" />
        <div className="neon-roll" />
        <div className="neon-crt" />
      </div>

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
