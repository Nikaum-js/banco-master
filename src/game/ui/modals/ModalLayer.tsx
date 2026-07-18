// Camada de modais centrais (022). Único ponto com efeito desta fatia: consome
// activeModal(game) (puro) e dispara os comandos já existentes do store. Reusa o
// vocabulário visual dos popovers de propriedade (cartão coffee + header com stripe).
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Bus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useGameStore } from '@/game/store'
import { useLocalView } from '@/net/roomStore'
import { WaitingBar } from '@/net/ui/WaitingBar'
import { activeModal, type ModalView, type HandCardView } from './activeModal'
import { BOARD, type PropertySquare } from '@/lib/boardData'
import { busSideOf, canUseBusTicket } from '@/game/turn/turnMachine'
import { AUCTION_WINDOW } from '@/game/economy/purchase'
import { RARITY_COLOR, RARITY_LABEL, cardLabel, CARD_DESC } from '@/game/ui/cards/cardMeta'
import { useBusTicketUI } from '@/game/ui/busTicketUI'
import { PlayerFace } from '@/boards/shared'
import { GROUP_COLOR } from '@/boards/groupColors'
import { SquareIcon } from '@/boards/glyphs/squares'
import { computeRents } from '@/game/ui/deed/deedRents'
import { PLAYER_COLORS } from '@/game/ui/panels/playersView'
import { buildCost } from '@/game/economy/construction'
import { GavelIcon, CoinIcon, HouseIcon, HotelIcon } from '@/game/ui/icons'
import { Button } from '@/game/ui/primitives'
import { Overlay, ModalShell, ModalHeader } from '@/game/ui/shell'
import { useModalTitleId } from '@/game/ui/a11y/dialog'
import { useMotion, MOTION, EASE } from '@/game/ui/motion'
import { money } from '@/lib/money'

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

// Carta revelada — componente PRÓPRIO (não inline no JSX de ModalLayer) por necessidade,
// não por gosto: 044/T024, `useModalTitleId()` só resolve o id certo quando chamado por um
// componente que é DESCENDENTE do `Overlay` que o gerou (Context resolve por posição na
// árvore de fibers, não por aninhamento textual do JSX) — inline aqui leria o contexto de
// FORA do Overlay (sempre `null`), do mesmo jeito que `ModalHeader` (que já é componente
// à parte) resolve certo.
function CardRevealCard({
  view,
  reduced,
  onConfirm,
}: {
  view: Extract<ModalView, { kind: 'card-reveal' }>
  reduced: boolean
  onConfirm: () => void
}) {
  const titleId = useModalTitleId()
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, scale: 0.9, y: 10, rotateZ: -2 }}
      animate={{ opacity: 1, scale: 1, y: 0, rotateZ: 0 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: 10 }}
      transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 320, damping: 26 }}
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
        <h2 id={titleId ?? undefined} className="display text-cream text-3xl leading-[0.95] text-center">{cardLabel(view.effect)}</h2>
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
          <ActionBtn onClick={onConfirm}>Guardar na mão</ActionBtn>
        </div>
      </div>
    </motion.div>
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

// Modal → comando que ele dispara (para perguntar "é minha esta decisão?") e rótulo de espera.
const MODAL_ACTION = {
  'card-discard': 'discard-card',
  'card-shortcut': 'choose-card-shortcut',
  'card-reveal': 'confirm-card-reveal',
  'bus-move': 'choose-bus-move',
  'triple-dest': 'choose-triple-dest',
  auction: 'place-bid',
} as const

const MODAL_WAITING = {
  'card-discard': 'descarte de carta',
  'card-shortcut': 'escolha do atalho',
  'card-reveal': 'carta sacada',
  'bus-move': 'escolha do dado',
  'triple-dest': 'escolha da casa',
  auction: 'leilão',
} as const

