// Negociação na UI (024) — "mesa com balança": cada lado da troca vira peso
// físico numa balança de latão (valor de face = preço de tabela + dinheiro) e o
// travessão pende para o lado mais pesado — a justiça da troca se lê de relance,
// sem aritmética. Os títulos selecionados empilham nos pratos como fichas.
// Reusa o vocabulário visual do leilão (deed/avatar) e o shell canônico de modal.
// Único ponto com efeito: dispara proposeTrade/acceptTrade/rejectTrade. A regra
// (validade) vem de validateTrade. Troca-se propriedade + dinheiro + Bus Tickets (D-028).
import { useReducer, useEffect, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Bus, Shield } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useGameStore } from '@/game/store'
import { useTradeUI } from './tradeUI'
import { useLocalView, useRoomStore } from '@/net/roomStore'
import { identityOf } from '@/net/identity'
import { WaitingBar } from '@/net/ui/WaitingBar'
import { validateTrade } from '@/game/economy/trade'
import type { Trade, Immunity } from '@/game/economy/types'
import { BOARD, type Square } from '@/lib/boardData'
import { PlayerFace } from '@/boards/shared'
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

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))
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

function Header({ title, subtitle, onClose }: { title: string; subtitle?: string; onClose?: () => void }) {
  return <ModalHeader center title={title} subtitle={subtitle} onClose={onClose} className="[&_h3]:text-xl" />
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
        <img src={`https://flagcdn.com/${deed.flagCode.toLowerCase()}.svg`} alt={deed.flagCode} className="w-full h-full object-cover block" draggable={false} />
      </span>
    )
  }
  return (
    <span className="text-gold shrink-0 flex items-center justify-center" style={{ width: size, height: size }}>
      <SquareIcon square={sq} size={size * 0.85} />
    </span>
  )
}

// Chip de título — faixa de cor do grupo + avatar + nome. Clicável (toggle) ou
// estático (read-only, no modal recebido).
function DeedChip({ pos, on, onToggle, readOnly }: { pos: number; on?: boolean; onToggle?: () => void; readOnly?: boolean }) {
  const sq = BOARD[pos]
  const deed = deedPresentation(sq)
  if (!deed) return null
  const inner = (
    <>
      <span className="self-stretch w-1.5 shrink-0 rounded-l-[var(--radius-sharp)]" style={{ background: deed.accent }} aria-hidden />
      <DeedAvatar sq={sq} size={22} />
      <span className="flex-1 min-w-0 py-1">
        <span className="block text-cream text-xs leading-tight truncate">{deed.name}</span>
        {deed.subtitle && <span className="block text-cream-muted leading-none truncate text-nano">{deed.subtitle}</span>}
      </span>
      {!readOnly && (
        <span className={cn('shrink-0 mr-2 w-[18px] h-[18px] rounded-full flex items-center justify-center transition-colors', on ? 'bg-gold' : 'border border-coffee-500/70')}>
          {on && <CheckGlyph />}
        </span>
      )}
    </>
  )
  const base = 'flex items-center gap-2 w-full rounded-[var(--radius-sharp)] text-left border overflow-hidden'
  if (readOnly) return <div className={cn(base, 'border-coffee-500/70 bg-coffee-900/50')}>{inner}</div>
  return (
    <button type="button" onClick={onToggle} className={cn(base, 'transition-colors', on ? 'border-gold bg-gold/15' : 'border-coffee-500 bg-coffee-900 hover:border-gold/60')}>
      {inner}
    </button>
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
      <span className="text-cream-muted text-nano shrink-0">{laps === null ? 'permanente' : `${laps}v restantes`}</span>
    </button>
  )
}

