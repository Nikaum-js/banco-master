// Pregão simultâneo (§7.3) — modal autônomo (lê game.landAuction).
// Visual baseado no LEILÃO COMUM (003/ModalLayer): avatar = flag circular do país (ou SquareIcon),
// stripe do grupo, escritura sob demanda.
// Cada lote é um cartão com seu PRÓPRIO cronômetro (barra + contagem regressiva) — lance
// reinicia só o lote dele. A janela é `THEME.LAND_AUCTION_SECONDS`, hoje 24s (D-060): era 8s,
// e foi a pressa que essa janela criava — sem prazo visível — que motivou a remoção do
// mecanismo na D-059. O prazo mostrado deriva do `deadline` AUTORITATIVO do estado, corrigido
// pelo offset de relógio do host, nunca de um timer local.
// pt-BR. NÃO é o leilão de casas (D-022).
//
// ---------------------------------------------------------------------------------------
// DOIS LAYOUTS, UMA HIERARQUIA (D-078)
//
// Com o limiar da escassez em 6, o pregão passa a caber até SEIS lotes na mesma tela. Três
// cabiam em qualquer lugar; seis não cabem em paisagem de celular de jeito nenhum — 6 × um
// cartão de ~150px de altura são 900px de conteúdo num aparelho com 328px de modal.
//
//   · Grade (desktop/tablet/retrato): os lotes lado a lado, até 3 colunas no desktop e 2 no
//     tablet. Comparar nome, tempo, lance e maior interessado é uma varredura, não uma
//     navegação — é o que a simultaneidade do pregão pede.
//   · Seleção + painel (paisagem baixa): uma FAIXA de seleção com todos os lotes em resumo
//     (nome curto, cronômetro, estado) e, abaixo, o painel completo do lote escolhido. Sem
//     carrossel e sem rolagem horizontal: os dois escondem lote, e num pregão simultâneo o
//     que o jogador não vê ele perde. A faixa mantém o estado dos OUTROS lotes visível
//     enquanto ele decide sobre um.
//
// A escolha é de ESTRUTURA, não de pintura, então quem decide é o React (`useMediaQuery`) e
// não um `display: none`: com CSS, os seis cartões continuariam na árvore, com seis paradas
// de tabulação e seis leituras para o leitor de tela.
//
// A ordem de leitura é a MESMA nos dois: identidade do terreno · tempo restante · lance atual
// e maior interessado · caixa disponível e comprometido · ação principal · incrementos ·
// escritura sob demanda.
import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useGameStore } from '@/game/store'
import { useLocalView, useName } from '@/net/roomStore'
import { PlayerName } from '@/net/ui/PlayerName'
import { committedCash, LAND_AUCTION_WINDOW } from '@/game/economy/landAuction'
import type { LandLot } from '@/game/economy/types'
import { type Square } from '@/lib/boardData'
import { SquareIcon } from '@/boards/glyphs/squares'
import { CoinIcon, HouseIcon, HotelIcon, GavelIcon } from '@/game/ui/icons'
import { Button } from '@/game/ui/primitives'
import { Overlay, ModalShell, ModalHeader } from '@/game/ui/shell'
import { MOTION, useMotion } from '@/game/ui/motion'
import { useMediaQuery } from '@/game/ui/media'
import { money } from '@/lib/money'
import { deedPresentation } from '@/game/ui/deed/presentation'
import { CountryFlagDisc } from '@/boards/glyphs/flags'
import { PropertyIconArt } from '@/boards/glyphs/propertyIcons'
import { countryName } from '@/boards/glyphs/countries'
import { activeBoard } from '@/game/ui/theme/boardTheme'

const INCREMENTS = [10, 50, 100] as const
const clamp01 = (x: number) => Math.max(0, Math.min(1, x))

// Paisagem BAIXA — celular deitado (667×375, 740×360). O corte é só por ALTURA: o tablet em
// paisagem (1024×768) tem altura de sobra e fica na grade, como manda o desenho. É o mesmo
// eixo que o resto da folha usa para paisagem estreita, sem o ramo de `max-width` que
// arrastaria o tablet junto.
const LANDSCAPE_TIGHT = '(orientation: landscape) and (max-height: 560px)'

