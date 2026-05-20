// Negociação na UI (024) — compositor + modal recebido. Reusa o vocabulário visual
// central (cartão coffee + backdrop). Único ponto com efeito: dispara os comandos
// proposeTrade/acceptTrade/rejectTrade. A regra (validade) vem de validateTrade.
import { useState, useEffect, type ReactNode } from 'react'
import { create } from 'zustand'
import { motion, AnimatePresence } from 'motion/react'
import { cn } from '@/lib/utils'
import { useGameStore } from '@/game/store'
import { validateTrade, tradableProps } from '@/game/economy/trade'
import type { Trade, ImmunityGrant } from '@/game/economy/types'
import { BOARD } from '@/lib/boardData'

// Store de UI mínimo: abre/fecha o compositor (botão "Negociar" mora noutro arquivo).
export const useTradeUI = create<{ open: boolean; show: () => void; hide: () => void }>((set) => ({
  open: false,
  show: () => set({ open: true }),
  hide: () => set({ open: false }),
}))

const propName = (pos: number) => BOARD[pos]?.name ?? `#${pos}`
const lapsLabel = (laps: number | null) => (laps === null ? 'permanente' : `${laps}v`)

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

function Card({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, y: 8 }}
      transition={{ type: 'spring', stiffness: 360, damping: 28 }}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        'bg-coffee-800 border-2 border-coffee-500 rounded-[var(--radius-card)] shadow-[var(--shadow-dropdown)] overflow-hidden max-h-[90vh] flex flex-col',
        wide ? 'w-[640px] max-w-[95vw]' : 'w-[360px] max-w-[92vw]',
      )}
    >
      {children}
    </motion.div>
  )
}

function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="px-4 py-3 border-b-2 border-coffee-950 bg-[linear-gradient(180deg,#d4af37_0%,#b8941f_100%)] shrink-0">
      <h3 className="display text-coffee-950 text-lg leading-none">{title}</h3>
      {subtitle && <p className="label text-coffee-950/80 mt-0.5" style={{ fontSize: '9px' }}>{subtitle}</p>}
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
        'flex-1 px-3 py-2 rounded-[var(--radius-sharp)] font-bold text-sm transition-all active:translate-y-px disabled:opacity-40 disabled:cursor-not-allowed',
        variant === 'primary' ? 'bg-gold text-coffee-900 hover:brightness-110' : 'bg-coffee-700 text-cream border border-coffee-500 hover:bg-coffee-600',
      )}
    >
      {children}
    </button>
  )
}

// Linha de propriedade com toggle (oferecer/pedir).
function PropToggle({ pos, on, onToggle }: { pos: number; on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'flex items-center gap-2 w-full px-2 py-1 rounded-[var(--radius-sharp)] text-left text-xs transition-colors border',
        on ? 'bg-gold/20 border-gold text-cream' : 'bg-coffee-900 border-coffee-500 text-cream-muted hover:border-gold/50',
      )}
    >
      <span className={cn('w-3 h-3 rounded-sm shrink-0 border', on ? 'bg-gold border-gold' : 'border-coffee-500')} />
      <span className="flex-1 min-w-0 truncate">{propName(pos)}</span>
    </button>
  )
}

