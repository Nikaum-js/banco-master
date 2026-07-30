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

// Hangar frontal com portão aberto e silhueta de avião. A leitura continua
// inequívoca na faixa estreita do aeroporto, sem parecer um ímã ou guarda-chuva.
export function HangarBadgeIcon({ size = 20 }: BuildingBadgeProps) {
  return (
    <svg
      viewBox="0 0 28 22"
      width={Math.round(size * 1.27)}
      height={size}
      fill="none"
      data-glyph="hangar"
      aria-hidden="true"
    >
      <path
        d="M2.5 20V8.5L7.5 3h13l5 5.5V20h-23Z"
        fill="var(--color-ink-950)"
        fillOpacity="0.84"
        stroke="currentColor"
        strokeWidth="1.55"
        strokeLinejoin="round"
      />
      <path d="M1.5 20h25M7.5 3 14 8.2 20.5 3" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7.5 20V9.5h13V20" stroke="var(--color-starlight)" strokeWidth="1.2" strokeLinejoin="round" opacity="0.76" />
      <path d="M14 10.8v6.6m-5-3.2 5-1.2 5 1.2-5 .9-5-.9Zm3.2 3.2L14 16l1.8 1.4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 7.8h18" stroke="var(--color-starlight)" strokeWidth="1" strokeLinecap="round" opacity="0.62" />
    </svg>
  )
}

// =====================================================================
// FAMÍLIA DA FULIGEM (D-070) — oficina, fábrica, Torre de Ferro, Estação de Carga.
//
// O mapa já chamava os níveis de oficina/fábrica/Torre de Ferro, mas desenhava CASA,
// HOTEL e ARRANHA-CÉU: o rótulo dizia uma coisa e o glifo dizia outra, e a leitura que
// vence é sempre a do desenho. Estes quatro fecham a fresta.
//
// Mesmo traço da família cartográfica acima (viewBox 24–28, corpo em `ink-950` a 0.82,
// contorno `currentColor` 1.55, detalhe em `starlight`), para que os dois mapas tenham
// pesos idênticos no tabuleiro e no título.
// =====================================================================

// OFICINA (níveis 1–4) — galpão de UMA água com chaminé e fumaça. O que a separa de uma
// casa: telhado de inclinação única (casa é duas águas simétricas) e a chaminé fumando.
export function WorkshopBadgeIcon({ size = 13 }: BuildingBadgeProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" data-glyph="oficina" aria-hidden="true">
      <path
        d="M5 11.5V21h14V8.5L5 11.5Z"
        fill="var(--color-ink-950)"
        fillOpacity="0.82"
        stroke="currentColor"
        strokeWidth="1.55"
        strokeLinejoin="round"
      />
      <path d="m3.6 12 15.8-3.4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M15.6 9.2V4.6h2.4v4.1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16.8 3.4c.9-.5.2-1.5 1.1-2" stroke="var(--color-starlight)" strokeWidth="1.05" strokeLinecap="round" opacity="0.7" />
      <path d="M10 21v-4.6h4V21M7.4 14.4h2M7.4 17.6h2" stroke="var(--color-starlight)" strokeWidth="1.15" strokeLinecap="round" opacity="0.86" />
      <path d="M4 21h16" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" opacity="0.7" />
    </svg>
  )
}

// FÁBRICA (nível 5) — telhado em DENTE DE SERRA e duas chaminés escalonadas. É a silhueta
// canônica: os dois sinais juntos não leem como prédio de escritório em nenhum tamanho.
export function FactoryBadgeIcon({ size = 18 }: BuildingBadgeProps) {
  return (
    <svg viewBox="0 0 28 24" width={Math.round(size * 1.17)} height={size} fill="none" data-glyph="fabrica" aria-hidden="true">
      <path d="M6.5 11V3.5h2.6V11M11.5 11V6h2.4v5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M3 21v-7l4-3.4v3.4l4-3.4v3.4l4-3.4v3.4l4-3.4V21H3Z"
        fill="var(--color-ink-950)"
        fillOpacity="0.82"
        stroke="currentColor"
        strokeWidth="1.55"
        strokeLinejoin="round"
      />
      <path d="M19 21V9.5h6V21" stroke="currentColor" strokeWidth="1.45" strokeLinejoin="round" />
      <path d="M5.5 17.5h2M9.5 17.5h2M13.5 17.5h2M21 12.5h2M21 16.5h2" stroke="var(--color-starlight)" strokeWidth="1.25" strokeLinecap="round" opacity="0.84" />
      <path d="M2 21h24" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" />
    </svg>
  )
}

// TORRE DE FERRO (nível 7) — alto-forno: cuba cônica sobre base treliçada, galeria no topo
// e a boca de corrida acesa. Substitui o arranha-céu, que lia como distrito financeiro.
export function IronTowerBadgeIcon({ size = 19 }: BuildingBadgeProps) {
  return (
    <svg viewBox="0 0 28 28" width={size} height={size} fill="none" data-glyph="torre-de-ferro" aria-hidden="true">
      <path d="M14 1.5V4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M9.5 4h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path
        d="M10.5 4h7l1.5 7.5v5.5h-10v-5.5L10.5 4Z"
        fill="var(--color-ink-950)"
        fillOpacity="0.82"
        stroke="currentColor"
        strokeWidth="1.55"
        strokeLinejoin="round"
      />
      <path d="M8 11.5h12" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" opacity="0.8" />
      <path d="M9 17h10v8H9v-8Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="m9 17 10 8M19 17 9 25" stroke="currentColor" strokeWidth="1.15" strokeLinecap="round" opacity="0.62" />
      <path d="M12.4 8.2h3.2" stroke="var(--color-starlight)" strokeWidth="1.2" strokeLinecap="round" opacity="0.86" />
      <path d="M12.6 22.2h2.8" stroke="var(--color-starlight)" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M2.5 25h23" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" />
      <circle cx="14" cy="1.5" r="1" fill="currentColor" />
    </svg>
  )
}

// ESTAÇÃO DE CARGA (melhoria de ferrovia) — galpão de carga sobre os trilhos com um vagão
// dentro. O `HangarBadgeIcon` do Atlas tem silhueta de AVIÃO; numa ferrovia isso é ruído.
export function FreightDepotBadgeIcon({ size = 20 }: BuildingBadgeProps) {
  return (
    <svg
      viewBox="0 0 28 22"
      width={Math.round(size * 1.27)}
      height={size}
      fill="none"
      data-glyph="estacao-de-carga"
      aria-hidden="true"
    >
      <path
        d="M2.5 18.5V7.5L14 2l11.5 5.5v11h-23Z"
        fill="var(--color-ink-950)"
        fillOpacity="0.84"
        stroke="currentColor"
        strokeWidth="1.55"
        strokeLinejoin="round"
      />
      <path d="M2.5 7.5h23" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.75" />
      <path d="M8 18.5v-7h12v7" stroke="var(--color-starlight)" strokeWidth="1.25" strokeLinejoin="round" opacity="0.8" />
      <path d="M10.5 14h7" stroke="var(--color-starlight)" strokeWidth="1.15" strokeLinecap="round" opacity="0.7" />
      <circle cx="11" cy="18.4" r="1.35" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="17" cy="18.4" r="1.35" stroke="currentColor" strokeWidth="1.3" />
      <path d="M1 20.5h26M4 22h6M18 22h6" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
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