// Conceder imunidade NOVA sobre uma propriedade própria mantida (não cedida na troca).
// Ao marcar, abre os presets de duração — sem seleção prévia, permanente é a leitura
// errada por padrão (o concedente quase sempre quer prazo, não "pra sempre").
function GrantRow({ pos, laps, onToggle, onSetLaps }: { pos: number; laps: number | null | undefined; onToggle: () => void; onSetLaps: (laps: number | null) => void }) {
  const on = laps !== undefined
  return (
    <div className={cn('flex flex-col gap-1.5 px-2 py-1.5 rounded-[var(--radius-sharp)] border transition-colors', on ? 'border-gold bg-gold/15' : 'border-coffee-500 bg-coffee-900')}>
      {/* 044/T031: sem padding próprio, esta linha tinha ~18px de alvo de toque (a altura
          do ToggleDot) — abaixo do mínimo de 24px. `min-h-6` garante o piso sem mexer no
          tamanho do texto/dot visível. */}
      <button type="button" onClick={onToggle} className="flex items-center gap-2 w-full min-h-6 text-left">
        <ToggleDot on={on} />
        <span className="flex-1 min-w-0 truncate text-cream text-xs">Conceder em {BOARD[pos].name}</span>
      </button>
      {on && (
        <div className="flex items-center gap-1 pl-[26px]">
          {TRADE_LAPS_PRESETS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onSetLaps(n)}
              // 044/T031: `text-micro` (9px) + `py-1` ficava perto de 19px de alvo —
              // `min-h-6` fecha os 24px mínimos sem aumentar o texto.
              className={cn(
                'label text-micro px-2 py-1 min-h-6 inline-flex items-center rounded-[var(--radius-sharp)] border transition-colors',
                laps === n ? 'bg-gold text-coffee-900 border-gold' : 'bg-coffee-700 text-cream-muted border-coffee-500 hover:border-gold/60',
              )}
            >
              {n}v
            </button>
          ))}
          <button
            type="button"
            onClick={() => onSetLaps(null)}
            className={cn(
              'label text-micro px-2 py-1 min-h-6 inline-flex items-center rounded-[var(--radius-sharp)] border transition-colors',
              laps === null ? 'bg-gold text-coffee-900 border-gold' : 'bg-coffee-700 text-cream-muted border-coffee-500 hover:border-gold/60',
            )}
          >
            Permanente
          </button>
        </div>
      )}
    </div>
  )
}