// Avatar da propriedade (igual ao leilão comum): flag circular do país; aeroporto/utilidade = ícone.
function LandDeedIcon({ sq, size = 40 }: { sq: Square; size?: number }) {
  const deed = deedPresentation(sq)
  if (deed?.flagCode) {
    return (
      <CountryFlagDisc code={deed.flagCode} size={size} />
    )
  }
  // Terceiro ramo, o que faltava: propriedade SEM bandeira (Fuligem). `SquareIcon` só cobre
  // casa especial e devolve null em `property`, então o lote saía sem avatar. Mesmo conserto do
  // leilão comum e do compositor de negociação — a causa era uma só, em três telas.
  if (sq.kind === 'property') {
    return (
      <span className="shrink-0 flex items-center justify-center" style={{ width: size, height: size, color: deed?.accent ?? 'var(--color-brass)' }}>
        <PropertyIconArt icon={sq.icon ?? 'building'} size={size * 0.8} />
      </span>
    )
  }
  return <span className="text-gold shrink-0"><SquareIcon square={sq} size={size * 0.8} /></span>
}

function rentRows(sq: Square): { label: string; value: string }[] {
  const deed = deedPresentation(sq)
  if (!deed) return []
  const rows = deed.rentRows.map((row, index) => ({
    label: deed.kind === 'property' && index === 0 ? 'Terreno' : row.label,
    value: row.kind === 'money' ? money(row.value) : `${row.value}× dados`,
  }))
  if (deed.kind === 'airport') rows.push({ label: 'Com Hangar', value: `${deed.hangar.multiplier}×` })
  return rows
}

function DeedStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 flex-1">
      <span className="text-gold">{icon}</span>
      <span className="currency text-cream text-xs leading-none">{value}</span>
      <span className="label text-cream-muted text-nano">{label}</span>
    </div>
  )
}

// --------------------------------------------------------------------------------------
// Leitura de um lote — tudo o que os dois layouts precisam saber, derivado uma vez só.
// --------------------------------------------------------------------------------------
interface LotView {
  lot: LandLot
  sq: Square
  name: string
  origem: string
  accent: string
  price: number
  secs: number
  frac: number
  urgente: boolean
  encerrado: boolean
  liderando: boolean
  /** Rótulo textual do estado. Nunca só cor: é ele que vai ao leitor de tela e ao chip. */
  estado: string
  cashAvail: number
  committed: number
  minimo: number
  podeMinimo: boolean
}

function readLot(
  lot: LandLot,
  now: number,
  bidder: string,
  cash: number,
  committed: number,
): LotView | null {
  const sq = activeBoard()[lot.pos]
  const deed = deedPresentation(sq)
  if (!deed) return null
  const remainingMs = lot.deadline - now
  const encerrado = remainingMs <= 0
  const liderando = lot.highBidder === bidder
  const cashAvail = cash - committed
  const minimo = lot.currentBid + INCREMENTS[0]
  return {
    lot,
    sq,
    name: deed.name,
    origem: deed.flagCode ? countryName(deed.flagCode) : (deed.subtitle ?? ''),
    accent: deed.accent,
    price: deed.price,
    secs: Math.max(0, Math.ceil(remainingMs / 1000)),
    frac: clamp01(remainingMs / LAND_AUCTION_WINDOW),
    // Alerta proporcional à janela, não um 3 fixo herdado dos 8s: um quarto do prazo é o ponto
    // em que "dá tempo de pensar" vira "decide agora", em qualquer janela que o tema configure.
    urgente: remainingMs <= LAND_AUCTION_WINDOW * 0.25,
    encerrado,
    liderando,
    estado: encerrado
      ? (lot.highBidder ? 'Arrematado, fechando' : 'Sem lance, fica livre')
      : liderando ? 'Você lidera'
      : lot.highBidder ? 'Lance de rival'
      : 'Sem lance',
    cashAvail,
    committed,
    minimo,
    podeMinimo: minimo <= cashAvail && !encerrado,
  }
}

