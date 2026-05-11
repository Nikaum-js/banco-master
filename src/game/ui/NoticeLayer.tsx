// Notificações informativas (030, §12.2). Loteria (ex-"Free Parking") = celebração
// com confete (sem modal); Aquisição Hostil sofrida = modal. Dispensa por clique
// (a loteria também some sozinha após alguns segundos). Não bloqueia o turno.
import { useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useGameStore } from '@/game/store'
import { BOARD } from '@/lib/boardData'

const propName = (pos: number) => BOARD[pos]?.name ?? `#${pos}`

const CONFETTI_COLORS = ['#fb923c', '#3b82f6', '#22c55e', '#d4af37', '#e74c3c', '#f4e8d0']

// Confete caindo do topo — peças coloridas com posição/rotação/tempo aleatórios.
function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 130 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        delay: Math.random() * 2.2,
        duration: 2.4 + Math.random() * 2,
        w: 6 + Math.random() * 6,
        rot: Math.random() * 360,
        drift: (Math.random() - 0.5) * 90,
      })),
    [],
  )
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {pieces.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-[1px]"
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
  const dismissNotice = useGameStore((s) => s.dismissNotice)

  // A loteria some sozinha depois de alguns segundos (além do clique).
  useEffect(() => {
    if (notice?.kind !== 'free-parking') return
    const t = setTimeout(() => dismissNotice(), 5200)
    return () => clearTimeout(t)
  }, [notice, dismissNotice])

  return (
    <AnimatePresence>
      {notice?.kind === 'free-parking' && (
        <motion.div
          key="lottery"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={() => dismissNotice()}
          className="fixed inset-0 z-[67] flex items-center justify-center overflow-hidden bg-coffee-950/55 backdrop-blur-[1px] cursor-pointer"
        >
          <Confetti />
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 18 }}
            className="relative text-center px-6 select-none"
          >
            <p className="display text-cream leading-tight tracking-wide" style={{ fontSize: '36px', textShadow: '0 3px 14px rgba(0,0,0,0.6)' }}>
              <span className="text-gold-glow">{notice.playerId}</span> ganhou na loteria!
            </p>
            <motion.p
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 11, delay: 0.18 }}
              className="currency leading-none mt-3"
              style={{
                fontSize: '68px',
                backgroundImage: 'linear-gradient(180deg, #fff1c2 0%, #f4d160 42%, #d4af37 70%, #b8941f 100%)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
                filter: 'drop-shadow(0 3px 12px rgba(212,175,55,0.6))',
              }}
            >
              R$ {notice.amount.toLocaleString('pt-BR')}
            </motion.p>
            <p className="label text-cream-muted mt-6">clique para continuar</p>
          </motion.div>
        </motion.div>
      )}

      {notice?.kind === 'hostile-takeover' && (
        <motion.div
          key="takeover"
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
            <div className="px-4 py-3 border-b-2 border-coffee-950" style={{ background: 'linear-gradient(180deg,#c0392b 0%,#922b21 100%)' }}>
              <h3 className="display text-lg leading-none text-cream">Aquisição Hostil</h3>
            </div>
            <div className="p-4">
              <p className="text-cream text-sm leading-snug">{notice.victimId} perdeu {propName(notice.pos)} para {notice.attackerId}.</p>
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
      )}
    </AnimatePresence>
  )
}
