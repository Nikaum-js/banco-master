// Casca única de modal do jogo — overlay, cartão e header em gradiente do
// tema. Toda camada modal (ModalLayer, Trade, HandCard, LandAuction, Notice)
// usa este vocabulário; divergência de backdrop/raio/gradiente é bug.
import { type ReactNode } from 'react'
import { motion } from 'motion/react'
import { cn } from '@/lib/utils'
import { useMotion } from '@/game/ui/motion'

// Overlay padrão: véu de tinta com VINHETA (centro mais claro, bordas mais
// fundas — foco no cartão) + blur leve, sempre o MESMO. Só o z-index varia
// (empilhamento entre camadas: modal 60 · trade 65 · carta 66 · notice 67 ·
// pregão 68).
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
  const { fade } = useMotion() // freio de graça: quem usa Overlay não precisa lembrar disso
  return (
    <motion.div
      initial={fade.initial}
      animate={fade.animate}
      exit={fade.exit}
      onClick={onClick}
      style={{
        zIndex: z,
        background:
          'radial-gradient(120% 120% at 50% 40%, color-mix(in srgb, var(--color-coffee-950) 60%, transparent) 0%, color-mix(in srgb, var(--color-coffee-950) 90%, transparent) 100%)',
      }}
      className={cn('fixed inset-0 flex items-center justify-center backdrop-blur-[3px] p-4', className)}
    >
      {children}
    </motion.div>
  )
}

// Cartão de modal — superfície com PROFUNDIDADE em vez de cor chapada: brilho
// quente de latão descendo do header, vinheta escura no rodapé e bisel dourado
// na borda superior (luz de castiçal). Raio modal, borda coffee, sombra
// dropdown, entrada com spring e clique interno protegido (não fecha pelo
// backdrop). Tema-aware: tudo via var(--color-*).
export function ModalShell({ className, children }: { className?: string; children: ReactNode }) {
  // A entrada é um SPRING, não um dos três tokens (D7 do plan: divergiu de propósito da
  // tabela — é a "personalidade" do cartão de modal, preservada como exceção documentada,
  // igual à do fim de jogo). O freio de `prefers-reduced-motion` não mexe na curva: some
  // com `initial={false}`, então a entrada vira aparecer direto, sem o spring rodar.
  const { reduced } = useMotion()
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, scale: 0.93, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.93, y: 8 }}
      transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 360, damping: 28 }}
      onClick={(e) => e.stopPropagation()}
      style={{
        background: [
          'radial-gradient(90% 55% at 50% 0%, color-mix(in srgb, var(--color-brass) 10%, transparent) 0%, transparent 60%)',
          'radial-gradient(130% 55% at 50% 118%, color-mix(in srgb, var(--color-coffee-950) 80%, transparent) 0%, transparent 60%)',
          'linear-gradient(180deg, var(--color-coffee-800) 0%, var(--color-coffee-900) 100%)',
        ].join(', '),
        boxShadow:
          'inset 0 1px 0 0 color-mix(in srgb, var(--color-brass-glow) 22%, transparent), var(--shadow-dropdown)',
      }}
      className={cn('border-2 border-coffee-500 rounded-[var(--radius-modal)] overflow-hidden', className)}
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
  onClose,
  className,
}: {
  tone?: 'brass' | 'signal'
  bg?: string
  icon?: ReactNode
  title: string
  subtitle?: string
  center?: boolean
  onClose?: () => void // fecha SEM decidir (ex.: proposta recebida — responder depois)
  className?: string
}) {
  // Shine (não chapado): topo quase branco descendo pro tom cheio — placa de
  // latão polido. Bisel: luz na aresta de cima, sombra na de baixo.
  const background = bg ?? (tone === 'signal' ? 'var(--gradient-signal-shine)' : 'var(--gradient-brass-shine)')
  const dark = tone !== 'signal' // texto tinta sobre latão/stripes; claro sobre signal
  return (
    <div
      className={cn('relative px-4 py-3 border-b-2 border-coffee-950 shrink-0', center && 'text-center', className)}
      style={{
        background,
        boxShadow:
          'inset 0 1px 0 0 color-mix(in srgb, white 32%, transparent), inset 0 -2px 0 0 color-mix(in srgb, var(--color-ink-950) 22%, transparent)',
      }}
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
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          title="Fechar (a proposta continua na mesa)"
          className={cn(
            'absolute right-2.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full grid place-items-center transition-colors',
            dark
              ? 'text-coffee-950/70 hover:text-coffee-950 hover:bg-coffee-950/15'
              : 'text-cream/70 hover:text-cream hover:bg-coffee-950/25',
          )}
        >
          <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" aria-hidden>
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      )}
    </div>
  )
}
