// Camada de modais centrais (022). Único ponto com efeito desta fatia: consome
// activeModal(game) (puro) e dispara os comandos já existentes do store. Reusa o
// vocabulário visual dos popovers de propriedade (cartão coffee + header com stripe).
import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { cn } from '@/lib/utils'
import { useGameStore } from '@/game/store'
import { activeModal, type ModalView, type HandCardView } from './activeModal'
import type { Square, PropertySquare, AirportSquare } from '@/lib/boardData'
import { BOARD } from '@/lib/boardData'

type PropertyOrAirportOrUtility = Extract<Square, { kind: 'property' | 'airport' | 'utility' }>
import {
  GROUP_COLOR,
  SquareIcon,
  CompactRent,
  CompactRentText,
  computeRents,
} from '@/boards/shared'
import { buildCost } from '@/game/economy/construction'
import { RARITY_COLOR, cardLabel, CARD_DESC } from '@/game/ui/cards/cardMeta'

// Botão de ação do modal (dourado = primário; coffee = secundário).
function ActionBtn({
  onClick,
  children,
  variant = 'primary',
}: {
  onClick: () => void
  children: React.ReactNode
  variant?: 'primary' | 'secondary'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex-1 px-3 py-2 rounded-[var(--radius-sharp)] font-bold text-sm transition-all active:translate-y-px',
        variant === 'primary'
          ? 'bg-gold text-coffee-900 hover:brightness-110'
          : 'bg-coffee-700 text-cream border border-coffee-500 hover:bg-coffee-600',
      )}
    >
      {children}
    </button>
  )
}

// Cartão central — shell coffee idêntico ao dos popovers, mas centralizado.
function Card({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, y: 8 }}
      transition={{ type: 'spring', stiffness: 360, damping: 28 }}
      className="w-[300px] max-w-[90vw] bg-coffee-800 border-2 border-coffee-500 rounded-[var(--radius-card)] shadow-[var(--shadow-dropdown)] overflow-hidden"
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </motion.div>
  )
}