export function ModalLayer() {
  const { reduced } = useMotion()
  const game = useGameStore((s) => s.game)
  const dispatch = useGameStore((s) => s.dispatch)
  const placeBid = (playerId: string, amount: number): void => dispatch({ kind: 'place-bid', playerId, amount })
  const discardCard = (cardId: string): void => dispatch({ kind: 'discard-card', cardId })
  const chooseCardShortcut = (dir: 'frente' | 'tras'): void => dispatch({ kind: 'choose-card-shortcut', dir })
  const chooseBusMove = (opt: 'die0' | 'die1' | 'sum'): void => dispatch({ kind: 'choose-bus-move', opt })
  const chooseTripleDest = (dest: number): void => dispatch({ kind: 'choose-triple-dest', dest })
  const confirmCardReveal = (): void => dispatch({ kind: 'confirm-card-reveal' })
  const spendBusTicket = (dest: number): void => dispatch({ kind: 'use-bus-ticket', dest })
  const busArmed = useBusTicketUI((s) => s.armed)
  // 044/T070 (FR-031): `boarding` fica true do clique na parada até a viagem terminar de
  // decorar. Sem isso, `canUseBusTicket(game)` — que já reflete o ticket gasto e o turno já
  // avançado — derrubaria `showBusArmed` no MESMO frame do dispatch, fechando o seletor
  // antes de a animação de embarque sequer aparecer.
  const busBoarding = useBusTicketUI((s) => s.boarding)
  const disarmBus = useBusTicketUI((s) => s.disarm)
  const setBusBoarding = useBusTicketUI((s) => s.setBoarding)

  const view = activeModal(game)
  const local = useLocalView()
  const activeId = game.players[game.turnOrder[game.activeSeat]].id
  // Quem decide neste modal? O leilão é PÚBLICO (todos licitam); os demais são do jogador
  // ativo — e o de descarte mostra a MÃO dele, então renderizá-lo para os outros vazaria
  // carta (princípio VI / FR-006). Para quem não decide, fica só o aviso de espera.
  const mineModal = view === null || view.kind === 'auction' || local.mayAct(MODAL_ACTION[view.kind])
  const activePlayer = game.players[game.turnOrder[game.activeSeat]]
  // Seletor de uso de ticket GUARDADO: aberto pelo HUD. Usável antes de rolar OU no fim do turno (034).
  // Elegibilidade vem do MOTOR (`canUseBusTicket`): a cópia que morava aqui não checava
  // `paused`, então com o jogo pausado o seletor abria e o clique era no-op. `|| busBoarding`
  // mantém o seletor na tela enquanto a viagem ainda está decorando por cima do estado já
  // avançado (T070) — sem isso o modal sumiria no instante do dispatch.
  const showBusArmed = busArmed && (canUseBusTicket(game) || busBoarding)

  return (
    <AnimatePresence>
      {view && !mineModal && (
        <WaitingBar key="modal-waiting" playerId={activeId} what={MODAL_WAITING[view.kind]} />
      )}
      {showBusArmed && (
        <Overlay key="bus-armed-backdrop" z={60}>
          <BusPicker
            fromPos={activePlayer.pos}
            title="Usar Bus Ticket"
            subtitle="Vá para uma casa do mesmo lado"
            onPick={spendBusTicket}
            onBoardingChange={setBusBoarding}
            onEmbarked={disarmBus}
            onCancel={disarmBus}
          />
        </Overlay>
      )}
      {view && mineModal && (
        <Overlay key="modal-backdrop" z={60}>
          {view.kind === 'auction' && (
            <AuctionCard view={view} activeId={local.seatId ?? activeId} placeBid={placeBid} />
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
              <ModalHeader title="Atalho" subtitle="Escolha a direção pra mover 3 casas" />
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
                          {hint}, cai em <span className="text-cream">{dest.name}</span>
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
            <CardRevealCard view={view} reduced={reduced} onConfirm={confirmCardReveal} />
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

// Bus Ticket — "linha de ônibus" (SRS §2.7): as casas do MESMO LADO viram
// paradas de uma linha; o ônibus fica estacionado na sua parada e DESLIZA até a
// parada sob o cursor. Clicar EMBARCA: o ônibus viaja até lá e só então o
// movimento acontece. Layout fluido (células flex, posição em %): nunca estoura
// a largura do modal — sem scroll horizontal.
// Duração da decoração de embarque (ônibus deslizando + rótulo "Embarcando…") — puramente
// visual desde o T070: o comando já saiu antes dela começar a contar. Zerada sob movimento
// reduzido (`reduced`), igual ao resto do vocabulário (D7 do plan).
const EMBARK_MS = 560

function BusLine({
  fromPos,
  onPick,
  onBoard,
  onEmbarked,
}: {
  fromPos: number
  onPick: (pos: number) => void
  onBoard?: () => void
  onEmbarked?: () => void
}) {
  const { reduced } = useMotion()
  const players = useGameStore((s) => s.game.players)
  const turnOrder = useGameStore((s) => s.game.turnOrder)
  const activeSeat = useGameStore((s) => s.game.activeSeat)
  const titles = useGameStore((s) => s.game.titles)
  const [hover, setHover] = useState<number | null>(null)
  const [departing, setDeparting] = useState<number | null>(null)
  const activeIdx = turnOrder[activeSeat] // índice em players do jogador da vez
  const side = busSideOf(fromPos)
  const cells = BOARD.filter((sq) => busSideOf(sq.pos) === side).reverse() // casas do lado, na ordem do tabuleiro (de trás pra frente)
  // Rostos por casa (peão = carinha, nunca bolinha): cor por assento + destaque do jogador da vez.
  const facesAt: Record<number, { color: string; active: boolean }[]> = {}
  players.forEach((p, i) => {
    if (p.eliminated) return
    ;(facesAt[p.pos] ??= []).push({ color: PLAYER_COLORS[i % PLAYER_COLORS.length], active: i === activeIdx })
  })
  // Parada onde o ônibus está: embarcando > cursor > a sua. Posição em % do
  // centro da célula — as células são flex-1 iguais, então (i + 0.5) / n.
  const n = cells.length
  const fromIdx = cells.findIndex((sq) => sq.pos === fromPos)
  const targetPos = departing ?? hover
  const busIdx = targetPos != null ? cells.findIndex((sq) => sq.pos === targetPos) : fromIdx
  const busPct = ((busIdx + 0.5) / n) * 100
  const steps = hover != null && departing == null ? hover - fromPos : 0 // lado é contíguo no BOARD → distância = diferença de pos

  // Embarque (044/T070, FR-031): o COMANDO sai na hora — `onPick` já não fica represado
  // atrás da viagem visual. O que antes era "espera 560ms, então move" virou "move, e a
  // viagem decora por cima do estado já avançado". Sob movimento reduzido, a decoração some
  // (`EMBARK_MS` zerado) e `onEmbarked` dispara já no próximo tick, sem espera nenhuma.
  const embark = (pos: number) => {
    if (departing != null) return
    setDeparting(pos)
    setHover(null)
    onBoard?.()
    onPick(pos)
    window.setTimeout(() => onEmbarked?.(), reduced ? 0 : EMBARK_MS)
  }

  return (
    <div className="flex flex-col" onMouseLeave={() => departing == null && setHover(null)}>
      {/* Estrada tracejada + ônibus; a placa de distância fica FIXA no centro
          (nunca estoura a borda do modal) */}
      <div className="relative h-12">
        <span className="absolute left-1/2 -translate-x-1/2 top-0 z-20">
          <AnimatePresence>
            {(departing != null || (hover != null && hover !== fromPos)) && (
              <motion.span
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: reduced ? 0 : MOTION.fast, ease: EASE.standard }}
                className="block label text-nano text-coffee-950 bg-gold-glow rounded-full px-2 py-0.5 whitespace-nowrap shadow-[var(--shadow-card)]"
              >
                {departing != null
                  ? 'Embarcando…'
                  : `${Math.abs(steps)} ${Math.abs(steps) === 1 ? 'casa' : 'casas'} ${steps > 0 ? 'à frente' : 'atrás'}`}
              </motion.span>
            )}
          </AnimatePresence>
        </span>
        <span className="absolute left-2 right-2 bottom-[15px] border-t-2 border-dashed border-brass/35" aria-hidden />
        <motion.div
          initial={false}
          animate={{ left: `${busPct}%`, scale: departing != null ? 1.1 : 1 }}
          transition={{ type: 'spring', stiffness: 130, damping: 19, mass: 1 }}
          className="absolute bottom-0 -ml-[18px] w-[36px] flex justify-center z-10 pointer-events-none"
        >
          <span className="w-8 h-8 rounded-full bg-gold text-coffee-950 grid place-items-center border-2 border-coffee-950 shadow-[var(--shadow-card)]">
            <Bus size={17} />
          </span>
        </motion.div>
      </div>

      {/* Pontos de parada ancorando cada casa na estrada */}
      <div className="flex mb-1">
        {cells.map((sq) => (
          <span key={sq.pos} className="flex-1 min-w-0 flex justify-center">
            <span className={cn('w-2 h-2 rounded-full border -mt-0.5', sq.pos === fromPos ? 'bg-gold border-gold' : 'bg-coffee-900 border-brass/50')} aria-hidden />
          </span>
        ))}
      </div>

      {/* Paradas — células flex (encolhem juntas, sem scroll), mesma linguagem
          informativa do tabuleiro (stripe, posse, bandeira, peões) */}
      <div className="flex">
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
            <span key={sq.pos} className="flex-1 min-w-0 px-0.5">
              <button
                type="button"
                disabled={isFrom || departing != null}
                onClick={() => embark(sq.pos)}
                onMouseEnter={() => departing == null && setHover(sq.pos)}
                onFocus={() => departing == null && setHover(sq.pos)}
                className={cn(
                  'relative w-full h-[112px] rounded-[4px] border flex flex-col overflow-hidden transition-all',
                  isFrom
                    ? 'border-cream bg-coffee-600 cursor-default'
                    : departing === sq.pos
                      ? 'border-gold bg-gold/25 -translate-y-0.5 shadow-[var(--shadow-glow)]'
                      : 'border-gold/70 bg-coffee-900/60 hover:bg-gold/25 hover:border-gold hover:-translate-y-0.5 cursor-pointer disabled:cursor-default',
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
                <span className="flex-1 flex flex-col items-center justify-center gap-0.5 px-0.5 text-center min-h-0 w-full">
                  {/* Propriedade = bandeira do país; demais tipos = glifo da casa (acaso/Tesouro/aeroporto/utilidade/taxa/cantos) */}
                  {isProp ? (
                    <span
                      className="block rounded-full border border-coffee-950/70 overflow-hidden shrink-0"
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
                  <span className="w-full text-cream leading-tight text-micro break-words line-clamp-2">{isFrom ? 'SUA PARADA' : sq.name}</span>
                  {!ownerColor && price != null && <span className="currency text-gold-glow leading-none" style={{ fontSize: '10px' }}>R$ {price}</span>}
                </span>
                <span className="flex items-center justify-center gap-px flex-wrap shrink-0 pb-1 min-h-[16px]">
                  {faces.slice(0, 4).map((f, j) => (
                    <PlayerFace key={j} color={f.color} active={f.active} size={16} />
                  ))}
                </span>
              </button>
            </span>
          )
        })}
      </div>
    </div>
  )
}

// Seletor de destino do Bus Ticket — a linha de ônibus acima + canhoto de
// bilhete picotado no rodapé. Usado pelo Bus Ticket guardado (carta ou espaço
// §2.7) via spendBusTicket.
function BusPicker({
  fromPos,
  title,
  subtitle,
  onPick,
  onBoardingChange,
  onEmbarked,
  onCancel,
}: {
  fromPos: number
  title: string
  subtitle: string
  onPick: (pos: number) => void
  /** 044/T070: avisa o pai (que decide se o seletor continua montado) assim que o
   * embarque começa — o comando já saiu, isto é só o sinal de "ainda decorando". */
  onBoardingChange?: (boarding: boolean) => void
  /** 044/T070: a viagem terminou de decorar — agora sim é hora de fechar o seletor. */
  onEmbarked?: () => void
  onCancel?: () => void
}) {
  const tickets = useGameStore((s) => s.game.players[s.game.turnOrder[s.game.activeSeat]].busTickets)
  const [boarding, setBoarding] = useState(false)
  return (
    <ModalShell className="w-[760px] max-w-[96vw]">
      <ModalHeader
        title={title}
        subtitle={subtitle}
        icon={
          <span className="w-9 h-9 rounded-full bg-coffee-950/15 border border-coffee-950/25 grid place-items-center text-coffee-950">
            <Bus size={19} />
          </span>
        }
      />
      <div className="px-5 pt-4 pb-3">
        <BusLine
          fromPos={fromPos}
          onPick={onPick}
          onBoard={() => { setBoarding(true); onBoardingChange?.(true) }}
          onEmbarked={onEmbarked}
        />
        <p className="label text-cream-muted text-center mt-2.5 leading-snug">Passe o cursor pela linha e clique na parada para embarcar.</p>
      </div>
      {/* Canhoto do bilhete — picote com furos nas bordas + contador + cancelar */}
      <div className="relative border-t-2 border-dashed border-coffee-500/60">
        <span className="absolute -left-[10px] -top-[10px] w-5 h-5 rounded-full bg-coffee-950 border-2 border-coffee-500" aria-hidden />
        <span className="absolute -right-[10px] -top-[10px] w-5 h-5 rounded-full bg-coffee-950 border-2 border-coffee-500" aria-hidden />
        <div className="pl-6 pr-4 py-2.5 flex items-center gap-3 bg-coffee-900/60">
          <span className="flex items-center gap-2">
            <Bus size={15} className="text-gold" />
            <span className="label text-cream-muted">Bilhete de ônibus</span>
            <span className="currency text-gold-glow text-sm tabular-nums leading-none">×{tickets}</span>
          </span>
          <span className="label text-cream-muted/70 text-nano">1 bilhete será usado na viagem</span>
          {onCancel && (
            <Button variant="secondary" onClick={onCancel} disabled={boarding} className="ml-auto">
              Cancelar
            </Button>
          )}
        </div>
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
  const { reduced } = useMotion()
  const cash = useGameStore((s) => s.game.players.find((p) => p.id === activeId)?.cash ?? 0)
  // Quem já passou não é mais licitante (`auction.ts:26` recusa o lance). Antes a view não
  // trazia `activeBidders`, então a tela oferecia três botões que o motor descartava.
  const stillBidding = view.activeBidders.includes(activeId)
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
              initial={reduced ? false : { scale: 1.14 }}
              animate={{ scale: 1 }}
              transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 300, damping: 16 }}
              className="currency text-5xl leading-none mt-2 origin-left"
              style={{
                backgroundImage: 'var(--gradient-brass-shine)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
                filter: 'drop-shadow(0 2px 10px color-mix(in srgb, var(--color-brass) 45%, transparent))',
              }}
            >
              {money(view.currentBid)}
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
                <span className="text-cream">ninguém ainda</span>
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
            <p className="label text-cream-muted mb-2">{stillBidding ? 'Meu lance…' : 'Você passou'}</p>
            <div className="flex gap-2">
              {[2, 10, 100].map((inc) => {
                const next = view.currentBid + inc
                return (
                  <Button
                    key={inc}
                    disabled={next > cash || !stillBidding}
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
