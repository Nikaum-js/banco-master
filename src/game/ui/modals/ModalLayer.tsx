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
import { Button } from '@/game/ui/primitives'
import { Overlay, ModalShell, ModalHeader } from '@/game/ui/shell'

// Botão de ação do modal — casca fina sobre o primitivo Button (flex-1).
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
    <Button variant={variant} onClick={onClick} className="flex-1">
      {children}
    </Button>
  )
}

// Seta de direção do Atalho — frente segue o sentido horário do tabuleiro.
function ArrowGlyph({ flip = false }: { flip?: boolean }) {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={flip ? { transform: 'scaleX(-1)' } : undefined}
      aria-hidden
    >
      <path d="M4 12h15" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  )
}

// Cartão central — casca fina sobre o ModalShell canônico.
function Card({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <ModalShell className={cn('max-w-[92vw]', wide ? 'w-[360px]' : 'w-[300px]')}>
      {children}
    </ModalShell>
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
        <Overlay key="bus-armed-backdrop" z={60}>
          <BusPicker
            fromPos={activePlayer.pos}
            title="Usar Bus Ticket"
            subtitle="Vá para uma casa do mesmo lado"
            onPick={(pos) => { useBusTicketCmd(pos); disarmBus() }}
            onCancel={disarmBus}
          />
        </Overlay>
      )}
      {view && (
        <Overlay key="modal-backdrop" z={60}>
          {view.kind === 'auction' && (
            <AuctionCard view={view} activeId={activeId} placeBid={placeBid} />
          )}

          {view.kind === 'card-discard' && (
            <Card>
              <ModalHeader title="Mão cheia" subtitle="Escolha 1 carta para descartar" />
              <div className="px-3.5 py-3 flex flex-col gap-2">
                {view.cards.map((c) => (
                  <DiscardRow key={c.id} card={c} onPick={() => discardCard(c.id)} />
                ))}
              </div>
            </Card>
          )}

          {view.kind === 'card-shortcut' && (
            <Card>
              <ModalHeader title="Atalho" subtitle="Mover 3 casas — escolha a direção" />
              {/* Cada direção é um CARTÃO DE DESTINO: seta no sentido real do
                  tabuleiro + onde o jogador vai cair (nome + bandeira/glifo).
                  Decisão informada, sem precisar decorar o tabuleiro. */}
              <div className="px-3.5 py-3 flex flex-col gap-2">
                {([
                  { dir: 'frente' as const, label: 'Frente', steps: 3, hint: 'no sentido do jogo' },
                  { dir: 'tras' as const, label: 'Trás', steps: -3, hint: 'no sentido contrário' },
                ]).map(({ dir, label, steps, hint }) => {
                  const dest = BOARD[(activePlayer.pos + steps + BOARD.length) % BOARD.length]
                  return (
                    <button
                      key={dir}
                      type="button"
                      onClick={() => chooseCardShortcut(dir)}
                      className="group flex items-center gap-3 w-full px-3 py-2.5 rounded-[var(--radius-sharp)] bg-coffee-900 border border-coffee-500 hover:border-gold hover:bg-coffee-700 transition-colors text-left"
                    >
                      <span className="w-9 h-9 shrink-0 rounded-full bg-coffee-800 border border-coffee-500 grid place-items-center text-gold-glow transition-colors group-hover:border-gold/60">
                        <ArrowGlyph flip={dir === 'tras'} />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block display text-cream text-base leading-none">{label}</span>
                        <span className="block text-cream-muted text-xs leading-snug mt-1 truncate">
                          {hint} — cai em <span className="text-cream">{dest.name}</span>
                        </span>
                      </span>
                      {dest.kind === 'property' ? (
                        <span className="w-7 h-7 shrink-0 rounded-full bg-coffee-900 border border-coffee-950 overflow-hidden shadow-[var(--shadow-card)]">
                          <img
                            src={`https://flagcdn.com/${(dest as PropertySquare).uf.toLowerCase()}.svg`}
                            alt=""
                            className="w-full h-full object-cover"
                            draggable={false}
                          />
                        </span>
                      ) : (
                        <span className="text-gold shrink-0"><SquareIcon square={dest} size={24} /></span>
                      )}
                    </button>
                  )
                })}
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
              className="w-[300px] max-w-[90vw] bg-coffee-800 rounded-[var(--radius-modal)] overflow-hidden border-2"
              style={{ borderColor: RARITY_COLOR[view.rarity], boxShadow: `var(--shadow-dropdown), 0 0 22px color-mix(in srgb, ${RARITY_COLOR[view.rarity]} 45%, transparent)` }}
            >
              {/* Faixa da raridade */}
              <div
                className="px-4 py-2.5 flex items-center justify-between"
                style={{ background: `linear-gradient(180deg, ${RARITY_COLOR[view.rarity]} 0%, color-mix(in srgb, ${RARITY_COLOR[view.rarity]} 75%, var(--color-ink-950)) 100%)` }}
              >
                <span className="display text-coffee-950 text-sm leading-none tracking-[var(--tracking-caps)] uppercase">{view.deckId === 'acaso' ? 'Acaso' : 'Tesouro'}</span>
                <span className="label text-coffee-950/85 text-micro">{RARITY_LABEL[view.rarity]}</span>
              </div>

              {/* Corpo — véu radial na cor da raridade atrás do título */}
              <div
                className="px-5 pt-7 pb-5 flex flex-col items-center gap-5"
                style={{
                  background: `radial-gradient(90% 55% at 50% 0%, color-mix(in srgb, ${RARITY_COLOR[view.rarity]} 10%, transparent) 0%, transparent 62%)`,
                }}
              >
                <h2 className="display text-cream text-3xl leading-[0.95] text-center">{cardLabel(view.effect)}</h2>
                <div className="w-full">
                  <div className="flex items-center gap-2 justify-center mb-2">
                    <span className="h-px flex-1 bg-coffee-500/50" />
                    <span className="label text-gold text-micro">O que faz</span>
                    <span className="h-px flex-1 bg-coffee-500/50" />
                  </div>
                  <p className="text-cream text-sm leading-snug text-center">{CARD_DESC[view.effect] ?? 'Carta sorteada.'}</p>
                </div>
              </div>

              {/* Rodapé */}
              <div className="px-4 py-3 border-t-2 border-coffee-950 bg-coffee-900/60">
                <p className="label text-cream-muted text-center mb-2 text-micro">vai para a sua mão</p>
                <div className="flex">
                  <ActionBtn onClick={() => confirmCardReveal()}>Guardar na mão</ActionBtn>
                </div>
              </div>
            </motion.div>
          )}

          {view.kind === 'bus-move' && (
            <Card>
              <ModalHeader title="Ônibus do Speed Die" subtitle="Escolha por qual dado mover" />
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
              <ModalHeader title="Speed Die triplo!" subtitle="Vá para qualquer casa" />
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
                      <span className="label text-cream-muted shrink-0 w-6 text-right text-micro">{sq.pos}</span>
                      <span className="flex-1 min-w-0 text-cream text-sm truncate">{sq.name}</span>
                      {sq.pos === view.pos && <span className="label text-cream-muted shrink-0 text-nano">aqui</span>}
                    </button>
                  ))}
                </div>
              </div>
            </Card>
          )}
        </Overlay>
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
          : sq.kind === 'airport' || sq.kind === 'utility' ? 'var(--color-brass)' : 'transparent'
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
                  style={{ width: 20, height: 20, boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--color-brass) 50%, transparent)' }}
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
              <span className="text-cream leading-tight text-micro">{isFrom ? 'VOCÊ AQUI' : sq.name}</span>
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
    <ModalShell className="w-[760px] max-w-[96vw]">
      <ModalHeader title={title} subtitle={subtitle} />
      <div className="px-5 py-5">
        <SideRow fromPos={fromPos} onPick={onPick} />
        <p className="label text-cream-muted text-center mt-3 leading-snug">Clique numa casa da fileira para ir.</p>
        {onCancel && (
          <Button variant="secondary" onClick={onCancel} className="mt-3 w-full">
            Cancelar
          </Button>
        )}
      </div>
    </ModalShell>
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
      <span className="label text-cream-muted shrink-0 text-nano">descartar</span>
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
      <span className="label text-cream-muted text-nano">{label}</span>
    </div>
  )
}

