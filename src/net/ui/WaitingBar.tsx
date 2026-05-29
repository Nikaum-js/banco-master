// "Aguardando <nome>" (spec 038, FR-003). O que aparece no lugar dos controles quando a
// decisão em aberto é de OUTRA pessoa.
//
// Decisão de design (research D4): a informação continua visível — some o controle, não o
// contexto. Esconder o que está acontecendo transformaria o turno alheio em tela morta e
// mataria a tensão do leilão e da negociação, que é metade da graça de jogar junto.
import { motion } from 'motion/react'
import { PlayerName } from './PlayerName'
import { useMotion } from '@/game/ui/motion'

export function WaitingBar({ playerId, what }: { playerId: string; what: string }) {
  const { reduced } = useMotion()
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
      transition={{ duration: reduced ? 0 : 0.18 }}
      className="system-banner system-banner--neutral fixed left-1/2 -translate-x-1/2 bottom-6 z-[62] rounded-[var(--radius-pill)]"
      role="status"
      aria-live="polite"
    >
      <span className="label text-cream-muted inline-flex items-center gap-2 whitespace-nowrap">
        <Spinner reduced={reduced} />
        Aguardando <PlayerName playerId={playerId} dot className="text-cream" /> · {what}
      </span>
    </motion.div>
  )
}

// Marcador de "algo está acontecendo" sem contagem regressiva — pressão de tempo é
// deliberadamente ausente (D-015 / princípio VII).
function Spinner({ reduced }: { reduced: boolean }) {
  return (
    <motion.span
      className="w-3 h-3 rounded-full border-2 border-gold/30 border-t-gold shrink-0"
      animate={reduced ? undefined : { rotate: 360 }}
      transition={reduced ? undefined : { duration: 1.1, repeat: Infinity, ease: 'linear' }}
      aria-hidden
    />
  )
}
