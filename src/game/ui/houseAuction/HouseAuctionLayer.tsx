// Leilão de casas (026) — modal do evento autônomo `game.houseAuction`. Único ponto
// com efeito: dispara placeHouseBid/closeHouseAuction. Reusa o cartão central.
// No demo de 1 cliente, o usuário escolhe por qual licitante dá o lance.
import { useState, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { cn } from '@/lib/utils'
import { useGameStore } from '@/game/store'

function Btn({ onClick, disabled, variant = 'primary', children }: { onClick: () => void; disabled?: boolean; variant?: 'primary' | 'secondary'; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex-1 px-3 py-2 rounded-[var(--radius-sharp)] font-bold text-sm transition-all active:translate-y-px disabled:opacity-40 disabled:cursor-not-allowed',
        variant === 'primary' ? 'bg-gold text-coffee-900 hover:brightness-110' : 'bg-coffee-700 text-cream border border-coffee-500 hover:bg-coffee-600',
      )}
    >
      {children}
    </button>
  )
}

export function HouseAuctionLayer() {
  const auction = useGameStore((s) => s.game.houseAuction)
  const cashById = useGameStore((s) => Object.fromEntries(s.game.players.map((p) => [p.id, p.cash])))
  const placeHouseBid = useGameStore((s) => s.placeHouseBid)
  const closeHouseAuction = useGameStore((s) => s.closeHouseAuction)

  const minNext = (auction?.currentBid ?? 0) + 50
  const [bidder, setBidder] = useState<string>('')
  const [amount, setAmount] = useState<number>(minNext)

  if (!auction) return null
  const sel = bidder || auction.activeBidders[0]

  return (
    <AnimatePresence>
      <motion.div
        key="house-auction-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 z-[66] flex items-center justify-center bg-coffee-950/70 backdrop-blur-[2px] p-4"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 360, damping: 28 }}
          className="w-[340px] max-w-[92vw] bg-coffee-800 border-2 border-coffee-500 rounded-[var(--radius-card)] shadow-[var(--shadow-dropdown)] overflow-hidden"
        >
          <div className="px-4 py-3 border-b-2 border-coffee-950 bg-[linear-gradient(180deg,#d4af37_0%,#b8941f_100%)]">
            <h3 className="display text-coffee-950 text-lg leading-none">Leilão de casas</h3>
            <p className="label text-coffee-950/80 mt-0.5" style={{ fontSize: '9px' }}>
              {auction.housesAvailable} casa(s) em disputa (escassez §5.4)
            </p>
          </div>

          <div className="px-4 py-3 flex flex-col gap-2">
            <p className="text-cream text-sm">
              Lance atual: <span className="text-gold-glow currency">R$ {auction.currentBid.toLocaleString('pt-BR')}</span>
            </p>
            <p className="text-cream-muted text-xs">
              Maior licitante: <span className="text-cream">{auction.highBidder ?? '—'}</span>
            </p>

            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <select
                value={sel}
                onChange={(e) => setBidder(e.target.value)}
                className="px-2 py-1.5 rounded bg-coffee-900 border border-coffee-500 text-cream text-sm"
              >
                {auction.activeBidders.map((id) => (
                  <option key={id} value={id}>{id} (R${cashById[id] ?? 0})</option>
                ))}
              </select>
              <input
                type="number"
                min={minNext}
                step={50}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value) || 0)}
                className="w-24 px-2 py-1.5 rounded-[var(--radius-sharp)] bg-coffee-900 border border-coffee-500 text-cream text-sm"
              />
            </div>

            <div className="mt-2 flex gap-2">
              <Btn onClick={() => placeHouseBid(sel, Math.max(amount, minNext))}>Dar lance</Btn>
              <Btn onClick={() => closeHouseAuction()} variant="secondary">Encerrar</Btn>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
