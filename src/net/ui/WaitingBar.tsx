// "Aguardando <nome>" (spec 038, FR-003). O que aparece no lugar dos controles quando a
// decisão em aberto é de OUTRA pessoa.
//
// Decisão de design (research D4): a informação continua visível — some o controle, não o
// contexto. Esconder o que está acontecendo transformaria o turno alheio em tela morta e
// mataria a tensão do leilão e da negociação, que é metade da graça de jogar junto.
import { motion } from 'motion/react'
import { PlayerName } from './PlayerName'

export function WaitingBar({ playerId, what }: { playerId: string; what: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.18 }}
      className="fixed left-1/2 -translate-x-1/2 bottom-6 z-[62] px-4 py-2.5 rounded-[var(--radius-pill)] border border-coffee-500 bg-coffee-900/95 shadow-[var(--shadow-dropdown)] backdrop-blur-sm"
      role="status"
      aria-live="polite"
    >
      <span className="label text-cream-muted inline-flex items-center gap-2 whitespace-nowrap">
        <Spinner />
        Aguardando <PlayerName playerId={playerId} dot className="text-cream" /> · {what}
      </span>
    </motion.div>
  )
}

// Marcador de "algo está acontecendo" sem contagem regressiva — pressão de tempo é
// deliberadamente ausente (D-015 / princípio VII).
function Spinner() {
  return (
    <motion.span
      className="w-3 h-3 rounded-full border-2 border-gold/30 border-t-gold shrink-0"
      animate={{ rotate: 360 }}
      transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }}
      aria-hidden
    />
  )
}