// --------------------------------------------------------------------------------------
// Cronômetro do lote. Um só componente para os dois layouts, com dois tamanhos.
//
// O número NÃO é anunciado a cada segundo: `aria-live="off"` no dígito, e o prazo fica
// disponível sob demanda no `progressbar`, cuja mudança de valor um leitor de tela não
// verbaliza sozinho. Contagem regressiva falada de segundo em segundo cobre justamente o
// anúncio que importa (encerramento, lance novo).
// --------------------------------------------------------------------------------------
function LotClock({ view, size }: { view: LotView; size: 'sm' | 'lg' }) {
  const { reduced } = useMotion()
  if (view.encerrado) {
    return (
      <span className="lot-clock__closed">
        <GavelIcon size={size === 'lg' ? 13 : 11} aria-hidden />
        {view.estado}
      </span>
    )
  }
  return (
    <div className={`lot-clock lot-clock--${size}`}>
      <span className="lot-clock__secs" aria-live="off">{view.secs}<small>s</small></span>
      <div
        className="lot-clock__bar"
        role="progressbar"
        aria-valuenow={view.secs}
        aria-valuemin={0}
        aria-valuemax={Math.round(LAND_AUCTION_WINDOW / 1000)}
        aria-label={`Tempo restante do lote ${view.name}`}
      >
        <motion.div
          className="lot-clock__fill"
          // `prefers-reduced-motion` (§12.6): sem interpolação a barra ainda cai — o FATO
          // permanece, só a suavização some. Zerar a barra seria remover a informação.
          animate={{ width: `${view.frac * 100}%` }}
          transition={reduced ? { duration: 0 } : { ease: 'linear', duration: MOTION.base }}
        />
      </div>
    </div>
  )
}

