// Cenário da Cidade da Fuligem (055/D-069). A home e todas as telas de entrada
// (identidade, lobby, erro e reentrada) usam exatamente este palco — o mesmo papel que o
// cenário do Atlas cumpre no outro mapa. O palco da partida (boards/StageBackdrop) reusa
// este mesmo SVG atenuado, então o que muda aqui muda atrás do tabuleiro também.
//
// A cidade em planos: FÁBRICAS ao fundo (fuligem clara), o COMPLEXO PRINCIPAL à frente com
// as janelas de fornalha, trilhos com um trem de carga cruzando o horizonte, postes
// elétricos antigos e névoa por cima.
//
// FÁBRICA, NÃO PRÉDIO. Silhueta de bloco com janelinhas espalhadas lê como escritório;
// o que separa os dois são quatro sinais, e o gerador entrega todos: telhado em DENTE DE
// SERRA, fileira de CHAMINÉS escalonadas (uma a três por fábrica, nunca só uma no cenário),
// VIDRO INDUSTRIAL em faixas horizontais contínuas — não janelinhas soltas — e um ANEXO
// tirado do vocabulário do lugar (torre de refrigeração, gasômetro, silos, caixa d'água).
//
// Disciplina de desempenho (FR-012): gerador semeado e determinístico; poucas dezenas de
// elementos animados sobre sete keyframes, tudo por transform/opacity e congelável sob
// prefers-reduced-motion. A cópia decorativa atrás do tabuleiro é estática: não há motivo
// para duplicar timelines que ficam quase inteiras escondidas pela mesa.
//
// NO LOBBY, a fábrica é o placar da mesa: cada assento ocupado acende uma seção do
// complexo principal na cor daquele jogador (estado → luz; sem timeline por janela).
import { createContext, useContext, useId, type CSSProperties, type ReactNode } from 'react'
import { useRoomStore } from '@/net/roomStore'
import './fuligem.css'

const PATTERN_W = 1440

// Custom properties viajam pelo `style` — o React as aplica em runtime, o TS só precisa
// do empurrão.
function vars(v: Record<string, string | number>): CSSProperties {
  return v as CSSProperties
}