// Header com stripe colorida + título + subtítulo (reusa o visual do deed).
function Header({ bg, icon, title, subtitle }: { bg: string; icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="relative px-3.5 py-3 border-b-2 border-coffee-950" style={{ background: bg }}>
      <div className="flex items-center gap-2.5">
        {icon && <div className="shrink-0 w-9 h-9 flex items-center justify-center">{icon}</div>}
        <div className="flex-1 min-w-0">
          <h3 className="display text-coffee-950 text-lg leading-none truncate">{title}</h3>
          {subtitle && (
            <p className="label text-coffee-950/80 mt-0.5" style={{ fontSize: '9px' }}>
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// Corpo (deed) da propriedade/aeroporto/utilidade em compra — reusa CompactRent.
function PurchaseBody({ square, price }: { square: PropertyOrAirportOrUtility; price: number }) {
  if (square.kind === 'property') {
    const p = square as PropertySquare
    const rents = computeRents(p.rent)
    return (
      <div className="px-3.5 py-3">
        <p className="label text-gold mb-2" style={{ fontSize: '9px' }}>Aluguel</p>
        <div className="flex flex-col gap-0.5">
          <CompactRent label="Base" value={rents.base} active />
          <CompactRent label="1 casa" value={rents.house1} />
          <CompactRent label="2 casas" value={rents.house2} />
          <CompactRent label="3 casas" value={rents.house3} />
          <CompactRent label="4 casas" value={rents.house4} />
          <CompactRent label="Hotel" value={rents.hotel} />
          <CompactRent label="Arranha-céu" value={rents.skyscraper} accent />
        </div>
        <div className="mt-3 pt-2.5 border-t border-coffee-500/60 flex flex-col gap-0.5">
          <CompactRent label="Preço" value={price} muted />
          <CompactRent label="Casa" value={buildCost(p)} muted />
          <CompactRent label="Hipoteca" value={Math.floor(price / 2)} muted />
        </div>
      </div>
    )
  }
  if (square.kind === 'airport') {
    return (
      <div className="px-3.5 py-3">
        <p className="label text-gold mb-2" style={{ fontSize: '9px' }}>Aluguel por aeroportos possuídos</p>
        <div className="flex flex-col gap-0.5">
          <CompactRent label="1 aeroporto" value={25} />
          <CompactRent label="2 aeroportos" value={50} />
          <CompactRent label="3 aeroportos" value={100} />
          <CompactRent label="4 aeroportos" value={200} accent />
        </div>
        <div className="mt-3 pt-2.5 border-t border-coffee-500/60 flex flex-col gap-0.5">
          <CompactRent label="Preço" value={price} muted />
          <CompactRent label="Hipoteca" value={Math.floor(price / 2)} muted />
        </div>
      </div>
    )
  }
  // utility
  return (
    <div className="px-3.5 py-3">
      <p className="label text-gold mb-2" style={{ fontSize: '9px' }}>Aluguel baseado nos dados</p>
      <div className="flex flex-col gap-0.5">
        <CompactRentText label="1 utilidade" value="4× os dados" />
        <CompactRentText label="2 utilidades" value="10× os dados" />
        <CompactRentText label="3 utilidades" value="20× os dados" accent />
      </div>
      <div className="mt-3 pt-2.5 border-t border-coffee-500/60 flex flex-col gap-0.5">
        <CompactRent label="Preço" value={price} muted />
        <CompactRent label="Hipoteca" value={Math.floor(price / 2)} muted />
      </div>
    </div>
  )
}

function headerForSquare(square: PropertyOrAirportOrUtility): { bg: string; icon: React.ReactNode; title: string; subtitle?: string } {
  if (square.kind === 'property') {
    const p = square as PropertySquare
    const color = GROUP_COLOR[p.group]
    return {
      bg: `linear-gradient(180deg, ${color} 0%, ${color} 60%, color-mix(in srgb, ${color} 75%, #000) 100%)`,
      icon: (
        <div className="w-9 h-9 rounded-full bg-coffee-900 border-2 border-coffee-950 overflow-hidden shadow-[0_2px_4px_rgba(0,0,0,0.55)]">
          <img src={`https://flagcdn.com/${p.uf.toLowerCase()}.svg`} alt={p.uf} className="w-full h-full object-cover" draggable={false} />
        </div>
      ),
      title: p.name,
      subtitle: p.capital,
    }
  }
  if (square.kind === 'airport') {
    return {
      bg: 'linear-gradient(180deg, #d4af37 0%, #b8941f 100%)',
      icon: <SquareIcon square={square} size={32} />,
      title: square.name,
      subtitle: (square as AirportSquare).iata,
    }
  }
  const accent = square.icon === 'fuel' ? '#22c55e' : square.icon === 'bolt' ? '#ffd97a' : '#fb923c'
  return {
    bg: `linear-gradient(180deg, ${accent} 0%, color-mix(in srgb, ${accent} 70%, #000) 100%)`,
    icon: <SquareIcon square={square} size={32} />,
    title: square.name,
    subtitle: 'Utilidade',
  }
}

export function ModalLayer() {
  const game = useGameStore((s) => s.game)
  const buyProperty = useGameStore((s) => s.buyProperty)
  const declineProperty = useGameStore((s) => s.declineProperty)
  const placeBid = useGameStore((s) => s.placeBid)
  const passBid = useGameStore((s) => s.passBid)
  const discardCard = useGameStore((s) => s.discardCard)
  const chooseCardShortcut = useGameStore((s) => s.chooseCardShortcut)
  const chooseBusMove = useGameStore((s) => s.chooseBusMove)
  const chooseTripleDest = useGameStore((s) => s.chooseTripleDest)
  const confirmCardReveal = useGameStore((s) => s.confirmCardReveal)

  const view = activeModal(game)
  const activeId = game.players[game.turnOrder[game.activeSeat]].id

  return (
    <AnimatePresence>
      {view && (
        <motion.div
          key="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-coffee-950/70 backdrop-blur-[2px] p-4"
        >
          {view.kind === 'purchase' && (
            <Card>
              <Header {...headerForSquare(view.square as PropertyOrAirportOrUtility)} />
              <PurchaseBody square={view.square as PropertyOrAirportOrUtility} price={view.price} />
              <div className="px-3.5 pb-3.5 pt-1 flex gap-2">
                <ActionBtn onClick={buyProperty}>Comprar</ActionBtn>
                <ActionBtn onClick={declineProperty} variant="secondary">Recusar → leilão</ActionBtn>
              </div>
            </Card>
          )}

          {view.kind === 'auction' && (
            <AuctionCard view={view} activeId={activeId} placeBid={placeBid} passBid={passBid} />
          )}

          {view.kind === 'card-discard' && (
            <Card>
              <Header bg="linear-gradient(180deg, #d4af37 0%, #b8941f 100%)" icon={null} title="Mão cheia" subtitle="Escolha 1 carta para descartar" />
              <div className="px-3.5 py-3 flex flex-col gap-2">
                {view.cards.map((c) => (
                  <DiscardRow key={c.id} card={c} onPick={() => discardCard(c.id)} />
                ))}
              </div>
            </Card>
          )}

          {view.kind === 'card-shortcut' && (
            <Card>
              <Header bg="linear-gradient(180deg, #d4af37 0%, #b8941f 100%)" icon={null} title="Atalho" subtitle="Mover 3 casas" />
              <div className="px-3.5 py-3">
                <p className="text-cream-muted text-sm mb-3">Para que direção você quer andar 3 casas?</p>
                <div className="flex gap-2">
                  <ActionBtn onClick={() => chooseCardShortcut('frente')}>← Frente</ActionBtn>
                  <ActionBtn onClick={() => chooseCardShortcut('tras')} variant="secondary">Trás →</ActionBtn>
                </div>
              </div>
            </Card>
          )}

          {view.kind === 'card-reveal' && (
            <Card>
              <Header
                bg={`linear-gradient(180deg, ${RARITY_COLOR[view.rarity]} 0%, color-mix(in srgb, ${RARITY_COLOR[view.rarity]} 70%, #000) 100%)`}
                icon={null}
                title={view.deckId === 'acaso' ? 'Acaso' : 'Tesouro'}
                subtitle={view.mode === 'mao' ? 'Vai para a sua mão' : 'Efeito imediato'}
              />
              <div className="px-3.5 py-4 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="shrink-0 w-3 h-3 rounded-full" style={{ background: RARITY_COLOR[view.rarity] }} aria-hidden />
                  <span className="display text-cream text-lg leading-none">{cardLabel(view.effect)}</span>
                </div>
                <p className="text-cream-muted text-sm leading-snug">{CARD_DESC[view.effect] ?? 'Carta sorteada.'}</p>
                <div className="pt-1">
                  <ActionBtn onClick={() => confirmCardReveal()}>Continuar</ActionBtn>
                </div>
              </div>
            </Card>
          )}

          {view.kind === 'bus-move' && (
            <Card>
              <Header bg="linear-gradient(180deg, #d4af37 0%, #b8941f 100%)" icon={null} title="Speed Die — Ônibus" subtitle="Escolha por qual dado mover" />
              <div className="px-3.5 py-3 flex flex-col gap-2">
                {([
                  { opt: 'die0' as const, label: `Dado A (${view.white[0]})`, steps: view.white[0] },
                  { opt: 'die1' as const, label: `Dado B (${view.white[1]})`, steps: view.white[1] },
                  { opt: 'sum' as const, label: `Soma (${view.white[0] + view.white[1]})`, steps: view.white[0] + view.white[1] },
                ]).map(({ opt, label, steps }) => {
                  const dest = BOARD[(view.pos + steps) % BOARD.length]
                  return (
                    <ActionBtn key={opt} onClick={() => chooseBusMove(opt)}>
                      {label} → {dest.name}
                    </ActionBtn>
                  )
                })}
              </div>
            </Card>
          )}

          {view.kind === 'triple-dest' && (
            <Card>
              <Header bg="linear-gradient(180deg, #d4af37 0%, #b8941f 100%)" icon={null} title="Speed Die — Triple!" subtitle="Vá para qualquer casa" />
              <div className="px-3.5 py-3">
                <p className="text-cream-muted text-sm mb-2">Escolha o destino:</p>
                <div className="max-h-[46vh] overflow-auto flex flex-col gap-1 pr-1">
                  {BOARD.map((sq) => (
                    <button
                      key={sq.pos}
                      type="button"
                      onClick={() => chooseTripleDest(sq.pos)}
                      disabled={sq.pos === view.pos}
                      className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-[var(--radius-sharp)] bg-coffee-900 border border-coffee-500 hover:border-gold hover:bg-coffee-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-left"
                    >
                      <span className="label text-cream-muted shrink-0 w-6 text-right" style={{ fontSize: '9px' }}>{sq.pos}</span>
                      <span className="flex-1 min-w-0 text-cream text-sm truncate">{sq.name}</span>
                      {sq.pos === view.pos && <span className="label text-cream-muted shrink-0" style={{ fontSize: '8px' }}>aqui</span>}
                    </button>
                  ))}
                </div>
              </div>
            </Card>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// Linha de carta no descarte — cor da raridade + rótulo, clicável.
function DiscardRow({ card, onPick }: { card: HandCardView; onPick: () => void }) {
  const color = RARITY_COLOR[card.rarity]
  return (
    <button
      type="button"
      onClick={onPick}
      className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-[var(--radius-sharp)] bg-coffee-900 border border-coffee-500 hover:border-gold hover:bg-coffee-700 transition-colors text-left"
    >
      <span className="shrink-0 w-2.5 h-2.5 rounded-full" style={{ background: color }} aria-hidden />
      <span className="flex-1 min-w-0 text-cream text-sm truncate">{cardLabel(card.effect)}</span>
      <span className="label text-cream-muted shrink-0" style={{ fontSize: '8px' }}>descartar</span>
    </button>
  )
}

// Cartão de leilão (propriedade ou casas). Valor de lance é estado LOCAL.
function AuctionCard({
  view,
  activeId,
  placeBid,
  passBid,
}: {
  view: Extract<ModalView, { kind: 'auction' }>
  activeId: string
  placeBid: (playerId: string, amount: number) => void
  passBid: (playerId: string) => void
}) {
  const minNext = view.currentBid + 50
  const [bid, setBid] = useState(minNext)

  return (
    <Card>
      <Header bg="linear-gradient(180deg, #d4af37 0%, #b8941f 100%)" icon={null} title={view.square.name} subtitle="Leilão de propriedade" />
      <div className="px-3.5 py-3">
        <div className="flex flex-col gap-0.5">
          <CompactRent label="Lance atual" value={view.currentBid} active />
        </div>
        <p className="text-cream-muted text-xs mt-2">
          Maior licitante: <span className="text-cream">{view.highBidder ?? '—'}</span>
        </p>
        <p className="text-cream-muted text-xs mt-0.5">Fecha sozinho em ~10s.</p>

        <div className="mt-3 flex items-center gap-2">
          <input
            type="number"
            min={minNext}
            step={50}
            value={bid}
            onChange={(e) => setBid(Number(e.target.value))}
            className="w-20 px-2 py-1.5 rounded-[var(--radius-sharp)] bg-coffee-900 border border-coffee-500 text-cream text-sm"
          />
          <ActionBtn onClick={() => placeBid(activeId, Math.max(bid, minNext))}>Dar lance</ActionBtn>
          <ActionBtn onClick={() => passBid(activeId)} variant="secondary">Passar</ActionBtn>
        </div>
      </div>
    </Card>
  )
}
