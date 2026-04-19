// Ícones SVG inline (sem emoji) — herdam currentColor. Usados em botões/cards.
type IconProps = { size?: number; className?: string }
const base = (size: number) => ({ width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const })

export function ShopIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <path d="M3 6h18" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  )
}

export function GavelIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <path d="m15 2 7 7-3 3-7-7 3-3Z" />
      <path d="m11 6 7 7" />
      <path d="m9 8-7 7 3 3 7-7" />
      <path d="M3 22h8" />
    </svg>
  )
}

export function CoinIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M14.5 9.5a2.5 2 0 0 0-2.5-1.5c-1.4 0-2.5.7-2.5 1.8 0 2.4 5 1.2 5 3.7 0 1.1-1.1 1.7-2.5 1.7a2.5 2 0 0 1-2.5-1.5" />
      <path d="M12 6.5v11" />
    </svg>
  )
}

export function HouseIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <path d="m3 10 9-7 9 7v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M9 21v-7h6v7" />
    </svg>
  )
}

export function DiceIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="3.5" />
      <circle cx="8" cy="8" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="16" cy="16" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function HotelIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <rect x="4" y="3" width="16" height="18" rx="1" />
      <path d="M9 7h.01M15 7h.01M9 11h.01M15 11h.01M9 15h.01M15 15h.01" />
      <path d="M11 21v-3h2v3" />
    </svg>
  )
}