function seeded(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

// Chaminé em coordenadas LOCAIS da fábrica: `top` é negativo (sobe acima do telhado).
interface Stack {
  x: number
  top: number
  w: number
}

interface Mill {
  x: number
  w: number
  h: number
  /** `hall` = galpão de dente de serra; `block` = bloco de tijolo com parapeito e respiros. */
  kind: 'hall' | 'block'
  stacks: Stack[]
  annex: 'cooling' | 'tank' | 'silo' | 'tower' | null
  /** Vidro industrial: faixas horizontais contínuas com montantes. */
  glazing: { y: number; h: number }[]
  /** Fornalhas do rés do chão — as únicas luzes quentes da silhueta. */
  furnaces: { x: number; flicker: boolean; delay: number }[]
}

function mills(seed: number, minH: number, maxH: number): Mill[] {
  const rnd = seeded(seed)
  const out: Mill[] = []
  let x = 8
  while (x < PATTERN_W - 140) {
    // Largura cresce COM a altura, e isso não é estética: galpão é uma construção larga e
    // baixa. Esticar só a altura devolveria a silhueta vertical de escritório — exatamente o
    // "prédio" que o dente de serra e o vidro industrial estão aqui para desfazer. Menos
    // fábricas e maiores é o que faz o distrito parecer perto.
    const w = (16 + Math.round(rnd() * 14)) * 8
    const h = (Math.round(minH / 8) + Math.round((rnd() * (maxH - minH)) / 8)) * 8
    const kind = rnd() > 0.42 ? 'hall' : 'block'

    // Fileira escalonada: chaminé isolada some na silhueta, três em degrau viram fábrica.
    const roll = rnd()
    const count = roll > 0.74 ? 3 : roll > 0.28 ? 2 : 1
    const stacks: Stack[] = Array.from({ length: count }, (_, i) => ({
      x: Math.round(w * (0.18 + i * 0.25)),
      top: -(46 + Math.round(rnd() * 8) * 9 + i * 13),
      w: 11 + (i % 2) * 3,
    }))

    // Faixas de vidro acompanham a altura: fixar a contagem deixaria parede cega demais nas
    // fábricas grandes, e é o vidro que sustenta a leitura industrial de longe.
    const bands = Math.min(5, Math.max(2, Math.round(h / 86)))
    const gap = (h - 44) / bands
    const glazing = Array.from({ length: bands }, (_, i) => ({
      y: 22 + Math.round(i * gap),
      h: kind === 'hall' ? 18 : 13,
    }))

    const furnaces: Mill['furnaces'] = []
    for (let fx = 16; fx < w - 26; fx += 44) {
      if (rnd() > 0.42) {
        const delay = Math.round(rnd() * 9000)
        furnaces.push({ x: fx, flicker: delay % 3 === 0, delay })
      }
    }

    const annexRoll = rnd()
    const annex =
      annexRoll > 0.8 ? 'cooling'
      : annexRoll > 0.64 ? 'tank'
      : annexRoll > 0.5 ? 'silo'
      : annexRoll > 0.38 ? 'tower'
      : null

    out.push({ x, w, h, kind, stacks, annex, glazing, furnaces })
    x += w + 10 + Math.round(rnd() * 3) * 8
  }
  return out
}

// ALTURA DAS BANDAS. Com 96–176 e 120–220 a cidade ocupava só o quinto de baixo do quadro e
// sobrava metade de céu vazio: de longe lia como uma faixa de rodapé, não como um distrito
// industrial em volta de quem olha. As faixas dobram de porte para o horizonte ficar ALTO —
// é a diferença entre "tem fábricas ao fundo" e "estou dentro da cidade da fuligem".
const FAR = mills(4451, 160, 270)
const NEAR = mills(7817, 200, 330)

// Chaminés que soltam fumaça. `every` decide quantas fábricas fumegam e `perMill` quantas
// chaminés de cada uma — a fila fica em ordem decrescente de altura, então `perMill: 2` pega
// as duas mais altas, nunca uma escondida atrás do telhado.
function plumeSites(
  list: Mill[],
  base: number,
  every: number,
  perMill = 1,
): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = []
  list.forEach((mill, index) => {
    if (index % every !== 0) return
    const byHeight = [...mill.stacks].sort((a, b) => a.top - b.top)
    for (const stack of byHeight.slice(0, perMill)) {
      out.push({ x: mill.x + stack.x + stack.w / 2, y: base - mill.h + stack.top })
    }
  })
  return out
}

// Torres de refrigeração exalam vapor largo e lento — limitado às `cap` primeiras.
function coolingSites(list: Mill[], base: number, cap: number): { x: number; y: number }[] {
  return list
    .filter((mill) => mill.annex === 'cooling')
    .slice(0, cap)
    .map((mill) => ({ x: mill.x + mill.w + 34, y: base - mill.h - 62 }))
}

// O céu tem que estar SUJO: uma chaminé fumegando a cada duas fábricas deixava o distrito
// limpo demais para um lugar chamado Cidade da Fuligem. Agora TODA fábrica do plano próximo
// fumega, pelas duas chaminés mais altas, e uma a cada duas do plano distante.
const FAR_PLUMES = plumeSites(FAR, 620, 4)
const NEAR_PLUMES = plumeSites(NEAR, 760, 3)
const NEAR_COOLING = coolingSites(NEAR, 760, 1)

// A chaminé mais alta do plano próximo ganha a baliza — o mesmo critério de um aeroporto.
const TALLEST_NEAR = NEAR_PLUMES.reduce((a, b) => (b.y < a.y ? b : a))

// Três sopros por pluma formam base/meio/cauda sem transformar cada chaminé em seis
// timelines. O gradiente radial dissolve as bordas e preserva a leitura de coluna.
const PUFFS = [0, 1, 2]

