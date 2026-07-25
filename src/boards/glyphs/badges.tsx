// SELOS E ÍCONES MIÚDOS — card 7 do review de arquitetura (2026-07-25).
//
// Arte pura: distintivos de construção (casa/hotel/arranha-céu/hangar), o glifo de "sem
// efeitos" e os ícones da linha de troca. Nenhum conhece store nem regra — quem decide
// QUANDO cada um aparece é `shared.tsx`.

// Casa (flat) — silhueta limpa: corpo cream, telhado dourado, porta coffee.
// Legível a ~13px; várias enfileiram pra contar de relance.
export function HouseBadgeIcon() {
  return (
    <svg viewBox="0 0 14 13" width="11" height="10" aria-hidden="true">
      <rect x="2.3" y="6" width="9.4" height="6.2" fill="var(--color-starlight)" stroke="var(--color-ink-950)" strokeWidth="1" strokeLinejoin="round" />
      <path d="M1 6.5 L7 1.4 L13 6.5 Z" fill="var(--color-brass)" stroke="var(--color-ink-950)" strokeWidth="1" strokeLinejoin="round" />
      <rect x="5.7" y="8.4" width="2.6" height="3.8" fill="var(--color-ink-400)" stroke="var(--color-ink-950)" strokeWidth="0.6" />
    </svg>
  )
}

// Hotel (flat) — bloco largo dourado com marquise cream, janelas escuras e
// porta em arco. Mais largo/baixo que o arranha-céu (distinção por silhueta).
export function HotelBadgeIcon() {
  return (
    <svg viewBox="0 0 20 16" width="22" height="18" aria-hidden="true">
      {/* marquise cream no topo */}
      <rect x="0.8" y="1.4" width="18.4" height="2.4" fill="var(--color-starlight)" stroke="var(--color-ink-950)" strokeWidth="1" strokeLinejoin="round" />
      {/* corpo dourado */}
      <rect x="2.2" y="3.8" width="15.6" height="11.4" fill="var(--color-brass)" stroke="var(--color-ink-950)" strokeWidth="1" strokeLinejoin="round" />
      {/* janelas escuras */}
      <g fill="var(--color-ink-900)">
        <rect x="4" y="5.6" width="2.4" height="2.4" />
        <rect x="8.8" y="5.6" width="2.4" height="2.4" />
        <rect x="13.6" y="5.6" width="2.4" height="2.4" />
        <rect x="4" y="9.2" width="2.4" height="2.4" />
        <rect x="13.6" y="9.2" width="2.4" height="2.4" />
      </g>
      {/* porta em arco */}
      <path d="M8 15.2 V12.4 Q10 10.8 12 12.4 V15.2 Z" fill="var(--color-ink-900)" stroke="var(--color-ink-950)" strokeWidth="0.6" />
    </svg>
  )
}

// Skyscraper (flat) — torre dourada estreita e alta, coroa + antena com luz
// dourada, brilho lateral e janelas escuras. Silhueta vertical = nível máximo.
export function SkyscraperBadgeIcon() {
  return (
    <svg viewBox="0 0 10 18" width="15" height="27" aria-hidden="true">
      {/* antena + luz */}
      <line x1="5" y1="0.3" x2="5" y2="2.3" stroke="var(--color-ink-950)" strokeWidth="0.7" />
      <circle cx="5" cy="0.6" r="0.75" fill="var(--color-brass-glow)" stroke="var(--color-ink-950)" strokeWidth="0.3">
        <animate attributeName="opacity" values="0.45;1;0.45" dur="1.8s" repeatCount="indefinite" />
      </circle>
      {/* coroa */}
      <rect x="3.4" y="2.2" width="3.2" height="1.3" fill="var(--color-brass)" stroke="var(--color-ink-950)" strokeWidth="0.6" strokeLinejoin="round" />
      {/* corpo */}
      <rect x="1.6" y="3.5" width="6.8" height="13.3" fill="var(--color-brass)" stroke="var(--color-ink-950)" strokeWidth="0.8" strokeLinejoin="round" />
      {/* brilho lateral */}
      <rect x="1.6" y="3.5" width="1.5" height="13.3" fill="var(--color-brass-glow)" opacity="0.45" />
      {/* janelas escuras (2×5) */}
      <g fill="var(--color-ink-900)">
        <rect x="2.9" y="4.7" width="1.4" height="1.5" /><rect x="5.5" y="4.7" width="1.4" height="1.5" />
        <rect x="2.9" y="7" width="1.4" height="1.5" /><rect x="5.5" y="7" width="1.4" height="1.5" />
        <rect x="2.9" y="9.3" width="1.4" height="1.5" /><rect x="5.5" y="9.3" width="1.4" height="1.5" />
        <rect x="2.9" y="11.6" width="1.4" height="1.5" /><rect x="5.5" y="11.6" width="1.4" height="1.5" />
        <rect x="2.9" y="13.9" width="1.4" height="1.5" /><rect x="5.5" y="13.9" width="1.4" height="1.5" />
      </g>
    </svg>
  )
}

// Hangar (flat) — galpão quonset (arco) cream com trilho dourado e portão escuro.
// Marca de hangar construído no aeroporto (§13.6).
export function HangarBadgeIcon() {
  return (
    <svg viewBox="0 0 20 14" width="22" height="15" aria-hidden="true">
      <path d="M1 13 V8 Q1 2.5 10 2.5 Q19 2.5 19 8 V13 Z" fill="var(--color-starlight)" stroke="var(--color-ink-950)" strokeWidth="1" strokeLinejoin="round" />
      <path d="M1.6 8 Q1.6 3.5 10 3.5 Q18.4 3.5 18.4 8" fill="none" stroke="var(--color-brass)" strokeWidth="0.9" />
      <path d="M6 13 V9.6 Q10 6.4 14 9.6 V13 Z" fill="var(--color-ink-900)" stroke="var(--color-ink-950)" strokeWidth="0.6" />
    </svg>
  )
}

// Círculo com visto — glifo do estado vazio "tabuleiro em paz".
export function CalmGlyph({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.5 2.5 2.5 4.5-5" />
    </svg>
  )
}

// ---------------------------------------------------------------------
// Glifos pequenos dos painéis (sem emoji) — herdam currentColor.
// ---------------------------------------------------------------------
export function TradeArrowGlyph({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  )
}

export function PlusGlyph({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" className="shrink-0" aria-hidden>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  )
}

// Setas de mão dupla — glifo do estado vazio de Negociações.
export function SwapMiniGlyph({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M7 4 3 8l4 4" />
      <path d="M3 8h14" />
      <path d="m17 20 4-4-4-4" />
      <path d="M21 16H7" />
    </svg>
  )
}

export function CheckTinyGlyph({ size = 10 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}
