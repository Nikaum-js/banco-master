// Camada de modais centrais (022). Único ponto com efeito desta fatia: consome
// activeModal(game) (puro) e dispara os comandos já existentes do store. Reusa o
// vocabulário visual dos popovers de propriedade (cartão coffee + header com stripe).
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { cn } from '@/lib/utils'
import { useGameStore } from '@/game/store'
import { activeModal, type ModalView, type HandCardView } from './activeModal'
import { BOARD, type PropertySquare } from '@/lib/boardData'
import { sideOf } from '@/game/turn/turnMachine'
import { AUCTION_WINDOW } from '@/game/economy/purchase'
import { RARITY_COLOR, RARITY_LABEL, cardLabel, CARD_DESC } from '@/game/ui/cards/cardMeta'
import { useBusTicketUI } from '@/game/ui/busTicketUI'
import { GROUP_COLOR, SquareIcon, PlayerFace, computeRents, PLAYER_COLORS } from '@/boards/shared'
import { buildCost } from '@/game/economy/construction'
import { GavelIcon, CoinIcon, HouseIcon, HotelIcon } from '@/game/ui/icons'

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
function Card({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, y: 8 }}
      transition={{ type: 'spring', stiffness: 360, damping: 28 }}
      className={cn(
        'max-w-[92vw] bg-coffee-800 border-2 border-coffee-500 rounded-[var(--radius-card)] shadow-[var(--shadow-dropdown)] overflow-hidden',
        wide ? 'w-[360px]' : 'w-[300px]',
      )}
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