// A BORDA é o que faz fumaça parecer fumaça. Um círculo de preenchimento chapado lê como
// bolha de sabão, não importa a opacidade — o que dissolve o contorno é o gradiente radial
// (centro translúcido, borda em zero). Vale mais que qualquer ajuste de alpha e custa um
// `<defs>`. Filtro de blur resolveria também, e está fora de questão: filtro em elemento
// animado repinta a cada quadro (FR-012).
//
// O `--puff-peak` de cada pluma é o alpha do CENTRO, não do disco: com a borda em zero o
// alpha médio cai a cerca de um quarto do pico. É por isso que os picos aqui parecem altos
// para fundo quase preto — o valor chapado equivalente seria quatro vezes menor.
//
// CUIDADO ao mexer nestes picos: eles já foram inflados a 0,46 tentando "consertar" fumaça
// que não aparecia, quando a causa real era a colisão de id abaixo. Com o gradiente pintando,
// 0,46 vira bolha redonda. Se a fumaça sumir de novo, verifique o paint server ANTES de subir
// alpha — o sintoma dos dois problemas é idêntico e o remédio errado estraga o certo.
//
// O id do gradiente é ÚNICO POR INSTÂNCIA (`useId`), e isso não é preciosismo — foi um bug
// real, e silencioso do pior jeito. `url(#id)` resolve no documento inteiro e pega a PRIMEIRA
// ocorrência. A EntryShell fica montada-mas-oculta sob `<Activity>` junto com a HomeFuligem,
// então havia DOIS `#fuligem-puff-city`; o primeiro era o da árvore `display:none`, e o Chrome
// não usa paint server de subárvore não renderizada. Resultado: os sopros visíveis tinham
// geometria e opacidade corretas e pintavam NADA — fumaça invisível sem nenhum erro no
// console. Com id por instância a colisão não pode voltar, não importa quantos cenários
// montem juntos.
function usePaintId(prefix: string): string {
  return `${prefix}-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
}

export function PlumeDefs({ id }: { id: string }) {
  return (
    <defs>
      <radialGradient id={id}>
        <stop offset="0%" stopColor="var(--color-starlight)" stopOpacity="0.52" />
        <stop offset="46%" stopColor="var(--color-starlight)" stopOpacity="0.3" />
        <stop offset="100%" stopColor="var(--color-starlight)" stopOpacity="0" />
      </radialGradient>
    </defs>
  )
}

// A tinta dos sopros desce por contexto: `MainWorks`, `FlareStack` e `SteamVents` também
// soltam pluma, e passar o id de mão em mão por todos eles só criaria chance de esquecer um
// — que é exatamente como um sopro volta a pintar nada.
const PuffPaint = createContext<string>('')

export function PlumePaintProvider({ id, children }: { id: string; children: ReactNode }) {
  return <PuffPaint.Provider value={`url(#${id})`}>{children}</PuffPaint.Provider>
}

// Uma PLUMA são três sopros no MESMO keyframe com a fase deslocada por delay negativo: o
// que se vê é uma coluna contínua subindo, não um balão pulsando. Altura, deriva, pico e
// duração entram por custom property, então este cenário e o miolo do tabuleiro
// (boards/glyphs/patterns.tsx) compartilham UM keyframe só, em escalas diferentes.
//
// Exportada pelo mesmo motivo que o AirlinerMark do Atlas: o miolo do tabuleiro solta a
// MESMA fumaça, só num viewBox de 100 unidades em vez de 1440.
export function Plume({
  x,
  y,
  r,
  rise,
  drift,
  peak,
  dur,
  delay,
  count = 3,
  fill,
}: {
  x: number
  y: number
  r: number
  rise: number
  drift: number
  peak: number
  dur: number
  delay: number
  count?: number
  fill?: string
}) {
  const inherited = useContext(PuffPaint)
  const paint = fill ?? inherited
  return (
    <g transform={`translate(${x} ${y})`}>
      {PUFFS.slice(0, count).map((i) => (
        <circle
          key={i}
          className="fuligem-puff"
          r={r}
          fill={paint}
          style={vars({
            '--puff-rise': `${rise}px`,
            // Cada sopro deriva um pouco diferente: vento igual em todos vira coluna de
            // desenho técnico, não fumaça.
            '--puff-drift': `${Math.round(drift * (0.55 + i * 0.2))}px`,
            '--puff-peak': peak,
            '--puff-dur': `${dur}ms`,
            '--puff-t': i / count,
            animationDelay: `${delay - (i * dur) / count}ms`,
          })}
        />
      ))}
    </g>
  )
}

function sawtooth(width: number): string {
  const teeth = Math.max(2, Math.floor(width / 28))
  const step = width / teeth
  let d = `M0 0`
  for (let i = 0; i < teeth; i++) d += ` l${step * 0.6} -16 l${step * 0.4} 16`
  return d
}

// Anexos — o vocabulário do lugar. Cada um é silhueta cheia com um filete de luz fria
// marcando o volume (aro, costura, cinta): sem o filete a torre vira mancha.
function Annex({ mill, ink }: { mill: Mill; ink: string }) {
  const rim = { stroke: 'var(--color-starlight)', strokeOpacity: 0.07, fill: 'none' } as const
  if (mill.annex === 'cooling') {
    return (
      <g transform={`translate(${mill.w + 6} 16)`}>
        <path d="M0 0C11 -36 19 -48 17 -74L39 -74C37 -48 45 -36 56 0Z" fill={ink} />
        <rect x="15" y="-78" width="26" height="6" rx="2" fill={ink} />
        <path d="M17 -74h22" strokeWidth="1.6" {...rim} />
      </g>
    )
  }
  if (mill.annex === 'tank') {
    return (
      <g transform={`translate(${mill.w + 8} 16)`}>
        <rect x="0" y="-62" width="66" height="62" rx="5" fill={ink} />
        {[-46, -30, -14].map((y) => (
          <path key={y} d={`M2 ${y}h62`} strokeWidth="1.4" {...rim} />
        ))}
        <path d="M58 -60v58" strokeWidth="1.4" {...rim} />
      </g>
    )
  }
  if (mill.annex === 'silo') {
    return (
      <g transform={`translate(${mill.w + 8} 16)`}>
        {[0, 26, 52].map((dx) => (
          <path key={dx} d={`M${dx} 0v-52a11 11 0 0 1 22 0V0Z`} fill={ink} />
        ))}
        <path d="M0 -50h74" strokeWidth="1.4" {...rim} />
      </g>
    )
  }
  if (mill.annex === 'tower') {
    return (
      <g transform={`translate(${mill.w + 10} 16)`}>
        <path d="M6 0 20 -46M40 0 26 -46" stroke={ink} strokeWidth="5" fill="none" />
        <path d="M10 -22h26" stroke={ink} strokeWidth="3.5" fill="none" />
        <path d="M2 -46h42l-6 -22h-30Z" fill={ink} />
        <path d="M4 -46h38" strokeWidth="1.4" {...rim} />
      </g>
    )
  }
  return null
}

function MillBand({ list, base, ink, className, opacity }: {
  list: Mill[]
  base: number
  ink: string
  className?: string
  opacity: number
}) {
  return (
    <g className={className} opacity={opacity}>
      {list.map((mill) => (
        <g key={mill.x} transform={`translate(${mill.x} ${base - mill.h})`}>
          <Annex mill={mill} ink={ink} />
          <rect width={mill.w} height={mill.h + 16} fill={ink} />
          {mill.kind === 'hall' ? (
            <path d={sawtooth(mill.w)} fill={ink} stroke="none" />
          ) : (
            <>
              {/* parapeito com beiral + respiros de telhado: o bloco de tijolo da fábrica */}
              <rect x="-5" y="-9" width={mill.w + 10} height="10" fill={ink} />
              {[0.24, 0.52, 0.78].map((f) => (
                <rect key={f} x={Math.round(mill.w * f)} y="-20" width="16" height="12" rx="2" fill={ink} />
              ))}
            </>
          )}
          {/* chaminés cônicas com cinta pintada perto do topo */}
          {mill.stacks.map((stack) => (
            <g key={stack.x}>
              <path
                d={`M${stack.x - 3} 0L${stack.x + 1} ${stack.top}h${stack.w}l4 ${-stack.top}Z`}
                fill={ink}
              />
              <path
                d={`M${stack.x + 1} ${stack.top + 12}h${stack.w}`}
                stroke="var(--color-starlight)"
                strokeOpacity="0.08"
                strokeWidth="4"
              />
            </g>
          ))}
          {/* VIDRO INDUSTRIAL — faixa contínua com montantes, o oposto da janelinha solta */}
          {mill.glazing.map((band) => (
            <g key={band.y}>
              <rect
                x="10"
                y={band.y}
                width={mill.w - 20}
                height={band.h}
                fill="var(--color-brass)"
                opacity="0.16"
              />
              {Array.from({ length: Math.floor((mill.w - 20) / 22) }, (_, i) => (
                <rect key={i} x={10 + i * 22} y={band.y} width="3" height={band.h} fill={ink} />
              ))}
              <rect x="10" y={band.y + band.h / 2 - 1} width={mill.w - 20} height="2" fill={ink} />
            </g>
          ))}
          {/* fornalhas: as bocas quentes no rés do chão */}
          {mill.furnaces.map((furnace) => (
            <rect
              key={furnace.x}
              className={furnace.flicker ? 'fuligem-furnace' : undefined}
              x={furnace.x}
              y={mill.h - 30}
              width="18"
              height="14"
              rx="1"
              fill="var(--color-brass)"
              opacity="0.8"
              style={furnace.flicker ? { animationDelay: `${furnace.delay}ms` } : undefined}
            />
          ))}
        </g>
      ))}
    </g>
  )
}

// O COMPLEXO PRINCIPAL — a fábrica do lobby, com oito seções de janela (uma por assento).
// Sem sala (home), as seções ficam apagadas: vidro escuro.
function MainWorks({ seatColors, gatesOpen }: { seatColors: (string | null)[]; gatesOpen: boolean }) {
  const x = 470
  const base = 700
  const w = 500
  // A altura acompanha as bandas: com as fábricas vizinhas em 200–330, um complexo de 168
  // ficaria ANÃO no meio delas — e este é o prédio que carrega o placar da mesa no lobby,
  // o que menos pode encolher. As janelas de assento seguem no alto, onde a leitura é melhor.
  const h = 296
  return (
    <g transform={`translate(${x} ${base - h})`}>
      <rect width={w} height={h + 20} fill="#070605" />
      <path d={sawtooth(w)} fill="#070605" />
      {/* portões centrais — abrem na transição lobby → partida (CSS, congela sob
          movimento reduzido: o fato "aberto/fechado" permanece via data-open) */}
      <g className="fuligem-gates" data-open={gatesOpen ? '' : undefined}>
        <rect x={w / 2 - 34} y={h - 62} width={32} height={62} fill="#0f0c09" stroke="var(--color-brass)" strokeOpacity="0.35" strokeWidth="1.5" />
        <rect x={w / 2 + 2} y={h - 62} width={32} height={62} fill="#0f0c09" stroke="var(--color-brass)" strokeOpacity="0.35" strokeWidth="1.5" />
      </g>
      {/* brasa da fornalha respirando no vão dos portões — luz, não movimento */}
      <ellipse
        className="fuligem-forge"
        cx={w / 2}
        cy={h}
        rx="88"
        ry="30"
        fill="var(--color-brass)"
        opacity="0.1"
      />
      {/* oito seções de janela: assento ocupado acende na cor do jogador */}
      {Array.from({ length: 8 }, (_, i) => {
        const sx = 18 + i * 58
        const lit = seatColors[i]
        return (
          <g key={i} data-fuligem-seat={i} data-lit={lit ? '' : undefined}>
            <rect x={sx} y={26} width={40} height={30} rx={2}
              fill={lit ?? '#0d0a08'}
              opacity={lit ? 0.92 : 1}
              stroke={lit ? 'none' : 'rgb(240 231 212 / 0.08)'}
            />
            <path d={`M${sx} 41h40M${sx + 13} 26v30M${sx + 27} 26v30`} stroke="#070605" strokeWidth="2" />
            {lit && <rect x={sx - 4} y={22} width={48} height={38} rx={4} fill={lit} opacity="0.18" />}
          </g>
        )
      })}
      {/* chaminé-mestra: a mais alta do cenário, com cinta e baliza */}
      <path d="M60 0l4 -168h20l4 168" fill="#070605" />
      <path d="M64 -152h20" stroke="var(--color-starlight)" strokeOpacity="0.09" strokeWidth="5" />
      <circle className="fuligem-beacon" cx="74" cy="-172" r="4" fill="var(--color-signal)" />
      <Plume x={74} y={-174} r={17} rise={-286} drift={74} peak={0.15} dur={13000} delay={-2600} />
    </g>
  )
}

// Queimador de gás — a chama que nunca apaga no pátio. O tremor é rápido de propósito: é o
// único elemento do cenário que se mexe em escala de segundo, e ele PODE, porque é PEQUENO.
// O tamanho não é gosto, é o que segura a licença: uma chama grande vira bola de fogo e
// passa a competir com o formulário que fica na frente. Uma língua de fogo de ~14 unidades
// num viewBox de 1440 é um detalhe no horizonte; o dobro disso já é um farol.
// A ALTURA da haste não é estilo: a 168 unidades a chama nascia na altura dos telhados em
// dente de serra e, sendo tudo #070605, a haste desaparecia contra eles — sobrava uma chama
// flutuando sem chaminé. Um queimador real é a estrutura mais alta do pátio justamente para
// ficar acima de tudo; 260 unidades devolvem isso, e o filete de luz separa a haste do que
// está atrás.
function FlareStack({ x, base }: { x: number; base: number }) {
  // Mesma armadilha do gradiente dos sopros: id fixo colide entre as instâncias montadas
  // juntas e o halo pinta nada. Único por instância.
  const halo = usePaintId('fuligem-flare-halo')
  return (
    <g transform={`translate(${x} ${base})`}>
      <path d="M-8 0L-3 -260h6l5 260Z" fill="#070605" />
      <path d="M-3.5 -244h7" stroke="var(--color-starlight)" strokeOpacity="0.1" strokeWidth="4" />
      <path d="M-2.6 -258L-6.4 0" stroke="var(--color-starlight)" strokeOpacity="0.07" strokeWidth="1.6" />
      {/* o halo também precisa de gradiente: disco de fill chapado, mesmo a 7% de alpha,
          desenha um contorno nítido no céu — vira lua, não brilho de chama */}
      <defs>
        <radialGradient id={halo}>
          <stop offset="0%" stopColor="var(--color-brass-glow)" stopOpacity="0.34" />
          <stop offset="100%" stopColor="var(--color-brass-glow)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle className="fuligem-flare-glow" cx="1" cy="-268" r="24" fill={`url(#${halo})`} />
      <path
        className="fuligem-flare"
        d="M2 -258C-4 -266 -3 -276 1 -287C5 -276 8 -266 2 -258Z"
        fill="var(--color-brass-glow)"
        opacity="0.55"
      />
      <Plume x={3} y={-284} r={13} rise={-244} drift={80} peak={0.12} dur={11000} delay={-4200} />
    </g>
  )
}

// Respiros de vapor no chão do pátio: sopro curto, claro e rasteiro — o contraponto
// rápido da fumaça alta e lenta das chaminés.
const VENTS = [
  { x: 236, y: 754, delay: 0 },
  { x: 1046, y: 758, delay: -2400 },
  { x: 1332, y: 750, delay: -4100 },
] as const

function SteamVents() {
  return (
    <g>
      {VENTS.map((vent) => (
        <g key={vent.x}>
          <path d={`M${vent.x - 9} ${vent.y + 12}h18l-3 -14h-12Z`} fill="#070605" />
          <Plume
            x={vent.x}
            y={vent.y - 4}
            r={10}
            rise={-78}
            drift={34}
            peak={0.16}
            dur={5200}
            delay={vent.delay}
            count={2}
          />
        </g>
      ))}
    </g>
  )
}

// Brasas subindo do pátio — oito faíscas, a coisa mais barata do cenário e a que mais
// vende "isto está queimando agora".
const EMBERS = [
  { x: 118, dur: 21000, rise: -330, drift: 74, delay: 0 },
  { x: 352, dur: 26000, rise: -420, drift: -58, delay: -7000 },
  { x: 508, dur: 19000, rise: -280, drift: 66, delay: -13000 },
  { x: 690, dur: 29000, rise: -470, drift: 44, delay: -4000 },
  { x: 884, dur: 23000, rise: -350, drift: -72, delay: -17000 },
  { x: 1064, dur: 18000, rise: -300, drift: 58, delay: -9000 },
  { x: 1228, dur: 27000, rise: -440, drift: -46, delay: -21000 },
  { x: 1388, dur: 22000, rise: -320, drift: 68, delay: -2500 },
] as const

function Embers() {
  return (
    <g>
      {EMBERS.map((ember) => (
        <circle
          key={ember.x}
          className="fuligem-ember"
          cx={ember.x}
          cy={742}
          r="2.6"
          fill="var(--color-brass-glow)"
          style={vars({
            '--ember-rise': `${ember.rise}px`,
            '--ember-drift': `${ember.drift}px`,
            '--ember-dur': `${ember.dur}ms`,
            animationDelay: `${ember.delay}ms`,
          })}
        />
      ))}
    </g>
  )
}

// Galeria de correia levando carvão pro complexo principal — quatro caçambas subindo a
// rampa por translate, nunca por stroke-dashoffset (que repinta o traço todo).
const CONVEYOR = { x1: 246, y1: 734, x2: 452, y2: 616 }
const COAL = [0, 1, 2, 3]

function Conveyor() {
  const dx = CONVEYOR.x2 - CONVEYOR.x1
  const dy = CONVEYOR.y2 - CONVEYOR.y1
  const dur = 10000
  return (
    <g>
      {/* pernas de sustentação */}
      {[0.28, 0.62].map((f) => (
        <path
          key={f}
          d={`M${CONVEYOR.x1 + dx * f} ${CONVEYOR.y1 + dy * f + 6}V760`}
          stroke="#070605"
          strokeWidth="7"
        />
      ))}
      {/* casco da galeria */}
      <path
        d={`M${CONVEYOR.x1} ${CONVEYOR.y1}L${CONVEYOR.x2} ${CONVEYOR.y2}l0 -20L${CONVEYOR.x1} ${CONVEYOR.y1 - 20}Z`}
        fill="#070605"
      />
      <path
        d={`M${CONVEYOR.x1 + 2} ${CONVEYOR.y1 - 10}L${CONVEYOR.x2 - 2} ${CONVEYOR.y2 - 10}`}
        stroke="var(--color-starlight)"
        strokeOpacity="0.06"
        strokeWidth="2"
      />
      <g transform={`translate(${CONVEYOR.x1} ${CONVEYOR.y1 - 10})`}>
        {COAL.map((i) => (
          <rect
            key={i}
            className="fuligem-coal"
            x="0"
            y="-4"
            width="13"
            height="8"
            rx="2"
            fill="var(--color-brass)"
            opacity="0.28"
            style={vars({
              '--coal-dx': `${dx}px`,
              '--coal-dy': `${dy}px`,
              '--coal-dur': `${dur}ms`,
              animationDelay: `${-i * (dur / COAL.length)}ms`,
            })}
          />
        ))}
      </g>
    </g>
  )
}

// Postes elétricos antigos ligados por catenárias — a eletricidade chegando (estático).
function PowerPoles() {
  const poles = [140, 420, 760, 1080, 1360]
  return (
    <g stroke="#0a0807" strokeWidth="5" opacity="0.9">
      {poles.map((x) => (
        <g key={x}>
          <path d={`M${x} 828V678`} />
          <path d={`M${x - 26} 694h52M${x - 18} 710h36`} strokeWidth="4" />
        </g>
      ))}
      <path
        d={poles.slice(0, -1).map((x, i) => `M${x} 696 Q ${(x + poles[i + 1]) / 2} 726 ${poles[i + 1]} 696`).join(' ')}
        fill="none"
        stroke="#0a0807"
        strokeWidth="1.6"
      />
    </g>
  )
}

// Trem de carga cruzando ao fundo — UM grupo, uma animação de transform bem lenta.
function CargoTrain() {
  const cars = [0, 62, 124, 186, 248]
  return (
    <g className="fuligem-train" aria-hidden="true">
      <g fill="#080606">
        <rect x="-320" y="666" width="74" height="26" rx="3" />
        <rect x="-306" y="650" width="26" height="18" rx="2" />
        <circle cx="-300" cy="694" r="6" fill="#050403" />
        <circle cx="-262" cy="694" r="6" fill="#050403" />
        {cars.map((dx) => (
          <g key={dx}>
            <rect x={-238 + dx} y="672" width="54" height="20" rx="2" />
            <circle cx={-228 + dx} cy="694" r="5" fill="#050403" />
            <circle cx={-194 + dx} cy="694" r="5" fill="#050403" />
          </g>
        ))}
        <rect x="-310" y="644" width="8" height="8" fill="var(--color-brass)" opacity="0.85" />
      </g>
    </g>
  )
}

export function FuligemBackdrop({
  className,
  staticScene = false,
}: {
  className?: string
  staticScene?: boolean
}) {
  // Só o lobby/partida têm sala; na home o seletor devolve null e as seções ficam apagadas.
  const seats = useRoomStore((s) => s.room?.seats)
  const status = useRoomStore((s) => s.room?.status)
  const seatColors = Array.from({ length: 8 }, (_, i) => seats?.[i]?.color ?? null)
  const gatesOpen = status !== undefined && status !== 'lobby'
  const puffId = usePaintId('fuligem-puff-city')

  return (
    <PlumePaintProvider id={puffId}>
    <div
      className={`pointer-events-none fixed inset-0 overflow-hidden ${staticScene ? 'fuligem-backdrop--static' : ''} ${className ?? ''}`}
      data-entry-backdrop="fuligem"
      aria-hidden="true"
    >
      <div className="fuligem-sky" />
      <svg
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMax slice"
        className="absolute inset-0 h-full w-full"
      >
        <PlumeDefs id={puffId} />
        <MillBand list={FAR} base={620} ink="#0d0b09" opacity={0.5} />
        {/* Fumaça mora FORA da banda: assim ela sobe por cima das vizinhas em vez de ficar
            presa na opacidade do plano — e o plano distante ganha o próprio pico. */}
        <g opacity={0.6}>
          {FAR_PLUMES.map((site, i) => (
            <Plume
              key={site.x}
              x={site.x}
              y={site.y}
              r={13}
              rise={-208}
              drift={64}
              peak={0.15}
              dur={14000 + i * 1700}
              delay={-i * 4300}
            />
          ))}
        </g>
        <CargoTrain />
        <line x1="0" y1="700" x2="1440" y2="700" stroke="#0a0807" strokeWidth="3" />
        <MillBand list={NEAR} base={760} ink="#070605" opacity={0.96} />
        <Conveyor />
        <FlareStack x={1178} base={764} />
        {NEAR_PLUMES.map((site, i) => (
          <Plume
            key={site.x}
            x={site.x}
            y={site.y}
            r={16}
            rise={-268}
            drift={82}
            peak={0.17}
            dur={12000 + i * 1900}
            delay={-i * 3100}
          />
        ))}
        {NEAR_COOLING.map((site, i) => (
          <Plume
            key={`cool-${site.x}`}
            x={site.x}
            y={site.y}
            r={19}
            rise={-204}
            drift={52}
            peak={0.1}
            dur={17000 + i * 2300}
            delay={-i * 5600}
            count={5}
          />
        ))}
        <circle className="fuligem-beacon" cx={TALLEST_NEAR.x} cy={TALLEST_NEAR.y - 6} r="4" fill="var(--color-signal)" style={{ animationDelay: '-1400ms' }} />
        {/* Depois da fumaça: as luzes de assento do complexo nunca ficam sob véu (FR-011). */}
        <MainWorks seatColors={seatColors} gatesOpen={gatesOpen} />
        <SteamVents />
        <Embers />
        <PowerPoles />
      </svg>
      <div className="fuligem-haze" />
      <div className="fuligem-vignette" />
    </div>
    </PlumePaintProvider>
  )
}
