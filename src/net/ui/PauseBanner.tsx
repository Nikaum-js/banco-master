// Pausa visível (spec 038, US3 — FR-013/017/019). A mecânica já existia na 037; o que
// faltava era comunicar. Sem esta superfície, uma pausa é indistinguível de um travamento,
// e o princípio VII (resiliência) vira promessa invisível.
//
// Deliberadamente SEM contagem regressiva e SEM ação destrutiva: não há timeout de
// desconexão (§11.3, D-015) e a partida espera o tempo que for.
import { AnimatePresence, motion } from 'motion/react'
import { useGameStore } from '@/game/store'
import { useRoomStore } from '@/net/roomStore'
import { pauseBannerView } from './pauseBannerView'
import { PlayerName } from './PlayerName'
import { useMotion } from '@/game/ui/motion'

export function PauseBanner() {
  const game = useGameStore((s) => s.game)
  const room = useRoomStore((s) => s.room)
  const view = pauseBannerView(game, room)
  const { reduced } = useMotion()

  return (
    <AnimatePresence>
      {view && (
        <motion.div
          key="pause-banner"
          initial={reduced ? false : { opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, y: -16 }}
          transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 320, damping: 28 }}
          className="system-banner system-banner--brass fixed top-4 left-1/2 -translate-x-1/2 z-[75] max-w-[92vw]"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-3">
            <PauseGlyph reduced={reduced} />
            <div className="min-w-0">
              <p className="display text-gold leading-none">Partida pausada</p>
              <p className="label text-cream-muted mt-1.5 leading-snug">
                Aguardando{' '}
                {view.ausentes.map((s, i) => (
                  <span key={s.uid}>
                    {i > 0 && (i === view.ausentes.length - 1 ? ' e ' : ', ')}
                    <PlayerName playerId={s.playerId} dot className="text-cream" />
                    {i === view.ausentes.length - 1 && ' '}
                  </span>
                ))}
                {view.tail}.{view.hostFora && ' Não há transferência de comando.'}
              </p>
              <p className="text-cream-muted/85 mt-1" style={{ fontSize: 10 }}>
                Nada se perde: saldo, propriedades, cartas e prazos ficam exatamente como estão.
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function PauseGlyph({ reduced }: { reduced: boolean }) {
  return (
    <motion.span
      className="system-banner__glyph shrink-0"
      animate={reduced ? undefined : { opacity: [1, 0.55, 1] }}
      transition={reduced ? undefined : { duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
      aria-hidden
    >
      <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor" className="text-gold">
        <rect x="6" y="4" width="4" height="16" rx="1" />
        <rect x="14" y="4" width="4" height="16" rx="1" />
      </svg>
    </motion.span>
  )
}
