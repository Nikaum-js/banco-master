// Primitivos de apresentação dos painéis laterais — vocabulário único de seção
// (cabeçalho, chip de status, estado vazio) compartilhado por Pote, Cartas,
// Negociações e Efeitos. Só JSX + classes; nenhum estado de jogo entra aqui.
import { type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

// Botão canônico do jogo — quatro variantes com a MESMA régua de padding,
// fonte, hover e estado desabilitado. Toda superfície (HUD, modais, trade,
// leilões, deed) deriva daqui; divergência visual de botão é bug.
//   primary   → latão sólido, texto tinta (ação principal)
//   secondary → superfície de tinta com borda (ação neutra)
//   ghost     → contorno dourado leve (ação de baixo peso, ex. "nova proposta")
//   danger    → contorno signal que preenche no hover (destrutivo)
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

export function Button({
  variant = 'primary',
  className,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      type={type}
      className={cn(
        'px-3 py-2 rounded-[var(--radius-sharp)] font-bold text-sm leading-none',
        'inline-flex items-center justify-center gap-1.5 whitespace-nowrap',
        'transition-all active:translate-y-px disabled:opacity-40 disabled:cursor-not-allowed disabled:active:translate-y-0',
        variant === 'primary' &&
          'bg-gold text-coffee-950 hover:brightness-110 disabled:hover:brightness-100',
        variant === 'secondary' &&
          'bg-coffee-700 text-cream border border-coffee-500 hover:border-gold/60 hover:bg-coffee-600 disabled:hover:bg-coffee-700 disabled:hover:border-coffee-500',
        variant === 'ghost' &&
          'bg-gold/[0.06] text-gold border border-gold/40 hover:bg-gold/15 hover:border-gold/70 disabled:hover:bg-gold/[0.06]',
        variant === 'danger' &&
          'bg-transparent text-signal-glow border border-signal hover:bg-signal hover:text-cream disabled:hover:bg-transparent disabled:hover:text-signal-glow',
        className,
      )}
      {...props}
    />
  )
}

// Cabeçalho padrão de seção: título em .label dourado + meta opcional à direita
// (contador, chip, slots). Mesmo ritmo visual em todas as seções.
export function SectionHeader({ title, meta, className }: { title: string; meta?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-center justify-between gap-2 mb-3', className)}>
      <p className="label text-gold">{title}</p>
      {meta}
    </div>
  )
}

// Chip de status — pílula pequena com tom semântico (neutro / dourado / alerta).
export function Chip({
  tone = 'neutral',
  title,
  className,
  children,
}: {
  tone?: 'neutral' | 'gold' | 'alert'
  title?: string
  className?: string
  children: ReactNode
}) {
  return (
    <span
      title={title}
      className={cn(
        'label inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[var(--radius-pill)] border leading-none tabular-nums shrink-0',
        tone === 'neutral' && 'text-cream-muted border-coffee-500 bg-coffee-900',
        tone === 'gold' && 'text-gold border-gold/40 bg-gold/10',
        tone === 'alert' && 'text-logo border-logo/40 bg-logo/10',
        className,
      )}
    >
      {children}
    </span>
  )
}

// Estado vazio com caráter: glifo opcional + título + dica de como preencher.
export function EmptyState({ icon, title, hint, className }: { icon?: ReactNode; title: string; hint?: string; className?: string }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-1.5 px-3 py-5 rounded-[var(--radius-card)] border border-dashed border-coffee-500 bg-coffee-800/40 text-center',
        className,
      )}
    >
      {icon && (
        <span className="text-cream-muted/50" aria-hidden>
          {icon}
        </span>
      )}
      <p className="label text-cream-muted leading-snug">{title}</p>
      {hint && (
        <p className="text-cream-muted/70 leading-snug" style={{ fontSize: '10px' }}>
          {hint}
        </p>
      )}
    </div>
  )
}