// Coluna de um lado da troca (propriedades + dinheiro + imunidades).
function Side({
  title,
  ownerCash,
  props,
  selected,
  onToggle,
  cash,
  onCash,
  immunityPool,
  immunities,
  onAddImmunity,
  onRemoveImmunity,
  transferPool,
  transfers,
  onToggleTransfer,
}: {
  title: string
  ownerCash: number
  props: number[]
  selected: Set<number>
  onToggle: (pos: number) => void
  cash: number
  onCash: (n: number) => void
  immunityPool: number[]
  immunities: ImmunityGrant[]
  onAddImmunity: (g: ImmunityGrant) => void
  onRemoveImmunity: (pos: number) => void
  transferPool: { pos: number; laps: number | null }[]
  transfers: Set<number>
  onToggleTransfer: (pos: number) => void
}) {
  const [immPos, setImmPos] = useState<number | ''>('')
  const [immLaps, setImmLaps] = useState(2)
  const [immPerm, setImmPerm] = useState(false)

  return (
    <div className="flex-1 min-w-0 flex flex-col gap-2 p-3">
      <p className="label text-gold" style={{ fontSize: '10px' }}>{title}</p>

      <div className="flex flex-col gap-1 max-h-[34vh] overflow-auto pr-1">
        {props.length === 0 && <p className="text-cream-muted text-xs">Sem propriedades negociáveis.</p>}
        {props.map((pos) => (
          <PropToggle key={pos} pos={pos} on={selected.has(pos)} onToggle={() => onToggle(pos)} />
        ))}
      </div>

      <label className="flex items-center gap-2 text-xs text-cream-muted">
        <span className="shrink-0">Dinheiro $</span>
        <input
          type="number"
          min={0}
          max={ownerCash}
          value={cash}
          onChange={(e) => onCash(Math.max(0, Math.min(ownerCash, Number(e.target.value) || 0)))}
          className="w-24 px-2 py-1 rounded-[var(--radius-sharp)] bg-coffee-900 border border-coffee-500 text-cream"
        />
      </label>

      {/* Imunidades concedidas sobre propriedades MANTIDAS */}
      <div className="flex flex-col gap-1 border-t border-coffee-500/50 pt-2">
        <p className="label text-cream-muted" style={{ fontSize: '9px' }}>Imunidade (propriedade mantida)</p>
        {immunities.map((g) => (
          <div key={g.pos} className="flex items-center gap-1.5 text-xs text-cream">
            <span className="flex-1 min-w-0 truncate">{propName(g.pos)} · {lapsLabel(g.laps)}</span>
            <button type="button" onClick={() => onRemoveImmunity(g.pos)} className="text-logo px-1">✕</button>
          </div>
        ))}
        {immunityPool.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            <select value={immPos} onChange={(e) => setImmPos(e.target.value === '' ? '' : Number(e.target.value))} className="px-1.5 py-1 rounded bg-coffee-900 border border-coffee-500 text-cream text-xs max-w-[40%]">
              <option value="">propriedade…</option>
              {immunityPool.map((pos) => (
                <option key={pos} value={pos}>{propName(pos)}</option>
              ))}
            </select>
            <label className="flex items-center gap-1 text-xs text-cream-muted">
              <input type="checkbox" checked={immPerm} onChange={(e) => setImmPerm(e.target.checked)} />perm
            </label>
            {!immPerm && (
              <input type="number" min={1} value={immLaps} onChange={(e) => setImmLaps(Math.max(1, Number(e.target.value) || 1))} className="w-12 px-1 py-1 rounded bg-coffee-900 border border-coffee-500 text-cream text-xs" />
            )}
            <button
              type="button"
              disabled={immPos === ''}
              onClick={() => {
                if (immPos === '') return
                onAddImmunity({ pos: immPos, laps: immPerm ? null : immLaps })
                setImmPos('')
              }}
              className="px-2 py-1 rounded bg-coffee-700 border border-coffee-500 text-cream text-xs disabled:opacity-40"
            >
              +
            </button>
          </div>
        )}
      </div>

      {/* Transferir imunidade EXISTENTE de que este lado já é beneficiário (028, §8.4) */}
      {transferPool.length > 0 && (
        <div className="flex flex-col gap-1 border-t border-coffee-500/50 pt-2">
          <p className="label text-cream-muted" style={{ fontSize: '9px' }}>Transferir imunidade (que possui)</p>
          {transferPool.map((im) => {
            const on = transfers.has(im.pos)
            return (
              <button
                key={im.pos}
                type="button"
                onClick={() => onToggleTransfer(im.pos)}
                className={cn(
                  'flex items-center gap-2 w-full px-2 py-1 rounded-[var(--radius-sharp)] text-left text-xs transition-colors border',
                  on ? 'bg-gold/20 border-gold text-cream' : 'bg-coffee-900 border-coffee-500 text-cream-muted hover:border-gold/50',
                )}
              >
                <span className={cn('w-3 h-3 rounded-sm shrink-0 border', on ? 'bg-gold border-gold' : 'border-coffee-500')} />
                <span className="flex-1 min-w-0 truncate">{propName(im.pos)} · {lapsLabel(im.laps)}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

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
  const [fromImm, setFromImm] = useState<ImmunityGrant[]>([])
  const [toImm, setToImm] = useState<ImmunityGrant[]>([])
  const [fromTransfers, setFromTransfers] = useState<Set<number>>(new Set())
  const [toTransfers, setToTransfers] = useState<Set<number>>(new Set())

  // Trocar de destinatário reseta o que dependia dele.
  useEffect(() => {
    setRequested(new Set())
    setToImm([])
    setToTransfers(new Set())
  }, [toId])

  const recipient = others.find((p) => p.id === toId)
  const myProps = tradableProps(game, me.id)
  const theirProps = recipient ? tradableProps(game, recipient.id) : []
  // Imunidade só sobre propriedade MANTIDA (não nas oferecidas/pedidas).
  const myKept = myProps.filter((p) => !offered.has(p))
  const theirKept = theirProps.filter((p) => !requested.has(p))
  // Imunidades existentes das quais cada lado é beneficiário (028) — transferíveis.
  const immOf = (id: string) => game.immunities.filter((i) => i.beneficiaryId === id).map((i) => ({ pos: i.pos, laps: i.lapsRemaining }))
  const myImmunities = immOf(me.id)
  const theirImmunities = recipient ? immOf(recipient.id) : []

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
    fromImmunities: fromImm.length ? fromImm : undefined,
    toImmunities: toImm.length ? toImm : undefined,
    fromImmunityTransfers: fromTransfers.size ? [...fromTransfers] : undefined,
    toImmunityTransfers: toTransfers.size ? [...toTransfers] : undefined,
  }
  const nonEmpty =
    offered.size || requested.size || fromCash > 0 || toCash > 0 || fromImm.length || toImm.length || fromTransfers.size || toTransfers.size
  const canPropose = !!recipient && !!nonEmpty && validateTrade(game, trade)

  return (
    <Card wide>
      <Header title="Negociação" subtitle="Monte a proposta — cartas e Bus Tickets não são negociáveis" />
      <div className="px-4 pt-3 shrink-0 flex items-center gap-2 text-sm text-cream">
        <span className="text-cream-muted">Com:</span>
        <select value={toId} onChange={(e) => setToId(e.target.value)} className="px-2 py-1 rounded bg-coffee-900 border border-coffee-500 text-cream">
          {others.map((p) => (
            <option key={p.id} value={p.id}>{p.id} (${p.cash})</option>
          ))}
        </select>
      </div>

      <div className="flex-1 overflow-auto flex divide-x divide-coffee-500/50">
        <Side
          title={`Você (${me.id}) oferece`}
          ownerCash={me.cash}
          props={myProps}
          selected={offered}
          onToggle={(pos) => toggle(offered, setOffered, pos)}
          cash={fromCash}
          onCash={setFromCash}
          immunityPool={myKept}
          immunities={fromImm}
          onAddImmunity={(g) => setFromImm((xs) => [...xs.filter((x) => x.pos !== g.pos), g])}
          onRemoveImmunity={(pos) => setFromImm((xs) => xs.filter((x) => x.pos !== pos))}
          transferPool={myImmunities}
          transfers={fromTransfers}
          onToggleTransfer={(pos) => setFromTransfers((s) => { const n = new Set(s); n.has(pos) ? n.delete(pos) : n.add(pos); return n })}
        />
        <Side
          title={`${recipient?.id ?? '—'} dá`}
          ownerCash={recipient?.cash ?? 0}
          props={theirProps}
          selected={requested}
          onToggle={(pos) => toggle(requested, setRequested, pos)}
          cash={toCash}
          onCash={setToCash}
          immunityPool={theirKept}
          immunities={toImm}
          onAddImmunity={(g) => setToImm((xs) => [...xs.filter((x) => x.pos !== g.pos), g])}
          onRemoveImmunity={(pos) => setToImm((xs) => xs.filter((x) => x.pos !== pos))}
          transferPool={theirImmunities}
          transfers={toTransfers}
          onToggleTransfer={(pos) => setToTransfers((s) => { const n = new Set(s); n.has(pos) ? n.delete(pos) : n.add(pos); return n })}
        />
      </div>

      <div className="px-4 py-3 border-t-2 border-coffee-950 shrink-0 flex gap-2">
        <Btn onClick={() => { proposeTrade(trade); onClose() }} disabled={!canPropose}>Propor</Btn>
        <Btn onClick={onClose} variant="secondary">Cancelar</Btn>
      </div>
    </Card>
  )
}

// Resumo de um lado no modal recebido.
function Terms({ label, props, cash, immunities, transfers }: { label: string; props: number[]; cash: number; immunities?: ImmunityGrant[]; transfers?: number[] }) {
  const empty = props.length === 0 && cash === 0 && !(immunities && immunities.length) && !(transfers && transfers.length)
  return (
    <div className="flex-1 min-w-0 p-3">
      <p className="label text-gold mb-1.5" style={{ fontSize: '10px' }}>{label}</p>
      {empty && <p className="text-cream-muted text-xs">Nada</p>}
      {props.map((pos) => (
        <p key={pos} className="text-cream text-xs truncate">{propName(pos)}</p>
      ))}
      {cash > 0 && <p className="text-gold-glow text-xs">R$ {cash}</p>}
      {immunities?.map((g) => (
        <p key={g.pos} className="text-cream text-xs truncate">Imunidade: {propName(g.pos)} · {lapsLabel(g.laps)}</p>
      ))}
      {transfers?.map((pos) => (
        <p key={`t${pos}`} className="text-cream text-xs truncate">Transfere imunidade: {propName(pos)}</p>
      ))}
    </div>
  )
}

function Received({ trade }: { trade: Trade }) {
  const acceptTrade = useGameStore((s) => s.acceptTrade)
  const rejectTrade = useGameStore((s) => s.rejectTrade)
  const game = useGameStore((s) => s.game)
  const stillValid = validateTrade(game, trade)
  return (
    <Card wide>
      <Header title="Proposta de negociação" subtitle={`${trade.fromId} propõe a ${trade.toId}`} />
      <div className="flex-1 overflow-auto flex divide-x divide-coffee-500/50">
        {/* Para o destinatário (toId): recebe o que `from` oferece; dá o que `from` pede. */}
        <Terms label={`${trade.toId} recebe`} props={trade.fromProps} cash={trade.fromCash} immunities={trade.fromImmunities} transfers={trade.fromImmunityTransfers} />
        <Terms label={`${trade.toId} dá`} props={trade.toProps} cash={trade.toCash} immunities={trade.toImmunities} transfers={trade.toImmunityTransfers} />
      </div>
      {!stillValid && <p className="px-4 text-logo text-xs">Proposta inválida agora (estado mudou) — recuse.</p>}
      <div className="px-4 py-3 border-t-2 border-coffee-950 shrink-0 flex gap-2">
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