function DeedIcon({ sq }: { sq: AuctionSquare }) {
  if (sq.kind === 'property') {
    const uf = (sq as PropertySquare).uf
    return (
      <div className="w-10 h-10 rounded-full bg-coffee-900 border-2 border-coffee-950 overflow-hidden shrink-0 shadow-[var(--shadow-card)]">
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
  const players = useGameStore((s) => s.game.players)
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
  const accent = isProp ? GROUP_COLOR[(sq as PropertySquare).group] : 'var(--color-brass)'

  return (
    <ModalShell className="w-[600px] max-w-[95vw]">
      <ModalHeader
        center
        title="Leilão"
        subtitle="quem der mais, leva"
        icon={<GavelIcon size={22} className="text-coffee-950" />}
        className="[&_h3]:text-xl"
      />
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
            <motion.p
              key={view.currentBid}
              initial={{ scale: 1.14 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 16 }}
              className="currency text-5xl leading-none mt-2 origin-left"
              style={{
                backgroundImage: 'var(--gradient-brass-shine)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
                filter: 'drop-shadow(0 2px 10px color-mix(in srgb, var(--color-brass) 45%, transparent))',
              }}
            >
              R$ {view.currentBid.toLocaleString('pt-BR')}
            </motion.p>
            <div className="flex items-center gap-1.5 mt-2 text-xs text-cream-muted">
              <span>Maior:</span>
              {view.highBidder ? (
                <>
                  {(() => {
                    const i = players.findIndex((pl) => pl.id === view.highBidder)
                    return i >= 0 ? <PlayerFace color={PLAYER_COLORS[i % PLAYER_COLORS.length]} size={18} /> : null
                  })()}
                  <span className="text-cream">{view.highBidder}</span>
                </>
              ) : (
                <span className="text-cream">— ninguém ainda</span>
              )}
            </div>
          </div>

          {/* Timer: enche até 100% → encerra; reseta a cada lance */}
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <GavelIcon size={13} className={secLeft <= 3 ? 'text-signal' : 'text-cream-muted'} />
              <span className={cn('label leading-none', secLeft <= 3 ? 'text-signal' : 'text-cream-muted')}>
                Termina em {secLeft}s…
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-coffee-950/60 overflow-hidden">
              <div
                className={cn('h-full rounded-full', secLeft <= 3 ? 'bg-signal' : 'bg-gold')}
                style={{ width: `${fillPct}%`, transition: 'width 0.2s linear' }}
              />
            </div>
          </div>

          <div>
            <p className="label text-cream-muted mb-2">Meu lance…</p>
            <div className="flex gap-2">
              {[2, 10, 100].map((inc) => {
                const next = view.currentBid + inc
                return (
                  <Button
                    key={inc}
                    disabled={next > cash}
                    onClick={() => placeBid(activeId, next)}
                    className="flex-1 flex-col px-1 py-3 gap-0"
                  >
                    <span className="currency text-base leading-none text-coffee-950">R$ {next}</span>
                    <span className="currency mt-1.5 leading-none text-coffee-950" style={{ fontSize: '11px' }}>+R$ {inc}</span>
                  </Button>
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
    </ModalShell>
  )
}
