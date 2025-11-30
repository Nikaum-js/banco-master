// SELOS E ÍCONES MIÚDOS — card 7 do review de arquitetura (2026-07-25).
//
// Arte pura: distintivos de construção (casa/hotel/arranha-céu/hangar), o glifo de "sem
// efeitos" e os ícones da linha de troca. Nenhum conhece store nem regra — quem decide
// QUANDO cada um aparece é `shared.tsx`.

type BuildingBadgeProps = {
  size?: number
}

// Família cartográfica das construções. Todos os níveis compartilham o mesmo
// traço, contraste e proporção para funcionar tanto no tabuleiro quanto no título.
export function PlotBadgeIcon({ size = 15 }: BuildingBadgeProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" aria-hidden="true">
      <path
        d="m12 4 9 5-9 5-9-5 9-5Z"
        fill="var(--color-ink-950)"
        fillOpacity="0.74"
        stroke="currentColor"
        strokeWidth="1.55"
        strokeLinejoin="round"
      />
      <path d="m3 9 9 5 9-5v6l-9 5-9-5V9Z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" opacity="0.55" />
      <path d="m8.2 9.1 3.8 2.1 3.8-2.1" stroke="var(--color-starlight)" strokeWidth="1.1" strokeLinecap="round" opacity="0.75" />
    </svg>
  )
}

export function HouseBadgeIcon({ size = 13 }: BuildingBadgeProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" aria-hidden="true">
      <path
        d="M5.5 10.5V21h13V10.5L12 5l-6.5 5.5Z"
        fill="var(--color-ink-950)"
        fillOpacity="0.82"
        stroke="currentColor"
        strokeWidth="1.55"
        strokeLinejoin="round"
      />
      <path d="m3.5 11.5 8.5-7 8.5 7" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 21v-5h4v5M7.7 13h2.1M14.2 13h2.1" stroke="var(--color-starlight)" strokeWidth="1.15" strokeLinecap="round" opacity="0.86" />
      <path d="M4 21h16" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" opacity="0.7" />
    </svg>
  )
}

export function HotelBadgeIcon({ size = 18 }: BuildingBadgeProps) {
  return (
    <svg viewBox="0 0 28 24" width={Math.round(size * 1.17)} height={size} fill="none" aria-hidden="true">
      <path
        d="M4 21V8h20v13H4Z"
        fill="var(--color-ink-950)"
        fillOpacity="0.82"
        stroke="currentColor"
        strokeWidth="1.55"
        strokeLinejoin="round"
      />
      <path d="M2.5 8h23M7 5h14v3H7V5Z" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 11.5h2M13 11.5h2M18 11.5h2M8 15h2M18 15h2" stroke="var(--color-starlight)" strokeWidth="1.3" strokeLinecap="round" opacity="0.84" />
      <path d="M12 21v-5h4v5M2.5 21h23" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" />
    </svg>
  )
}

export function SkyscraperBadgeIcon({ size = 19 }: BuildingBadgeProps) {
  return (
    <svg viewBox="0 0 28 28" width={size} height={size} fill="none" aria-hidden="true">
      <path d="M14 1.5V5" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" />
      <path
        d="M11 7V5h6v2h2v3h3v4h2v11H4V14h2v-4h3V7h2Z"
        fill="var(--color-ink-950)"
        fillOpacity="0.82"
        stroke="currentColor"
        strokeWidth="1.55"
        strokeLinejoin="round"
      />
      <path d="M10 13h2M16 13h2M8 17h2M13 17h2M18 17h2M8 21h2M13 21h2M18 21h2" stroke="var(--color-starlight)" strokeWidth="1.2" strokeLinecap="round" opacity="0.86" />
      <path d="M12 25v-4h4v4M2.5 25h23" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" />
      <path d="m11 7 3-2 3 2" stroke="var(--color-starlight)" strokeWidth="1" strokeLinejoin="round" opacity="0.72" />
      <circle cx="14" cy="1.5" r="1" fill="currentColor" />
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
