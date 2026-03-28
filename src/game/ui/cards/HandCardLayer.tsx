// Seletor de alvo ao usar uma carta de mão com alvo (029). Único ponto com efeito:
// dispara playHandCard(cardId, target?, targetPlayer?). Os alvos vêm de cardTargets
// (puro) — exatamente os que o motor aceita. Diplomacia é interceptada pelo motor.
import { type ReactNode } from 'react'
import { create } from 'zustand'
import { motion, AnimatePresence } from 'motion/react'
import { useGameStore } from '@/game/store'
import { BOARD } from '@/lib/boardData'
import { cardById } from '@/game/cards/catalog'
import { ownerOf } from '@/game/economy/titles'
import { cardLabel } from './cardMeta'
import { cardTargets } from './handView'

// Store de UI efêmero: qual carta está escolhendo alvo (null = fechado).
export const useHandCardUI = create<{ cardId: string | null; open: (id: string) => void; close: () => void }>((set) => ({
  cardId: null,
  open: (id) => set({ cardId: id }),
  close: () => set({ cardId: null }),
}))

const propName = (pos: number) => BOARD[pos]?.name ?? `#${pos}`

function Backdrop({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onClick={() => useHandCardUI.getState().close()}
      className="fixed inset-0 z-[66] flex items-center justify-center bg-coffee-950/70 backdrop-blur-[2px] p-4"
    >
      {children}
    </motion.div>
  )
}

function TargetBtn({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 w-full px-3 py-2 rounded-[var(--radius-sharp)] text-left text-sm bg-coffee-900 border border-coffee-500 text-cream hover:border-gold hover:bg-coffee-700 transition-colors"
    >
      {children}
    </button>
  )
}

export function HandCardLayer() {
  const cardId = useHandCardUI((s) => s.cardId)
  const close = useHandCardUI((s) => s.close)
  const game = useGameStore((s) => s.game)
  const playHandCard = useGameStore((s) => s.playHandCard)
  const activeId = game.players[game.turnOrder[game.activeSeat]]?.id

  const targets = cardId && activeId ? cardTargets(game, activeId, cardId) : null
  const play = (target?: number, targetPlayer?: string) => {
    if (cardId) playHandCard(cardId, target, targetPlayer)
    close()
  }

  return (
    <AnimatePresence>
      {cardId && targets ? (
        <Backdrop key="hand-target">
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 8 }}
            transition={{ type: 'spring', stiffness: 360, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-coffee-800 border-2 border-coffee-500 rounded-[var(--radius-card)] shadow-[var(--shadow-dropdown)] w-[360px] max-w-[92vw] max-h-[90vh] flex flex-col overflow-hidden"
          >
            <div className="px-4 py-3 border-b-2 border-coffee-950 bg-[linear-gradient(180deg,#d4af37_0%,#b8941f_100%)] shrink-0">
              <h3 className="display text-coffee-950 text-lg leading-none">Usar {cardLabel(cardById(cardId).effect)}</h3>
              <p className="label text-coffee-950/80 mt-0.5" style={{ fontSize: '9px' }}>Escolha o alvo</p>
            </div>

            <div className="flex-1 overflow-auto p-3 flex flex-col gap-1.5">
              {(targets.positions ?? []).map((pos) => {
                const owner = ownerOf(game, pos)
                return (
                  <TargetBtn key={`p${pos}`} onClick={() => play(pos)}>
                    <span className="flex-1 min-w-0 truncate">{propName(pos)}</span>
                    {owner && owner !== activeId && <span className="text-cream-muted text-xs shrink-0">de {owner}</span>}
                  </TargetBtn>
                )
              })}
              {(targets.players ?? []).map((pid) => (
                <TargetBtn key={`j${pid}`} onClick={() => play(undefined, pid)}>
                  <span className="flex-1 min-w-0 truncate">{pid}</span>
                </TargetBtn>
              ))}
            </div>

            <div className="px-4 py-3 border-t-2 border-coffee-950 shrink-0">
              <button
                type="button"
                onClick={close}
                className="w-full px-3 py-2 rounded-[var(--radius-sharp)] bg-coffee-700 text-cream border border-coffee-500 hover:bg-coffee-600 font-bold text-sm transition-colors"
              >
                Cancelar
              </button>
            </div>
          </motion.div>
        </Backdrop>
      ) : null}
    </AnimatePresence>
  )
}
