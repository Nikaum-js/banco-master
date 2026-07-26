// Pregão de escassez de TERRENOS (031, §7.3) — modal autônomo (lê game.landAuction).
// Visual baseado no LEILÃO COMUM (003/ModalLayer): avatar = flag circular do país (ou SquareIcon),
// header com a cor do grupo, tabela de aluguel (computeRents) e rodapé Preço/Casa/Hotel.
// Cada lote é um deed-card com seu PRÓPRIO cronômetro de 8s (barra) — lance reinicia só o lote dele.
// pt-BR. NÃO é o leilão de casas (D-022).
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useGameStore } from '@/game/store'
import { useLocalView, useName } from '@/net/roomStore'
import { PlayerName } from '@/net/ui/PlayerName'
import { committedCash, LAND_AUCTION_WINDOW } from '@/game/economy/landAuction'
import { rentLadder } from '@/game/economy/rent'
import { buildCost } from '@/game/economy/construction'
import type { LandLot } from '@/game/economy/types'
import { BOARD, type PropertySquare, type Square } from '@/lib/boardData'
import { GROUP_COLOR } from '@/boards/groupColors'
import { SquareIcon } from '@/boards/glyphs/squares'
import { CoinIcon, HouseIcon, HotelIcon, GavelIcon } from '@/game/ui/icons'
import { Button } from '@/game/ui/primitives'
import { Overlay, ModalShell, ModalHeader } from '@/game/ui/shell'
import { THEME } from '@/game/theme'
import { money } from '@/lib/money'

const INCREMENTS = [10, 50, 100] as const
const clamp01 = (x: number) => Math.max(0, Math.min(1, x))

// Avatar da propriedade (igual ao leilão comum): flag circular do país; aeroporto/utilidade = ícone.
function LandDeedIcon({ sq, size = 40 }: { sq: Square; size?: number }) {
  if (sq.kind === 'property') {
    const uf = (sq as PropertySquare).uf
    return (
      <div
        className="rounded-full bg-coffee-900 border-2 border-coffee-950 overflow-hidden shrink-0 shadow-[var(--shadow-card)]"
        style={{ width: size, height: size }}
      >
        <img src={`https://flagcdn.com/${uf.toLowerCase()}.svg`} alt={uf} className="w-full h-full object-cover" draggable={false} />
      </div>
    )
  }
  return <span className="text-gold shrink-0"><SquareIcon square={sq} size={size * 0.8} /></span>
}

