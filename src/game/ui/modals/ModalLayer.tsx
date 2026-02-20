// Camada de modais centrais (022). Único ponto com efeito desta fatia: consome
// activeModal(game) (puro) e dispara os comandos já existentes do store. Reusa o
// vocabulário visual dos popovers de propriedade (cartão coffee + header com stripe).
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Bus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useGameStore } from '@/game/store'
import { useLocalView, useRoomStore } from '@/net/roomStore'
import { identityOf } from '@/net/identity'
import { WaitingBar } from '@/net/ui/WaitingBar'
import { activeModal, type ModalView, type HandCardView } from './activeModal'
import type { Rarity } from '@/game/cards/types'
import { BOARD, GROUPS, type PropertySquare, type Square } from '@/lib/boardData'
import { busSideOf, canUseBusTicket } from '@/game/turn/turnMachine'
import { AUCTION_WINDOW } from '@/game/economy/purchase'
import { RARITY_COLOR, RARITY_LABEL, cardLabel, CARD_DESC } from '@/game/ui/cards/cardMeta'
import { cardById } from '@/game/cards/catalog'
import { useBusTicketUI } from '@/game/ui/busTicketUI'
import { PlayerFace } from '@/boards/PlayerFace'
import { SquareIcon } from '@/boards/glyphs/squares'
import {
  PlotBadgeIcon,
  HouseBadgeIcon,
  HotelBadgeIcon,
  SkyscraperBadgeIcon,
} from '@/boards/glyphs/badges'
import { CoinIcon, GavelIcon } from '@/game/ui/icons'
import { Button } from '@/game/ui/primitives'
import { Overlay, ModalShell, ModalHeader } from '@/game/ui/shell'
import { useModalTitleId } from '@/game/ui/a11y/dialog'
import { useMotion } from '@/game/ui/motion'
import { money } from '@/lib/money'
import { deedPresentation } from '@/game/ui/deed/presentation'

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
  // 043: `cardId`/`rarity`/`effect` são anuláveis na view — um slot OCULTO é carta alheia, e
  // quem observa nunca chega aqui (`mineModal` já barra). Exigir o não-nulo NA PROP é o que
  // transporta essa garantia para dentro do componente: o estreitamento feito no chamador
  // vale aqui também, sem um `!` por campo no corpo.
  view: Extract<ModalView, { kind: 'card-reveal' }> & { cardId: string; rarity: Rarity; effect: string }
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
      className="atlas-surface atlas-surface--modal card-reveal w-[300px] max-w-[90vw] overflow-hidden"
      style={{
        '--atlas-surface-accent': RARITY_COLOR[view.rarity],
        '--card-reveal-accent': RARITY_COLOR[view.rarity],
        boxShadow: `inset 0 1px 0 color-mix(in srgb, ${RARITY_COLOR[view.rarity]} 12%, transparent), 0 0 0 4px color-mix(in srgb, var(--color-ink-950) 72%, transparent), 0 0 0 5px color-mix(in srgb, ${RARITY_COLOR[view.rarity]} 18%, transparent), var(--shadow-dropdown), 0 0 22px color-mix(in srgb, ${RARITY_COLOR[view.rarity]} 45%, transparent)`,
      } as React.CSSProperties}
    >
      {/* Raridade como filete, sem quebrar a superfície azul do modal. */}
      <div
        className="card-reveal__header px-5 pt-5 pb-3 flex items-center justify-between"
      >
        <span className="display text-starlight text-base leading-none tracking-[var(--tracking-caps)] uppercase">{view.deckId === 'acaso' ? 'Acaso' : 'Tesouro'}</span>
        <span className="label card-reveal__rarity text-micro">{RARITY_LABEL[view.rarity]}</span>
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
  // O `deck` vem do CATÁLOGO, não do estado — quem descarta sempre vê a própria carta
  // (nunca oculta), então `cardById` é seguro aqui (043, D10).
  const discardCard = (cardId: string): void => dispatch({ kind: 'discard-card', cardId, deck: cardById(cardId).deck })
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

          {/* `mineModal` já garante que só quem decide chega aqui — a mão nunca tem oculto
              na perspectiva de quem decide (043); o `!== null` só estreita o tipo pro TS.
              O corpo do card virou `CardRevealCard` na 044 (movimento reduzido). */}
          {view.kind === 'card-reveal' && view.cardId !== null && view.rarity !== null && view.effect !== null && (
            <CardRevealCard
              // Reafirma os três campos já estreitados na condição: o TS não carrega um
              // `&&` sobre propriedades para dentro do tipo do objeto inteiro.
              view={{ ...view, cardId: view.cardId, rarity: view.rarity, effect: view.effect }}
              reduced={reduced}
              onConfirm={confirmCardReveal}
            />
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

function busStopAccent(ownerColor?: string): string {
  return ownerColor ?? 'var(--color-ink-400)'
}

function busStopFooterAccent(square: Square, ownerColor?: string): string {
  if (ownerColor) return ownerColor

  switch (square.kind) {
    case 'acaso':
    case 'tax':
      return 'var(--color-signal)'
    case 'tesouro':
    case 'bus-ticket':
    case 'airport':
      return 'var(--color-brass)'
    case 'utility':
      return square.icon === 'fuel'
        ? 'var(--color-group-green)'
        : square.icon === 'bolt'
          ? 'var(--color-brass-glow)'
          : 'var(--color-group-orange)'
    case 'property':
    case 'corner-go':
    case 'corner-jail':
    case 'corner-parking':
    case 'corner-gotojail':
      return 'var(--color-ink-400)'
  }
}

function busStopMeta(square: Square): string {
  switch (square.kind) {
    case 'property':
      return square.capital ?? GROUPS[square.group].name
    case 'airport':
      return `Aeroporto · ${square.iata}`
    case 'utility':
      return 'Serviço público'
    case 'tax':
      return 'Imposto'
    case 'acaso':
      return 'Carta de Acaso'
    case 'tesouro':
      return 'Carta de Tesouro'
    case 'bus-ticket':
      return 'Ponto de ônibus'
    case 'corner-go':
    case 'corner-jail':
    case 'corner-parking':
    case 'corner-gotojail':
      return 'Canto do tabuleiro'
  }
}

function busStopValue(square: Square, ownerName?: string): string {
  if (ownerName) return `Dono · ${ownerName}`
  if ('price' in square) return `Livre · R$ ${square.price}`
  if (square.kind === 'tax') return `Cobrança · R$ ${square.amount}`
  if (square.kind === 'acaso' || square.kind === 'tesouro') return 'Compre uma carta'
  if (square.kind === 'bus-ticket') return 'Ganhe 1 bilhete'
  return 'Parada especial'
}

function BusStopGlyph({ square, size = 24 }: { square: Square; size?: number }) {
  if (square.kind === 'property') {
    return (
      <span
        className="bus-stop-flag"
        style={{ width: size, height: size }}
      >
        <img
          src={`https://flagcdn.com/${square.uf.toLowerCase()}.svg`}
          alt=""
          className="block h-full w-full object-cover"
          draggable={false}
        />
      </span>
    )
  }
  return <SquareIcon square={square} size={size} />
}

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
  const room = useRoomStore((s) => s.room)
  const [hover, setHover] = useState<number | null>(null)
  const [departing, setDeparting] = useState<number | null>(null)
  const activeIdx = turnOrder[activeSeat] // índice em players do jogador da vez
  const side = busSideOf(fromPos)
  const cells = BOARD.filter((sq) => busSideOf(sq.pos) === side).reverse() // casas do lado, na ordem do tabuleiro (de trás pra frente)
  // Rostos por casa (peão = carinha, nunca bolinha): cor por assento + destaque do jogador da vez.
  const facesAt: Record<number, {
    color: string
    avatar: ReturnType<typeof identityOf>['avatar']
    skin: ReturnType<typeof identityOf>['skin']
    active: boolean
  }[]> = {}
  players.forEach((p, i) => {
    if (p.eliminated) return
    const identity = identityOf(room, p.id)
    ;(facesAt[p.pos] ??= []).push({
      color: identity.color,
      avatar: identity.avatar,
      skin: identity.skin,
      active: i === activeIdx,
    })
  })
  // Parada onde o ônibus está: embarcando > cursor > a sua. Posição em % do
  // centro da célula — as células são flex-1 iguais, então (i + 0.5) / n.
  const n = cells.length
  const fromIdx = cells.findIndex((sq) => sq.pos === fromPos)
  const targetPos = departing ?? hover
  const busIdx = targetPos != null ? cells.findIndex((sq) => sq.pos === targetPos) : fromIdx
  const busPct = ((busIdx + 0.5) / n) * 100

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
    <div className="bus-route flex min-w-0 max-w-full flex-col" onMouseLeave={() => departing == null && setHover(null)}>
      {departing != null && (
        <span className="sr-only" aria-live="polite">Embarcando…</span>
      )}

      {/* Estrada tracejada + ônibus. */}
      <div className="relative h-10">
        <span className="absolute left-2 right-2 bottom-[15px] border-t-2 border-dashed border-brass/35" aria-hidden />
        <motion.div
          initial={false}
          animate={{ left: `${busPct}%`, scale: departing != null ? 1.1 : 1 }}
          transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 130, damping: 19, mass: 1 }}
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
      <div className="bus-stop-grid">
        {cells.map((sq) => {
          const isFrom = sq.pos === fromPos
          const isProp = sq.kind === 'property'
          // Posse (igual ao tabuleiro): casa com dono "veste" a cor dele (tint + moldura)
          // e troca o valor livre pelo nome do dono.
          const ownerId = titles[sq.pos]?.ownerId
          const owner = ownerId ? identityOf(room, ownerId) : undefined
          const accent = busStopAccent(owner?.color)
          const faces = facesAt[sq.pos] ?? []
          const price = !owner && 'price' in sq ? sq.price : null
          const footerAccent = busStopFooterAccent(sq, owner?.color)
          const semanticValue = busStopValue(sq, owner?.name)
          const ariaLabel = `${sq.name}. ${busStopMeta(sq)}.${isFrom ? ' Ponto de partida.' : ` ${semanticValue}. ${Math.abs(sq.pos - fromPos)} casas de distância.`}`
          return (
            <span key={sq.pos} className="bus-stop-cell">
              <button
                type="button"
                disabled={isFrom || departing != null}
                aria-label={ariaLabel}
                aria-current={isFrom ? 'location' : undefined}
                onClick={() => embark(sq.pos)}
                onMouseEnter={() => departing == null && setHover(sq.pos)}
                onFocus={() => departing == null && setHover(sq.pos)}
                className={cn(
                  'bus-stop-card',
                  isFrom
                    ? 'bus-stop-card--current cursor-default'
                    : departing === sq.pos
                      ? 'bus-stop-card--departing'
                      : 'cursor-pointer disabled:cursor-default',
                  owner && 'bus-stop-card--owned',
                )}
                style={{
                  '--bus-stop-accent': accent,
                  '--bus-stop-owner': owner?.color ?? 'transparent',
                  '--bus-stop-footer-accent': footerAccent,
                } as React.CSSProperties}
              >
                <span className="bus-stop-card__stripe" aria-hidden />
                <span className="bus-stop-card__topline">
                  <span>#{String(sq.pos).padStart(2, '0')}</span>
                  {!isFrom && owner && <i style={{ background: owner.color }} title={`Dono: ${owner.name}`} />}
                </span>
                <span className="bus-stop-card__body">
                  <span className={cn('bus-stop-card__glyph', !isProp && 'text-gold')}>
                    <BusStopGlyph square={sq} size={24} />
                  </span>
                  <span className="bus-stop-card__name">{sq.short ?? sq.name}</span>
                </span>
                <span
                  className={cn(
                    'bus-stop-card__footer',
                    faces.length > 0
                      ? 'bus-stop-card__footer--players'
                      : price != null
                        ? 'bus-stop-card__footer--price'
                        : 'bus-stop-card__footer--accent',
                  )}
                  aria-hidden
                >
                  {faces.length > 0 ? (
                    <span className="bus-stop-card__faces">
                      {faces.slice(0, 3).map((f, j) => (
                        <PlayerFace key={j} color={f.color} avatar={f.avatar} skin={f.skin} active={f.active} size={20} />
                      ))}
                    </span>
                  ) : price != null ? (
                    <span className="bus-stop-card__price">
                      <span>R$</span>
                      {price}
                    </span>
                  ) : null}
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
  onPick,
  onBoardingChange,
  onEmbarked,
  onCancel,
}: {
  fromPos: number
  title: string
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
    <ModalShell className="bus-picker-modal w-[980px] max-w-[calc(100vw-2rem)] overflow-y-auto !overflow-x-hidden">
      <ModalHeader
        title={title}
        icon={<Bus size={19} />}
      />
      <div className="bus-picker-body min-w-0 max-w-full px-5 pt-3 pb-3">
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
        <div className="pl-6 pr-4 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-2 bg-coffee-900/60">
          <span className="flex items-center gap-2">
            <Bus size={15} className="text-gold" />
            <span className="label text-cream-muted">Bilhete de ônibus</span>
            <span className="currency text-gold-glow text-sm tabular-nums leading-none">×{tickets}</span>
          </span>
          <span className="label min-w-[10rem] flex-1 text-cream-muted/85 text-nano">1 bilhete será usado na viagem</span>
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

type AuctionSquare = Extract<ModalView, { kind: 'auction' }>['square']
type AuctionDeed = NonNullable<ReturnType<typeof deedPresentation>>
type AuctionTierKind = 'base' | 'house' | 'hotel' | 'skyscraper'

function DeedIcon({ sq }: { sq: AuctionSquare }) {
  const deed = deedPresentation(sq)
  if (deed?.flagCode) {
    return (
      <div className="title-auction-lot__flag">
        <img src={`https://flagcdn.com/${deed.flagCode.toLowerCase()}.svg`} alt={deed.flagCode} className="w-full h-full object-cover" draggable={false} />
      </div>
    )
  }
  return <span className="title-auction-lot__glyph"><SquareIcon square={sq} size={32} /></span>
}

function AuctionTierMarkers({ kind, count }: { kind: AuctionTierKind; count: number }) {
  if (kind === 'base') return <PlotBadgeIcon />
  if (kind === 'house') {
    return Array.from({ length: count }, (_, index) => <HouseBadgeIcon key={index} />)
  }
  if (kind === 'hotel') {
    return Array.from({ length: count }, (_, index) => <HotelBadgeIcon key={index} />)
  }
  return <SkyscraperBadgeIcon />
}

function AuctionRentTier({
  label,
  value,
  kind,
  count = 1,
  marker,
}: {
  label: string
  value: string
  kind: AuctionTierKind
  count?: number
  marker?: React.ReactNode
}) {
  return (
    <div className="title-auction-tier" data-tier={kind}>
      <span className="title-auction-tier__identity">{label}</span>
      <span className="title-auction-tier__mark" aria-hidden>
        {marker ?? <AuctionTierMarkers kind={kind} count={count} />}
      </span>
      <span className="title-auction-tier__value">{value}</span>
    </div>
  )
}

function AuctionDeedPanel({ sq, deed }: { sq: AuctionSquare; deed: AuctionDeed }) {
  const facts = [
    { label: 'Preço', value: money(deed.price) },
    ...(deed.kind === 'property'
      ? [{ label: 'Casa', value: money(deed.buildCost) }]
      : deed.kind === 'airport'
        ? [{ label: 'Hangar', value: money(deed.hangar.cost) }]
        : []),
    { label: 'Hipoteca', value: money(deed.mortgage) },
  ]

  return (
    <section className="title-auction-deed" aria-label={`Título ${deed.name}`}>
      <p className="title-auction-section-label">
        {deed.kind === 'property' ? 'Progressão de aluguel' : 'Renda do título'}
      </p>

      <div className="title-auction-tier-grid">
        {deed.kind === 'property' ? (
          <>
            <AuctionRentTier label="Terreno" value={money(deed.rents.base)} kind="base" />
            <AuctionRentTier label="1 casa" value={money(deed.rents.house1)} kind="house" />
            <AuctionRentTier label="2 casas" value={money(deed.rents.house2)} kind="house" count={2} />
            <AuctionRentTier label="3 casas" value={money(deed.rents.house3)} kind="house" count={3} />
            <AuctionRentTier label="4 casas" value={money(deed.rents.house4)} kind="house" count={4} />
            <AuctionRentTier label="Hotel" value={money(deed.rents.hotel)} kind="hotel" />
            <AuctionRentTier label="2º hotel" value={money(deed.rents.hotel2)} kind="hotel" count={2} />
            <AuctionRentTier label="Arranha-céu" value={money(deed.rents.skyscraper)} kind="skyscraper" />
          </>
        ) : (
          deed.rentRows.map((row, index) => (
            <AuctionRentTier
              key={row.key}
              label={row.label}
              value={row.kind === 'money' ? money(row.value) : `${row.value}× dados`}
              kind="base"
              marker={(
                <span className="title-auction-tier__square-icons">
                  {Array.from({ length: index + 1 }, (_, markerIndex) => (
                    <SquareIcon key={markerIndex} square={sq} size={13} />
                  ))}
                </span>
              )}
            />
          ))
        )}
      </div>

      <dl
        className="title-auction-deed__facts"
        aria-label="Valores do título"
        style={{ gridTemplateColumns: `repeat(${facts.length}, minmax(0, 1fr))` }}
      >
        {facts.map((fact) => (
          <div key={fact.label} className="title-auction-deed__fact">
            <dt>{fact.label}</dt>
            <dd>{fact.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

// Tela pública do leilão. A regra continua no motor; aqui só organizamos o pregão.
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
  const room = useRoomStore((s) => s.room)
  const clockOffsetMs = useRoomStore((s) => s.clockOffsetMs)
  const [localNow, setLocalNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setLocalNow(Date.now()), 200)
    return () => clearInterval(t)
  }, [])
  const msLeft = Math.max(0, view.deadline - (localNow + clockOffsetMs))
  const secLeft = Math.ceil(msLeft / 1000)
  const timeLeftPct = Math.max(0, Math.min(100, (msLeft / AUCTION_WINDOW) * 100))
  const sq = view.square
  const deed = deedPresentation(sq)
  if (!deed) return null
  const highBidderIdentity = view.highBidder ? identityOf(room, view.highBidder) : null
  const highBidderIsPresent = view.highBidder
    ? players.some((player) => player.id === view.highBidder)
    : false

  return (
    <ModalShell className="title-auction-modal w-[600px] max-w-[95vw]">
      <ModalHeader
        center
        title="Leilão ao vivo"
        subtitle="O maior lance leva o título"
        icon={<GavelIcon size={22} />}
        className="[&_h3]:text-xl"
      />

      <div
        className="title-auction-lot"
        style={{ '--title-auction-accent': deed.accent } as React.CSSProperties}
      >
        <DeedIcon sq={sq} />
        <div className="title-auction-lot__copy">
          <span>Título em disputa</span>
          <h2>{sq.name}</h2>
          {deed.subtitle && <p>{deed.subtitle}</p>}
        </div>
        <span className="title-auction-lot__number">Lote {String(view.pos).padStart(2, '0')}</span>
      </div>

      <div className="title-auction-layout">
        <section className="title-auction-live" aria-label="Pregão">
          <div className="title-auction-live__heading">
            <p className="title-auction-section-label">Maior lance</p>
            <span className="title-auction-live__status">
              <i aria-hidden />
              Ao vivo
            </span>
          </div>

          <div className="title-auction-current">
            <motion.p
              key={view.currentBid}
              initial={reduced ? false : { scale: 1.14 }}
              animate={{ scale: 1 }}
              transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 300, damping: 16 }}
              className="title-auction-current__amount"
              aria-live="polite"
            >
              {money(view.currentBid)}
            </motion.p>
            <div className="title-auction-leader">
              {highBidderIdentity && highBidderIsPresent ? (
                <>
                  <PlayerFace
                    color={highBidderIdentity.color}
                    avatar={highBidderIdentity.avatar}
                    skin={highBidderIdentity.skin}
                    size={24}
                  />
                  <span>
                    <small>Na frente</small>
                    <strong>{highBidderIdentity.name}</strong>
                  </span>
                </>
              ) : (
                <span>
                  <small>Na frente</small>
                  <strong>Sem lances</strong>
                </span>
              )}
            </div>
          </div>

          <div className="title-auction-clock" data-urgent={secLeft <= 3 || undefined}>
            <div className="title-auction-clock__copy">
              <span>Fecha em</span>
              <strong>{secLeft}s</strong>
            </div>
            <div
              className="title-auction-clock__track"
              role="progressbar"
              aria-label={`Leilão fecha em ${secLeft} segundos`}
              aria-valuemin={0}
              aria-valuemax={Math.ceil(AUCTION_WINDOW / 1000)}
              aria-valuenow={secLeft}
            >
              <div
                className="title-auction-clock__fill"
                style={{ width: `${timeLeftPct}%` }}
              />
            </div>
          </div>

          <div className="title-auction-bids">
            <div className="title-auction-bids__heading">
              <p className="title-auction-section-label">
                {stillBidding ? 'Seu próximo lance' : 'Fora do pregão'}
              </p>
              <span>Caixa {money(cash)}</span>
            </div>

            {stillBidding ? (
              <div className="title-auction-bid-grid">
                {[2, 10, 100].map((inc) => {
                  const next = view.currentBid + inc
                  return (
                    <Button
                      key={inc}
                      variant="secondary"
                      disabled={next > cash}
                      onClick={() => placeBid(activeId, next)}
                      className="title-auction-bid-option"
                      aria-label={`Dar lance de ${money(next)}`}
                    >
                      <span className="title-auction-bid-option__cue">
                        <CoinIcon size={11} />
                        Dar lance
                      </span>
                      <strong className="title-auction-bid-option__amount">{money(next)}</strong>
                      <small className="title-auction-bid-option__increment">+ {money(inc)}</small>
                    </Button>
                  )
                })}
              </div>
            ) : (
              <div className="title-auction-bids__inactive">
                <GavelIcon size={15} />
                Você saiu deste leilão
              </div>
            )}
          </div>

        </section>

        <AuctionDeedPanel sq={sq} deed={deed} />
      </div>
    </ModalShell>
  )
}
