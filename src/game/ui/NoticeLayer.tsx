// Notificações informativas (030, §12.2). Loteria (ex-"Free Parking") = celebração
// com confete (sem modal); Aquisição Hostil sofrida = modal. Dispensa por clique
// (a loteria também some sozinha após alguns segundos). Não bloqueia o turno.
//
// 044/T024 (US3/D-039): as duas são INFORMATIVAS — nenhuma decide a partida, então Esc
// fecha as duas (`dismissible`). A loteria não passa pelo `Overlay` (backdrop custom,
// sem ModalShell), então chama `useDialogA11y` direto pra ganhar o mesmo trap/Esc/
// restauração de foco sem duplicar a lógica.
import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useGameStore } from '@/game/store'
import { Button } from '@/game/ui/primitives'
import { Overlay, ModalShell, ModalHeader } from '@/game/ui/shell'
import { useDialogA11y } from '@/game/ui/a11y/dialog'
import { useMotion, MOTION } from '@/game/ui/motion'
import { money } from '@/lib/money'
import { activeBoard } from '@/game/ui/theme/boardTheme'

const propName = (pos: number) => activeBoard()[pos]?.name ?? `#${pos}`

const CONFETTI_COLORS = [
  'var(--color-group-orange)',
  'var(--color-group-navy)',
  'var(--color-group-green)',
  'var(--color-brass)',
  'var(--color-signal)',
  'var(--color-starlight)',
]

// Layout do confete sorteado UMA vez, no import — não em render. O sorteio em `useMemo`
// era impuro durante o render (o compilador pode reexecutar a memo), e a aleatoriedade
// aqui é só decorativa: a mesma chuva serve para todas as celebrações da sessão.
const CONFETTI_PIECES = Array.from({ length: 130 }, (_, i) => ({
  id: i,
  left: Math.random() * 100,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  delay: Math.random() * 2.2,
  duration: 2.4 + Math.random() * 2,
  w: 6 + Math.random() * 6,
  rot: Math.random() * 360,
  drift: (Math.random() - 0.5) * 90,
}))

// Confete caindo do topo — peças coloridas com posição/rotação/tempo aleatórios.
// Exportado: reusado na celebração do vencedor (GameHUD, fim de jogo).
// Sob movimento reduzido, o confete SOME (D7 do plan, exemplo literal do freio): é
// decoração, não o fato — quem ganhou e quanto continuam na tela sem ele.
export function Confetti() {
  const { reduced } = useMotion()
  if (reduced) return null
  const pieces = CONFETTI_PIECES
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {pieces.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-[var(--radius-sharp)]"
          style={{ left: `${p.left}%`, top: -24, width: p.w, height: p.w * 0.6, background: p.color }}
          initial={{ y: 0, x: 0, opacity: 0, rotate: p.rot }}
          animate={{ y: '106vh', x: p.drift, opacity: [0, 1, 1, 0.7], rotate: p.rot + 540 }}
          transition={{ duration: p.duration, delay: p.delay, repeat: Infinity, ease: 'linear' }}
        />
      ))}
    </div>
  )
}

export function NoticeLayer() {
  const notice = useGameStore((s) => s.game.notice)
  const dispatch = useGameStore((s) => s.dispatch)
  const dismissNotice = (): void => dispatch({ kind: 'dismiss-notice' })
  const { reduced } = useMotion()
  const lotteryRef = useRef<HTMLDivElement>(null)
  useDialogA11y(lotteryRef, { active: notice?.kind === 'free-parking', dismissible: true, onDismiss: dismissNotice })

  // A loteria some sozinha depois de alguns segundos (além do clique).
  useEffect(() => {
    if (notice?.kind !== 'free-parking') return
    const t = setTimeout(() => dispatch({ kind: 'dismiss-notice' }), 5200)
    return () => clearTimeout(t)
    // `dispatch` é referência estável do store; `dismissNotice` seria recriada a cada
    // render e reiniciaria o timer sem parar.
  }, [notice, dispatch])

  return (
    <AnimatePresence>
      {notice?.kind === 'free-parking' && (
        <motion.div
          key="lottery"
          ref={lotteryRef}
          role="dialog"
          aria-modal="true"
          aria-label="Prêmio da loteria"
          tabIndex={-1}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: MOTION.base }}
          onClick={() => dismissNotice()}
          className="fixed inset-0 z-[67] flex items-center justify-center overflow-hidden bg-coffee-950/55 backdrop-blur-[1px] cursor-pointer outline-none"
        >
          <Confetti />
          <motion.div
            initial={reduced ? false : { scale: 0.8, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 300, damping: 18 }}
            className="atlas-surface atlas-surface--modal lottery-card relative w-[32rem] max-w-[92vw] px-8 py-8 text-center select-none"
          >
            <p className="display text-cream leading-tight tracking-wide" style={{ fontSize: '36px', textShadow: '0 3px 14px rgba(0,0,0,0.6)' }}>
              <span className="text-gold-glow">{notice.playerId}</span> ganhou na loteria!
            </p>
            <motion.p
              initial={reduced ? false : { scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 11, delay: 0.18 }}
              className="currency leading-none mt-3"
              style={{
                fontSize: '68px',
                backgroundImage: 'var(--gradient-brass-shine)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
                filter: 'drop-shadow(0 3px 12px color-mix(in srgb, var(--color-brass) 60%, transparent))',
              }}
            >
              {money(notice.amount)}
            </motion.p>
            <p className="label text-cream-muted mt-6">clique para continuar</p>
          </motion.div>
        </motion.div>
      )}

      {notice?.kind === 'hostile-takeover' && (
        <Overlay key="takeover" z={67} onClick={() => dismissNotice()} dismissible>
          <ModalShell className="w-[360px] max-w-[92vw]">
            <ModalHeader tone="signal" title="Aquisição Hostil" />
            <div className="p-4">
              <p className="text-cream text-sm leading-snug">{notice.victimId} perdeu {propName(notice.pos)} para {notice.attackerId}.</p>
              <Button onClick={() => dismissNotice()} className="mt-4 w-full">
                OK
              </Button>
            </div>
          </ModalShell>
        </Overlay>
      )}
    </AnimatePresence>
  )
}
