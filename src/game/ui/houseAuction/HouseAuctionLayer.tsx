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
  // Selecionar a lista ESTÁVEL e derivar no corpo: `Object.fromEntries(...)` dentro do
  // seletor cria objeto novo a cada leitura → loop do useSyncExternalStore.
  const players = useGameStore((s) => s.game.players)
  const cashById = Object.fromEntries(players.map((p) => [p.id, p.cash]))
  const placeHouseBid = useGameStore((s) => s.placeHouseBid)
  const closeHouseAuction = useGameStore((s) => s.closeHouseAuction)

  const [bidder, setBidder] = useState<string>('')

  if (!auction) return null
  const sel = bidder || auction.activeBidders[0]
  const selCash = cashById[sel] ?? 0

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

          <div className="px-4 py-3 flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
              <span className="label text-cream-muted">Lance atual</span>
              <span className="currency text-gold-glow text-2xl leading-none">R$ {auction.currentBid.toLocaleString('pt-BR')}</span>
            </div>
            <p className="text-cream-muted text-xs -mt-1.5">
              Maior licitante: <span className="text-cream">{auction.highBidder ?? '—'}</span>
            </p>

            <label className="flex items-center gap-2 text-sm text-cream-muted">
              <span className="shrink-0">Licitante</span>
              <select
                value={sel}
                onChange={(e) => setBidder(e.target.value)}
                className="flex-1 px-2 py-1.5 rounded bg-coffee-900 border border-coffee-500 text-cream text-sm"
              >
                {auction.activeBidders.map((id) => (
                  <option key={id} value={id}>{id} (R${cashById[id] ?? 0})</option>
                ))}
              </select>
            </label>

            {/* Incrementos rápidos: +R$2 / +R$10 / +R$100 */}
            <div className="flex gap-2">
              {[2, 10, 100].map((inc) => {
                const next = auction.currentBid + inc
                return (
                  <button
                    key={inc}
                    type="button"
                    disabled={next > selCash}
                    onClick={() => placeHouseBid(sel, next)}
                    className="flex-1 px-2 py-2 rounded-[var(--radius-sharp)] bg-gold text-coffee-900 font-bold text-sm hover:brightness-110 active:translate-y-px disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    +R$ {inc}
                  </button>
                )
              })}
            </div>
            <Btn onClick={() => closeHouseAuction()} variant="secondary">Encerrar</Btn>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
