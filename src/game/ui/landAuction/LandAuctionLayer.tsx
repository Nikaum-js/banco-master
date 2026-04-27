// Pregão de escassez de TERRENOS (031, §7.3) — modal autônomo (lê game.landAuction).
// Visual baseado no LEILÃO COMUM (003/ModalLayer): avatar = flag circular do país (ou SquareIcon),
// header com a cor do grupo, tabela de aluguel (computeRents) e rodapé Preço/Casa/Hotel.
// Cada lote é um deed-card com seu PRÓPRIO cronômetro de 8s (barra) — lance reinicia só o lote dele.
// pt-BR. NÃO é o leilão de casas (D-022).
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useGameStore } from '@/game/store'
import { committedCash, LAND_AUCTION_WINDOW } from '@/game/economy/landAuction'
import { rentLadder } from '@/game/economy/rent'
import { buildCost } from '@/game/economy/construction'
import type { LandLot } from '@/game/economy/types'
import { BOARD, type PropertySquare, type Square } from '@/lib/boardData'
import { GROUP_COLOR, SquareIcon } from '@/boards/shared'
import { CoinIcon, HouseIcon, HotelIcon, GavelIcon } from '@/game/ui/icons'
import { THEME } from '@/game/theme'

const INCREMENTS = [10, 50, 100] as const
const clamp01 = (x: number) => Math.max(0, Math.min(1, x))
const money = (v: number) => `R$ ${v.toLocaleString('pt-BR')}`

// Avatar da propriedade (igual ao leilão comum): flag circular do país; aeroporto/utilidade = ícone.
function LandDeedIcon({ sq, size = 40 }: { sq: Square; size?: number }) {
  if (sq.kind === 'property') {
    const uf = (sq as PropertySquare).uf
    return (
      <div
        className="rounded-full bg-coffee-900 border-2 border-coffee-950 overflow-hidden shrink-0 shadow-[0_2px_4px_rgba(0,0,0,0.5)]"
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
      <span className="label text-cream-muted" style={{ fontSize: '8px' }}>{label}</span>
    </div>
  )
}

function LotCard(props: { lot: LandLot; now: number; cashAvail: number; onBid: (pos: number, amount: number) => void }) {
  const { lot, now, cashAvail, onBid } = props
  const sq = BOARD[lot.pos]
  const isProp = sq.kind === 'property'
  const isAirport = sq.kind === 'airport'
  const accent = isProp ? GROUP_COLOR[(sq as PropertySquare).group] : '#d4af37'
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
          <GavelIcon size={11} className={baixo ? 'text-[#e74c3c]' : 'text-cream-muted'} />
          <span className={`label leading-none ${baixo ? 'text-[#e74c3c]' : 'text-cream-muted'}`}>{secs}s</span>
        </div>
        <div className="h-2 rounded-full bg-coffee-950/60 overflow-hidden">
          <motion.div className={`h-full rounded-full ${baixo ? 'bg-[#e74c3c]' : 'bg-gold'}`} animate={{ width: `${frac * 100}%` }} transition={{ ease: 'linear', duration: 0.25 }} />
        </div>
      </div>

      {/* Botões de lance */}
      <div className="px-3 py-3 flex gap-1.5">
        {INCREMENTS.map((inc) => {
          const next = lot.currentBid + inc
          const pode = next <= cashAvail
          return (
            <button
              key={inc}
              type="button"
              disabled={!pode}
              onClick={() => onBid(lot.pos, next)}
              title={!pode ? 'Caixa insuficiente (comprometido em outros lotes)' : undefined}
              className="flex-1 flex flex-col items-center px-1 py-2 rounded-[var(--radius-sharp)] bg-gold text-coffee-900 hover:brightness-110 active:translate-y-px disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <span className="currency text-xs leading-none text-coffee-950">{money(next)}</span>
              <span className="currency mt-1 leading-none text-coffee-950" style={{ fontSize: '10px' }}>+{inc}</span>
            </button>
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
  const placeLandBid = useGameStore((s) => s.placeLandBid)

  const [bidder, setBidder] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())

  // Tick do relógio (barras) enquanto há pregão aberto.
  useEffect(() => {
    if (!auction) return
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [auction])

  // Garante um licitante válido selecionado.
  useEffect(() => {
    if (!auction) return
    if (!bidder || !auction.bidders.includes(bidder)) setBidder(auction.bidders[0] ?? null)
  }, [auction, bidder])

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
      <motion.div
        key="land-auction"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        className="fixed inset-0 z-[68] flex items-center justify-center bg-coffee-950/70 backdrop-blur-[2px] p-4"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 26 }}
          className="bg-coffee-800 border-2 border-coffee-500 rounded-[var(--radius-card)] shadow-[var(--shadow-dropdown)] w-[860px] max-w-[97vw] max-h-[92vh] overflow-auto"
        >
          {/* Título */}
          <div className="px-5 py-3 border-b-2 border-coffee-950 sticky top-0 z-10 text-center bg-[linear-gradient(180deg,#d4af37_0%,#b8941f_100%)]">
            <h3 className="display text-coffee-950 text-xl leading-none tracking-wide">Leilão de Escassez</h3>
          </div>

          {/* Seletor de licitante (single-client) + caixa disponível */}
          <div className="px-5 py-3 border-b border-coffee-700 flex items-center gap-2 flex-wrap">
            <span className="label text-cream-muted">Lance por:</span>
            {bidders.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setBidder(id)}
                className={`px-2.5 py-1 rounded-[var(--radius-sharp)] text-sm font-bold border transition-colors ${
                  id === bidder ? 'bg-gold text-coffee-900 border-gold' : 'bg-coffee-700 text-cream border-coffee-500 hover:border-gold'
                }`}
              >
                {id}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-1.5 pl-3 pr-3.5 py-1.5 rounded-full bg-coffee-950/55 border border-coffee-500/40 shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)]">
              <CoinIcon size={15} className="text-gold" />
              <motion.span
                key={available}
                initial={{ scale: 1.18, color: '#fff1c2' }}
                animate={{ scale: 1, color: '#d4af37' }}
                transition={{ duration: 0.25 }}
                className="currency text-sm tabular-nums leading-none"
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
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
