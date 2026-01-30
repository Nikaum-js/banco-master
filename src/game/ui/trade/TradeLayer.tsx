// Negociação na UI (024) — "mesa de troca": dois jogadores (PlayerFace) frente a
// frente, deed chips coloridos por grupo, campo de dinheiro e barra de saldo.
// Reusa o vocabulário visual do leilão (deed/avatar) e dos tokens Café Coado.
// Único ponto com efeito: dispara proposeTrade/acceptTrade/rejectTrade. A regra
// (validade) vem de validateTrade. Troca-se só propriedade + dinheiro.
import { useState, useEffect, type ReactNode } from 'react'
import { create } from 'zustand'
import { motion, AnimatePresence } from 'motion/react'
import { cn } from '@/lib/utils'
import { useGameStore } from '@/game/store'
import { validateTrade, tradableProps } from '@/game/economy/trade'
import type { Trade } from '@/game/economy/types'
import { BOARD, type PropertySquare, type Square } from '@/lib/boardData'
import { GROUP_COLOR, SquareIcon, PlayerFace, PLAYER_COLORS } from '@/boards/shared'
import { CoinIcon } from '@/game/ui/icons'

// Store de UI mínimo: abre/fecha o compositor (botão "Negociar" mora noutro arquivo).
export const useTradeUI = create<{ open: boolean; show: () => void; hide: () => void }>((set) => ({
  open: false,
  show: () => set({ open: true }),
  hide: () => set({ open: false }),
}))

const money = (v: number) => `R$ ${v.toLocaleString('pt-BR')}`
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))
const colorOf = (players: { id: string }[], id: string) => {
  const i = players.findIndex((p) => p.id === id)
  return i >= 0 ? PLAYER_COLORS[i % PLAYER_COLORS.length] : '#d4af37'
}

// ---------------------------------------------------------------------
// Glifos pequenos (sem emoji) — herdam currentColor.
// ---------------------------------------------------------------------
function SwapGlyph({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M7 4 3 8l4 4" /><path d="M3 8h14" /><path d="m17 20 4-4-4-4" /><path d="M21 16H7" />
    </svg>
  )
}
function CheckGlyph() {
  return (
    <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="#1a1410" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

// ---------------------------------------------------------------------
// Shell — backdrop + cartão + header + botão (vocabulário central).
// ---------------------------------------------------------------------
function Backdrop({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-[65] flex items-center justify-center bg-coffee-950/70 backdrop-blur-[2px] p-4"
    >
      {children}
    </motion.div>
  )
}

function Card({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 10 }}
      transition={{ type: 'spring', stiffness: 320, damping: 26 }}
      onClick={(e) => e.stopPropagation()}
      className="w-[720px] max-w-[96vw] max-h-[92vh] bg-coffee-800 border-2 border-coffee-500 rounded-[var(--radius-card)] shadow-[var(--shadow-dropdown)] overflow-hidden flex flex-col"
    >
      {children}
    </motion.div>
  )
}

function Header({ title }: { title: string }) {
  return (
    <div className="px-5 py-3 border-b-2 border-coffee-950 bg-[linear-gradient(180deg,#d4af37_0%,#b8941f_100%)] shrink-0 text-center">
      <h3 className="display text-coffee-950 text-xl leading-none tracking-wide">{title}</h3>
    </div>
  )
}

function Btn({ onClick, disabled, variant = 'primary', children }: { onClick: () => void; disabled?: boolean; variant?: 'primary' | 'secondary'; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex-1 px-3 py-2.5 rounded-[var(--radius-sharp)] font-bold text-sm transition-all active:translate-y-px disabled:opacity-40 disabled:cursor-not-allowed',
        variant === 'primary' ? 'bg-gold text-coffee-900 hover:brightness-110' : 'bg-coffee-700 text-cream border border-coffee-500 hover:bg-coffee-600',
      )}
    >
      {children}
    </button>
  )
}

// ---------------------------------------------------------------------
// Avatar do título: bandeira circular (propriedade) ou glifo (aeroporto/utilidade).
// ---------------------------------------------------------------------
function DeedAvatar({ sq, size = 22 }: { sq: Square; size?: number }) {
  if (sq.kind === 'property') {
    const uf = (sq as PropertySquare).uf
    return (
      <span className="rounded-full bg-coffee-900 border border-coffee-950 overflow-hidden shrink-0 shadow-[0_1px_2px_rgba(0,0,0,0.5)]" style={{ width: size, height: size }}>
        <img src={`https://flagcdn.com/${uf.toLowerCase()}.svg`} alt={uf} className="w-full h-full object-cover block" draggable={false} />
      </span>
    )
  }
  return (
    <span className="text-gold shrink-0 flex items-center justify-center" style={{ width: size, height: size }}>
      <SquareIcon square={sq} size={size * 0.85} />
    </span>
  )
}

