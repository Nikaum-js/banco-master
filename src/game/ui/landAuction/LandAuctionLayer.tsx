// Pregão de escassez de TERRENOS (031, §7.3) — modal autônomo (lê game.landAuction).
// Visual baseado no LEILÃO COMUM (003/ModalLayer): avatar = flag circular do país (ou SquareIcon),
// header com a cor do grupo, tabela de aluguel canônica e rodapé Preço/Casa/Hotel.
// Cada lote é um deed-card com seu PRÓPRIO cronômetro (barra + contagem regressiva) — lance
// reinicia só o lote dele. A janela é `THEME.LAND_AUCTION_SECONDS`, hoje 24s (D-060): era 8s,
// e foi a pressa que essa janela criava — sem prazo visível — que motivou a remoção do
// mecanismo na D-059. O prazo mostrado deriva do `deadline` AUTORITATIVO do estado, corrigido
// pelo offset de relógio do host, nunca de um timer local.
// pt-BR. NÃO é o leilão de casas (D-022).
import { useEffect, useState } from 'react'
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
import { money } from '@/lib/money'
import { deedPresentation } from '@/game/ui/deed/presentation'
import { CountryFlagDisc } from '@/boards/glyphs/flags'
import { countryName } from '@/boards/glyphs/countries'
import { activeBoard } from '@/game/ui/theme/boardTheme'

const INCREMENTS = [10, 50, 100] as const
const clamp01 = (x: number) => Math.max(0, Math.min(1, x))

