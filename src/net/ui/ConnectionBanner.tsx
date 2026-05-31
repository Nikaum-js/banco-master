// Aviso de DESCONEXÃO PRÓPRIA (041, FR-006/009 — D13 do plan). Alimentado só pelo
// `roomStore.connection` — NUNCA lê `GameState`. É um fato diferente do `PauseBanner`: "a
// mesa está parada" (todos veem, vem do jogo) vs. "eu não estou na mesa" (só eu vejo, vem da
// casca de rede) — quem caiu não recebe o `GameState` que diria que a mesa está pausada.
//
// Deliberadamente SEM contagem regressiva e SEM ação destrutiva (FR-009): não há timeout de
// desconexão, a espera é indefinida por princípio.
import { AnimatePresence, motion } from 'motion/react'
import { useRoomStore } from '@/net/roomStore'
import { connectionBannerView } from './connectionBannerView'
import { useMotion } from '@/game/ui/motion'

export function ConnectionBanner() {
  const connection = useRoomStore((s) => s.connection)
  const view = connectionBannerView(connection)
  const { reduced } = useMotion()

  return (
    <AnimatePresence>
      {view && (
        <motion.div
          key="connection-banner"
          initial={reduced ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, y: 16 }}
          transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 320, damping: 28 }}
          className="system-banner system-banner--signal fixed bottom-4 left-1/2 -translate-x-1/2 z-[76] max-w-[92vw]"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-3">
            <ConnectionGlyph reduced={reduced} />
            <div className="min-w-0">
              <p className="display text-red-300 leading-none">{view.title}</p>
              <p className="label text-cream-muted mt-1.5 leading-snug">{view.detail}</p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function ConnectionGlyph({ reduced }: { reduced: boolean }) {
  return (
    <motion.span
      className="system-banner__glyph shrink-0"
      animate={reduced ? undefined : { opacity: [1, 0.55, 1] }}
      transition={reduced ? undefined : { duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
      aria-hidden
    >
      <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor" className="text-red-300">
        <path d="M12 2 1 21h22L12 2zm0 6 7.5 13h-15L12 8zm-1 4v4h2v-4h-2zm0 6v2h2v-2h-2z" />
      </svg>
    </motion.span>
  )
}