// Blocos 3 a 6 da hierarquia, comuns aos dois layouts: lance atual e maior interessado, caixa
// disponível e comprometido, ação principal, incrementos.
function LotDecision({ view, onBid }: { view: LotView; onBid: (pos: number, amount: number) => void }) {
  /**
   * Trava de reenvio. Dois cliques rápidos no mesmo botão mandavam dois comandos: o segundo
   * virava no-op no host, mas gastava difusão e piscava a UI.
   *
   * DERIVADA, não sincronizada por efeito: guarda-se o valor enviado, e ele conta como "em voo"
   * só enquanto for MAIOR que o lance atual. Quando a difusão chega, `currentBid` alcança o
   * valor e a trava solta sozinha.
   */
  const [sentAmount, setSentAmount] = useState(0)
  const inFlight = (amount: number): boolean => sentAmount === amount && amount > view.lot.currentBid

  return (
    <>
      {/* 3. Quanto está, e quanto vale — lado a lado, porque a comparação é a decisão */}
      <div className="lot-figures">
        <span className="lot-figures__cell">
          <span className="lot-figures__value lot-figures__value--bid">{money(view.lot.currentBid)}</span>
          <span className="lot-figures__label">
            {view.lot.highBidder ? <>lance de <PlayerName playerId={view.lot.highBidder} /></> : 'sem lance'}
          </span>
        </span>
        <span className="lot-figures__cell lot-figures__cell--right">
          <span className="lot-figures__value">{money(view.price)}</span>
          <span className="lot-figures__label">preço de tabela</span>
        </span>
      </div>

      {/* 4. Caixa disponível PARA ESTE LOTE, e o que já está comprometido nos outros.
          A trava de solvência é por soma (§7.3), então o número que decide o lance não é o
          saldo: é o saldo menos o que ele já lidera. Sem esta linha o botão desabilitado
          parecia bug. */}
      <p className="lot-purse">
        <span className="lot-purse__avail">
          <CoinIcon size={11} aria-hidden />
          <span className="currency">{money(view.cashAvail)}</span>
          <span className="lot-purse__tag">disponível</span>
        </span>
        {view.committed > 0 && (
          <span className="lot-purse__held">
            <span className="currency">{money(view.committed)}</span>
            <span className="lot-purse__tag">comprometido</span>
          </span>
        )}
      </p>

      {/* 5. Uma ação principal, e 6. os incrementos como secundárias */}
      <div className="lot-actions">
        <Button
          disabled={!view.podeMinimo || inFlight(view.minimo)}
          onClick={() => { setSentAmount(view.minimo); onBid(view.lot.pos, view.minimo) }}
          className="lot-actions__primary"
          title={!view.podeMinimo ? 'Caixa insuficiente (o que você lidera em outros lotes fica comprometido)' : undefined}
        >
          {inFlight(view.minimo) ? 'Enviando…' : `Cobrir · ${money(view.minimo)}`}
        </Button>
        <div className="lot-actions__steps">
          {INCREMENTS.slice(1).map((inc) => {
            const next = view.lot.currentBid + inc
            const pode = next <= view.cashAvail && !view.encerrado
            return (
              <button
                key={inc}
                type="button"
                disabled={!pode || inFlight(next)}
                onClick={() => { setSentAmount(next); onBid(view.lot.pos, next) }}
                className="lot-actions__step hit-44"
                aria-label={`Lance de ${money(next)} em ${view.name}`}
                title={pode ? `Lance de ${money(next)}` : 'Caixa insuficiente'}
              >
                +{inc}
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}

// 7. Escritura completa, sob demanda. Em 24s ninguém compara oito linhas de aluguel — mas
// quem quer conferir antes de subir o lance precisa poder.
function LotDeed({ view }: { view: LotView }) {
  const deed = deedPresentation(view.sq)
  if (!deed) return null
  return (
    <details className="lot-deed">
      <summary className="lot-deed__summary">Escritura</summary>
      <div className="lot-deed__body">
        {rentRows(view.sq).map((r) => (
          <div key={r.label} className="lot-deed__row">
            <span>{r.label}</span>
            <span className="currency tabular-nums">{r.value}</span>
          </div>
        ))}
        <div className="lot-deed__stats">
          <DeedStat icon={<CoinIcon size={13} />} label="Preço" value={money(deed.price)} />
          {deed.kind === 'property' && <DeedStat icon={<HouseIcon size={13} />} label="Casa" value={money(deed.buildCost)} />}
          {deed.kind === 'property' && <DeedStat icon={<HotelIcon size={13} />} label="Hotel" value={money(deed.buildCost)} />}
          {deed.kind === 'airport' && <DeedStat icon={<HotelIcon size={13} />} label="Hangar" value={money(deed.hangar.cost)} />}
        </div>
      </div>
    </details>
  )
}

// --------------------------------------------------------------------------------------
// Cartão de lote — layout de GRADE (desktop, tablet, retrato).
// --------------------------------------------------------------------------------------
function LotCard({ view, onBid }: { view: LotView; onBid: (pos: number, amount: number) => void }) {
  return (
    <div
      className={`lot-card${view.urgente && !view.encerrado ? ' lot-card--urgent' : ''}${view.encerrado ? ' lot-card--closed' : ''}`}
      style={{ '--lot-accent': view.accent } as React.CSSProperties}
    >
      {/* 1. Que lote é */}
      <div className="lot-card__head">
        <LandDeedIcon sq={view.sq} size={30} />
        <div className="lot-card__identity">
          <p className="lot-card__name">{view.name}</p>
          <p className="lot-card__origin">{view.origem}</p>
        </div>
        {view.liderando && !view.encerrado && <span className="lot-badge" title="Você é o maior licitante deste lote">SEU</span>}
      </div>

      {/* 2. Quanto tempo tenho */}
      <LotClock view={view} size="lg" />

      <LotDecision view={view} onBid={onBid} />
      <LotDeed view={view} />
    </div>
  )
}

// --------------------------------------------------------------------------------------
// Faixa de seleção — layout de PAISAGEM BAIXA. `tablist` porque é exatamente isso: um
// conjunto de lotes em que um está selecionado e revela o painel abaixo. Ganha de graça o
// que o leitor de tela precisa dizer ("lote 3 de 6, selecionado") e a navegação por setas.
//
// O cronômetro do chip é `aria-hidden`: o número muda quatro vezes por segundo, e um leitor
// de tela que reanuncie o elemento focado a cada mudança tornaria a faixa inaudível. O
// estado ("sem lance", "você lidera", "encerrado") entra no nome acessível, que é a
// informação estável; o prazo continua sob demanda no `progressbar` do painel.
// --------------------------------------------------------------------------------------
function LotStrip({
  views,
  selected,
  onSelect,
  tabId,
  panelId,
}: {
  views: LotView[]
  selected: number
  onSelect: (pos: number) => void
  tabId: (pos: number) => string
  panelId: string
}) {
  const move = (e: React.KeyboardEvent, index: number): void => {
    const delta = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : e.key === 'Home' ? -index : e.key === 'End' ? views.length - 1 - index : 0
    if (delta === 0) return
    e.preventDefault()
    const next = views[(index + delta + views.length) % views.length]
    onSelect(next.lot.pos)
    document.getElementById(tabId(next.lot.pos))?.focus()
  }

  return (
    <div className="lot-strip" role="tablist" aria-label="Lotes do pregão" style={{ '--lot-strip-cols': views.length } as React.CSSProperties}>
      {views.map((v, i) => (
        <button
          key={v.lot.pos}
          id={tabId(v.lot.pos)}
          type="button"
          role="tab"
          aria-selected={v.lot.pos === selected}
          aria-controls={panelId}
          tabIndex={v.lot.pos === selected ? 0 : -1}
          aria-label={`Lote ${i + 1} de ${views.length}, ${v.name}, ${v.estado}${v.lot.currentBid > 0 ? `, maior lance ${money(v.lot.currentBid)}` : ''}`}
          onClick={() => onSelect(v.lot.pos)}
          onKeyDown={(e) => move(e, i)}
          className={`lot-chip${v.lot.pos === selected ? ' lot-chip--on' : ''}${v.urgente && !v.encerrado ? ' lot-chip--urgent' : ''}${v.encerrado ? ' lot-chip--closed' : ''}`}
          style={{ '--lot-accent': v.accent } as React.CSSProperties}
        >
          <span className="lot-chip__name">{v.name}</span>
          <span className="lot-chip__meta" aria-hidden>
            {/* Estado por FORMA e TEXTO, nunca só por cor: martelo = encerrado, ponto cheio =
                seu, ponto vazado = lance de rival, traço = sem lance. */}
            <span className="lot-chip__mark">
              {v.encerrado ? <GavelIcon size={9} /> : v.liderando ? '●' : v.lot.highBidder ? '○' : '·'}
            </span>
            <span className="lot-chip__secs">{v.encerrado ? 'fim' : `${v.secs}s`}</span>
          </span>
          <span className="lot-chip__bar" aria-hidden>
            <span className="lot-chip__bar-fill" style={{ width: `${v.frac * 100}%` }} />
          </span>
        </button>
      ))}
    </div>
  )
}

// Painel do lote selecionado — mesma hierarquia do cartão, com o cronômetro grande porque
// aqui ele não compete com mais nada.
function LotPanel({
  view,
  onBid,
  id,
  labelledBy,
}: {
  view: LotView
  onBid: (pos: number, amount: number) => void
  id: string
  labelledBy: string
}) {
  return (
    <div
      id={id}
      role="tabpanel"
      aria-labelledby={labelledBy}
      tabIndex={-1}
      className={`lot-panel${view.urgente && !view.encerrado ? ' lot-panel--urgent' : ''}${view.encerrado ? ' lot-panel--closed' : ''}`}
      style={{ '--lot-accent': view.accent } as React.CSSProperties}
    >
      <div className="lot-panel__head">
        <LandDeedIcon sq={view.sq} size={28} />
        <div className="lot-card__identity">
          <p className="lot-card__name">{view.name}</p>
          <p className="lot-card__origin">{view.origem}</p>
        </div>
        {view.liderando && !view.encerrado && <span className="lot-badge">SEU</span>}
        <LotClock view={view} size="lg" />
      </div>
      <div className="lot-panel__body">
        <LotDecision view={view} onBid={onBid} />
      </div>
      <LotDeed view={view} />
    </div>
  )
}

/**
 * Anúncio de ENCERRAMENTO para leitor de tela.
 *
 * O fecho de um lote é o único evento do pregão que muda o mundo sem o jogador ter feito
 * nada, e é o que a contagem regressiva silenciosa (de propósito) não entrega. Uma região
 * `polite` fala uma vez por lote, quando ele cruza o prazo, e nunca repete.
 */
function useClosingAnnouncement(views: LotView[]): string {
  const announced = useRef<Set<number>>(new Set())
  const [message, setMessage] = useState('')
  const encerrados = views.filter((v) => v.encerrado).map((v) => `${v.lot.pos}:${v.estado}`).join('|')

  useEffect(() => {
    const novos = views
      .filter((v) => v.encerrado && !announced.current.has(v.lot.pos))
      .map((v) => {
        announced.current.add(v.lot.pos)
        return `${v.name}: ${v.estado}.`
      })
    if (novos.length > 0) setMessage(novos.join(' '))
    // `encerrados` é a assinatura estável do conjunto já fechado — o efeito não roda a cada
    // tick do relógio, só quando um lote de fato cruza o prazo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [encerrados])

  return message
}

export function LandAuctionLayer() {
  const { reduced } = useMotion()
  const auction = useGameStore((s) => s.game.landAuction)
  const players = useGameStore((s) => s.game.players)
  const game = useGameStore((s) => s.game)
  const dispatch = useGameStore((s) => s.dispatch)
  const placeLandBid = (playerId: string, pos: number, amount: number): void =>
    dispatch({ kind: 'place-land-bid', playerId, pos, amount })

  const [pickedBidder, setPickedBidder] = useState<string | null>(null)
  const [pickedLot, setPickedLot] = useState<number | null>(null)
  // Online, o licitante é o ASSENTO LOCAL (spec 038, FR-002) — o seletor de licitante do
  // 031 existia porque o cliente único jogava por todos. Sem sala, ele continua.
  const local = useLocalView()
  // Título pela ORIGEM dos lotes (039 / FR-020): o mecanismo é o mesmo, o que muda é o
  // que está sendo leiloado. Nome do falido vem da SALA (FR-021), nunca do GameState (D-019).
  const bankruptName = useName(auction?.bankruptId)
  const title =
    auction?.origin === 'bankruptcy' ? `Espólio de ${bankruptName}`
    : auction?.origin === 'mixed' ? `Espólio de ${bankruptName} + terrenos livres`
    : 'Leilão de Escassez'
  // O licitante válido é DERIVADO, não sincronizado por efeito: a escolha só vale enquanto
  // estiver na lista de licitantes do pregão em curso (ela muda quando um pregão fecha e
  // outro abre), senão cai no primeiro. Guardar isso em estado exigia um efeito que
  // corrigia o próprio estado — um render intermediário com licitante inválido na tela.
  const setBidder = setPickedBidder
  const bidder =
    local.seatId ??
    (pickedBidder && auction?.bidders.includes(pickedBidder) ? pickedBidder : auction?.bidders[0] ?? null)
  const [now, setNow] = useState(() => Date.now())
  const compacto = useMediaQuery(LANDSCAPE_TIGHT)

  // Tick do relógio (barras) enquanto há pregão aberto.
  useEffect(() => {
    if (!auction) return
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [auction])

  const cash = players.find((p) => p.id === bidder)?.cash ?? 0
  const views = (auction?.lots ?? [])
    .map((lot) => readLot(lot, now, bidder ?? '', cash, bidder ? committedCash(game, bidder, lot.pos) : 0))
    .filter((v): v is LotView => v !== null)

  const aviso = useClosingAnnouncement(views)

  if (!auction || !bidder || views.length === 0) return null

  const bidders = auction.bidders
  // "Disponível" = saldo − comprometido (lances em que o jogador está liderando agora).
  // Cai quando ele assume a ponta de um lote; volta quando é coberto.
  const committedTotal = auction.lots.reduce((s, l) => (l.highBidder === bidder ? s + l.currentBid : s), 0)
  const available = cash - committedTotal
  const bid = (pos: number, amount: number): void => placeLandBid(bidder, pos, amount)

  /**
   * Lote selecionado (paisagem baixa), DERIVADO — sem efeito que corrija o próprio estado.
   *
   * A regra do relato: preservar a escolha quando ela ainda existir; quando o lote escolhido
   * sai do pregão, cair no próximo AINDA ABERTO, e só depois no primeiro que houver. Um lote
   * que acabou de encerrar continua na lista por um instante (mostrando "Arrematado,
   * fechando"), e nesse instante a seleção NÃO pula: o jogador precisa ver o desfecho do lote
   * em que ele estava.
   */
  const aindaNaLista = pickedLot !== null && views.some((v) => v.lot.pos === pickedLot)
  const selected = aindaNaLista
    ? pickedLot
    : (views.find((v) => !v.encerrado)?.lot.pos ?? views[0].lot.pos)
  const selectedView = views.find((v) => v.lot.pos === selected) ?? views[0]

  const tabId = (pos: number): string => `lote-tab-${pos}`
  const panelId = 'lote-painel'

  return (
    <AnimatePresence>
      <Overlay key="land-auction" z={68}>
        <ModalShell className={`land-auction${compacto ? ' land-auction--compact' : ''}`}>
          {/* Em paisagem baixa o header encolhe pela CLASSE, não pela folha: o respiro dele vem
              de utilitários do Tailwind, e a camada `components` perde para a `utilities` na
              ordem de cascata. Regra em `index.css` seria escrita e ignorada. */}
          <ModalHeader
            center
            title={title}
            className={compacto
              ? 'sticky top-0 z-10 px-4 pt-2 pb-1 [&_h3]:text-lg [&>[aria-hidden]]:hidden'
              : 'sticky top-0 z-10 [&_h3]:text-xl'}
          />

          {/* Licitante (fixo no assento local quando online) + caixa disponível */}
          <div className="land-auction__bar">
            <span className="label text-cream-muted">Lance por:</span>
            {local.seatId ? (
              <span className="land-auction__seat">
                <PlayerName playerId={local.seatId} />
              </span>
            ) : bidders.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setBidder(id)}
                className={`land-auction__seat land-auction__seat--pick${id === bidder ? ' is-on' : ''}`}
              >
                <PlayerName playerId={id} />
              </button>
            ))}
            <div className="land-auction__purse">
              <CoinIcon size={15} className="text-gold" />
              <motion.span
                key={available}
                initial={reduced ? false : { scale: 1.18 }}
                animate={{ scale: 1 }}
                transition={{ duration: MOTION.base }}
                className="currency text-sm tabular-nums leading-none text-gold"
              >
                {money(available)}
              </motion.span>
              <span className="label text-cream-muted text-nano">disponível</span>
            </div>
          </div>

          {compacto ? (
            <div className="land-auction__compact">
              {views.length > 1 && (
                <LotStrip views={views} selected={selected} onSelect={setPickedLot} tabId={tabId} panelId={panelId} />
              )}
              <LotPanel
                key={selectedView.lot.pos}
                view={selectedView}
                onBid={bid}
                id={panelId}
                labelledBy={tabId(selectedView.lot.pos)}
              />
            </div>
          ) : (
            <div className="lot-grid" style={{ '--lot-count': views.length } as React.CSSProperties}>
              {views.map((v) => (
                <LotCard key={v.lot.pos} view={v} onBid={bid} />
              ))}
            </div>
          )}

          {/* Encerramentos falados uma vez, sem narrar a contagem regressiva. */}
          <p className="sr-only" role="status" aria-live="polite">{aviso}</p>
        </ModalShell>
      </Overlay>
    </AnimatePresence>
  )
}
