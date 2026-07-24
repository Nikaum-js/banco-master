// Painel "Minhas Cartas" (029, §12.4) — a mão do jogador da vez, com botão "Usar"
// gated por timing. Privacidade (VI): só o jogador ativo; demais veem só o contador
// (PlayersPanel). Sem alvo → joga direto; com alvo → abre o HandCardLayer.
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'
import { useGameStore } from '@/game/store'
import { handCardsView } from './handView'
import { useHandCardUI } from './HandCardLayer'
import { Button, SectionHeader, EmptyState } from '@/game/ui/primitives'

function LockGlyph({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  )
}

function TargetGlyph({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" className="shrink-0" aria-hidden>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
    </svg>
  )
}

// Duas cartas em leque — glifo do estado vazio.
function EmptyHandGlyph({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" aria-hidden>
      <rect x="3" y="5" width="9.5" height="14" rx="1.5" transform="rotate(-8 7.75 12)" />
      <rect x="11.5" y="5" width="9.5" height="14" rx="1.5" transform="rotate(8 16.25 12)" />
    </svg>
  )
}

// Slots da mão (limite 3, §10.3) — mini-cartas preenchidas conforme a mão.
function HandSlots({ count }: { count: number }) {
  const label = `${count} de 3 cartas na mão`
  return (
    <span className="flex items-center gap-1" title={label} aria-label={label}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={cn(
            'w-2.5 h-3.5 rounded-[var(--radius-sharp)] border transition-colors',
            i < count ? 'bg-gold/80 border-gold' : 'bg-coffee-900 border-coffee-500',
          )}
        />
      ))}
    </span>
  )
}

export function HandPanel() {
  const game = useGameStore((s) => s.game)
  const playHandCard = useGameStore((s) => s.playHandCard)
  const reduced = useReducedMotion()
  const activeId = game.players[game.turnOrder[game.activeSeat]]?.id
  const cards = activeId ? handCardsView(game, activeId) : []

  const onUse = (id: string, needsTarget: boolean) => {
    if (needsTarget) useHandCardUI.getState().open(id)
    else playHandCard(id)
  }

  return (
    <div className="side-panel-section">
      <SectionHeader title="Minhas Cartas" meta={<HandSlots count={cards.length} />} />

      {cards.length === 0 ? (
        <EmptyState icon={<EmptyHandGlyph />} title="Mão vazia" hint="Cartas vêm das casas de Acaso e Tesouro" />
      ) : (
        <ul className="flex flex-col gap-2.5">
          <AnimatePresence initial={false}>
            {cards.map((c) => (
              <motion.li
                key={c.id}
                layout={!reduced}
                initial={reduced ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              >
                <article
                  className={cn(
                    'relative overflow-hidden rounded-[var(--radius-card)] border bg-coffee-700',
                    'shadow-[inset_0_0_0_1px_var(--color-coffee-800),var(--shadow-card)] transition-all',
                    c.playable
                      ? 'border-coffee-500 hover:border-gold/60 hover:-translate-y-0.5 hover:shadow-[inset_0_0_0_1px_var(--color-coffee-800),var(--shadow-lift)]'
                      : 'border-coffee-500/70',
                  )}
                >
                  {/* faixa de raridade no topo */}
                  <div className="h-1" style={{ background: c.rarityColor }} aria-hidden />
                  <div
                    className="px-3 pt-2.5 pb-3"
                    style={{ background: `linear-gradient(180deg, color-mix(in srgb, ${c.rarityColor} 9%, transparent) 0%, transparent 55%)` }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="display text-cream text-[15px] leading-tight flex-1 min-w-0">{c.label}</span>
                      <span
                        className="label text-nano shrink-0 px-1.5 py-0.5 rounded-[var(--radius-sharp)] border leading-none"
                        style={{ color: c.rarityColor, borderColor: `color-mix(in srgb, ${c.rarityColor} 40%, transparent)`, background: `color-mix(in srgb, ${c.rarityColor} 8%, transparent)` }}
                      >
                        {c.rarityLabel}
                      </span>
                    </div>
                    <p className="text-cream-muted text-xs leading-snug mt-1.5">{c.desc}</p>

                    {c.playable ? (
                      <Button
                        onClick={() => onUse(c.id, c.needsTarget)}
                        className="w-full mt-2.5 text-xs"
                      >
                        {c.needsTarget ? (
                          <>
                            <TargetGlyph /> Escolher alvo
                          </>
                        ) : (
                          'Usar agora'
                        )}
                      </Button>
                    ) : (
                      <p
                        title={c.reason}
                        className="mt-2.5 flex items-center gap-1.5 text-cream-muted text-[11px] leading-snug px-2.5 py-1.5 rounded-[var(--radius-sharp)] bg-coffee-950/40 border border-coffee-500/50"
                      >
                        <LockGlyph /> <span className="flex-1 min-w-0">{c.reason}</span>
                      </p>
                    )}
                  </div>
                </article>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  )
}