const deedSub = (sq: Square) =>
  sq.kind === 'property' ? ((sq as PropertySquare).capital ?? '') : sq.kind === 'airport' ? 'Aeroporto' : sq.kind === 'utility' ? 'Utilidade' : ''
const deedAccent = (sq: Square) => (sq.kind === 'property' ? GROUP_COLOR[(sq as PropertySquare).group] : '#d4af37')

// Chip de título — faixa de cor do grupo + avatar + nome. Clicável (toggle) ou
// estático (read-only, no modal recebido).
function DeedChip({ pos, on, onToggle, readOnly }: { pos: number; on?: boolean; onToggle?: () => void; readOnly?: boolean }) {
  const sq = BOARD[pos]
  const sub = deedSub(sq)
  const inner = (
    <>
      <span className="self-stretch w-1.5 shrink-0 rounded-l-[1px]" style={{ background: deedAccent(sq) }} aria-hidden />
      <DeedAvatar sq={sq} size={22} />
      <span className="flex-1 min-w-0 py-1">
        <span className="block text-cream text-xs leading-tight truncate">{sq.name}</span>
        {sub && <span className="block text-cream-muted leading-none truncate" style={{ fontSize: '8px' }}>{sub}</span>}
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

// Chip de jogador — rosto + nome. Selecionável (destinatário) ou estático (você).
function PlayerChip({ color, name, selected, onSelect }: { color: string; name: string; selected?: boolean; onSelect?: () => void }) {
  const inner = (
    <>
      <PlayerFace color={color} size={30} active={!!selected || !onSelect} />
      <span className={cn('leading-none max-w-[72px] truncate font-semibold', selected || !onSelect ? 'text-gold' : 'text-cream-muted')} style={{ fontSize: '10px' }}>
        {name}
      </span>
    </>
  )
  const base = 'flex flex-col items-center gap-1 px-2.5 py-1.5 rounded-[var(--radius-sharp)] border shrink-0'
  if (!onSelect) return <div className={cn(base, 'border-transparent')}>{inner}</div>
  return (
    <button type="button" onClick={onSelect} className={cn(base, 'transition-colors', selected ? 'border-gold bg-gold/10' : 'border-coffee-500 bg-coffee-900 hover:border-gold/60')}>
      {inner}
    </button>
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
            className="w-full bg-transparent outline-none currency tabular-nums text-gold-glow text-sm placeholder:text-cream-muted/40 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
        </span>
        <button
          type="button"
          onClick={() => onChange(max)}
          disabled={max <= 0}
          className="shrink-0 label px-2 py-1.5 rounded-[var(--radius-sharp)] bg-coffee-700 border border-coffee-500 text-cream-muted hover:text-gold hover:border-gold/60 disabled:opacity-40 transition-colors"
          style={{ fontSize: '9px' }}
        >
          TUDO
        </button>
      </div>
      <p className="label text-cream-muted leading-none" style={{ fontSize: '8px' }}>de {money(max)} em caixa</p>
    </div>
  )
}

// ---------------------------------------------------------------------
// Coluna de um lado da troca (propriedades + dinheiro).
// ---------------------------------------------------------------------
function Side({
  title,
  color,
  ownerCash,
  props,
  selected,
  onToggle,
  cash,
  onCash,
}: {
  title: string
  color: string
  ownerCash: number
  props: number[]
  selected: Set<number>
  onToggle: (pos: number) => void
  cash: number
  onCash: (n: number) => void
}) {
  return (
    <div className="flex-1 min-w-0 flex flex-col">
      <div className="px-3 pt-3 pb-2 flex items-center gap-2 sticky top-0 z-10 bg-coffee-800 shrink-0 border-b border-coffee-700/40">
        <PlayerFace color={color} size={18} />
        <p className="label text-gold truncate" style={{ fontSize: '10px' }}>{title}</p>
      </div>

      <div className="flex-1 overflow-auto px-3 pt-2.5 pb-3 flex flex-col gap-2.5">
        <div className="flex flex-col gap-1">
          {props.length === 0 && <p className="text-cream-muted text-xs italic py-1">Nada para negociar.</p>}
          {props.map((pos) => (
            <DeedChip key={pos} pos={pos} on={selected.has(pos)} onToggle={() => onToggle(pos)} />
          ))}
        </div>

        <CashField value={cash} max={ownerCash} onChange={onCash} />
      </div>
    </div>
  )
}

// Barra de saldo — dinheiro líquido a favor de "você" + contagem de propriedades (dá ⇄ recebe).
function BalanceBar({ giveCount, getCount, netToYou }: { giveCount: number; getCount: number; netToYou: number }) {
  return (
    <div className="px-5 py-2.5 bg-coffee-950/50 border-t border-coffee-700 shrink-0 flex items-center justify-between gap-3">
      <div className="flex items-baseline gap-2">
        <span className="label text-cream-muted">Saldo</span>
        {netToYou !== 0 ? (
          <>
            <span className={cn('currency text-base tabular-nums', netToYou > 0 ? 'text-gold-glow' : 'text-logo')}>
              {netToYou > 0 ? '+' : '−'}{money(Math.abs(netToYou))}
            </span>
            <span className="label text-cream-muted" style={{ fontSize: '9px' }}>{netToYou > 0 ? 'a seu favor' : 'você paga'}</span>
          </>
        ) : (
          <span className="label text-cream-muted" style={{ fontSize: '9px' }}>equilibrado</span>
        )}
      </div>
      <div className="flex items-center gap-2 label text-cream-muted" style={{ fontSize: '9px' }} title="propriedades que você dá ⇄ recebe">
        <span>dá <span className="currency text-cream text-sm">{giveCount}</span></span>
        <SwapGlyph size={12} className="text-cream-muted" />
        <span>recebe <span className="currency text-cream text-sm">{getCount}</span></span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------
// Compositor — montar a proposta.
// ---------------------------------------------------------------------
function Composer({ onClose }: { onClose: () => void }) {
  const game = useGameStore((s) => s.game)
  const proposeTrade = useGameStore((s) => s.proposeTrade)

  const me = game.players[game.turnOrder[game.activeSeat]]
  const others = game.players.filter((p) => p.id !== me.id && !p.eliminated)
  const [toId, setToId] = useState(others[0]?.id ?? '')

  const [offered, setOffered] = useState<Set<number>>(new Set())
  const [requested, setRequested] = useState<Set<number>>(new Set())
  const [fromCash, setFromCash] = useState(0)
  const [toCash, setToCash] = useState(0)

  // Trocar de destinatário reseta o que dependia dele.
  useEffect(() => {
    setRequested(new Set())
  }, [toId])

  const recipient = others.find((p) => p.id === toId)
  const myProps = tradableProps(game, me.id)
  const theirProps = recipient ? tradableProps(game, recipient.id) : []

  const toggle = (set: Set<number>, setter: (s: Set<number>) => void, pos: number) => {
    const next = new Set(set)
    next.has(pos) ? next.delete(pos) : next.add(pos)
    setter(next)
  }

  const trade: Trade = {
    fromId: me.id,
    toId,
    fromProps: [...offered],
    fromCash,
    toProps: [...requested],
    toCash,
  }
  const nonEmpty = offered.size || requested.size || fromCash > 0 || toCash > 0
  const canPropose = !!recipient && !!nonEmpty && validateTrade(game, trade)

  const meColor = colorOf(game.players, me.id)

  return (
    <Card>
      <Header title="Negociação" />

      {/* Mesa — duelo Você ⇄ destinatário + seletor "trocar com" */}
      <div className="px-5 py-3 bg-coffee-900 border-b border-coffee-700 shrink-0 flex flex-col gap-2.5">
        <div className="flex items-center justify-center gap-5">
          <div className="flex flex-col items-center gap-1">
            <PlayerFace color={meColor} size={40} active />
            <span className="label text-gold" style={{ fontSize: '10px' }}>Você</span>
          </div>
          <SwapGlyph size={22} className="text-cream-muted shrink-0" />
          <div className="flex flex-col items-center gap-1">
            <PlayerFace color={recipient ? colorOf(game.players, recipient.id) : '#a89683'} size={40} active={!!recipient} />
            <span className="label text-gold" style={{ fontSize: '10px' }}>{recipient?.id ?? '—'}</span>
          </div>
        </div>
        {others.length > 1 && (
          <div className="flex items-center justify-center gap-1.5">
            <span className="label text-cream-muted" style={{ fontSize: '9px' }}>Trocar com</span>
            {others.map((p) => (
              <button
                key={p.id}
                type="button"
                title={p.id}
                onClick={() => setToId(p.id)}
                className={cn('rounded-full p-0.5 border transition-colors', p.id === toId ? 'border-gold bg-gold/15' : 'border-transparent hover:border-gold/50')}
              >
                <PlayerFace color={colorOf(game.players, p.id)} size={24} active={p.id === toId} />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-hidden flex divide-x divide-coffee-500/40">
        <Side
          title="Você oferece"
          color={meColor}
          ownerCash={me.cash}
          props={myProps}
          selected={offered}
          onToggle={(pos) => toggle(offered, setOffered, pos)}
          cash={fromCash}
          onCash={setFromCash}
        />
        <Side
          title={`${recipient?.id ?? '—'} oferece`}
          color={recipient ? colorOf(game.players, recipient.id) : '#a89683'}
          ownerCash={recipient?.cash ?? 0}
          props={theirProps}
          selected={requested}
          onToggle={(pos) => toggle(requested, setRequested, pos)}
          cash={toCash}
          onCash={setToCash}
        />
      </div>

      <BalanceBar giveCount={offered.size} getCount={requested.size} netToYou={toCash - fromCash} />

      <div className="px-5 py-3 border-t-2 border-coffee-950 shrink-0 flex gap-2">
        <Btn onClick={() => { proposeTrade(trade); onClose() }} disabled={!canPropose}>Propor</Btn>
        <Btn onClick={onClose} variant="secondary">Cancelar</Btn>
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------
// Recebido — resumo read-only da proposta + aceitar/recusar.
// ---------------------------------------------------------------------
function ReadSide({ title, color, props, cash }: { title: string; color: string; props: number[]; cash: number }) {
  const empty = props.length === 0 && cash === 0
  return (
    <div className="flex-1 min-w-0 flex flex-col">
      <div className="px-3 pt-3 pb-2 flex items-center gap-2 shrink-0 border-b border-coffee-700/40">
        <PlayerFace color={color} size={18} />
        <p className="label text-gold truncate" style={{ fontSize: '10px' }}>{title}</p>
      </div>
      <div className="flex-1 overflow-auto px-3 pt-2.5 pb-3 flex flex-col gap-1.5">
        {empty && <p className="text-cream-muted text-xs italic py-1">Nada.</p>}
        {props.map((pos) => (
          <DeedChip key={pos} pos={pos} readOnly />
        ))}
        {cash > 0 && (
          <span className="bill self-start">
            <CoinIcon size={13} className="text-gold" />
            {money(cash)}
          </span>
        )}
      </div>
    </div>
  )
}

function Received({ trade }: { trade: Trade }) {
  const acceptTrade = useGameStore((s) => s.acceptTrade)
  const rejectTrade = useGameStore((s) => s.rejectTrade)
  const game = useGameStore((s) => s.game)
  const stillValid = validateTrade(game, trade)

  const fromColor = colorOf(game.players, trade.fromId)
  const toColor = colorOf(game.players, trade.toId)

  return (
    <Card>
      <Header title="Proposta de negociação" />

      {/* Quem propõe ⇄ quem responde */}
      <div className="px-5 py-3 bg-coffee-900 border-b border-coffee-700 shrink-0 flex items-center justify-center gap-4">
        <PlayerChip color={fromColor} name={trade.fromId} />
        <SwapGlyph size={18} className="text-cream-muted shrink-0" />
        <PlayerChip color={toColor} name={trade.toId} />
      </div>

      <div className="flex-1 min-h-0 overflow-hidden flex divide-x divide-coffee-500/40">
        {/* Do ponto de vista do destinatário (toId): recebe o que `from` dá; dá o que `from` pede. */}
        <ReadSide title={`${trade.toId} recebe`} color={fromColor} props={trade.fromProps} cash={trade.fromCash} />
        <ReadSide title={`${trade.toId} dá`} color={toColor} props={trade.toProps} cash={trade.toCash} />
      </div>

      <BalanceBar giveCount={trade.toProps.length} getCount={trade.fromProps.length} netToYou={trade.fromCash - trade.toCash} />

      {!stillValid && <p className="px-5 pt-2 text-logo text-xs">Proposta inválida agora (estado mudou) — recuse.</p>}

      <div className="px-5 py-3 border-t-2 border-coffee-950 shrink-0 flex gap-2">
        <Btn onClick={() => acceptTrade()} disabled={!stillValid}>Aceitar</Btn>
        <Btn onClick={() => rejectTrade()} variant="secondary">Recusar</Btn>
      </div>
    </Card>
  )
}

export function TradeLayer() {
  const pendingTrade = useGameStore((s) => s.game.pendingTrade)
  const open = useTradeUI((s) => s.open)
  const hide = useTradeUI((s) => s.hide)

  // Proposta pendente tem prioridade (precisa de resposta).
  const showComposer = open && !pendingTrade

  return (
    <AnimatePresence>
      {pendingTrade ? (
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