// Avatar da propriedade (igual ao leilão comum): flag circular do país; aeroporto/utilidade = ícone.
function LandDeedIcon({ sq, size = 40 }: { sq: Square; size?: number }) {
  const deed = deedPresentation(sq)
  if (deed?.flagCode) {
    return (
      <CountryFlagDisc code={deed.flagCode} size={size} />
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

/**
 * CARD 03 — o lote redesenhado em torno da DECISÃO, não da escritura.
 *
 * O problema do desenho antigo não era a estética: era a hierarquia. Ele abria com a tabela de
 * aluguel completa (até 8 linhas), enterrava o preço num rodapé de três estatísticas iguais,
 * punha o lance atual em corpo pequeno no meio, e terminava em três botões idênticos sem ação
 * principal. Com 8 segundos de prazo, o jogador tinha de montar a decisão sozinho lendo de baixo
 * para cima. Com 24s (D-060) o tempo passa a existir — e a ordem de leitura passa a valer a pena.
 *
 * A ordem agora é a da pergunta que o jogador está fazendo:
 *
 *   1. **Que lote é** — bandeira, cidade, país, stripe do grupo.
 *   2. **Quanto tempo tenho** — cronômetro no topo, com o número em corpo grande, porque é o
 *      recurso mais escasso da tela. Deriva do `deadline` autoritativo, corrigido pelo offset
 *      de relógio do host: nunca de um timer local que cada aparelho conta diferente.
 *   3. **Quanto está e quanto vale** — lance atual em latão, ao lado do preço de tabela, que é a
 *      única referência de "caro ou barato" que existe. Antes eles estavam em seções distintas,
 *      então a comparação exigia memória.
 *   4. **Uma ação principal** — cobrir o lance. Os incrementos ficam como ações secundárias.
 *
 * A tabela de aluguel sai do card e vira um detalhe expansível: em 24 segundos ninguém compara
 * oito linhas, e ela empurrava tudo o que importa para fora da primeira dobra no celular.
 */
function LotCard(props: {
  lot: LandLot
  now: number
  cashAvail: number
  bidder: string
  onBid: (pos: number, amount: number) => void
}) {
  const { lot, now, cashAvail, bidder, onBid } = props
  const { reduced } = useMotion()
  const [open, setOpen] = useState(false)
  /**
   * Trava de reenvio (CARD 03). Dois cliques rápidos no mesmo botão mandavam dois comandos: o
   * segundo virava no-op no host, mas gastava difusão e piscava a UI.
   *
   * DERIVADA, não sincronizada por efeito: guarda-se o valor enviado, e ele conta como "em voo"
   * só enquanto for MAIOR que o lance atual. Quando a difusão chega, `currentBid` alcança o
   * valor e a trava solta sozinha — sem `useEffect` que corrige o próprio estado (era o que o
   * `react-hooks/set-state-in-effect` acusava, e a regra estava certa: um efeito ali dispara
   * uma renderização em cascata a cada tick do relógio).
   */
  const [sentAmount, setSentAmount] = useState(0)
  const inFlight = (amount: number): boolean => sentAmount === amount && amount > lot.currentBid

  const sq = activeBoard()[lot.pos]
  const deed = deedPresentation(sq)
  if (!deed) return null

  const remainingMs = lot.deadline - now
  const frac = clamp01(remainingMs / LAND_AUCTION_WINDOW)
  const secs = Math.max(0, Math.ceil(remainingMs / 1000))
  // Alerta proporcional à janela, não um 3 fixo herdado dos 8s: um quarto do prazo é o ponto em
  // que "dá tempo de pensar" vira "decide agora", em qualquer janela que o tema configure.
  const urgente = remainingMs <= LAND_AUCTION_WINDOW * 0.25
  const encerrado = remainingMs <= 0
  const liderando = lot.highBidder === bidder
  const minimo = lot.currentBid + INCREMENTS[0]
  const podeMinimo = minimo <= cashAvail && !encerrado

  return (
    <div className={`lot-card${urgente && !encerrado ? ' lot-card--urgent' : ''}${encerrado ? ' lot-card--closed' : ''}`} style={{ '--lot-accent': deed.accent } as React.CSSProperties}>
      {/* 1. Que lote é */}
      <div className="lot-card__head">
        <LandDeedIcon sq={sq} size={32} />
        <div className="lot-card__identity">
          <p className="lot-card__name">{deed.name}</p>
          <p className="lot-card__origin">{deed.flagCode ? countryName(deed.flagCode) : deed.subtitle}</p>
        </div>
        {liderando && <span className="lot-card__lead" title="Você é o maior licitante deste lote">SEU</span>}
      </div>

      {/* 2. Quanto tempo tenho — e o que aconteceu quando acabar (feedback de timeout) */}
      <div className="lot-card__clock">
        {encerrado ? (
          <span className="lot-card__closed-label">
            <GavelIcon size={12} aria-hidden />
            {lot.highBidder ? 'Arrematado — fechando' : 'Sem lance — fica livre'}
          </span>
        ) : (
          <>
            <span className="lot-card__secs" aria-live="off">{secs}<small>s</small></span>
            <div className="lot-card__bar" role="progressbar" aria-valuenow={secs} aria-valuemin={0} aria-valuemax={Math.round(LAND_AUCTION_WINDOW / 1000)} aria-label={`Tempo restante do lote ${deed.name}`}>
              <motion.div
                className="lot-card__bar-fill"
                // `prefers-reduced-motion` (§12.6): sem interpolação a barra ainda cai — o FATO
                // permanece, só a suavização some. Zerar a barra seria remover a informação.
                animate={{ width: `${frac * 100}%` }}
                transition={reduced ? { duration: 0 } : { ease: 'linear', duration: MOTION.base }}
              />
            </div>
          </>
        )}
      </div>

      {/* 3. Quanto está, e quanto vale — lado a lado, porque a comparação é a decisão */}
      <div className="lot-card__figures">
        <span className="lot-card__figure">
          <span className="lot-card__figure-value lot-card__figure-value--bid">{money(lot.currentBid)}</span>
          <span className="lot-card__figure-label">{lot.highBidder ? 'lance de ' : 'sem lance'}{lot.highBidder && <PlayerName playerId={lot.highBidder} />}</span>
        </span>
        <span className="lot-card__figure lot-card__figure--right">
          <span className="lot-card__figure-value">{money(deed.price)}</span>
          <span className="lot-card__figure-label">preço de tabela</span>
        </span>
      </div>

      {/* 4. Uma ação principal, e os incrementos como secundárias */}
      <div className="lot-card__actions">
        <Button
          disabled={!podeMinimo || inFlight(minimo)}
          onClick={() => { setSentAmount(minimo); onBid(lot.pos, minimo) }}
          className="lot-card__primary"
          title={!podeMinimo ? 'Caixa insuficiente (o que você lidera em outros lotes fica comprometido)' : undefined}
        >
          {inFlight(minimo) ? 'Enviando…' : `Cobrir · ${money(minimo)}`}
        </Button>
        <div className="lot-card__steps">
          {INCREMENTS.slice(1).map((inc) => {
            const next = lot.currentBid + inc
            const pode = next <= cashAvail && !encerrado
            return (
              <button
                key={inc}
                type="button"
                disabled={!pode || inFlight(next)}
                onClick={() => { setSentAmount(next); onBid(lot.pos, next) }}
                className="lot-card__step"
                title={pode ? `Lance de ${money(next)}` : 'Caixa insuficiente'}
              >
                +{inc}
              </button>
            )
          })}
        </div>
      </div>

      {/* Escritura completa, sob demanda. Em 24s ninguém compara oito linhas de aluguel — mas
          quem quer conferir antes de subir o lance precisa poder. */}
      <details className="lot-card__deed" open={open} onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
        <summary className="lot-card__deed-summary">Escritura</summary>
        <div className="lot-card__deed-body">
          {rentRows(sq).map((r) => (
            <div key={r.label} className="lot-card__deed-row">
              <span>{r.label}</span>
              <span className="currency tabular-nums">{r.value}</span>
            </div>
          ))}
          <div className="lot-card__deed-stats">
            <DeedStat icon={<CoinIcon size={13} />} label="Preço" value={money(deed.price)} />
            {deed.kind === 'property' && <DeedStat icon={<HouseIcon size={13} />} label="Casa" value={money(deed.buildCost)} />}
            {deed.kind === 'property' && <DeedStat icon={<HotelIcon size={13} />} label="Hotel" value={money(deed.buildCost)} />}
            {deed.kind === 'airport' && <DeedStat icon={<HotelIcon size={13} />} label="Hangar" value={money(deed.hangar.cost)} />}
          </div>
        </div>
      </details>
    </div>
  )
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

  // Tick do relógio (barras) enquanto há pregão aberto.
  useEffect(() => {
    if (!auction) return
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [auction])

  if (!auction || !bidder) return null

  const bidders = auction.bidders
  const lots = auction.lots
  const cash = players.find((p) => p.id === bidder)?.cash ?? 0
  // "Disponível" = saldo − comprometido (lances em que o jogador está liderando agora).
  // Cai quando ele assume a ponta de um lote; volta quando é coberto.
  const committedTotal = lots.reduce((s, l) => (l.highBidder === bidder ? s + l.currentBid : s), 0)
  const available = cash - committedTotal
  const committedFor = (pos: number): number => committedCash(game, bidder, pos)
  const bid = (pos: number, amount: number): void => placeLandBid(bidder, pos, amount)

  return (
    <AnimatePresence>
      <Overlay key="land-auction" z={68}>
        <ModalShell className="w-[860px] max-w-[97vw] max-h-[92vh] overflow-auto">
          <ModalHeader center title={title} className="sticky top-0 z-10 [&_h3]:text-xl" />

          {/* Licitante (fixo no assento local quando online) + caixa disponível */}
          <div className="px-5 py-3 border-b border-coffee-700 flex items-center gap-2 flex-wrap">
            <span className="label text-cream-muted">Lance por:</span>
            {local.seatId ? (
              <span className="px-2.5 py-1 rounded-[var(--radius-sharp)] text-sm font-bold border bg-gold text-coffee-900 border-gold">
                <PlayerName playerId={local.seatId} />
              </span>
            ) : bidders.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setBidder(id)}
                className={`px-2.5 py-1 rounded-[var(--radius-sharp)] text-sm font-bold border transition-colors ${
                  id === bidder ? 'bg-gold text-coffee-900 border-gold' : 'bg-coffee-700 text-cream border-coffee-500 hover:border-gold'
                }`}
              >
                <PlayerName playerId={id} />
              </button>
            ))}
            <div className="ml-auto flex items-center gap-1.5 pl-3 pr-3.5 py-1.5 rounded-full bg-coffee-950/55 border border-coffee-500/40 shadow-[var(--shadow-press)]">
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
            </div>
          </div>

          {/* Lotes */}
          <div className="p-4 grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
            {lots.map((lot) => (
              <LotCard key={lot.pos} lot={lot} now={now} cashAvail={cash - committedFor(lot.pos)} bidder={bidder} onBid={bid} />
            ))}
          </div>
        </ModalShell>
      </Overlay>
    </AnimatePresence>
  )
}
