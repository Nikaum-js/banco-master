// Casca única de modal do jogo — overlay, cartão e header em gradiente do
// tema. Toda camada modal (ModalLayer, Trade, HandCard, LandAuction, Notice)
// usa este vocabulário; divergência de backdrop/raio/gradiente é bug.
import { type ReactNode } from 'react'
import { motion } from 'motion/react'
import { cn } from '@/lib/utils'

// Overlay padrão: véu de tinta + blur leve, sempre o MESMO. Só o z-index
// varia (empilhamento entre camadas: modal 60 · trade 65 · carta 66 ·
// notice 67 · pregão 68).
export function Overlay({
  z = 60,
  onClick,
  className,
  children,
}: {
  z?: number
  onClick?: () => void
  className?: string
  children: ReactNode
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onClick={onClick}
      style={{ zIndex: z }}
      className={cn(
        'fixed inset-0 flex items-center justify-center bg-coffee-950/70 backdrop-blur-[2px] p-4',
        className,
      )}
    >
      {children}
    </motion.div>
  )
}

// Cartão de modal — raio modal, borda coffee, sombra dropdown, entrada com
// spring e clique interno protegido (não fecha pelo backdrop).
export function ModalShell({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.93, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.93, y: 8 }}
      transition={{ type: 'spring', stiffness: 360, damping: 28 }}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        'bg-coffee-800 border-2 border-coffee-500 rounded-[var(--radius-modal)] shadow-[var(--shadow-dropdown)] overflow-hidden',
        className,
      )}
    >
      {children}
    </motion.div>
  )
}

// Header de modal — faixa em gradiente do tema: brass (padrão), signal
// (perigo/multa) ou um `bg` custom (stripe de grupo/raridade). Texto escuro
// sobre latão, claro sobre signal/custom escuro.
export function ModalHeader({
  tone = 'brass',
  bg,
  icon,
  title,
  subtitle,
  center = false,
  className,
}: {
  tone?: 'brass' | 'signal'
  bg?: string
  icon?: ReactNode
  title: string
  subtitle?: string
  center?: boolean
  className?: string
}) {
  const background = bg ?? (tone === 'signal' ? 'var(--gradient-signal)' : 'var(--gradient-brass)')
  const dark = tone !== 'signal' // texto tinta sobre latão/stripes; claro sobre signal
  return (
    <div
      className={cn('relative px-4 py-3 border-b-2 border-coffee-950 shrink-0', center && 'text-center', className)}
      style={{ background }}
    >
      <div className={cn('flex items-center gap-2.5', center && 'justify-center')}>
        {icon && <div className="shrink-0 w-9 h-9 flex items-center justify-center">{icon}</div>}
        <div className={cn('min-w-0', !center && 'flex-1')}>
          <h3 className={cn('display text-lg leading-none truncate', dark ? 'text-coffee-950' : 'text-cream')}>
            {title}
          </h3>
          {subtitle && (
            <p className={cn('label mt-0.5 text-micro', dark ? 'text-coffee-950/80' : 'text-cream/85')}>
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
