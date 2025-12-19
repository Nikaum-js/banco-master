// Painel "Minhas Cartas" (029, §12.4) — a mão do DONO DESTA TELA, com botão "Usar" gated
// por timing. Privacidade (VI/§10.3): online, a mão é sempre a do assento local (spec 038,
// FR-005) — nunca a do jogador da vez, senão a tela de todo mundo viraria a dele a cada
// turno. Sem sala (cliente único), o assento local é o jogador ativo, que é o comportamento
// de sempre. Demais jogadores aparecem só como contador (PlayersPanel, §12.3/FR-006).
import { motion, AnimatePresence } from 'motion/react'
import { cn } from '@/lib/utils'
import { useGameStore } from '@/game/store'
import { useLocalView } from '@/net/roomStore'
import { handCardsView } from './handView'
import { useHandCardUI } from './handCardUI'
import { useMotion } from '@/game/ui/motion'
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
    // `role="img"`: `aria-label` só é permitido em elementos com role — sem ele, um
    // `<span>` puro ignora o nome acessível (axe `aria-prohibited-attr`). O conteúdo é só
    // o glifo de slots (decorativo); a leitura correta é o rótulo, como uma imagem.
    <span className="flex items-center gap-1" title={label} role="img" aria-label={label}>
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
  const dispatch = useGameStore((s) => s.dispatch)
  const { reduced } = useMotion()
  const view = useLocalView()
  // Assento local; sem sala, o dono da tela é o jogador da vez (cliente único).
  const myId = view.seatId ?? game.players[game.turnOrder[game.activeSeat]]?.id
  const cards = myId ? handCardsView(game, myId) : []

  const onUse = (id: string, needsTarget: boolean) => {
    if (needsTarget) useHandCardUI.getState().open(id)
    else dispatch({ kind: 'play-hand-card', cardId: id })
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
                {/* O acento local é a raridade: uma variável, e a classe resolve borda,
                    filete, selo e hover a partir dela (padrão `.trade-deed-item`). */}
                <article
                  className={cn('hand-card', c.playable ? 'hand-card--playable' : 'hand-card--locked')}
                  style={{ '--hand-card-accent': c.rarityColor } as React.CSSProperties}
                >
                  <div className="px-3 pt-3 pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="display text-starlight text-[15px] leading-tight flex-1 min-w-0 text-balance">{c.label}</span>
                      <span className="hand-card__rarity label text-nano shrink-0">{c.rarityLabel}</span>
                    </div>
                    <p className="text-starlight-muted text-xs leading-snug mt-1.5">{c.desc}</p>

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
                      <p title={c.reason} className="hand-card__reason text-[11px] leading-snug mt-2.5">
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
