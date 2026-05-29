// Aviso de comando MEU recusado por FALHA (spec 042, FR-020/022, US5). Alimentado só pelo
// `roomStore.commandFailure` — nunca lê `GameState`. Distinto de recusa por REGRA (comando
// inválido), que continua silenciosa por decisão desta spec — só a falha precisa de sinal
// visível, porque só ela é surpresa: regra o jogador já devia esperar.
import { AnimatePresence, motion } from 'motion/react'
import { useRoomStore } from '@/net/roomStore'
import { useMotion } from '@/game/ui/motion'

export function CommandFailureToast() {
  const failure = useRoomStore((s) => s.commandFailure)
  const { reduced } = useMotion()

  return (
    <AnimatePresence>
      {failure && (
        <motion.div
          key="command-failure-toast"
          initial={reduced ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, y: 16 }}
          transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 320, damping: 28 }}
          className="system-banner system-banner--signal fixed bottom-4 right-4 z-[76] max-w-[92vw]"
          role="status"
          aria-live="polite"
        >
          <p className="label text-red-300 leading-none">Sua ação não foi aplicada</p>
          <p className="text-cream-muted/85 mt-1" style={{ fontSize: 10 }}>Ocorrência: {failure.occurrenceId}</p>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