// Bloco de imunidade de um lado da troca (024 US3 + 028) — some quando não há nada
// pra transferir nem conceder (a maioria das trocas não mexe em imunidade).
function ImmunitySide({
  transferable,
  transfers,
  onToggleTransfer,
  grantable,
  grants,
  onToggleGrant,
  onSetLaps,
}: {
  transferable: Immunity[]
  transfers: Set<number>
  onToggleTransfer: (pos: number) => void
  grantable: number[]
  grants: TradeGrantMap
  onToggleGrant: (pos: number) => void
  onSetLaps: (pos: number, laps: number | null) => void
}) {
  if (transferable.length === 0 && grantable.length === 0) return null
  return (
    <div className="flex flex-col gap-1.5">
      <p className="label text-cream-muted text-micro flex items-center gap-1"><Shield size={11} /> Imunidade</p>
      {transferable.map((im) => (
        <TransferRow key={`t${im.pos}`} pos={im.pos} laps={im.lapsRemaining} on={transfers.has(im.pos)} onToggle={() => onToggleTransfer(im.pos)} />
      ))}
      {grantable.map((pos) => (
        <GrantRow key={`g${pos}`} pos={pos} laps={grants[pos]} onToggle={() => onToggleGrant(pos)} onSetLaps={(laps) => onSetLaps(pos, laps)} />
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

function PanTokens({ positions, cash, tickets }: { positions: number[]; cash: number; tickets: number }) {
  const shown = positions.slice(0, 5)
  const extra = positions.length - shown.length
  return (
    <div className="flex items-end justify-center min-h-[20px] -mb-[3px]">
      {shown.map((pos, i) => (
        <span key={pos} className={cn('relative', i > 0 && '-ml-2')} style={{ zIndex: i }}>
          <DeedAvatar sq={BOARD[pos]} size={18} />
        </span>
      ))}
      {extra > 0 && (
        <span className="relative z-10 -ml-1 label text-cream text-nano bg-coffee-700 border border-coffee-500 rounded-full px-1 leading-tight">+{extra}</span>
      )}
      {cash > 0 && (
        <span className={cn('relative z-10', (positions.length > 0) && '-ml-1')}>
          <CoinIcon size={15} className="text-gold" />
        </span>
      )}
      {tickets > 0 && (
        <span className={cn('relative z-10 flex items-end', (positions.length > 0 || cash > 0) && '-ml-0.5')}>
          <Bus size={14} className="text-gold" />
          {tickets > 1 && <span className="currency text-gold-glow text-nano leading-none ml-px">×{tickets}</span>}
        </span>
      )}
    </div>
  )
}

function Pan({ side, deg, positions, cash, tickets }: { side: 'left' | 'right'; deg: number; positions: number[]; cash: number; tickets: number }) {
  const value = faceValue(positions, cash)
  return (
    <motion.div
      animate={{ rotate: -deg }}
      transition={{ type: 'spring', stiffness: 120, damping: 14 }}
      style={{ transformOrigin: '50% 0%', [side === 'left' ? 'left' : 'right']: -46 }}
      className="absolute top-0 w-[92px] flex flex-col items-center"
    >
      {/* argola + cordas em V + carga + prato + etiqueta de valor */}
      <span className="w-1.5 h-1.5 rounded-full border border-brass-glow -mt-[3px]" aria-hidden />
      <div className="relative w-[78px] h-[30px]">
        <svg viewBox="0 0 78 30" className="absolute inset-0 w-full h-full" aria-hidden>
          <path
            d="M39 1 L6 29 M39 1 L72 29"
            stroke="var(--color-brass)"
            strokeOpacity="0.7"
            strokeWidth="1"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
        <div className="absolute inset-x-0 bottom-0">
          <PanTokens positions={positions} cash={cash} tickets={tickets} />
        </div>
      </div>
      <span className="relative block w-[78px] h-[11px]" aria-hidden>
        <span
          className="absolute inset-0 rounded-b-full shadow-[0_4px_10px_-2px_rgba(2,6,16,0.7)]"
          style={{ background: 'var(--gradient-brass)' }}
        />
        {/* borda do prato apanha a luz — vira "aro" em vez de barra chapada */}
        <span className="absolute inset-x-[3px] top-0 h-[2px] rounded-full bg-brass-glow/70" />
      </span>
      <span
        className={cn(
          'currency tabular-nums leading-none mt-1 px-1.5 py-0.5 rounded-full border',
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
  // de tela, então não há fade/pop/slideUp que os substitua sem perder o efeito. Só o
  // pulso ambiente do fecho (quando os pratos empatam) segue o freio de movimento reduzido.
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

  return (
    <div className="flex-1 min-w-0 flex flex-col items-center">
      <div className="relative w-[280px] max-w-full h-[104px]" aria-hidden>
        {/* halo quente atrás da balança (tira o "chapado" do fundo) */}
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-44 h-24 rounded-full bg-brass/10 blur-2xl" />
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
        {/* mostrador: arco graduado fixo sob o fulcro… */}
        <svg aria-hidden viewBox="0 0 44 24" className="absolute left-1/2 -translate-x-1/2 top-[12px] w-[44px] h-[24px]">
          <path d="M13.5 20.1 A20 20 0 0 0 30.5 20.1" stroke="var(--color-brass)" strokeOpacity="0.4" strokeWidth="1" fill="none" />
          <path d="M22 18.4 L22 22.2" stroke="var(--color-brass-glow)" strokeOpacity="0.7" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
        {/* …e o fiel, que amplifica a inclinação e cai no risco central quando os lados pesam igual */}
        <motion.span
          animate={{ rotate: deg * 4 }}
          transition={{ type: 'spring', stiffness: 120, damping: 14 }}
          style={{ transformOrigin: '50% 0%', clipPath: 'polygon(0 0, 100% 0, 50% 100%)' }}
          className={cn(
            'absolute left-1/2 -translate-x-1/2 top-[14px] w-[3px] h-[19px] z-10 transition-colors',
            balanced ? 'bg-brass-glow drop-shadow-[0_0_4px_var(--color-brass-glow)]' : 'bg-brass',
          )}
        />
        {/* travessão com os dois pratos pendurados (pratos contra-rotacionam p/ ficar nivelados) */}
        <motion.div
          animate={{ rotate: deg }}
          transition={{ type: 'spring', stiffness: 120, damping: 14 }}
          style={{ transformOrigin: '50% 50%', background: 'var(--gradient-brass-shine)' }}
          className="absolute left-[46px] right-[46px] top-[12px] h-[4px] rounded-full"
        >
          <span className="absolute -left-[3px] top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-brass-glow" />
          <span className="absolute -right-[3px] top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-brass-glow" />
          <Pan side="left" deg={deg} positions={leftPositions} cash={leftCash} tickets={leftTickets} />
          <Pan side="right" deg={deg} positions={rightPositions} cash={rightCash} tickets={rightTickets} />
        </motion.div>
        {/* joia do fulcro — pulsa quando a balança fecha */}
        <motion.span
          animate={balanced && !reduced ? { scale: [1, 1.25, 1], opacity: [1, 0.85, 1] } : { scale: 1, opacity: 1 }}
          transition={balanced && !reduced ? { repeat: Infinity, duration: 1.8, ease: 'easeInOut' } : { type: 'spring', stiffness: 120, damping: 14 }}
          className={cn(
            'absolute left-1/2 -translate-x-1/2 top-[10px] w-2 h-2 rounded-full bg-brass-glow z-20',
            balanced ? 'shadow-[0_0_14px_var(--color-brass-glow)]' : 'shadow-[0_0_8px_var(--color-brass-glow)]',
          )}
        />
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
    <div className="flex flex-col items-center gap-1 w-[64px] shrink-0">
      <PlayerFace color={color} avatar={avatar} skin={skin} size={36} active={active} />
      <span className="label text-gold max-w-full truncate">{name}</span>
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
  selected,
  onToggle,
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
  selected: Set<number>
  onToggle: (pos: number) => void
  cash: number
  onCash: (n: number) => void
  tickets: number
  onTickets: (n: number) => void
  immunity?: ReactNode
}) {
  const summary = [
    selected.size > 0 ? `${selected.size} ${selected.size === 1 ? 'título' : 'títulos'}` : '',
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
          {props.length === 0 && <EmptyState title="Nada para negociar" className="py-3" />}
          {props.map((pos) => (
            <DeedChip key={pos} pos={pos} on={selected.has(pos)} onToggle={() => onToggle(pos)} />
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
function Composer({ onClose }: { onClose: () => void }) {
  const game = useGameStore((s) => s.game)
  const room = useRoomStore((s) => s.room)
  const dispatchTrade = useGameStore((s) => s.dispatch)
  const proposeTrade = (trade: Trade): void => dispatchTrade({ kind: 'propose-trade', trade })

  const me = game.players[game.turnOrder[game.activeSeat]]
  const [draft, send] = useReducer(
    (current: ReturnType<typeof createTradeDraft>, action: Parameters<typeof updateTradeDraft>[2]) =>
      updateTradeDraft(game, current, action),
    game,
    (initialGame) => createTradeDraft(initialGame, me.id),
  )
  const view = projectTradeDraft(game, draft)
  const { proposer, recipients: others, recipient, trade, canPropose } = view
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
          selected={offered}
          onToggle={fromChange.property}
          cash={fromCash}
          onCash={fromChange.cash}
          tickets={fromTickets}
          onTickets={fromChange.tickets}
          immunity={
            <ImmunitySide
              transferable={view.fromImmunities}
              transfers={fromTransfers}
              onToggleTransfer={fromChange.transfer}
              grantable={view.fromGrantable}
              grants={fromGrants}
              onToggleGrant={fromChange.grant}
              onSetLaps={fromChange.grantLaps}
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
          selected={requested}
          onToggle={toChange.property}
          cash={toCash}
          onCash={toChange.cash}
          tickets={toTickets}
          onTickets={toChange.tickets}
          immunity={
            <ImmunitySide
              transferable={view.toImmunities}
              transfers={toTransfers}
              onToggleTransfer={toChange.transfer}
              grantable={view.toGrantable}
              grants={toGrants}
              onToggleGrant={toChange.grant}
              onSetLaps={toChange.grantLaps}
            />
          }
        />
      </div>

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
  title,
  color,
  avatar,
  skin,
  props,
  cash,
  tickets = 0,
  immunityGrants = [],
  immunityTransfers = [],
}: {
  title: string
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
    <div className="flex-1 min-w-0 flex flex-col">
      <div className="px-3 pt-3 pb-2 flex items-center gap-2 shrink-0 border-b border-coffee-700/40">
        <PlayerFace color={color} avatar={avatar} skin={skin} size={18} />
        <p className="label text-gold truncate">{title}</p>
      </div>
      <div className="flex-1 overflow-auto px-3 pt-2.5 pb-3 flex flex-col gap-1.5">
        {empty && <EmptyState title="Nada por este lado" className="py-3" />}
        {props.map((pos) => (
          <DeedChip key={pos} pos={pos} readOnly />
        ))}
        {cash > 0 && (
          <span className="bill self-start">
            <CoinIcon size={13} className="text-gold" />
            {money(cash)}
          </span>
        )}
        {tickets > 0 && (
          <span className="bill self-start">
            <Bus size={13} className="text-gold" />
            {tickets} Bus Ticket{tickets > 1 ? 's' : ''}
          </span>
        )}
        {immunityTransfers.map((pos) => (
          <span key={`t${pos}`} className="bill self-start">
            <Shield size={13} className="text-gold" />
            Imunidade de {BOARD[pos].name} transferida
          </span>
        ))}
        {immunityGrants.map((g) => (
          <span key={`g${g.pos}`} className="bill self-start">
            <Shield size={13} className="text-gold" />
            Imunidade em {BOARD[g.pos].name} ({g.laps === null ? 'permanente' : `${g.laps} voltas`})
          </span>
        ))}
      </div>
    </div>
  )
}

function Received({ trade }: { trade: Trade }) {
  const dispatch = useGameStore((s) => s.dispatch)
  const acceptTrade = (): void => dispatch({ kind: 'accept-trade' })
  const rejectTrade = (): void => dispatch({ kind: 'reject-trade' })
  const dismiss = useTradeUI((s) => s.dismiss)
  const game = useGameStore((s) => s.game)
  const room = useRoomStore((s) => s.room)
  const stillValid = validateTrade(game, trade)

  const from = identityOf(room, trade.fromId)
  const to = identityOf(room, trade.toId)

  return (
    <Card>
      {/* X fecha SEM responder — a proposta segue na mesa (reabre pelo painel lateral) */}
      <Header title="Proposta de negociação" subtitle={`${to.name} decide se aceita ou recusa`} onClose={dismiss} />

      {/* Mesa read-only: a mesma balança, já carregada com a proposta */}
      <div className="px-4 pt-3 pb-2 bg-coffee-950/25 border-b border-coffee-700/50 shrink-0 flex items-center justify-center gap-1">
        <FaceTag color={from.color} avatar={from.avatar} skin={from.skin} name={from.name} />
        <TradeScale
          leftPositions={trade.fromProps}
          leftCash={trade.fromCash}
          leftTickets={trade.fromBusTickets ?? 0}
          rightPositions={trade.toProps}
          rightCash={trade.toCash}
          rightTickets={trade.toBusTickets ?? 0}
        />
        <FaceTag color={to.color} avatar={to.avatar} skin={to.skin} name={to.name} />
      </div>

      <div className="flex-1 min-h-0 overflow-hidden flex divide-x divide-coffee-500/40">
        {/* Do ponto de vista do destinatário (toId): recebe o que `from` dá; dá o que `from` pede. */}
        <ReadSide
          title={`${to.name} recebe`}
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
          title={`${to.name} dá`}
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

      {!stillValid && (
        <p className="mx-5 mt-2 px-3 py-2 rounded-[var(--radius-sharp)] border border-logo/50 bg-logo/10 text-logo text-xs">
          A proposta ficou inválida porque o estado do jogo mudou. Recuse para continuar.
        </p>
      )}

      {/* Convenção de rodapé: secundário à ESQUERDA, primário à DIREITA */}
      <div className="px-5 py-3 border-t-2 border-coffee-950 shrink-0 flex gap-2">
        <Button className="flex-1 py-2.5" variant="secondary" onClick={() => rejectTrade()}>Recusar</Button>
        <Button className="flex-1 py-2.5" onClick={() => acceptTrade()} disabled={!stillValid}>Aceitar</Button>
      </div>
    </Card>
  )
}

export function TradeLayer() {
  const pendingTrade = useGameStore((s) => s.game.pendingTrade)
  const open = useTradeUI((s) => s.open)
  const hide = useTradeUI((s) => s.hide)
  const dismissed = useTradeUI((s) => s.dismissed)

  // Proposta saiu da mesa (aceita/recusada) → o próximo recebimento abre de novo.
  useEffect(() => {
    if (!pendingTrade) useTradeUI.setState({ dismissed: false })
  }, [pendingTrade])

  // Proposta pendente tem prioridade (precisa de resposta) — a menos que o
  // destinatário tenha fechado pra decidir depois (dismissed).
  const showComposer = open && !pendingTrade
  // Online, a proposta recebida abre no DESTINATÁRIO (spec 038, FR-002); quem propôs vê
  // o aviso de espera. Sem sala, `mayAct` é sempre true e nada muda (cliente único).
  const iAnswer = useLocalView().mayAct('accept-trade')

  return (
    <AnimatePresence>
      {pendingTrade && !iAnswer ? (
        <WaitingBar key="trade-waiting" playerId={pendingTrade.toId} what="resposta à proposta" />
      ) : pendingTrade && !dismissed ? (
        <Backdrop key="received">
          <Received trade={pendingTrade} />
        </Backdrop>
      ) : showComposer ? (
        <Backdrop key="composer">
          <Composer onClose={hide} />
        </Backdrop>
      ) : null}
    </AnimatePresence>
  )
}
