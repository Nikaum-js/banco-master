// Primitivos de apresentação dos painéis laterais — vocabulário único de seção
// (cabeçalho, chip de status, estado vazio) compartilhado por Pote, Cartas,
// Negociações e Efeitos. Só JSX + classes; nenhum estado de jogo entra aqui.
import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'

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