export function ModalLayer() {
  const game = useGameStore((s) => s.game)
  const placeBid = useGameStore((s) => s.placeBid)
  const discardCard = useGameStore((s) => s.discardCard)
  const chooseCardShortcut = useGameStore((s) => s.chooseCardShortcut)
  const chooseBusMove = useGameStore((s) => s.chooseBusMove)
  const chooseTripleDest = useGameStore((s) => s.chooseTripleDest)
  const confirmCardReveal = useGameStore((s) => s.confirmCardReveal)
  const useBusTicketCmd = useGameStore((s) => s.useBusTicket)
  const busArmed = useBusTicketUI((s) => s.armed)
  const disarmBus = useBusTicketUI((s) => s.disarm)

  const view = activeModal(game)
  const activeId = game.players[game.turnOrder[game.activeSeat]].id
  const activePlayer = game.players[game.turnOrder[game.activeSeat]]
  // Seletor de uso de ticket GUARDADO: aberto pelo HUD. Usável antes de rolar OU no fim do turno (034).
  const showBusArmed = busArmed && (game.turn.state === 'aguardando-rolagem' || game.turn.state === 'aguardando-finalizacao') && activePlayer.busTickets >= 1 && sideOf(activePlayer.pos) !== null

  return (
    <AnimatePresence>
      {showBusArmed && (
        <motion.div
          key="bus-armed-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-coffee-950/70 backdrop-blur-[2px] p-4"
        >
          <BusPicker
            fromPos={activePlayer.pos}
            title="Usar Bus Ticket"
            subtitle="Vá para uma casa do mesmo lado"
            onPick={(pos) => { useBusTicketCmd(pos); disarmBus() }}
            onCancel={disarmBus}
          />
        </motion.div>
      )}
      {view && (
        <motion.div
          key="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-coffee-950/70 backdrop-blur-[2px] p-4"
        >
          {view.kind === 'auction' && (
            <AuctionCard view={view} activeId={activeId} placeBid={placeBid} />
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
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 10, rotateZ: -2 }}
              animate={{ opacity: 1, scale: 1, y: 0, rotateZ: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              transition={{ type: 'spring', stiffness: 320, damping: 26 }}
              onClick={(e) => e.stopPropagation()}
              className="w-[300px] max-w-[90vw] bg-coffee-800 rounded-[var(--radius-card)] overflow-hidden border-2"
              style={{ borderColor: RARITY_COLOR[view.rarity], boxShadow: `0 12px 40px rgba(0,0,0,0.55), 0 0 22px color-mix(in srgb, ${RARITY_COLOR[view.rarity]} 45%, transparent)` }}
            >
              {/* Faixa da raridade */}
              <div
                className="px-4 py-2.5 flex items-center justify-between"
                style={{ background: `linear-gradient(180deg, ${RARITY_COLOR[view.rarity]} 0%, color-mix(in srgb, ${RARITY_COLOR[view.rarity]} 75%, #000) 100%)` }}
              >
                <span className="display text-coffee-950 text-sm leading-none tracking-[0.2em] uppercase">{view.deckId === 'acaso' ? 'Acaso' : 'Tesouro'}</span>
                <span className="label text-coffee-950/85" style={{ fontSize: '9px' }}>{RARITY_LABEL[view.rarity]}</span>
              </div>

              {/* Corpo */}
              <div className="px-5 pt-7 pb-5 flex flex-col items-center gap-5">
                <h2 className="display text-cream text-3xl leading-[0.95] text-center">{cardLabel(view.effect)}</h2>
                <div className="w-full">
                  <div className="flex items-center gap-2 justify-center mb-2">
                    <span className="h-px flex-1 bg-coffee-500/50" />
                    <span className="label text-gold" style={{ fontSize: '9px' }}>O que faz</span>
                    <span className="h-px flex-1 bg-coffee-500/50" />
                  </div>
                  <p className="text-cream text-sm leading-snug text-center">{CARD_DESC[view.effect] ?? 'Carta sorteada.'}</p>
                </div>
              </div>

              {/* Rodapé */}
              <div className="px-4 py-3 border-t-2 border-coffee-950 bg-coffee-900/60">
                <p className="label text-cream-muted text-center mb-2" style={{ fontSize: '9px' }}>vai para a sua mão</p>
                <div className="flex">
                  <ActionBtn onClick={() => confirmCardReveal()}>Guardar na mão</ActionBtn>
                </div>
              </div>
            </motion.div>
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

// Fileira do MESMO LADO (a única para onde o Bus Ticket pode ir) — uma faixa de
// casas como um trecho do tabuleiro: faixa de cor do grupo, peões e nº da casa.
// A casa atual fica marcada; as demais são clicáveis. Tooltip mostra o nome.
function SideRow({ fromPos, onPick }: { fromPos: number; onPick: (pos: number) => void }) {
  const players = useGameStore((s) => s.game.players)
  const turnOrder = useGameStore((s) => s.game.turnOrder)
  const activeSeat = useGameStore((s) => s.game.activeSeat)
  const titles = useGameStore((s) => s.game.titles)
  const activeIdx = turnOrder[activeSeat] // índice em players do jogador da vez
  const side = sideOf(fromPos)
  const cells = BOARD.filter((sq) => sideOf(sq.pos) === side).reverse() // casas do lado, na ordem do tabuleiro (de trás pra frente)
  // Rostos por casa (peão = carinha, nunca bolinha): cor por assento + destaque do jogador da vez.
  const facesAt: Record<number, { color: string; active: boolean }[]> = {}
  players.forEach((p, i) => {
    if (p.eliminated) return
    ;(facesAt[p.pos] ??= []).push({ color: PLAYER_COLORS[i % PLAYER_COLORS.length], active: i === activeIdx })
  })
  return (
    <div className="flex gap-1 justify-center overflow-x-auto pb-1 bg-coffee-950/40 rounded-[var(--radius-sharp)] p-1.5">
      {cells.map((sq) => {
        const isFrom = sq.pos === fromPos
        const isProp = sq.kind === 'property'
        const stripe = isProp ? GROUP_COLOR[(sq as PropertySquare).group]
          : sq.kind === 'airport' || sq.kind === 'utility' ? '#d4af37' : 'transparent'
        const price = 'price' in sq ? sq.price : null
        // Posse (igual ao tabuleiro): casa com dono "veste" a cor dele (tint + moldura)
        // e NÃO mostra preço — só casa livre exibe valor.
        const ownerId = titles[sq.pos]?.ownerId
        const oi = ownerId ? players.findIndex((p) => p.id === ownerId) : -1
        const ownerColor = oi >= 0 ? PLAYER_COLORS[oi % PLAYER_COLORS.length] : undefined
        const faces = facesAt[sq.pos] ?? []
        return (
          <button
            key={sq.pos}
            type="button"
            disabled={isFrom}
            onClick={() => onPick(sq.pos)}
            title={sq.name}
            className={cn(
              'relative shrink-0 w-[60px] h-[112px] rounded-[4px] border flex flex-col overflow-hidden transition-colors',
              isFrom ? 'border-cream bg-coffee-600 cursor-default' : 'border-gold/70 bg-coffee-900/60 hover:bg-gold/25 hover:border-gold cursor-pointer',
            )}
          >
            <span className="h-2 w-full shrink-0" style={{ background: stripe }} />
            {/* Posse — veste a cor do dono (tint + moldura), como na célula do tabuleiro */}
            {ownerColor && !isFrom && (
              <>
                <span className="absolute inset-0 pointer-events-none" style={{ background: ownerColor, opacity: 0.16 }} aria-hidden />
                <span className="absolute inset-0 pointer-events-none" style={{ boxShadow: `inset 0 0 0 2px ${ownerColor}` }} aria-hidden />
              </>
            )}
            <span className="flex-1 flex flex-col items-center justify-center gap-0.5 px-1 text-center min-h-0">
              {/* Propriedade = bandeira do país; demais tipos = glifo da casa (acaso/Tesouro/aeroporto/utilidade/taxa/cantos) */}
              {isProp ? (
                <span
                  className="rounded-full border border-coffee-950/70 overflow-hidden shrink-0"
                  style={{ width: 20, height: 20, boxShadow: 'inset 0 0 0 1px rgba(212,175,55,0.5)' }}
                >
                  <img
                    src={`https://flagcdn.com/${(sq as PropertySquare).uf.toLowerCase()}.svg`}
                    alt={(sq as PropertySquare).uf}
                    className="w-full h-full object-cover block"
                    draggable={false}
                  />
                </span>
              ) : (
                <span className="text-gold leading-none"><SquareIcon square={sq} size={20} /></span>
              )}
              <span className="text-cream leading-tight" style={{ fontSize: '9px' }}>{isFrom ? 'VOCÊ AQUI' : sq.name}</span>
              {!ownerColor && price != null && <span className="currency text-gold-glow leading-none" style={{ fontSize: '11px' }}>R$ {price}</span>}
            </span>
            <span className="flex items-center justify-center gap-px flex-wrap shrink-0 pb-1 min-h-[16px]">
              {faces.slice(0, 4).map((f, j) => (
                <PlayerFace key={j} color={f.color} active={f.active} size={16} />
              ))}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// Seletor de destino do Bus Ticket — a FILEIRA (lado) como uma faixa de casas com
// nome vertical. Usado pelo Bus Ticket guardado (carta ou espaço §2.7) via useBusTicket.
function BusPicker({
  fromPos,
  title,
  subtitle,
  onPick,
  onCancel,
}: {
  fromPos: number
  title: string
  subtitle: string
  onPick: (pos: number) => void
  onCancel?: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, y: 8 }}
      transition={{ type: 'spring', stiffness: 360, damping: 28 }}
      onClick={(e) => e.stopPropagation()}
      className="w-[760px] max-w-[96vw] bg-coffee-800 border-2 border-coffee-500 rounded-[var(--radius-card)] shadow-[var(--shadow-dropdown)] overflow-hidden"
    >
      <Header bg="linear-gradient(180deg, #d4af37 0%, #b8941f 100%)" icon={null} title={title} subtitle={subtitle} />
      <div className="px-5 py-5">
        <SideRow fromPos={fromPos} onPick={onPick} />
        <p className="label text-cream-muted text-center mt-3 leading-snug">Clique numa casa da fileira para ir.</p>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="mt-3 w-full px-3 py-2 rounded-[var(--radius-sharp)] bg-coffee-700 text-cream border border-coffee-500 hover:bg-coffee-600 font-bold text-sm transition-colors"
          >
            Cancelar
          </button>
        )}
      </div>
    </motion.div>
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

// Faixas de aluguel exibidas no deed do leilão (até hotel).
type AuctionSquare = Extract<ModalView, { kind: 'auction' }>['square']
function deedRows(sq: AuctionSquare): { label: string; value: string }[] {
  if (sq.kind === 'property') {
    const r = computeRents((sq as PropertySquare).group, (sq as PropertySquare).rent)
    return [
      { label: 'Com aluguel', value: `R$ ${r.base}` },
      { label: '1 casa', value: `R$ ${r.house1}` },
      { label: '2 casas', value: `R$ ${r.house2}` },
      { label: '3 casas', value: `R$ ${r.house3}` },
      { label: '4 casas', value: `R$ ${r.house4}` },
      { label: 'Hotel', value: `R$ ${r.hotel}` },
      { label: '2º hotel', value: `R$ ${r.hotel2}` },
      { label: 'Arranha-céu', value: `R$ ${r.skyscraper}` },
    ]
  }
  if (sq.kind === 'airport') {
    return [
      { label: '1 aeroporto', value: 'R$ 25' },
      { label: '2 aeroportos', value: 'R$ 50' },
      { label: '3 aeroportos', value: 'R$ 100' },
      { label: '4 aeroportos', value: 'R$ 200' },
    ]
  }
  return [
    { label: '1 utilidade', value: '4× dados' },
    { label: '2 utilidades', value: '10× dados' },
    { label: '3 utilidades', value: '20× dados' },
  ]
}

function DeedStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 flex-1">
      <span className="text-gold">{icon}</span>
      <span className="currency text-cream text-sm leading-none">{value}</span>
      <span className="label text-cream-muted" style={{ fontSize: '8px' }}>{label}</span>
    </div>
  )
}

function DeedIcon({ sq }: { sq: AuctionSquare }) {
  if (sq.kind === 'property') {
    const uf = (sq as PropertySquare).uf
    return (
      <div className="w-10 h-10 rounded-full bg-coffee-900 border-2 border-coffee-950 overflow-hidden shrink-0 shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
        <img src={`https://flagcdn.com/${uf.toLowerCase()}.svg`} alt={uf} className="w-full h-full object-cover" draggable={false} />
      </div>
    )
  }
  return <span className="text-gold shrink-0"><SquareIcon square={sq} size={34} /></span>
}

// Tela de leilão (D-021/redesign) — overlay 2 colunas: lances+timer | deed.
function AuctionCard({
  view,
  activeId,
  placeBid,
}: {
  view: Extract<ModalView, { kind: 'auction' }>
  activeId: string
  placeBid: (playerId: string, amount: number) => void
}) {
  const cash = useGameStore((s) => s.game.players.find((p) => p.id === activeId)?.cash ?? 0)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 200)
    return () => clearInterval(t)
  }, [])
  const msLeft = Math.max(0, view.deadline - now)
  const secLeft = Math.ceil(msLeft / 1000)
  const fillPct = Math.max(0, Math.min(100, 100 - (msLeft / AUCTION_WINDOW) * 100)) // enche; reseta a cada lance
  const sq = view.square
  const price = 'price' in sq ? sq.price : 0
  const isProp = sq.kind === 'property'
  const houseCost = isProp ? buildCost(sq as PropertySquare) : 0
  const accent = isProp ? GROUP_COLOR[(sq as PropertySquare).group] : '#d4af37'

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, y: 8 }}
      transition={{ type: 'spring', stiffness: 360, damping: 28 }}
      onClick={(e) => e.stopPropagation()}
      className="w-[600px] max-w-[95vw] bg-coffee-800 border-2 border-coffee-500 rounded-[var(--radius-card)] shadow-[var(--shadow-dropdown)] overflow-hidden"
    >
      {/* Título */}
      <div className="px-4 py-3 border-b-2 border-coffee-950 bg-[linear-gradient(180deg,#d4af37_0%,#b8941f_100%)] text-center">
        <h3 className="display text-coffee-950 text-xl leading-none tracking-wide">Leilão</h3>
      </div>
      {/* Nome + ícone, centralizado */}
      <div className="flex items-center justify-center gap-2.5 px-4 pt-4 pb-3">
        <DeedIcon sq={sq} />
        <h2 className="display text-cream text-2xl leading-none">{sq.name}</h2>
      </div>

      <div className="flex divide-x divide-coffee-500/50 border-t border-coffee-500/40">
        {/* Coluna esquerda — lances + timer */}
        <div className="flex-1 p-5 flex flex-col gap-6">
          <div>
            <p className="label text-cream-muted">Lance atual</p>
            <p className="currency text-gold-glow text-5xl leading-none mt-2">R$ {view.currentBid.toLocaleString('pt-BR')}</p>
            <p className="text-cream-muted text-xs mt-2">Maior: <span className="text-cream">{view.highBidder ?? '—'}</span></p>
          </div>

          {/* Timer: enche até 100% → encerra; reseta a cada lance */}
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <GavelIcon size={13} className="text-cream-muted" />
              <span className="label leading-none text-cream-muted">Termina em {secLeft}s…</span>
            </div>
            <div className="h-2.5 rounded-full bg-coffee-950/60 overflow-hidden">
              <div className="h-full rounded-full bg-gold" style={{ width: `${fillPct}%`, transition: 'width 0.2s linear' }} />
            </div>
          </div>

          <div>
            <p className="label text-cream-muted mb-2">Meu lance…</p>
            <div className="flex gap-2">
              {[2, 10, 100].map((inc) => {
                const next = view.currentBid + inc
                return (
                  <button
                    key={inc}
                    type="button"
                    disabled={next > cash}
                    onClick={() => placeBid(activeId, next)}
                    className="flex-1 flex flex-col items-center px-1 py-3 rounded-[var(--radius-sharp)] bg-gold text-coffee-900 hover:brightness-110 active:translate-y-px disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    <span className="currency text-base leading-none text-coffee-950">R$ {next}</span>
                    <span className="currency mt-1.5 leading-none text-coffee-950" style={{ fontSize: '11px' }}>+R$ {inc}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Coluna direita — deed (aluguéis + preço/casa/hotel) */}
        <div className="flex-1 p-5">
          <div className="rounded-[var(--radius-card)] border border-coffee-500 bg-coffee-900/50 overflow-hidden h-full flex flex-col">
            <div className="px-4 py-2.5 text-center border-b border-coffee-500/60" style={{ background: `color-mix(in srgb, ${accent} 22%, transparent)` }}>
              <p className="display text-cream text-base leading-none">{sq.name}</p>
            </div>
            <div className="px-4 py-3 flex flex-col gap-2 flex-1">
              {deedRows(sq).map((r) => (
                <div key={r.label} className="flex items-baseline justify-between gap-3 text-[13px]">
                  <span className="text-cream-muted">{r.label}</span>
                  <span className="currency text-cream">{r.value}</span>
                </div>
              ))}
            </div>
            <div className="px-3 py-3 border-t border-coffee-500/60 flex items-stretch gap-2">
              <DeedStat icon={<CoinIcon size={16} />} label="Preço" value={`R$ ${price}`} />
              {isProp && <DeedStat icon={<HouseIcon size={16} />} label="Casa" value={`R$ ${houseCost}`} />}
              {isProp && <DeedStat icon={<HotelIcon size={16} />} label="Hotel" value={`R$ ${houseCost}`} />}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
