// Aviso de comando MEU recusado por FALHA (spec 042, FR-020/022, US5). Alimentado só pelo
// `roomStore.commandFailure` — nunca lê `GameState`. Distinto de recusa por REGRA (comando
// inválido), que continua silenciosa por decisão desta spec — só a falha precisa de sinal
// visível, porque só ela é surpresa: regra o jogador já devia esperar.
import { AnimatePresence, motion } from 'motion/react'
import { useRoomStore } from '@/net/roomStore'

export function CommandFailureToast() {
  const failure = useRoomStore((s) => s.commandFailure)

  return (
    <AnimatePresence>
      {failure && (
        <motion.div
          key="command-failure-toast"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          className="fixed bottom-4 right-4 z-[76] px-4 py-2.5 rounded-[var(--radius-card)] border-2 border-red-500/50 bg-coffee-900/97 shadow-[var(--shadow-dropdown)] backdrop-blur-sm max-w-[92vw]"
          role="status"
          aria-live="polite"
        >
          <p className="label text-red-300 leading-none">Sua ação não foi aplicada</p>
          <p className="text-cream-muted/70 mt-1" style={{ fontSize: 10 }}>Ocorrência: {failure.occurrenceId}</p>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
