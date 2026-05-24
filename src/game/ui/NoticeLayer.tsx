// Notificações informativas (030, §12.2) — exibe o evento autônomo `game.notice`
// (Free Parking coletado / Aquisição Hostil sofrida) e o dispensa. Único efeito:
// dispara dismissNotice. Não bloqueia o turno.
import { motion, AnimatePresence } from 'motion/react'
import { useGameStore } from '@/game/store'
import { BOARD } from '@/lib/boardData'

const propName = (pos: number) => BOARD[pos]?.name ?? `#${pos}`

export function NoticeLayer() {
  const notice = useGameStore((s) => s.game.notice)
  const dismissNotice = useGameStore((s) => s.dismissNotice)

  const view = !notice
    ? null
    : notice.kind === 'free-parking'
      ? { tone: 'gold' as const, title: 'Free Parking!', body: `🎉 ${notice.playerId} coletou R$ ${notice.amount.toLocaleString('pt-BR')} do pote.` }
      : { tone: 'logo' as const, title: 'Aquisição Hostil', body: `⚠️ ${notice.victimId} perdeu ${propName(notice.pos)} para ${notice.attackerId}.` }

  return (
    <AnimatePresence>
      {view ? (
        <motion.div
          key="notice"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={() => dismissNotice()}
          className="fixed inset-0 z-[67] flex items-center justify-center bg-coffee-950/70 backdrop-blur-[2px] p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 8 }}
            transition={{ type: 'spring', stiffness: 360, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-coffee-800 border-2 border-coffee-500 rounded-[var(--radius-card)] shadow-[var(--shadow-dropdown)] w-[360px] max-w-[92vw] overflow-hidden"
          >
            <div
              className="px-4 py-3 border-b-2 border-coffee-950"
              style={{ background: view.tone === 'gold' ? 'linear-gradient(180deg,#d4af37 0%,#b8941f 100%)' : 'linear-gradient(180deg,#c0392b 0%,#922b21 100%)' }}
            >
              <h3 className="display text-lg leading-none" style={{ color: view.tone === 'gold' ? '#1a120b' : '#fff' }}>{view.title}</h3>
            </div>
            <div className="p-4">
              <p className="text-cream text-sm leading-snug">{view.body}</p>
              <button
                type="button"
                onClick={() => dismissNotice()}
                className="mt-4 w-full px-3 py-2 rounded-[var(--radius-sharp)] bg-gold text-coffee-900 font-bold text-sm hover:brightness-110 active:translate-y-px transition-all"
              >
                OK
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
