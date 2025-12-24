// Negociação na UI (024) — "mesa com balança": cada lado da troca vira peso
// físico numa balança de latão (valor de face = preço de tabela + dinheiro) e o
// travessão pende para o lado mais pesado — a justiça da troca se lê de relance,
// sem aritmética. Os títulos selecionados empilham nos pratos como fichas.
// Reusa o vocabulário visual do leilão (deed/avatar) e o shell canônico de modal.
// Único ponto com efeito: dispara proposeTrade/acceptTrade/rejectTrade. A regra
// (validade) vem de validateTrade. Troca-se propriedade + dinheiro + Bus Tickets (D-028).
import { useReducer, useEffect, type CSSProperties, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Bus, Shield } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useGameStore } from '@/game/store'
import { useTradeUI } from './tradeUI'
import { useLocalView, useRoomStore } from '@/net/roomStore'
import { identityOf } from '@/net/identity'
import { validateTrade } from '@/game/economy/trade'
import type { Trade, Immunity } from '@/game/economy/types'
import { BOARD, type Square } from '@/lib/boardData'
import { PlayerFace } from '@/boards/PlayerFace'
import type { AvatarId } from '@/boards/playerAvatarCatalog'
import type { SkinId } from '@/boards/playerSkinCatalog'
import { SquareIcon } from '@/boards/glyphs/squares'
import { CoinIcon } from '@/game/ui/icons'
import { Button, EmptyState } from '@/game/ui/primitives'
import { Overlay, ModalShell, ModalHeader } from '@/game/ui/shell'
import { useMotion } from '@/game/ui/motion'
import { money } from '@/lib/money'
import {
  createTradeDraft,
  projectTradeDraft,
  TRADE_LAPS_PRESETS,
  updateTradeDraft,
  type TradeDraftParty,
  type TradeGrantMap,
} from './draft'
import { deedPresentation } from '@/game/ui/deed/presentation'
import { TradeDeedItem } from './TradeDeedItem'
import { CountryFlag } from '@/boards/glyphs/flags'

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))
const lapsLabel = (laps: number | null): string => (
  laps === null ? 'Permanente' : `${laps} ${laps === 1 ? 'volta' : 'voltas'}`
)
function CheckGlyph() {
  return (
    <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="var(--color-ink-950)" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

// ---------------------------------------------------------------------
// Shell — cascas finas sobre Overlay/ModalShell/ModalHeader canônicos.
// ---------------------------------------------------------------------
function Backdrop({ children }: { children: ReactNode }) {
  return <Overlay z={65}>{children}</Overlay>
}

function Card({ children }: { children: ReactNode }) {
  return (
    <ModalShell className="w-[720px] max-w-[96vw] max-h-[92vh] flex flex-col">
      {children}
    </ModalShell>
  )
}

function Header({
  title,
  subtitle,
  onClose,
}: {
  title: string
  subtitle?: string
  onClose?: () => void
}) {
  return (
    <ModalHeader
      center
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      className={cn('[&_h3]:text-xl', onClose && 'trade-proposal-header')}
    />
  )
}

// ---------------------------------------------------------------------
// Avatar do título: bandeira circular (propriedade) ou glifo (aeroporto/utilidade).
// ---------------------------------------------------------------------
function DeedAvatar({ sq, size = 22 }: { sq: Square; size?: number }) {
  const deed = deedPresentation(sq)
  if (deed?.flagCode) {
    return (
      // `block`: fora de flex (ex. prato da balança) um span inline ignoraria width/height
      <span className="block rounded-full bg-coffee-900 border border-coffee-950 overflow-hidden shrink-0 shadow-[var(--shadow-card)]" style={{ width: size, height: size }}>
        <CountryFlag code={deed.flagCode} fill />
      </span>
    )
  }
  return (
    <span className="text-gold shrink-0 flex items-center justify-center" style={{ width: size, height: size }}>
      <SquareIcon square={sq} size={size * 0.85} />
    </span>
  )
}

// Uma propriedade aparece uma única vez no compositor. No próprio item, o jogador
// escolhe se quer negociar o título ou conceder imunidade naquele endereço.
function PropertyTermRow({
  pos,
  canTrade,
  titleSelected,
  grantLaps,
  onToggleTitle,
  onToggleGrant,
  onSetGrantLaps,
}: {
  pos: number
  canTrade: boolean
  titleSelected: boolean
  grantLaps: number | null | undefined
  onToggleTitle: () => void
  onToggleGrant: () => void
  onSetGrantLaps: (laps: number | null) => void
}) {
  const sq = BOARD[pos]
  const deed = deedPresentation(sq)
  if (!deed) return null
  const grantSelected = grantLaps !== undefined

  return (
    <div
      className="trade-property-term"
      data-selected={(titleSelected || grantSelected) || undefined}
      style={{ '--trade-property-accent': deed.accent } as CSSProperties}
    >
      <span className="trade-property-term__avatar">
        <DeedAvatar sq={sq} size={24} />
      </span>
      <span className="trade-property-term__identity">
        <strong>{deed.name}</strong>
        {deed.subtitle && <small>{deed.subtitle}</small>}
      </span>

      <div className="trade-property-term__actions" role="group" aria-label={`Negociar ${deed.name}`}>
        {canTrade && (
          <button
            type="button"
            aria-pressed={titleSelected}
            aria-label={`Incluir o título ${deed.name}`}
            title="Transferir a propriedade"
            onClick={onToggleTitle}
            className={cn('trade-property-term__action', titleSelected && 'trade-property-term__action--active')}
          >
            <span className="trade-property-term__check" aria-hidden>{titleSelected && <CheckGlyph />}</span>
            Título
          </button>
        )}
        <button
          type="button"
          aria-pressed={grantSelected}
          aria-label={`Conceder imunidade em ${deed.name}`}
          title="Manter a propriedade e conceder imunidade"
          onClick={onToggleGrant}
          className={cn('trade-property-term__action', grantSelected && 'trade-property-term__action--active')}
        >
          <Shield size={11} aria-hidden />
          Imunidade
        </button>
      </div>

      {grantSelected && (
        <div className="trade-property-term__duration" aria-label={`Duração da imunidade em ${deed.name}`}>
          <span>Duração</span>
          {TRADE_LAPS_PRESETS.map((laps) => (
            <button
              key={laps}
              type="button"
              aria-pressed={grantLaps === laps}
              onClick={() => onSetGrantLaps(laps)}
              className={cn('trade-property-term__duration-option', grantLaps === laps && 'trade-property-term__duration-option--active')}
            >
              {lapsLabel(laps)}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={grantLaps === null}
            onClick={() => onSetGrantLaps(null)}
            className={cn('trade-property-term__duration-option', grantLaps === null && 'trade-property-term__duration-option--active')}
          >
            Permanente
          </button>
        </div>
      )}
    </div>
  )
}

// Presets de duração — cobre o uso real (2 = duração padrão das cartas de imunidade
// temporária; 5 = "por um tempo"; permanente = até o fim de jogo). Input livre não
// compensa a complexidade extra numa troca que já tem propriedade + dinheiro + tickets.
function ToggleDot({ on }: { on: boolean }) {
  return (
    <span className={cn('shrink-0 w-[18px] h-[18px] rounded-full flex items-center justify-center transition-colors', on ? 'bg-gold' : 'border border-coffee-500/70')}>
      {on && <CheckGlyph />}
    </span>
  )
}

// Transferir uma imunidade que JÁ se possui (028, §8.4) — re-atribui o beneficiário,
// preserva as voltas restantes. Read-only quanto à duração (não é uma concessão nova).
function TransferRow({ pos, laps, on, onToggle }: { pos: number; laps: number | null; on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'flex items-center gap-2 w-full px-2 py-1.5 rounded-[var(--radius-sharp)] border text-left transition-colors',
        on ? 'border-gold bg-gold/15' : 'border-coffee-500 bg-coffee-900 hover:border-gold/60',
      )}
    >
      <ToggleDot on={on} />
      <span className="flex-1 min-w-0 truncate text-cream text-xs">Transferir {BOARD[pos].name}</span>
      <span className="text-cream-muted text-nano shrink-0">
        {laps === null ? 'Permanente' : `${lapsLabel(laps)} restantes`}
      </span>
    </button>
  )
}

// Imunidades já recebidas são ativos próprios e continuam numa faixa separada.
// A concessão nova mora no item da propriedade acima, sem repetir a lista de endereços.
function ImmunitySide({
  transferable,
  transfers,
  onToggleTransfer,
}: {
  transferable: Immunity[]
  transfers: Set<number>
  onToggleTransfer: (pos: number) => void
}) {
  if (transferable.length === 0) return null
  return (
    <div className="flex flex-col gap-1.5">
      <p className="label text-cream-muted text-micro flex items-center gap-1"><Shield size={11} /> Imunidades recebidas</p>
      {transferable.map((im) => (
        <TransferRow key={`t${im.pos}`} pos={im.pos} laps={im.lapsRemaining} on={transfers.has(im.pos)} onToggle={() => onToggleTransfer(im.pos)} />
      ))}
    </div>
  )
}

// Campo de dinheiro — moeda + input tabular + "tudo".
function CashField({ value, max, onChange }: { value: number; max: number; onChange: (n: number) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <span className="flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded-[var(--radius-sharp)] bg-coffee-950/50 border border-coffee-500 focus-within:border-gold transition-colors">
          <CoinIcon size={14} className="text-gold shrink-0" />
          <input
            type="number"
            min={0}
            max={max}
            value={value || ''}
            placeholder="0"
            onChange={(e) => onChange(clamp(Number(e.target.value) || 0, 0, max))}
            className="w-full bg-transparent outline-none currency tabular-nums text-gold-glow text-sm placeholder:text-cream-muted/85 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
        </span>
        <button
          type="button"
          onClick={() => onChange(max)}
          disabled={max <= 0}
          className="shrink-0 label text-micro px-2 py-1.5 rounded-[var(--radius-sharp)] bg-coffee-700 border border-coffee-500 text-cream-muted hover:text-gold hover:border-gold/60 disabled:opacity-40 transition-colors"
        >
          TUDO
        </button>
      </div>
      <p className="label text-cream-muted leading-none text-nano">de {money(max)} em caixa</p>
    </div>
  )
}

// Bus Tickets no acordo (D-028) — stepper 0..N dos tickets do dono. Só aparece
// quando o dono tem ao menos 1 (não polui a coluna de quem não tem).
function TicketField({ value, max, onChange }: { value: number; max: number; onChange: (n: number) => void }) {
  const stepBtn =
    'w-6 h-6 rounded-full border border-coffee-500 bg-coffee-700 text-cream grid place-items-center leading-none text-sm hover:border-gold/60 hover:text-gold disabled:opacity-40 disabled:hover:border-coffee-500 disabled:hover:text-cream transition-colors'
  return (
    <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-[var(--radius-sharp)] bg-coffee-950/50 border border-coffee-500">
      <Bus size={14} className="text-gold shrink-0" />
      <span className="label text-cream-muted flex-1 min-w-0 truncate">Bus Tickets</span>
      <button type="button" className={stepBtn} disabled={value <= 0} onClick={() => onChange(value - 1)} aria-label="Menos um ticket">−</button>
      <span className={cn('currency text-sm tabular-nums w-5 text-center leading-none', value > 0 ? 'text-gold-glow' : 'text-cream-muted/85')}>{value}</span>
      <button type="button" className={stepBtn} disabled={value >= max} onClick={() => onChange(value + 1)} aria-label="Mais um ticket">+</button>
      <span className="label text-cream-muted text-nano shrink-0">de {max}</span>
    </div>
  )
}

// ---------------------------------------------------------------------
// Balança de latão — coração da mesa. Cada prato carrega os títulos (bandeiras
// empilhadas) + moeda do dinheiro; o travessão pende para o lado mais pesado.
// Peso = valor de face (preço de tabela) + dinheiro. Contrapeso visual, não regra:
// a validade continua vindo de validateTrade.
// ---------------------------------------------------------------------
const faceValue = (positions: number[], cash: number): number =>
  positions.reduce((sum, pos) => {
    const sq = BOARD[pos]
    return sum + ('price' in sq ? (sq as { price: number }).price : 0)
  }, cash)

// Molas compartilhadas da física da balança: o travessão e os pratos respondem juntos.
const SCALE_SPRING = { type: 'spring', stiffness: 120, damping: 13 } as const
// Balanço de repouso — a balança vazia oscila devagar, como se acabasse de ser tocada.
const SWAY_TRANSITION = { repeat: Infinity, duration: 6, ease: 'easeInOut' } as const

function PanTokens({ positions, cash, tickets, reduced }: { positions: number[]; cash: number; tickets: number; reduced: boolean }) {
  const shown = positions.slice(0, 5)
  const extra = positions.length - shown.length
  // Cada item CAI no prato — a mola do travessão logo abaixo responde ao peso novo.
  const drop = reduced
    ? { initial: { opacity: 0 }, animate: { opacity: 1 } }
    : { initial: { y: -14, opacity: 0, scale: 0.7 }, animate: { y: 0, opacity: 1, scale: 1 } }
  const landing = { type: 'spring', stiffness: 420, damping: 20 } as const
  return (
    <div className="flex items-end justify-center min-h-[20px] -mb-[3px]">
      {shown.map((pos, i) => (
        <motion.span key={pos} {...drop} transition={landing} className={cn('relative', i > 0 && '-ml-2')} style={{ zIndex: i }}>
          <DeedAvatar sq={BOARD[pos]} size={18} />
        </motion.span>
      ))}
      {extra > 0 && (
        <span className="relative z-10 -ml-1 label text-cream text-nano bg-coffee-700 border border-coffee-500 rounded-full px-1 leading-tight">+{extra}</span>
      )}
      {cash > 0 && (
        <motion.span {...drop} transition={landing} className={cn('relative z-10', (positions.length > 0) && '-ml-1')}>
          <CoinIcon size={15} className="text-gold" />
        </motion.span>
      )}
      {tickets > 0 && (
        <motion.span {...drop} transition={landing} className={cn('relative z-10 flex items-end', (positions.length > 0 || cash > 0) && '-ml-0.5')}>
          <Bus size={14} className="text-gold" />
          {tickets > 1 && <span className="currency text-gold-glow text-nano leading-none ml-px">×{tickets}</span>}
        </motion.span>
      )}
    </div>
  )
}

function Pan({ side, deg, sway, positions, cash, tickets, reduced }: {
  side: 'left' | 'right'
  deg: number
  sway: boolean
  positions: number[]
  cash: number
  tickets: number
  reduced: boolean
}) {
  const value = faceValue(positions, cash)
  return (
    <motion.div
      // Contra-rotaciona o travessão para o prato ficar nivelado; no repouso, espelha o balanço.
      animate={sway ? { rotate: [0, -1.8, 0, 1.8, 0] } : { rotate: -deg }}
      transition={sway ? SWAY_TRANSITION : SCALE_SPRING}
      style={{ transformOrigin: '50% 0%', [side === 'left' ? 'left' : 'right']: -46 }}
      className="absolute top-0 w-[92px] flex flex-col items-center"
    >
      {/* argola + correntes de contas + carga + prato + etiqueta de valor */}
      <span className="w-1.5 h-1.5 rounded-full border border-brass-glow -mt-[3px]" aria-hidden />
      <div className="relative w-[78px] h-[30px]">
        {/* correntes: pontilhado redondo sobre curva suave = elos apanhando a luz */}
        <svg viewBox="0 0 78 30" className="absolute inset-0 w-full h-full" aria-hidden>
          <path
            d="M39 1 Q26 13 7 28 M39 1 Q52 13 71 28"
            stroke="var(--color-brass)"
            strokeOpacity="0.85"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeDasharray="0.1 3.2"
            fill="none"
          />
        </svg>
        <div className="absolute inset-x-0 bottom-0">
          <PanTokens positions={positions} cash={cash} tickets={tickets} reduced={reduced} />
        </div>
      </div>
      <span className="relative block w-[78px] h-[12px]" aria-hidden>
        {/* poço côncavo: sombra externa + interna dão profundidade ao prato */}
        <span
          className="absolute inset-0 rounded-b-full shadow-[0_5px_12px_-2px_rgba(2,6,16,0.75),inset_0_2px_3px_rgba(2,6,16,0.4)]"
          style={{ background: 'var(--gradient-brass)' }}
        />
        {/* borda do prato apanha a luz — vira "aro" em vez de barra chapada */}
        <span className="absolute inset-x-[3px] top-0 h-[2px] rounded-full bg-brass-glow/70" />
        {/* reflexo no fundo do poço */}
        <span className="absolute left-[10px] bottom-[2px] w-[14px] h-[2px] rounded-full bg-brass-glow/35 blur-[1px]" />
      </span>
      <span
        className={cn(
          'currency tabular-nums leading-none mt-1 px-1.5 py-0.5 rounded-full border transition-colors',
          value > 0 ? 'text-gold-glow border-brass/30 bg-coffee-950/50' : 'text-cream-muted/85 border-transparent',
        )}
        style={{ fontSize: '10px' }}
      >
        {money(value)}
      </span>
    </motion.div>
  )
}

function TradeScale({
  leftPositions,
  leftCash,
  leftTickets = 0,
  rightPositions,
  rightCash,
  rightTickets = 0,
}: {
  leftPositions: number[]
  leftCash: number
  leftTickets?: number
  rightPositions: number[]
  rightCash: number
  rightTickets?: number
}) {
  // Os springs de inclinação abaixo (fiel, travessão, pratos) são fora do vocabulário
  // por design (D7 do plan, mesma categoria da exceção do fim de jogo): simulam uma
  // balança FÍSICA respondendo ao valor da proposta em tempo real — não são um enter/exit
  // de tela, então não há fade/pop/slideUp que os substitua sem perder o efeito. Os
  // ambientes (balanço de repouso, brilho do travessão, anel e halo do fecho) seguem
  // TODOS o freio de movimento reduzido.
  const { reduced } = useMotion()
  const lv = faceValue(leftPositions, leftCash)
  const rv = faceValue(rightPositions, rightCash)
  const total = lv + rv
  // Pende para o lado mais pesado: positivo = horário = direita desce.
  // Bus Tickets não têm preço de tabela — vão no prato como carga, sem peso.
  const tilt = total === 0 ? 0 : clamp((rv - lv) / total, -1, 1)
  const deg = tilt * 6
  const diff = Math.abs(rv - lv)
  const balanced = total > 0 && diff / total < 0.08
  // Vazia, a balança oscila de leve — convida a pôr algo nos pratos; carregada, a mola assume.
  const sway = total === 0 && !reduced

  return (
    <div className="flex-1 min-w-0 flex flex-col items-center">
      <div className="relative w-[280px] max-w-full h-[104px]" aria-hidden>
        {/* halo quente atrás da balança — respira quando os pratos fecham */}
        <motion.span
          animate={balanced && !reduced ? { opacity: [0.55, 1, 0.55] } : { opacity: 0.55 }}
          transition={balanced && !reduced ? { repeat: Infinity, duration: 1.8, ease: 'easeInOut' } : { duration: 0.4 }}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-44 h-24 rounded-full bg-brass/15 blur-2xl"
        />
        {/* coluna torneada: remate em losango, fuste afunilado e plinto em degraus */}
        <span
          className="absolute left-1/2 -translate-x-1/2 top-0 w-2 h-2 rotate-45 rounded-[2px]"
          style={{ background: 'var(--gradient-brass-shine)' }}
        />
        <span
          className="absolute left-1/2 -translate-x-1/2 top-[15px] bottom-[8px] w-[10px]"
          style={{ background: 'var(--gradient-brass)', clipPath: 'polygon(38% 0, 62% 0, 78% 100%, 22% 100%)' }}
        />
        <span className="absolute left-1/2 -translate-x-1/2 bottom-[4px] w-9 h-[4px] rounded-full" style={{ background: 'var(--gradient-brass)' }} />
        <span className="absolute left-1/2 -translate-x-1/2 bottom-0 w-14 h-[5px] rounded-full bg-brass-soft/80" />
        {/* mostrador: arco graduado fixo sob o fulcro (acende quando os lados pesam igual)… */}
        <svg aria-hidden viewBox="0 0 44 24" className="absolute left-1/2 -translate-x-1/2 top-[12px] w-[44px] h-[24px]">
          <path
            d="M13.5 20.1 A20 20 0 0 0 30.5 20.1"
            stroke={balanced ? 'var(--color-brass-glow)' : 'var(--color-brass)'}
            strokeOpacity={balanced ? 0.9 : 0.4}
            strokeWidth="1"
            fill="none"
          />
          <path d="M22 18.4 L22 22.2" stroke="var(--color-brass-glow)" strokeOpacity="0.7" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
        {/* …e o fiel, que amplifica a inclinação e cai no risco central quando fecham */}
        <motion.span
          animate={sway ? { rotate: [0, 7, 0, -7, 0] } : { rotate: deg * 4 }}
          transition={sway ? SWAY_TRANSITION : SCALE_SPRING}
          style={{ transformOrigin: '50% 0%', clipPath: 'polygon(0 0, 100% 0, 50% 100%)' }}
          className={cn(
            'absolute left-1/2 -translate-x-1/2 top-[14px] w-[3px] h-[19px] z-10 transition-colors',
            balanced ? 'bg-brass-glow drop-shadow-[0_0_4px_var(--color-brass-glow)]' : 'bg-brass',
          )}
        />
        {/* travessão com os dois pratos pendurados (pratos contra-rotacionam p/ ficar nivelados) */}
        <motion.div
          animate={sway ? { rotate: [0, 1.8, 0, -1.8, 0] } : { rotate: deg }}
          transition={sway ? SWAY_TRANSITION : SCALE_SPRING}
          style={{ transformOrigin: '50% 50%', background: 'var(--gradient-brass-shine)' }}
          className="absolute left-[46px] right-[46px] top-[12px] h-[4px] rounded-full"
        >
          {/* brilho que varre o latão de tempos em tempos — metal polido, não barra chapada */}
          {!reduced && (
            <span className="absolute inset-0 overflow-hidden rounded-full">
              <motion.span
                animate={{ x: [-36, 220] }}
                transition={{ repeat: Infinity, repeatDelay: 3.4, duration: 1.1, ease: 'easeInOut' }}
                className="absolute inset-y-0 w-9"
                style={{ background: 'linear-gradient(90deg, transparent, color-mix(in srgb, var(--color-brass-glow) 85%, white) 50%, transparent)' }}
              />
            </span>
          )}
          <span className="absolute -left-[3px] top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-brass-glow" />
          <span className="absolute -right-[3px] top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-brass-glow" />
          <Pan side="left" deg={deg} sway={sway} positions={leftPositions} cash={leftCash} tickets={leftTickets} reduced={reduced} />
          <Pan side="right" deg={deg} sway={sway} positions={rightPositions} cash={rightCash} tickets={rightTickets} reduced={reduced} />
        </motion.div>
        {/* joia do fulcro — pulsa quando a balança fecha… */}
        <motion.span
          animate={balanced && !reduced ? { scale: [1, 1.25, 1], opacity: [1, 0.85, 1] } : { scale: 1, opacity: 1 }}
          transition={balanced && !reduced ? { repeat: Infinity, duration: 1.8, ease: 'easeInOut' } : { type: 'spring', stiffness: 120, damping: 14 }}
          className={cn(
            'absolute left-1/2 -translate-x-1/2 top-[10px] w-2 h-2 rounded-full bg-brass-glow z-20',
            balanced ? 'shadow-[0_0_14px_var(--color-brass-glow)]' : 'shadow-[0_0_8px_var(--color-brass-glow)]',
          )}
        />
        {/* …e emite um anel que se dissipa, como um sino visual do acordo fechado */}
        {balanced && !reduced && (
          <motion.span
            initial={{ scale: 0.5, opacity: 0.55 }}
            animate={{ scale: 2.4, opacity: 0 }}
            transition={{ repeat: Infinity, duration: 2.2, ease: 'easeOut' }}
            className="absolute left-1/2 -translate-x-1/2 top-[6px] w-4 h-4 rounded-full border border-brass-glow z-10"
          />
        )}
      </div>
    </div>
  )
}

// Rosto + nome que flanqueia a balança (alinhado ao prato do seu lado).
function FaceTag({
  color,
  avatar,
  skin,
  name,
  active = true,
}: {
  color: string
  avatar: AvatarId
  skin: SkinId
  name: string
  active?: boolean
}) {
  return (
    <div className="trade-scale-player">
      <PlayerFace color={color} avatar={avatar} skin={skin} size={36} active={active} />
      <span className="label text-gold">{name}</span>
    </div>
  )
}

// ---------------------------------------------------------------------
// Coluna de um lado da troca (propriedades + dinheiro).
// ---------------------------------------------------------------------
function Side({
  title,
  color,
  avatar,
  skin,
  ownerCash,
  ownerTickets,
  props,
  grantable,
  selected,
  grants,
  onToggle,
  onToggleGrant,
  onSetGrantLaps,
  cash,
  onCash,
  tickets,
  onTickets,
  immunity,
}: {
  title: string
  color: string
  avatar: AvatarId
  skin: SkinId
  ownerCash: number
  ownerTickets: number
  props: number[]
  grantable: number[]
  selected: Set<number>
  grants: TradeGrantMap
  onToggle: (pos: number) => void
  onToggleGrant: (pos: number) => void
  onSetGrantLaps: (pos: number, laps: number | null) => void
  cash: number
  onCash: (n: number) => void
  tickets: number
  onTickets: (n: number) => void
  immunity?: ReactNode
}) {
  const propertyPositions = [...new Set([
    ...props,
    ...grantable,
    ...Object.keys(grants).map(Number),
  ])]
  const grantCount = Object.keys(grants).length
  const summary = [
    selected.size > 0 ? `${selected.size} ${selected.size === 1 ? 'título' : 'títulos'}` : '',
    grantCount > 0 ? `${grantCount} ${grantCount === 1 ? 'imunidade' : 'imunidades'}` : '',
    cash > 0 ? money(cash) : '',
    tickets > 0 ? `${tickets} ticket${tickets > 1 ? 's' : ''}` : '',
  ].filter(Boolean).join(' + ')
  return (
    <div className="flex-1 min-w-0 flex flex-col">
      <div className="px-3 pt-3 pb-2 flex items-center gap-2 sticky top-0 z-10 bg-coffee-800/90 backdrop-blur-sm shrink-0 border-b border-coffee-700/40">
        <PlayerFace color={color} avatar={avatar} skin={skin} size={18} />
        <p className="label text-gold truncate">{title}</p>
        {summary && (
          <p className="ml-auto label text-gold-glow tabular-nums shrink-0 text-micro" title="Resumo deste lado da troca">
            {summary}
          </p>
        )}
      </div>

      <div className="flex-1 overflow-auto px-3 pt-2.5 pb-3 flex flex-col gap-2.5">
        <div className="flex flex-col gap-1">
          {propertyPositions.length === 0 && <EmptyState title="Nada para negociar" className="py-3" />}
          {propertyPositions.map((pos) => (
            <PropertyTermRow
              key={pos}
              pos={pos}
              canTrade={props.includes(pos)}
              titleSelected={selected.has(pos)}
              grantLaps={grants[pos]}
              onToggleTitle={() => onToggle(pos)}
              onToggleGrant={() => onToggleGrant(pos)}
              onSetGrantLaps={(laps) => onSetGrantLaps(pos, laps)}
            />
          ))}
        </div>

        <CashField value={cash} max={ownerCash} onChange={onCash} />
        {ownerTickets > 0 && <TicketField value={tickets} max={ownerTickets} onChange={onTickets} />}
        {immunity}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------
// Compositor — montar a proposta.
// ---------------------------------------------------------------------
function Composer({ onClose, proposerId }: { onClose: () => void; proposerId: string | null }) {
  const game = useGameStore((s) => s.game)
  const room = useRoomStore((s) => s.room)
  const dispatchTrade = useGameStore((s) => s.dispatch)
  const proposeTrade = (trade: Trade): void => dispatchTrade({ kind: 'propose-trade', trade })

  // Negociação é uma ação em nome do remetente e pode nascer fora da vez dele. Em sala,
  // "você" é o assento ligado à sessão local; o jogador ativo só é fallback do modo local.
  const active = game.players[game.turnOrder[game.activeSeat]]
  const me = game.players.find((player) => player.id === proposerId) ?? active
  const [draft, send] = useReducer(
    (current: ReturnType<typeof createTradeDraft>, action: Parameters<typeof updateTradeDraft>[2]) =>
      updateTradeDraft(game, current, action),
    game,
    (initialGame) => createTradeDraft(initialGame, me.id),
  )
  const view = projectTradeDraft(game, draft)
  const { proposer, recipients: others, recipient, trade, canPropose, counterpart } = view
  const { props: offered, cash: fromCash, tickets: fromTickets, grants: fromGrants, transfers: fromTransfers } = draft.from
  const { props: requested, cash: toCash, tickets: toTickets, grants: toGrants, transfers: toTransfers } = draft.to
  const change = (party: TradeDraftParty) => ({
    property: (pos: number) => send({ kind: 'toggle-property', party, pos }),
    cash: (amount: number) => send({ kind: 'set-cash', party, amount }),
    tickets: (amount: number) => send({ kind: 'set-tickets', party, amount }),
    grant: (pos: number) => send({ kind: 'toggle-grant', party, pos }),
    grantLaps: (pos: number, laps: number | null) => send({ kind: 'set-grant-laps', party, pos, laps }),
    transfer: (pos: number) => send({ kind: 'toggle-transfer', party, pos }),
  })
  const fromChange = change('from')
  const toChange = change('to')

  const meIdentity = identityOf(room, proposer.id)
  const themIdentity = recipient ? identityOf(room, recipient.id) : null

  return (
    <Card>
      <Header title="Negociação" subtitle="Monte os dois lados e confirme" />

      {/* Mesa — Você e o destinatário flanqueiam a balança; cada prato pesa um lado.
          Fundo translúcido: deixa o gradiente do shell respirar (nada de cor chapada). */}
      <div className="px-4 pt-3 pb-2 bg-coffee-950/25 border-b border-coffee-700/50 shrink-0 flex flex-col gap-1.5">
        <div className="flex items-center justify-center gap-1">
          <FaceTag color={meIdentity.color} avatar={meIdentity.avatar} skin={meIdentity.skin} name="Você" />
          <TradeScale
            leftPositions={[...offered]}
            leftCash={fromCash}
            leftTickets={fromTickets}
            rightPositions={[...requested]}
            rightCash={toCash}
            rightTickets={toTickets}
          />
          <FaceTag
            color={themIdentity?.color ?? 'var(--color-starlight-muted)'}
            avatar={themIdentity?.avatar ?? 'classic-alive'}
            skin={themIdentity?.skin ?? 'careca'}
            name={themIdentity?.name ?? '—'}
            active={!!recipient}
          />
        </div>
        {others.length > 1 && (
          <div className="flex items-center justify-center gap-1.5">
            <span className="label text-cream-muted text-micro">Trocar com</span>
            {others.map((p) => {
              const identity = identityOf(room, p.id)
              return (
              <button
                key={p.id}
                type="button"
                title={identity.name}
                aria-label={`Trocar com ${identity.name}`}
                aria-pressed={p.id === draft.toId}
                onClick={() => send({ kind: 'pick-recipient', toId: p.id })}
                className={cn('rounded-full p-0.5 border transition-colors', p.id === draft.toId ? 'border-gold bg-gold/15' : 'border-transparent hover:border-gold/50')}
              >
                <PlayerFace color={identity.color} avatar={identity.avatar} skin={identity.skin} size={24} active={p.id === draft.toId} />
              </button>
              )
            })}
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-hidden flex divide-x divide-coffee-500/40">
        <Side
          title="Você oferece"
          color={meIdentity.color}
          avatar={meIdentity.avatar}
          skin={meIdentity.skin}
          ownerCash={proposer.cash}
          ownerTickets={proposer.busTickets}
          props={view.fromProps}
          grantable={view.fromGrantable}
          selected={offered}
          grants={fromGrants}
          onToggle={fromChange.property}
          onToggleGrant={fromChange.grant}
          onSetGrantLaps={fromChange.grantLaps}
          cash={fromCash}
          onCash={fromChange.cash}
          tickets={fromTickets}
          onTickets={fromChange.tickets}
          immunity={
            <ImmunitySide
              transferable={view.fromImmunities}
              transfers={fromTransfers}
              onToggleTransfer={fromChange.transfer}
            />
          }
        />
        <Side
          title={`${themIdentity?.name ?? '—'} oferece`}
          color={themIdentity?.color ?? 'var(--color-starlight-muted)'}
          avatar={themIdentity?.avatar ?? 'classic-alive'}
          skin={themIdentity?.skin ?? 'careca'}
          ownerCash={recipient?.cash ?? 0}
          ownerTickets={recipient?.busTickets ?? 0}
          props={view.toProps}
          grantable={view.toGrantable}
          selected={requested}
          grants={toGrants}
          onToggle={toChange.property}
          onToggleGrant={toChange.grant}
          onSetGrantLaps={toChange.grantLaps}
          cash={toCash}
          onCash={toChange.cash}
          tickets={toTickets}
          onTickets={toChange.tickets}
          immunity={
            <ImmunitySide
              transferable={view.toImmunities}
              transfers={toTransfers}
              onToggleTransfer={toChange.transfer}
            />
          }
        />
      </div>

      {/* Trava de esvaziamento (§8.5, D-058): recusa explicada COM o motivo. Sem isso, o
          botão desabilitado é indistinguível de bug. Doação pura pede qualquer contrapartida;
          esvaziamento diz quanto falta em valor real. */}
      {counterpart && (
        <p className="px-5 pt-3 label text-signal-glow normal-case leading-snug shrink-0" role="status">
          {counterpart.fromMissing > 0 && counterpart.toMissing > 0
            ? `Essa troca esvaziaria os dois lados: faltam ${money(counterpart.fromMissing)} para você e ${money(counterpart.toMissing)} para ${themIdentity?.name ?? 'o outro lado'}.`
            : counterpart.fromMissing > 0
              ? `Essa troca esvaziaria você — quem entrega quase tudo precisa receber valor real: faltam ${money(counterpart.fromMissing)}.`
              : counterpart.toMissing > 0
                ? `Essa troca esvaziaria ${themIdentity?.name ?? 'o outro lado'} — quem entrega quase tudo precisa receber valor real: faltam ${money(counterpart.toMissing)}.`
                : counterpart.fromDonation
                  ? 'Você está entregando sem receber nada em troca — inclua qualquer contrapartida.'
                  : `${themIdentity?.name ?? 'O outro lado'} entrega sem receber nada em troca — inclua qualquer contrapartida.`}
        </p>
      )}

      {/* Convenção de rodapé: secundário à ESQUERDA, primário à DIREITA */}
      <div className="px-5 py-3 border-t-2 border-coffee-950 shrink-0 flex gap-2">
        <Button className="flex-1 py-2.5" variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button className="flex-1 py-2.5" onClick={() => { proposeTrade(trade); onClose() }} disabled={!canPropose}>Confirmar</Button>
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------
// Recebido — resumo read-only da proposta + aceitar/recusar.
// ---------------------------------------------------------------------
function ReadSide({
  heading,
  context,
  color,
  avatar,
  skin,
  props,
  cash,
  tickets = 0,
  immunityGrants = [],
  immunityTransfers = [],
}: {
  heading: string
  context: string
  color: string
  avatar: AvatarId
  skin: SkinId
  props: number[]
  cash: number
  tickets?: number
  immunityGrants?: { pos: number; laps: number | null }[]
  immunityTransfers?: number[]
}) {
  const empty = props.length === 0 && cash === 0 && tickets === 0 && immunityGrants.length === 0 && immunityTransfers.length === 0
  return (
    <section className="trade-read-side">
      <div className="trade-read-side__header">
        <PlayerFace color={color} avatar={avatar} skin={skin} size={26} />
        <div className="trade-read-side__label">
          <p className="trade-read-side__heading">{heading}</p>
          <p className="trade-read-side__context">{context}</p>
        </div>
      </div>
      <div className="trade-read-side__content">
        {empty && <EmptyState title="Nada por este lado" className="py-3" />}
        {props.map((pos) => (
          <TradeDeedItem key={pos} pos={pos} />
        ))}
        {cash > 0 && (
          <div className="trade-value-item">
            <span className="trade-value-item__icon"><CoinIcon size={18} /></span>
            <div>
              <p>Dinheiro</p>
              <strong>{money(cash)}</strong>
            </div>
          </div>
        )}
        {tickets > 0 && (
          <div className="trade-value-item">
            <span className="trade-value-item__icon"><Bus size={18} /></span>
            <div>
              <p>Bus Ticket{tickets > 1 ? 's' : ''}</p>
              <strong>{tickets}</strong>
            </div>
          </div>
        )}
        {immunityTransfers.map((pos) => (
          <div key={`t${pos}`} className="trade-value-item trade-value-item--immunity">
            <span className="trade-value-item__icon"><Shield size={18} /></span>
            <div className="trade-value-item__identity">
              <p>Imunidade transferida</p>
            </div>
            <div className="trade-value-item__facts">
              <span>Local</span>
              <strong>{BOARD[pos].name}</strong>
            </div>
          </div>
        ))}
        {immunityGrants.map((g) => (
          <div key={`g${g.pos}`} className="trade-value-item trade-value-item--immunity">
            <span className="trade-value-item__icon"><Shield size={18} /></span>
            <div className="trade-value-item__identity">
              <p>Imunidade em {BOARD[g.pos].name}</p>
            </div>
            <div className="trade-value-item__facts">
              <span>Duração</span>
              <strong>{lapsLabel(g.laps)}</strong>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function Received({
  proposalId,
  trade,
  canRespond,
}: {
  proposalId: number
  trade: Trade
  canRespond: boolean
}) {
  const dispatch = useGameStore((s) => s.dispatch)
  const closeProposal = useTradeUI((s) => s.closeProposal)
  const acceptTrade = (): void => {
    dispatch({ kind: 'accept-trade', proposalId })
    closeProposal()
  }
  const rejectTrade = (): void => {
    dispatch({ kind: 'reject-trade', proposalId })
    closeProposal()
  }
  const game = useGameStore((s) => s.game)
  const room = useRoomStore((s) => s.room)
  const stillValid = validateTrade(game, trade)

  const from = identityOf(room, trade.fromId)
  const to = identityOf(room, trade.toId)

  return (
    <Card>
      {/* Fechar adia a decisão — a proposta segue na mesa e reabre pelo painel lateral. */}
      <Header
        title="Proposta de negociação"
        subtitle={canRespond
          ? `${from.name} enviou esta proposta para você`
          : `${from.name} enviou esta proposta para ${to.name}`}
        onClose={closeProposal}
      />

      {/* Mesa read-only: a mesma balança, já carregada com a proposta */}
      <div className="trade-proposal-scale">
        <TradeScale
          leftPositions={trade.fromProps}
          leftCash={trade.fromCash}
          leftTickets={trade.fromBusTickets ?? 0}
          rightPositions={trade.toProps}
          rightCash={trade.toCash}
          rightTickets={trade.toBusTickets ?? 0}
        />
      </div>

      <div className="trade-read-grid">
        {/* Do ponto de vista do destinatário (toId): recebe o que `from` dá; dá o que `from` pede. */}
        <ReadSide
          heading={canRespond ? 'Você recebe' : `${to.name} recebe`}
          context={`de ${from.name}`}
          color={from.color}
          avatar={from.avatar}
          skin={from.skin}
          props={trade.fromProps}
          cash={trade.fromCash}
          tickets={trade.fromBusTickets ?? 0}
          immunityGrants={trade.fromImmunities}
          immunityTransfers={trade.fromImmunityTransfers}
        />
        <ReadSide
          heading={canRespond ? 'Você paga' : `${to.name} entrega`}
          context={`para ${from.name}`}
          color={to.color}
          avatar={to.avatar}
          skin={to.skin}
          props={trade.toProps}
          cash={trade.toCash}
          tickets={trade.toBusTickets ?? 0}
          immunityGrants={trade.toImmunities}
          immunityTransfers={trade.toImmunityTransfers}
        />
      </div>

      {!stillValid && canRespond && (
        <p className="mx-5 mt-2 px-3 py-2 rounded-[var(--radius-sharp)] border border-logo/50 bg-logo/10 text-logo text-xs">
          A proposta ficou inválida porque o estado do jogo mudou. Recuse para continuar.
        </p>
      )}

      {canRespond && (
        <div className="px-5 py-3 border-t-2 border-coffee-950 shrink-0 flex gap-2">
          <Button className="flex-1 py-2.5" variant="secondary" onClick={rejectTrade}>Recusar</Button>
          <Button className="flex-1 py-2.5" onClick={acceptTrade} disabled={!stillValid}>Aceitar</Button>
        </div>
      )}
    </Card>
  )
}

export function TradeLayer() {
  const proposals = useGameStore((s) => s.game.tradeProposals)
  const open = useTradeUI((s) => s.open)
  const hide = useTradeUI((s) => s.hide)
  const selectedProposalId = useTradeUI((s) => s.selectedProposalId)
  const selectedProposal = proposals.find((proposal) => proposal.id === selectedProposalId)
  const local = useLocalView()
  const canRespond = selectedProposal
    ? local.mayActAction({ kind: 'accept-trade', proposalId: selectedProposal.id })
    : false

  // A proposta pode ser respondida por outro cliente enquanto está aberta localmente.
  useEffect(() => {
    if (selectedProposalId !== null && !selectedProposal) {
      useTradeUI.getState().closeProposal()
    }
  }, [selectedProposal, selectedProposalId])

  return (
    <AnimatePresence>
      {selectedProposal ? (
        <Backdrop key="received">
          <Received
            proposalId={selectedProposal.id}
            trade={selectedProposal.trade}
            canRespond={canRespond}
          />
        </Backdrop>
      ) : open ? (
        <Backdrop key="composer">
          <Composer onClose={hide} proposerId={local.seatId} />
        </Backdrop>
      ) : null}
    </AnimatePresence>
  )
}
