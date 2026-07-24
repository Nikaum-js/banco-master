// Seletor de alvo ao usar uma carta de mão com alvo (029). Único ponto com efeito:
// dispara playHandCard(cardId, target?, targetPlayer?). Os alvos vêm de cardTargets
// (puro) — exatamente os que o motor aceita. Diplomacia é interceptada pelo motor.
import { type ReactNode } from 'react'
import { create } from 'zustand'
import { AnimatePresence } from 'motion/react'
import { useGameStore } from '@/game/store'
import { BOARD } from '@/lib/boardData'
import { cardById } from '@/game/cards/catalog'
import { ownerOf } from '@/game/economy/titles'
import { cardLabel } from './cardMeta'
import { cardTargets } from './handView'
import { Button } from '@/game/ui/primitives'
import { Overlay, ModalShell, ModalHeader } from '@/game/ui/shell'

// Store de UI efêmero: qual carta está escolhendo alvo (null = fechado).
export const useHandCardUI = create<{ cardId: string | null; open: (id: string) => void; close: () => void }>((set) => ({
  cardId: null,
  open: (id) => set({ cardId: id }),
  close: () => set({ cardId: null }),
}))

const propName = (pos: number) => BOARD[pos]?.name ?? `#${pos}`

function Backdrop({ children }: { children: ReactNode }) {
  return (
    <Overlay z={66} onClick={() => useHandCardUI.getState().close()}>
      {children}
    </Overlay>
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
          <ModalShell className="w-[360px] max-w-[92vw] max-h-[90vh] flex flex-col">
            <ModalHeader title={`Usar ${cardLabel(cardById(cardId).effect)}`} subtitle="Escolha o alvo" />

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
              <Button variant="secondary" onClick={close} className="w-full">
                Cancelar
              </Button>
            </div>
          </ModalShell>
        </Backdrop>
      ) : null}
    </AnimatePresence>
  )
}
