// Peças autorais em SVG — line art de instrumento gravado, na linguagem dos glifos do
// tabuleiro (boards/glyphs): traço uniforme, cantos redondos, nada de emoji (que renderiza
// diferente por plataforma e destoa da identidade). Stroke em `currentColor`: a mesma peça
// serve clara sobre tinta (picker do lobby) e tinta sobre a cor do assento (badge).
// O catálogo (id + label) segue em `net/room.ts` — aqui mora só a arte, como prometido lá.
import type { ReactNode } from 'react'
import type { PieceId } from '@/net/room'

const ART: Record<PieceId, ReactNode> = {
  // Avião — silhueta vista de cima, nariz pra cima
  aviao: (
    <path d="M16 3c1.3 1.9 1.4 3.9 1.4 5.9v5.3L29 19.9v2.9l-11.6-3.1v5.2l3.5 2.8v2.1L16 28.5l-4.9 1.3v-2.1l3.5-2.8v-5.2L3 22.8v-2.9l11.6-5.7V8.9c0-2 .1-4 1.4-5.9Z" />
  ),
  // Navio — âncora de cepo: anel, haste, braços e unhas
  navio: (
    <>
      <circle cx="16" cy="6.2" r="2.7" />
      <path d="M16 8.9V27" />
      <path d="M10.4 13.2h11.2" />
      <path d="M4.8 19.6c1.2 4.9 5.6 7.9 11.2 7.9s10-3 11.2-7.9" />
      <path d="M4.8 19.6l-2.4 1.1M4.8 19.6l.8 2.6M27.2 19.6l2.4 1.1M27.2 19.6l-.8 2.6" />
    </>
  ),
  // Trem — locomotiva de perfil: cabine, caldeira, chaminé e três rodas
  trem: (
    <>
      <path d="M4.5 20.5V12.2h7.6l3.2-3.4h5.2c3.2 0 5.8 2.6 5.8 5.8v5.9" />
      <path d="M2.8 20.5h26.4" />
      <circle cx="9" cy="24" r="2.4" />
      <circle cx="16.2" cy="24" r="2.4" />
      <circle cx="23" cy="24" r="2.4" />
      <path d="M22 5.4h3.2M23.6 5.4v3.4" />
      <rect x="7" y="14.6" width="4.2" height="4" rx="0.6" />
    </>
  ),
  // Táxi — perfil com letreiro no teto
  taxi: (
    <>
      <path d="M3.8 21.2v-2.9c0-1.4 1.1-2.5 2.5-2.5h2.3l3.4-4.6h8.2l3.4 4.6h2.3c1.4 0 2.5 1.1 2.5 2.5v2.9H3.8Z" />
      <circle cx="10.4" cy="21.6" r="2.6" />
      <circle cx="21.6" cy="21.6" r="2.6" />
      <path d="M13.6 6.2h4.8v2.6h-4.8Z" />
      <path d="M16 8.8v2.4" />
      <path d="M16 16.6v4.4" />
    </>
  ),
  // Balão — envelope com gomos e cesto pendurado
  balao: (
    <>
      <path d="M16 2.8c5.6 0 9.4 3.7 9.4 8.5 0 4.9-4.2 8.2-6.6 11.2h-5.6C10.8 19.5 6.6 16.2 6.6 11.3c0-4.8 3.8-8.5 9.4-8.5Z" />
      <path d="M12.6 3.6c-1.7 3.2-1.7 15.7.6 18.9M19.4 3.6c1.7 3.2 1.7 15.7-.6 18.9M16 2.8v19.7" />
      <path d="M13 22.5l-.5 3M19 22.5l.5 3" />
      <rect x="12" y="25.5" width="8" height="3.9" rx="1" />
    </>
  ),
  // Bússola — mostrador com agulha em losango a 45°
  bussola: (
    <>
      <circle cx="16" cy="16" r="12.2" />
      <path d="M16 3.8v2.4M28.2 16h-2.4M16 28.2v-2.4M3.8 16h2.4" />
      <path d="M21.9 10.1 18 18l-7.9 3.9L14 14Z" />
      <circle cx="16" cy="16" r="1.4" fill="currentColor" stroke="none" />
    </>
  ),
  // Mala — baú de viagem com alça, cintas e selo redondo
  mala: (
    <>
      <rect x="4.8" y="10.2" width="22.4" height="16" rx="2.6" />
      <path d="M12.2 10.2V8.5c0-1.6 1.3-2.7 3.8-2.7s3.8 1.1 3.8 2.7v1.7" />
      <path d="M10.2 10.2v16M21.8 10.2v16" />
      <circle cx="16" cy="18.2" r="2.9" />
    </>
  ),
  // Farol — torre listrada, lanterna e feixes de luz
  farol: (
    <>
      <path d="M12.6 11.8 10.6 27h10.8l-2-15.2" />
      <path d="M12.1 16.2h7.8M11.5 20.8h9" />
      <path d="M12.6 11.8V8.4h6.8v3.4" />
      <path d="M11.6 8.4 16 4.6l4.4 3.8" />
      <path d="M7.8 27h16.4" />
      <path d="M10.4 8.2 5.6 6.4M21.6 8.2l4.8-1.8" />
    </>
  ),
}

/** Glifo da peça pelo id, com o mesmo fallback de `pieceOf` (primeira do catálogo). */
export function PieceGlyph({ id, size = 20, className }: { id?: string; size?: number | string; className?: string }) {
  const art = ART[id as PieceId] ?? ART.aviao
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {art}
    </svg>
  )
}
