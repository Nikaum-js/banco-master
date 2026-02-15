// Casca única de modal do jogo — overlay, prancha Atlas e header integrado.
// Toda camada modal (ModalLayer, Trade, HandCard, LandAuction, Notice)
// usa este vocabulário; divergência de backdrop/raio/gradiente é bug.
//
// 044/T023 (US3/D4 do plan, D-039): é também o ÚNICO lugar que implementa acessibilidade
// de modal — role="dialog", aria-modal, aria-labelledby (ligado ao título do ModalHeader
// via contexto), foco inicial, trap de Tab e restauração de foco no desmonte. `dismissible`
// (default FALSE) decide se Esc/clique no backdrop fecham — o default fechado é o lado
// seguro: modal novo nasce sem deixar Esc virar comando de jogo por engano.
//
// O contexto/hook de título e o hook de trap/foco vivem em `a11y/dialog.ts`, não aqui — o
// lint de fast-refresh recusa um arquivo que mistura componente com contexto/hook solto.
import { useId, useRef, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { cn } from '@/lib/utils'
import { useMotion } from '@/game/ui/motion'
import { ModalTitleContext, useModalTitleId, useDialogA11y } from '@/game/ui/a11y/dialog'

// Overlay padrão: véu de tinta com VINHETA (centro mais claro, bordas mais
// fundas — foco no cartão) + blur leve, sempre o MESMO. Só o z-index varia
// (empilhamento entre camadas: modal 60 · trade 65 · carta 66 · notice 67 ·
// pregão 68).
export function Overlay({
  z = 60,
  onClick,
  className,
  children,
  dismissible = false,
  ariaLabel,
}: {
  z?: number
  onClick?: () => void
  className?: string
  children: ReactNode
  // 044/T023 (D4 do plan): governa Esc E clique no backdrop, sempre junto. Default FALSE —
  // o lado seguro. Só camadas informativas (NoticeLayer, popovers) marcam `true`; as que
  // decidem a partida (ModalLayer, TradeLayer, LandAuctionLayer, HandCardLayer) não marcam.
  dismissible?: boolean
  // Nome acessível pra Overlay sem ModalHeader (ex.: EndGameScreen). Com ModalHeader,
  // deixe de fora — o título dele já vira `aria-labelledby` via contexto.
  ariaLabel?: string
}) {
  const { fade } = useMotion() // freio de graça: quem usa Overlay não precisa lembrar disso
  const titleId = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  useDialogA11y(containerRef, { dismissible, onDismiss: onClick })

  return (
    <ModalTitleContext.Provider value={titleId}>
      <motion.div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabel ? undefined : titleId}
        tabIndex={-1}
        initial={fade.initial}
        animate={fade.animate}
        exit={fade.exit}
        onClick={() => {
          if (dismissible) onClick?.()
        }}
        style={{
          zIndex: z,
          background:
            'radial-gradient(120% 120% at 50% 40%, color-mix(in srgb, var(--color-coffee-950) 60%, transparent) 0%, color-mix(in srgb, var(--color-coffee-950) 90%, transparent) 100%)',
        }}
        className={cn('modal-overlay fixed inset-0 flex items-center justify-center backdrop-blur-[3px] p-4 outline-none', className)}
      >
        {children}
      </motion.div>
    </ModalTitleContext.Provider>
  )
}

// Cartão de modal — a mesma prancha cartográfica das telas de entrada:
// superfície azul contínua, dupla moldura e marcas de registro nos cantos.
// O latão aparece como fio, não como placa. A classe `atlas-surface` também
// atende cards de decisão e popovers sem transformar essas superfícies em
// modal nem alterar seus ciclos de vida.
//
// 044/T037 (FR-026): teto de altura + rolagem própria SÃO O PADRÃO daqui, não de cada
// modal — antes, três camadas (`LandAuctionLayer`, `TradeLayer`, `HandCardLayer`)
// repetiam `max-h-[…vh] overflow-auto` cada uma com seu próprio número, e o resto (o
// `ModalLayer` principal, `NoticeLayer`, `LobbyScreen`, `HomeScreen`, `FailureScreen`) não
// tinha proteção nenhuma — um card mais alto que a viewport mínima (740×360 em paisagem)
// cortava os botões do rodapé pra fora da tela, inalcançáveis. `max-h` calcula o mesmo
// espaço que o padding do `Overlay` (`p-4`) já reserva, então o cartão nunca encosta na
// borda; `overflow-auto` deixa o CARTÃO INTEIRO rolar (não some por baixo, rola por
// dentro) — os botões continuam alcançáveis descendo, mesmo sem espaço pra ficarem
// sempre visíveis. Uma camada que já declara seu próprio `max-h`/`overflow` (className)
// continua vencendo via `cn()`/tailwind-merge — nada muda pra quem já tinha o cuidado.
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
      className={cn(
        'atlas-surface atlas-surface--modal modal-shell max-h-[calc(100svh-2rem)] overflow-auto overscroll-contain',
        className,
      )}
    >
      {children}
    </motion.div>
  )
}

// Header de modal — título integrado à prancha com filete ornamental. `tone`
// troca somente o acento sem criar uma segunda linguagem de superfície.
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
  // 044/T023 (D4 do plan): título vira o `aria-labelledby` do diálogo — o id vem de quem
  // envolve este header (Overlay ou o DecisionShell do GameHUD), nunca inventado aqui.
  const titleId = useModalTitleId()
  const accent = bg ?? (tone === 'signal' ? 'var(--color-signal-glow)' : 'var(--color-brass)')
  return (
    <div
      data-tone={tone}
      className={cn(
        'modal-header relative px-5 pt-5 pb-3 shrink-0',
        center && 'text-center',
        onClose && 'px-14',
        className,
      )}
      style={{ '--modal-header-accent': accent } as React.CSSProperties}
    >
      <div className={cn('relative z-[1] flex items-center gap-2.5', center && 'justify-center')}>
        {icon && <div className="modal-header__icon shrink-0 w-10 h-10 flex items-center justify-center">{icon}</div>}
        <div className={cn('min-w-0', !center && 'flex-1')}>
          <h3 id={titleId ?? undefined} className="display text-xl leading-none text-starlight truncate">
            {title}
          </h3>
          {subtitle && (
            <p className="label mt-1 text-micro text-starlight-muted">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      <div className="modal-header__rule mt-3 flex items-center gap-2.5" aria-hidden="true">
        <span />
        <i />
        <span />
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          title="Fechar (a proposta continua na mesa)"
          className="modal-header__close absolute z-[2] right-2 top-2 w-11 h-11 grid place-items-center transition-colors"
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