function rentRows(sq: Square): { label: string; value: string }[] {
  if (sq.kind === 'property') {
    const p = sq as PropertySquare
    const l = rentLadder(p.group, p.rent)
    return [
      { label: 'Terreno', value: money(p.rent) },
      { label: '1 casa', value: money(l.house[0]) },
      { label: '2 casas', value: money(l.house[1]) },
      { label: '3 casas', value: money(l.house[2]) },
      { label: '4 casas', value: money(l.house[3]) },
      { label: 'Hotel', value: money(l.hotel) },
      { label: '2º hotel', value: money(l.hotel2) },
      { label: 'Arranha-céu', value: money(l.skyscraper) },
    ]
  }
  if (sq.kind === 'airport') {
    return [
      ...THEME.AIRPORT_RENT.map((v, i) => ({ label: `${i + 1} aeroporto${i ? 's' : ''}`, value: money(v) })),
      { label: 'Com Hangar', value: '2×' },
    ]
  }
  return THEME.UTILITY_MULT.map((v, i) => ({ label: `${i + 1} utilidade${i ? 's' : ''}`, value: `${v}× dados` }))
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

function LotCard(props: { lot: LandLot; now: number; cashAvail: number; onBid: (pos: number, amount: number) => void }) {
  const { lot, now, cashAvail, onBid } = props
  const sq = BOARD[lot.pos]
  const isProp = sq.kind === 'property'
  const isAirport = sq.kind === 'airport'
  const accent = isProp ? GROUP_COLOR[(sq as PropertySquare).group] : 'var(--color-brass)'
  const price = 'price' in sq ? (sq as { price: number }).price : 0
  const houseCost = isProp ? buildCost(sq as PropertySquare) : 0
  const remainingMs = lot.deadline - now
  const frac = clamp01(remainingMs / LAND_AUCTION_WINDOW)
  const secs = Math.max(0, Math.ceil(remainingMs / 1000))
  const baixo = secs <= 3

  return (
    <div className="rounded-[var(--radius-card)] border border-coffee-500 bg-coffee-900/50 overflow-hidden flex flex-col">
      {/* Avatar + nome (header com tinta do grupo) */}
      <div className="px-3 py-2.5 flex items-center gap-2 border-b border-coffee-500/60" style={{ background: `color-mix(in srgb, ${accent} 24%, transparent)` }}>
        <LandDeedIcon sq={sq} size={34} />
        <div className="min-w-0">
          <p className="display text-cream text-sm leading-tight truncate">{sq.name}</p>
          <p className="label text-cream-muted leading-none">{isProp ? (sq as PropertySquare).capital ?? '' : sq.kind === 'airport' ? 'Aeroporto' : 'Utilidade'}</p>
        </div>
      </div>

      {/* Tabela de aluguel */}
      <div className="px-3 py-2 flex flex-col flex-1">
        {rentRows(sq).map((r, i, arr) => (
          <div
            key={r.label}
            className={`flex items-center justify-between gap-3 text-xs py-[3px] ${
              i < arr.length - 1 ? 'border-b border-coffee-500/15' : ''
            }`}
          >
            <span className="text-cream-muted">{r.label}</span>
            <span className="currency text-cream tabular-nums">{r.value}</span>
          </div>
        ))}
      </div>

      {/* Rodapé Preço / Casa / Hotel (propriedade) ou Preço / Hangar (aeroporto) */}
      <div className="px-2 py-2 border-t border-coffee-500/50 flex items-stretch gap-1">
        <DeedStat icon={<CoinIcon size={14} />} label="Preço" value={money(price)} />
        {isProp && <DeedStat icon={<HouseIcon size={14} />} label="Casa" value={money(houseCost)} />}
        {isProp && <DeedStat icon={<HotelIcon size={14} />} label="Hotel" value={money(houseCost)} />}
        {isAirport && <DeedStat icon={<HotelIcon size={14} />} label="Hangar" value={money(THEME.HANGAR_COST)} />}
      </div>

      {/* Lance atual */}
      <div className="px-3 pt-2 text-center border-t border-coffee-950">
        <p className="label text-cream-muted leading-none">Lance</p>
        <p className="currency text-gold-glow text-xl leading-none mt-0.5">{money(lot.currentBid)}</p>
        <p className="label text-cream-muted leading-none mt-1">Maior: <span className="text-cream">{lot.highBidder ?? '—'}</span></p>
      </div>

      {/* Cronômetro do lote (8s) */}
      <div className="px-3 mt-2">
        <div className="flex items-center gap-1 mb-1">
          <GavelIcon size={11} className={baixo ? 'text-signal' : 'text-cream-muted'} />
          <span className={`label leading-none ${baixo ? 'text-signal' : 'text-cream-muted'}`}>{secs}s</span>
        </div>
        <div className="h-2 rounded-full bg-coffee-950/60 overflow-hidden">
          <motion.div className={`h-full rounded-full ${baixo ? 'bg-signal' : 'bg-gold'}`} animate={{ width: `${frac * 100}%` }} transition={{ ease: 'linear', duration: 0.25 }} />
        </div>
      </div>

      {/* Botões de lance */}
      <div className="px-3 py-3 flex gap-1.5">
        {INCREMENTS.map((inc) => {
          const next = lot.currentBid + inc
          const pode = next <= cashAvail
          return (
            <Button
              key={inc}
              disabled={!pode}
              onClick={() => onBid(lot.pos, next)}
              title={!pode ? 'Caixa insuficiente (comprometido em outros lotes)' : undefined}
              className="flex-1 flex-col px-1 py-2 gap-0"
            >
              <span className="currency text-xs leading-none text-coffee-950">{money(next)}</span>
              <span className="currency mt-1 leading-none text-coffee-950" style={{ fontSize: '10px' }}>+{inc}</span>
            </Button>
          )
        })}
      </div>
    </div>
  )
}

export function LandAuctionLayer() {
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
                initial={{ scale: 1.18 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.25 }}
                className="currency text-sm tabular-nums leading-none text-gold"
              >
                {money(available)}
              </motion.span>
            </div>
          </div>

          {/* Lotes */}
          <div className="p-4 grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
            {lots.map((lot) => (
              <LotCard key={lot.pos} lot={lot} now={now} cashAvail={cash - committedFor(lot.pos)} onBid={bid} />
            ))}
          </div>
        </ModalShell>
      </Overlay>
    </AnimatePresence>
  )
}
