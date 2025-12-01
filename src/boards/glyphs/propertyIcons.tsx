// Ícones de propriedade do mapa Cidade da Fuligem (055/D-069) — o disco que ocupa, nas
// propriedades SEM bandeira, o lugar que o `FlagAvatar` ocupa no mapa Cidades do Mundo.
// Traço simples em `currentColor` sobre placa de ferro: fábrica, chaminé, trem, engrenagem,
// lâmpada, prédio… nada decorativo além do símbolo (FR-006).
import type { PropertyIconId } from '@/lib/boardData'

// ViewBox 24×24, stroke 1.8, formas fechadas simples — legíveis a 20px.
const ICON_PATHS: Record<PropertyIconId, React.ReactNode> = {
  chimney: (
    <>
      <path d="M9 20V8h2.5V5h3v15" />
      <path d="M6 20h12" />
      <path d="M12.5 3.2c1.4-.9 2.6.4 4 .1" opacity="0.7" />
    </>
  ),
  factory: (
    <>
      <path d="M4 20V10l5 3v-3l5 3v-3l6 3.6V20Z" />
      <path d="M6 10V5h2.6v6.6" />
    </>
  ),
  anvil: (
    <>
      <path d="M4 8h13c-1 2.4-3 3.6-5.6 3.9V15h2v3H8v-3h2v-3C6.8 12 4.8 10.6 4 8Z" />
      <path d="M6 20h10" />
    </>
  ),
  crane: (
    <>
      <path d="M5 20V7l12-3" />
      <path d="M5 11l9-2.6" />
      <path d="M17 4v5.4" />
      <path d="M17 9.4v3.2m0 0a1.6 1.6 0 1 0 .01 0Z" />
      <path d="M3 20h6" />
    </>
  ),
  house: (
    <>
      <path d="M4.5 11.5 12 5l7.5 6.5" />
      <path d="M6.5 10.5V19h11v-8.5" />
      <path d="M10.3 19v-4.6h3.4V19" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 5.6V3.4M12 20.6v-2.2M18.4 12h2.2M3.4 12h2.2M16.5 7.5 18 6M6 18l1.5-1.5M16.5 16.5 18 18M6 6l1.5 1.5" />
      <circle cx="12" cy="12" r="6.4" opacity="0.55" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="11" r="6.5" />
      <path d="M12 7.4V11l2.6 1.8" />
      <path d="M9 20h6M10.2 17.4 9 20m4.8-2.6L15 20" />
    </>
  ),
  train: (
    <>
      <rect x="5.5" y="5" width="13" height="10.5" rx="2" />
      <path d="M5.5 11h13" />
      <circle cx="9" cy="18.4" r="1.3" />
      <circle cx="15" cy="18.4" r="1.3" />
      <path d="M8 8h3" />
    </>
  ),
  lamp: (
    <>
      <path d="M8.6 9.4a3.4 3.4 0 1 1 6.8 0c0 2-1.6 2.6-1.6 4.2h-3.6c0-1.6-1.6-2.2-1.6-4.2Z" />
      <path d="M10.4 16h3.2M11 18.4h2" />
    </>
  ),
  building: (
    <>
      <rect x="7" y="4.5" width="10" height="15.5" />
      <path d="M9.6 8h1.6M12.8 8h1.6M9.6 11.4h1.6M12.8 11.4h1.6M9.6 14.8h1.6M12.8 14.8h1.6" />
      <path d="M10.8 20v-2.6h2.4V20" />
    </>
  ),
  bank: (
    <>
      <path d="M4.5 9.5 12 5l7.5 4.5" />
      <path d="M6.5 10.5V17M10.2 10.5V17M13.8 10.5V17M17.5 10.5V17" />
      <path d="M5 19.5h14" />
    </>
  ),
  mansion: (
    <>
      <path d="M5 20v-8l3-2.6V20M19 20v-8l-3-2.6V20" />
      <path d="M8 9l4-3.6L16 9" />
      <path d="M10.5 20v-3.4h3V20" />
      <path d="M4 20h16" />
    </>
  ),
}

/** Só a arte do ícone (sem disco) — para caber dentro de círculos que já existem,
 * como o avatar da casa e o cabeçalho da escritura. */
export function PropertyIconArt({ icon, size = 20 }: { icon: PropertyIconId; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICON_PATHS[icon]}
    </svg>
  )
}

/** Disco de ícone — mesma pegada visual do `FlagAvatar` (32px cravado na borda interna). */
export function PropertyIconDisc({ icon, className }: { icon: PropertyIconId; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={className}
      style={{
        display: 'grid',
        placeItems: 'center',
        width: 32,
        height: 32,
        borderRadius: '9999px',
        background: 'color-mix(in srgb, var(--color-ink-abyss) 88%, var(--color-brass))',
        border: '1px solid color-mix(in srgb, var(--color-brass) 55%, transparent)',
        boxShadow: 'var(--shadow-card)',
        color: 'var(--color-brass)',
      }}
    >
      <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        {ICON_PATHS[icon]}
      </svg>
    </span>
  )
}
