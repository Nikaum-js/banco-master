// ARTE DAS CASAS — card 7 do review de arquitetura (2026-07-25).
//
// Glifos SVG puros: recebem `size`, devolvem `<svg>`. Sem store, sem regra, sem layout.
// Saíram de `shared.tsx`, onde a corrida de arte era INTERROMPIDA no meio por três tabelas
// de dados (`GROUP_BG`, `GROUP_COLOR`, `HOUSE_COST`) e retomada depois — uma ordenação que
// ninguém escolheu, só acumulou.
//
// `SquareIcon` é o adapter da seam: `square.kind` → glifo. É a única coisa que o resto do
// board precisa conhecer daqui.
import type { Square } from '@/lib/boardData'
import { activeCatalog } from '@/game/ui/theme/boardTheme'
import type { MetalId } from '@/lib/boardData'
import { METAL_ACCENT } from './metals'

// ---------------------------------------------------------------------
// Glifos SVG próprios para casas especiais — ilustrações full-bleed com
// personalidade, na paleta do tema via var(--color-*): latão, tinta,
// starlight e signal. Sem aro/mostrador — o pictograma ocupa a célula.
// Cada glifo aceita size: number|string (suporta "1em" pra escala via cqi).
// ---------------------------------------------------------------------
export type GlyphProps = { size?: number | string }

// GO — moeda dourada gigante "R$ 200" com raios de brilho (bônus de
// passar pelo GO, SRS §13.6). Full-bleed, sem aro de instrumento.
export function GoGlyph({ size = 24 }: GlyphProps) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      {/* raios/sparkles ao redor */}
      <g stroke="var(--color-brass-glow)" strokeWidth="1.1" strokeLinecap="round" opacity="0.6">
        <line x1="20" y1="1.5" x2="20" y2="3.5" />
        <line x1="38.5" y1="20" x2="36.5" y2="20" />
        <line x1="20" y1="38.5" x2="20" y2="36.5" />
        <line x1="1.5" y1="20" x2="3.5" y2="20" />
        <line x1="33"   y1="7"  x2="31.5" y2="8.5" />
        <line x1="33"   y1="33" x2="31.5" y2="31.5" />
        <line x1="7"    y1="33" x2="8.5"  y2="31.5" />
        <line x1="7"    y1="7"  x2="8.5"  y2="8.5" />
      </g>
      <ellipse cx="20" cy="36.5" rx="13" ry="1.2" fill="var(--color-ink-950)" opacity="0.45" />
      {/* moeda */}
      <circle cx="20" cy="20" r="15" fill="var(--color-brass)" stroke="var(--color-ink-950)" strokeWidth="1.8" />
      <circle cx="20" cy="20" r="12.6" fill="none" stroke="var(--color-brass-soft)" strokeWidth="0.7" strokeDasharray="1 1.4" />
      <ellipse cx="14" cy="12" rx="4" ry="2" fill="var(--color-brass-glow)" opacity="0.55" />
      <text x="20" y="17.5" textAnchor="middle"
        fontFamily="Roboto Slab, Roboto Slab Variable, serif"
        fontSize="7.5" fontWeight="800" fill="var(--color-ink-950)">R$</text>
      <text x="20" y="28.5" textAnchor="middle"
        fontFamily="Roboto Slab, Roboto Slab Variable, serif"
        fontSize="10" fontWeight="800" fill="var(--color-ink-950)" letterSpacing="-0.06em">200</text>
    </svg>
  )
}

// Prisão (visita) — cela de pedra com prisioneiro atrás das barras e
// cadeado pendurado. Full-bleed, sem aro.
export function JailGlyph({ size = 24 }: GlyphProps) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      {/* parede de pedra externa */}
      <rect x="1" y="1" width="38" height="38" rx="1.5"
        fill="var(--color-ink-500)" stroke="var(--color-ink-950)" strokeWidth="1.2" />
      {/* tijolos em padrão alternado */}
      <g stroke="var(--color-ink-900)" strokeWidth="0.6" opacity="0.6">
        <line x1="1"  y1="7"  x2="39" y2="7"  />
        <line x1="1"  y1="14" x2="39" y2="14" />
        <line x1="1"  y1="26" x2="39" y2="26" />
        <line x1="1"  y1="33" x2="39" y2="33" />
        <line x1="8"  y1="1"  x2="8"  y2="7" />
        <line x1="18" y1="1"  x2="18" y2="7" />
        <line x1="28" y1="1"  x2="28" y2="7" />
        <line x1="4"  y1="7"  x2="4"  y2="14" />
        <line x1="14" y1="7"  x2="14" y2="14" />
        <line x1="24" y1="7"  x2="24" y2="14" />
        <line x1="34" y1="7"  x2="34" y2="14" />
        <line x1="8"  y1="33" x2="8"  y2="39" />
        <line x1="18" y1="33" x2="18" y2="39" />
        <line x1="28" y1="33" x2="28" y2="39" />
      </g>
      {/* vão da cela */}
      <rect x="6" y="9" width="28" height="22" rx="0.5"
        fill="var(--color-ink-abyss)" stroke="var(--color-ink-950)" strokeWidth="1" />
      {/* prisioneiro — corpo com listras + cabeça */}
      <path d="M 13 28 Q 13 22 20 22 Q 27 22 27 28 L 27 31 L 13 31 Z"
        fill="var(--color-ink-400)" stroke="var(--color-ink-950)" strokeWidth="0.6" />
      <line x1="13" y1="25" x2="27" y2="25" stroke="var(--color-starlight-muted)" strokeWidth="0.8" />
      <line x1="13" y1="27.5" x2="27" y2="27.5" stroke="var(--color-starlight-muted)" strokeWidth="0.8" />
      <circle cx="20" cy="19" r="4.5" fill="#c2854f" stroke="var(--color-ink-950)" strokeWidth="0.6" />
      <ellipse cx="18.5" cy="17" rx="1.5" ry="0.8" fill="#ffffff" opacity="0.18" />
      <circle cx="18.2" cy="18.7" r="0.9" fill="var(--color-starlight)" />
      <circle cx="21.8" cy="18.7" r="0.9" fill="var(--color-starlight)" />
      <circle cx="18.3" cy="18.8" r="0.5" fill="var(--color-ink-950)" />
      <circle cx="21.9" cy="18.8" r="0.5" fill="var(--color-ink-950)" />
      <line x1="16.5" y1="16.6" x2="19" y2="17.4" stroke="var(--color-ink-950)" strokeWidth="0.7" strokeLinecap="round" />
      <line x1="23.5" y1="16.6" x2="21" y2="17.4" stroke="var(--color-ink-950)" strokeWidth="0.7" strokeLinecap="round" />
      <path d="M 17.5 21.6 Q 20 20.5 22.5 21.6" stroke="var(--color-ink-950)" strokeWidth="0.7" fill="none" strokeLinecap="round" />
      {/* mãos agarradas nas barras */}
      <g fill="#c2854f" stroke="var(--color-ink-950)" strokeWidth="0.4">
        <ellipse cx="14" cy="23" rx="1.4" ry="1.1" />
        <ellipse cx="26" cy="23" rx="1.4" ry="1.1" />
      </g>
      {/* travessa + barras de ferro */}
      <rect x="6" y="15" width="28" height="2" fill="var(--color-starlight-muted)" stroke="var(--color-ink-400)" strokeWidth="0.5" />
      <g>
        <rect x="10" y="9" width="2.4" height="22" fill="var(--color-starlight-muted)" stroke="var(--color-ink-400)" strokeWidth="0.5" />
        <rect x="18.8" y="9" width="2.4" height="22" fill="var(--color-starlight-muted)" stroke="var(--color-ink-400)" strokeWidth="0.5" />
        <rect x="27.6" y="9" width="2.4" height="22" fill="var(--color-starlight-muted)" stroke="var(--color-ink-400)" strokeWidth="0.5" />
      </g>
      {/* cadeado pendurado */}
      <g transform="translate(4 32)">
        <path d="M 1.5 1.8 Q 1.5 0 3 0 Q 4.5 0 4.5 1.8" fill="none" stroke="var(--color-brass-soft)" strokeWidth="0.8" strokeLinecap="round" />
        <rect x="0.5" y="1.8" width="5" height="4" rx="0.4" fill="var(--color-brass)" stroke="var(--color-ink-950)" strokeWidth="0.5" />
        <circle cx="3" cy="3.6" r="0.5" fill="var(--color-ink-950)" />
        <line x1="3" y1="3.6" x2="3" y2="5" stroke="var(--color-ink-950)" strokeWidth="0.4" />
      </g>
    </svg>
  )
}

// Vá pra Prisão — quepe de polícia: coroa azul-noite, cinta escura com
// frisos dourados, viseira e estrela. Full-bleed, sem aro.
export function GoToJailGlyph({ size = 24 }: GlyphProps) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      <ellipse cx="20" cy="36" rx="14" ry="1.3" fill="var(--color-ink-950)" opacity="0.45" />
      {/* coroa/topo do quepe */}
      <path d="M 8 22 Q 8 8 20 8 Q 32 8 32 22 L 32 23 L 8 23 Z"
        fill="#34549c" stroke="var(--color-ink-950)" strokeWidth="1.6" strokeLinejoin="round" />
      <ellipse cx="14" cy="11.5" rx="3.5" ry="1.4" fill="#ffffff" opacity="0.18" />
      {/* cinta com frisos dourados */}
      <rect x="7" y="22.5" width="26" height="4" fill="var(--color-ink-950)" stroke="var(--color-ink-950)" strokeWidth="0.5" />
      <line x1="7" y1="22.5" x2="33" y2="22.5" stroke="var(--color-brass-glow)" strokeWidth="0.5" opacity="0.7" />
      <line x1="7" y1="26.5" x2="33" y2="26.5" stroke="var(--color-brass-glow)" strokeWidth="0.5" opacity="0.7" />
      {/* viseira */}
      <path d="M 4 29 Q 12 32.5 20 32.5 Q 28 32.5 36 29 L 36 27.5 L 4 27.5 Z"
        fill="var(--color-ink-900)" stroke="var(--color-ink-950)" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M 6 29 Q 13 31 20 31 Q 27 31 34 29" stroke="var(--color-ink-400)" strokeWidth="0.6" fill="none" />
      {/* estrela dourada */}
      <polygon points="20,12 21.6,16 25.8,16 22.4,18.7 23.7,22.6 20,20.1 16.3,22.6 17.6,18.7 14.2,16 18.4,16"
        fill="var(--color-brass-glow)" stroke="var(--color-ink-950)" strokeWidth="0.7" strokeLinejoin="round" />
      <circle cx="20" cy="17.5" r="0.9" fill="var(--color-ink-950)" />
    </svg>
  )
}

// Loteria — globo de sorteio full-bleed com 3 bolas numeradas, pedestal
// e manivela de girar o tambor.
export function LotteryGlyph({ size = 24 }: GlyphProps) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      <ellipse cx="20" cy="36" rx="14" ry="1.3" fill="var(--color-ink-950)" opacity="0.45" />
      {/* base/pedestal */}
      <rect x="13" y="33.5" width="14" height="2.5" rx="0.5" fill="var(--color-ink-950)" />
      <rect x="17" y="30" width="6" height="4" fill="var(--color-ink-500)" stroke="var(--color-ink-950)" strokeWidth="0.8" />
      {/* esfera do globo (vidro escuro com aro dourado) */}
      <circle cx="20" cy="17" r="13" fill="var(--color-ink-abyss)" stroke="var(--color-brass)" strokeWidth="1.8" />
      <ellipse cx="13.5" cy="10" rx="3.5" ry="2" fill="#ffffff" opacity="0.3" />
      {/* manivela do tambor */}
      <line x1="33" y1="17" x2="36.2" y2="13.6" stroke="var(--color-brass-soft)" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="36.4" cy="13.2" r="1.4" fill="var(--color-brass)" stroke="var(--color-ink-950)" strokeWidth="0.5" />
      {/* aro inferior do drum */}
      <ellipse cx="20" cy="28" rx="13" ry="3" fill="var(--color-ink-500)" stroke="var(--color-ink-950)" strokeWidth="1" />
      <ellipse cx="20" cy="27.5" rx="11.5" ry="2" fill="var(--color-ink-900)" />
      {/* 3 bolas numeradas */}
      <circle cx="14" cy="21" r="3.4" fill="var(--color-signal)" stroke="var(--color-ink-950)" strokeWidth="0.7" />
      <text x="14" y="22.2" textAnchor="middle"
        fontFamily="Roboto Slab, Roboto Slab Variable, serif"
        fontSize="3.2" fontWeight="800" fill="var(--color-starlight)">07</text>
      <circle cx="22" cy="14.5" r="3.8" fill="var(--color-brass-glow)" stroke="var(--color-ink-950)" strokeWidth="0.8" />
      <text x="22" y="15.8" textAnchor="middle"
        fontFamily="Roboto Slab, Roboto Slab Variable, serif"
        fontSize="3.6" fontWeight="800" fill="var(--color-ink-950)">22</text>
      <circle cx="26" cy="22" r="3.2" fill="var(--color-group-green)" stroke="var(--color-ink-950)" strokeWidth="0.7" />
      <text x="26" y="23.2" textAnchor="middle"
        fontFamily="Roboto Slab, Roboto Slab Variable, serif"
        fontSize="3" fontWeight="800" fill="var(--color-ink-abyss)">58</text>
    </svg>
  )
}

// Aeroporto — avião top-down em metal do tema, rastro de rota tracejado
// e luzes de navegação nas pontas das asas (vermelha/verde, como na aviação).
export function AirportGlyph({ size = 24 }: GlyphProps) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      {/* rastro de rota com ponto de partida */}
      <path d="M 4 35 Q 13 30 20 24 T 34 8"
        stroke="var(--color-brass)" strokeWidth="1" strokeDasharray="2 2.5" fill="none" opacity="0.5" />
      <circle cx="4.5" cy="34.5" r="1.2" fill="none" stroke="var(--color-brass)" strokeWidth="0.7" opacity="0.55" />
      {/* avião */}
      <g stroke="var(--color-ink-950)" strokeWidth="1.2" strokeLinejoin="round">
        <path d="M 20 6 Q 22.5 7 22.5 15 L 22.5 24 L 20 28 L 17.5 24 L 17.5 15 Q 17.5 7 20 6 Z" fill="var(--color-brass)" />
        <path d="M 4 18 L 17.5 15.5 L 17.5 21 L 4 22.5 Z" fill="var(--color-brass)" />
        <path d="M 36 18 L 22.5 15.5 L 22.5 21 L 36 22.5 Z" fill="var(--color-brass)" />
        <path d="M 13 28 L 20 27 L 27 28 L 25 32 L 15 32 Z" fill="var(--color-brass)" />
      </g>
      {/* luzes de ponta de asa */}
      <circle cx="4.6" cy="20.2" r="0.9" fill="var(--color-signal)" />
      <circle cx="35.4" cy="20.2" r="0.9" fill="var(--color-group-green)" />
      {/* cockpit */}
      <ellipse cx="20" cy="10" rx="1.5" ry="2.4" fill="var(--color-ink-900)" />
      <ellipse cx="20" cy="9.5" rx="0.9" ry="1.1" fill="var(--color-group-skyblue)" opacity="0.65" />
    </svg>
  )
}

// Petrobras — bomba de combustível: display, label PETRO, mangueira em
// arco simétrico e gota dourada pingando do bico.
export function FuelGlyph({ size = 24 }: GlyphProps) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      <ellipse cx="20" cy="36" rx="14" ry="1.2" fill="var(--color-ink-950)" opacity="0.4" />
      <rect x="9" y="33" width="22" height="2.5" rx="0.5" fill="var(--color-ink-950)" />
      <rect x="10" y="11" width="20" height="22" rx="1.5" fill="var(--color-ink-400)" stroke="var(--color-ink-950)" strokeWidth="1.4" />
      <rect x="10" y="11" width="20" height="3" rx="1.5" fill="var(--color-ink-500)" stroke="var(--color-ink-950)" strokeWidth="1" />
      <rect x="12" y="15.5" width="16" height="6" rx="0.5" fill="var(--color-ink-abyss)" stroke="var(--color-ink-950)" strokeWidth="0.6" />
      <text x="20" y="20" textAnchor="middle"
        fontFamily="Roboto Slab, Roboto Slab Variable, serif"
        fontSize="4" fontWeight="700" fill="var(--color-brass)" letterSpacing="0.3">88.88</text>
      <rect x="12" y="23" width="16" height="7" rx="0.5" fill="var(--color-group-green)" stroke="var(--color-ink-950)" strokeWidth="0.5" />
      <text x="20" y="27.9" textAnchor="middle"
        fontFamily="Inter Variable, sans-serif"
        fontSize="3.8" fontWeight="800" fill="var(--color-ink-950)" letterSpacing="0.2">PETRO</text>
      <path d="M 13 11 Q 13 5 17 5 L 23 5 Q 27 5 27 11"
        fill="none" stroke="var(--color-ink-500)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <rect x="18.5" y="3.5" width="3" height="2.5" rx="0.5" fill="var(--color-ink-500)" stroke="var(--color-ink-950)" strokeWidth="0.4" />
      {/* gota pingando do bico */}
      <path d="M 20 7.2 Q 21.2 8.9 20 10 Q 18.8 8.9 20 7.2 Z" fill="var(--color-brass-glow)" opacity="0.9" />
    </svg>
  )
}

// Eletrobras — raio grande com arcos elétricos e faíscas, sem aro.
export function BoltGlyph({ size = 24 }: GlyphProps) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      <ellipse cx="20" cy="36" rx="12" ry="1.2" fill="var(--color-ink-950)" opacity="0.4" />
      {/* arcos elétricos */}
      <g stroke="var(--color-brass-glow)" strokeWidth="1" strokeLinecap="round" opacity="0.55" fill="none">
        <path d="M 7 10 Q 11 12 9 15" />
        <path d="M 33 10 Q 29 12 31 15" />
        <path d="M 6 26 Q 10 24 8 21" />
        <path d="M 34 26 Q 30 24 32 21" />
      </g>
      {/* faíscas */}
      <g fill="var(--color-brass-glow)" opacity="0.8">
        <circle cx="12" cy="6" r="0.8" />
        <circle cx="29" cy="30" r="0.8" />
      </g>
      {/* raio */}
      <path d="M 22 3 L 10 21 L 17.5 21 L 14 36 L 30 15.5 L 22.5 15.5 L 25.5 3 Z"
        fill="var(--color-brass-glow)" stroke="var(--color-ink-950)" strokeWidth="1.3" strokeLinejoin="round" />
      {/* brilho interno */}
      <path d="M 21.5 6 L 13.5 19 L 16.5 19 Z" fill="#ffffff" opacity="0.35" />
    </svg>
  )
}

// Imposto — boleto/fatura: papel claro, cabeçalho signal com selo,
// linhas de campos e caixa de "TOTAL R$" destacada.
export function TaxGlyph({ size = 24 }: GlyphProps) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      {/* sombra do chão */}
      <ellipse cx="20" cy="36.5" rx="13" ry="1.3" fill="var(--color-ink-950)" opacity="0.4" />

      {/* papel — claro com borda escura */}
      <rect x="7" y="5" width="26" height="29" rx="1.5"
        fill="var(--color-starlight)" stroke="var(--color-ink-950)" strokeWidth="1.4" />

      {/* cabeçalho signal da fatura */}
      <path d="M 7 6.5 Q 7 5 8.5 5 L 31.5 5 Q 33 5 33 6.5 L 33 12 L 7 12 Z"
        fill="var(--color-signal)" stroke="var(--color-ink-950)" strokeWidth="1.1" strokeLinejoin="round" />

      {/* selo redondo no header */}
      <circle cx="11.5" cy="8.5" r="1.7" fill="var(--color-starlight)" stroke="var(--color-signal-deep)" strokeWidth="0.5" />
      <circle cx="11.5" cy="8.5" r="0.7" fill="var(--color-signal)" />

      {/* linhas sugerindo "REPÚBLICA / RECEITA" no header */}
      <line x1="15" y1="7.5" x2="29" y2="7.5" stroke="var(--color-starlight)" strokeWidth="0.7" opacity="0.85" />
      <line x1="15" y1="10" x2="26" y2="10" stroke="var(--color-starlight)" strokeWidth="0.6" opacity="0.65" />

      {/* linhas dos campos da fatura */}
      <line x1="10" y1="16" x2="30" y2="16" stroke="var(--color-ink-400)" strokeWidth="0.55" opacity="0.55" />
      <line x1="10" y1="18.5" x2="24" y2="18.5" stroke="var(--color-ink-400)" strokeWidth="0.55" opacity="0.55" />

      {/* caixa de "TOTAL" destacada */}
      <rect x="10" y="21" width="20" height="10" rx="0.8"
        fill="none" stroke="var(--color-signal)" strokeWidth="1.2" />

      {/* R$ grande dentro da caixa */}
      <text x="20" y="29" textAnchor="middle"
        fontFamily="Roboto Slab, Roboto Slab Variable, serif"
        fontSize="8.5" fontWeight="800" fill="var(--color-signal)">R$</text>
    </svg>
  )
}

// Acaso (na casa) — losango signal com "!" claro.
export function AcasoCellGlyph({ size = 24 }: GlyphProps) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      <polygon points="20,4 36,20 20,36 4,20" fill="var(--color-signal)" stroke="var(--color-ink-950)" strokeWidth="1.6" strokeLinejoin="round" />
      <polygon points="20,9 31,20 20,31 9,20" fill="none" stroke="var(--color-brass-glow)" strokeWidth="0.7" strokeDasharray="1.5 1.5" />
      <path d="M 18 13 L 22 13 L 21 25 L 19 25 Z" fill="var(--color-starlight)" stroke="var(--color-ink-950)" strokeWidth="0.6" />
      <circle cx="20" cy="29" r="2" fill="var(--color-starlight)" stroke="var(--color-ink-950)" strokeWidth="0.6" />
    </svg>
  )
}

// Tesouro (na casa) — mini-baú de metal do tema.
export function TesouroCellGlyph({ size = 24 }: GlyphProps) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      <ellipse cx="20" cy="35" rx="14" ry="1.3" fill="var(--color-ink-950)" opacity="0.45" />
      {/* corpo */}
      <rect x="6" y="20" width="28" height="14" rx="1" fill="var(--color-ink-400)" stroke="var(--color-ink-950)" strokeWidth="1.2" />
      {/* tampa */}
      <path d="M 6 20 Q 6 10 20 10 Q 34 10 34 20 Z" fill="var(--color-ink-500)" stroke="var(--color-ink-950)" strokeWidth="1.2" />
      {/* fita vertical */}
      <rect x="18" y="10" width="4" height="24" fill="var(--color-brass)" stroke="var(--color-ink-950)" strokeWidth="0.6" />
      {/* fechadura */}
      <rect x="16" y="21" width="8" height="7" rx="0.8" fill="var(--color-brass-glow)" stroke="var(--color-ink-950)" strokeWidth="0.8" />
      <circle cx="20" cy="24" r="1" fill="var(--color-ink-950)" />
      <line x1="20" y1="24" x2="20" y2="26.5" stroke="var(--color-ink-950)" strokeWidth="0.8" />
      {/* moedas em cima */}
      <circle cx="10" cy="11" r="2.2" fill="var(--color-brass-glow)" stroke="var(--color-ink-950)" strokeWidth="0.6" />
      <circle cx="30" cy="9" r="1.8" fill="var(--color-brass)" stroke="var(--color-ink-950)" strokeWidth="0.6" />
    </svg>
  )
}

// Carta na mão — silhueta de carta de baralho levemente inclinada, com
// borda dupla e um pip "?" no centro (são cartas-evento de Acaso/Tesouro,
// não baralho comum — o "?" comunica melhor que um naipe). currentColor
// pra herdar do contexto.
export function CardGlyph({ size = 13 }: GlyphProps) {
  return (
    <svg viewBox="0 0 14 18" width={size} height={size} aria-hidden="true" className="shrink-0">
      <g transform="rotate(-10 7 9)">
        <rect x="1.5" y="1.5" width="11" height="15" rx="1.6"
          fill="currentColor" fillOpacity="0.15"
          stroke="currentColor" strokeWidth="1.2" />
        <rect x="2.8" y="2.8" width="8.4" height="12.4" rx="0.8"
          fill="none" stroke="currentColor" strokeWidth="0.5" strokeOpacity="0.55" />
        <text x="7" y="12" textAnchor="middle"
          fontSize="9" fontWeight="800" fill="currentColor"
          fontFamily="Inter, sans-serif">?</text>
      </g>
    </svg>
  )
}

// Gás (3ª utilidade, SRS §2.5) — chama grande com núcleo dourado e
// coração claro, faíscas subindo, sem aro.
export function GasGlyph({ size = 24 }: GlyphProps) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      <ellipse cx="20" cy="36" rx="11" ry="1.2" fill="var(--color-ink-950)" opacity="0.4" />
      {/* faíscas subindo */}
      <g fill="var(--color-group-orange)" opacity="0.7">
        <circle cx="10" cy="10" r="0.9" />
        <circle cx="30.5" cy="8" r="0.7" />
        <circle cx="29" cy="14" r="0.5" />
      </g>
      {/* chama externa */}
      <path d="M 20 3.5 Q 28 12 24.5 20 Q 31 18.5 29 26 Q 27.5 33.5 20 34.5 Q 12.5 33.5 11 26 Q 9.5 20 14.5 16 Q 14 22 17.5 23 Q 13.5 12 20 3.5 Z"
        fill="var(--color-group-orange)" stroke="var(--color-ink-950)" strokeWidth="1.3" strokeLinejoin="round" />
      {/* núcleo dourado */}
      <path d="M 20 16 Q 24.5 21.5 22.5 27 Q 21.5 30.5 20 31 Q 18.5 30.5 17.5 27 Q 15.5 21.5 20 16 Z" fill="var(--color-brass-glow)" />
      {/* coração claro */}
      <path d="M 20 22 Q 22 25 20 28.5 Q 18 25 20 22 Z" fill="var(--color-starlight)" opacity="0.85" />
    </svg>
  )
}

// Bus Ticket (espaço novo, SRS §2.7) — ônibus de frente com letreiro,
// para-brisa com reflexo e faróis acesos.
export function BusGlyph({ size = 24 }: GlyphProps) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      <ellipse cx="20" cy="36" rx="13" ry="1.3" fill="var(--color-ink-950)" opacity="0.45" />
      <rect x="7" y="6" width="26" height="29" rx="3.5" fill="var(--color-brass)" stroke="var(--color-ink-950)" strokeWidth="1.6" />
      <rect x="10" y="8.5" width="20" height="4.5" rx="1" fill="var(--color-ink-900)" />
      <text x="20" y="12.2" textAnchor="middle"
        fontFamily="Inter Variable, sans-serif" fontSize="3.2" fontWeight="800" fill="var(--color-brass-glow)">BUS</text>
      <rect x="10" y="15" width="20" height="8" rx="1.2" fill="var(--color-group-skyblue)" stroke="var(--color-ink-950)" strokeWidth="0.9" />
      <line x1="20" y1="15" x2="20" y2="23" stroke="var(--color-ink-950)" strokeWidth="0.8" />
      {/* reflexo no para-brisa */}
      <path d="M 11 22.6 L 17 15.4 L 19.5 15.4 L 12.8 22.6 Z" fill="#ffffff" opacity="0.18" />
      <circle cx="12" cy="27" r="1.8" fill="var(--color-brass-glow)" stroke="var(--color-ink-950)" strokeWidth="0.6" />
      <circle cx="28" cy="27" r="1.8" fill="var(--color-brass-glow)" stroke="var(--color-ink-950)" strokeWidth="0.6" />
      <rect x="9" y="30.5" width="22" height="3" rx="1" fill="var(--color-ink-500)" stroke="var(--color-ink-950)" strokeWidth="0.6" />
      <circle cx="13" cy="35" r="2.4" fill="var(--color-ink-900)" stroke="var(--color-ink-950)" strokeWidth="0.8" />
      <circle cx="27" cy="35" r="2.4" fill="var(--color-ink-900)" stroke="var(--color-ink-950)" strokeWidth="0.8" />
    </svg>
  )
}

// ---------------------------------------------------------------------
// Glifos do mapa Cidade da Fuligem (055/D-069) — mesmos papéis, outro mundo:
// a locomotiva no lugar do avião, o bilhete de trem no lugar do ônibus, o
// carvão e a caixa d'água nas utilidades. Estilo idêntico: full-bleed 40×40,
// paleta por var(--color-*).
// ---------------------------------------------------------------------

// Ferrovia — locomotiva a vapor de frente, farol aceso e fumaça subindo.
export function TrainGlyph({ size = 24 }: GlyphProps) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      <ellipse cx="20" cy="36.5" rx="14" ry="1.3" fill="var(--color-ink-950)" opacity="0.45" />
      {/* fumaça */}
      <g fill="var(--color-starlight)" opacity="0.3">
        <circle cx="20" cy="4" r="2.2" />
        <circle cx="24" cy="2.8" r="1.4" />
      </g>
      {/* chaminé + caldeira frontal */}
      <rect x="17.5" y="5" width="5" height="4" fill="var(--color-ink-500)" stroke="var(--color-ink-950)" strokeWidth="0.9" />
      <rect x="9" y="9" width="22" height="20" rx="3" fill="var(--color-ink-400)" stroke="var(--color-ink-950)" strokeWidth="1.6" />
      <rect x="12" y="12" width="16" height="7" rx="1.2" fill="var(--color-ink-900)" stroke="var(--color-ink-950)" strokeWidth="0.8" />
      {/* farol */}
      <circle cx="20" cy="23.5" r="3.4" fill="var(--color-brass-glow)" stroke="var(--color-ink-950)" strokeWidth="0.9" />
      <circle cx="20" cy="23.5" r="1.4" fill="var(--color-starlight)" opacity="0.9" />
      {/* para-choque/limpa-trilhos */}
      <path d="M 8 29 L 32 29 L 35 35 L 5 35 Z" fill="var(--color-signal-deep)" stroke="var(--color-ink-950)" strokeWidth="1.2" strokeLinejoin="round" />
      <line x1="14" y1="29.5" x2="11" y2="34.5" stroke="var(--color-ink-950)" strokeWidth="0.8" />
      <line x1="20" y1="29.5" x2="20" y2="34.5" stroke="var(--color-ink-950)" strokeWidth="0.8" />
      <line x1="26" y1="29.5" x2="29" y2="34.5" stroke="var(--color-ink-950)" strokeWidth="0.8" />
      {/* lanternas laterais */}
      <circle cx="11.5" cy="12.5" r="1.1" fill="var(--color-signal)" />
      <circle cx="28.5" cy="12.5" r="1.1" fill="var(--color-signal)" />
    </svg>
  )
}

// Bilhete de Trem — bilhete picotado com furo de conferência.
export function TrainTicketGlyph({ size = 24 }: GlyphProps) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      <ellipse cx="20" cy="35" rx="13" ry="1.2" fill="var(--color-ink-950)" opacity="0.4" />
      <g transform="rotate(-8 20 20)">
        <rect x="5" y="12" width="30" height="16" rx="2" fill="var(--color-brass)" stroke="var(--color-ink-950)" strokeWidth="1.5" />
        {/* picote central */}
        <line x1="26" y1="12.5" x2="26" y2="27.5" stroke="var(--color-ink-950)" strokeWidth="0.9" strokeDasharray="1.6 1.6" />
        {/* furo do conferente */}
        <circle cx="30.5" cy="20" r="1.6" fill="var(--color-ink-900)" stroke="var(--color-ink-950)" strokeWidth="0.5" />
        {/* trilho estampado */}
        <line x1="8" y1="17" x2="23" y2="17" stroke="var(--color-ink-950)" strokeWidth="1" />
        <line x1="8" y1="23" x2="23" y2="23" stroke="var(--color-ink-950)" strokeWidth="1" />
        <line x1="10" y1="15.5" x2="10" y2="24.5" stroke="var(--color-ink-950)" strokeWidth="0.7" />
        <line x1="14" y1="15.5" x2="14" y2="24.5" stroke="var(--color-ink-950)" strokeWidth="0.7" />
        <line x1="18" y1="15.5" x2="18" y2="24.5" stroke="var(--color-ink-950)" strokeWidth="0.7" />
        <line x1="22" y1="15.5" x2="22" y2="24.5" stroke="var(--color-ink-950)" strokeWidth="0.7" />
      </g>
    </svg>
  )
}

// Mina de Carvão — vagonete com carvão e picareta apoiada.
export function CoalGlyph({ size = 24 }: GlyphProps) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      <ellipse cx="20" cy="36" rx="13" ry="1.2" fill="var(--color-ink-950)" opacity="0.4" />
      {/* trilho */}
      <line x1="5" y1="33.5" x2="35" y2="33.5" stroke="var(--color-ink-500)" strokeWidth="1.4" />
      {/* carvão */}
      <g fill="var(--color-ink-900)" stroke="var(--color-ink-950)" strokeWidth="0.7">
        <circle cx="15" cy="15.5" r="3.4" />
        <circle cx="21" cy="13.5" r="3.8" />
        <circle cx="26" cy="16" r="3" />
        <circle cx="18" cy="17" r="2.6" />
      </g>
      {/* brilhos do carvão */}
      <g fill="var(--color-brass-glow)" opacity="0.65">
        <circle cx="20.5" cy="12.8" r="0.7" />
        <circle cx="15.5" cy="15" r="0.55" />
        <circle cx="25.8" cy="15.2" r="0.5" />
      </g>
      {/* caçamba */}
      <path d="M 8 17 L 32 17 L 29 29 L 11 29 Z" fill="var(--color-ink-400)" stroke="var(--color-ink-950)" strokeWidth="1.4" strokeLinejoin="round" />
      <line x1="14" y1="17.5" x2="15.5" y2="28.5" stroke="var(--color-ink-950)" strokeWidth="0.7" opacity="0.6" />
      <line x1="26" y1="17.5" x2="24.5" y2="28.5" stroke="var(--color-ink-950)" strokeWidth="0.7" opacity="0.6" />
      {/* rodas */}
      <circle cx="14.5" cy="31.5" r="2.2" fill="var(--color-ink-900)" stroke="var(--color-ink-950)" strokeWidth="0.8" />
      <circle cx="25.5" cy="31.5" r="2.2" fill="var(--color-ink-900)" stroke="var(--color-ink-950)" strokeWidth="0.8" />
      {/* picareta */}
      <line x1="31" y1="10" x2="35.5" y2="23" stroke="var(--color-brass-soft)" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M 27.5 11.5 Q 31.5 7.5 35.5 9.5" fill="none" stroke="var(--color-ink-300)" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

// Companhia de Água — caixa d'água elevada com gota.
export function WaterGlyph({ size = 24 }: GlyphProps) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      <ellipse cx="20" cy="36.5" rx="12" ry="1.2" fill="var(--color-ink-950)" opacity="0.4" />
      {/* tanque */}
      <path d="M 9 8 L 31 8 L 29 20 L 11 20 Z" fill="var(--color-ink-400)" stroke="var(--color-ink-950)" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M 9 8 Q 20 5 31 8" fill="var(--color-ink-500)" stroke="var(--color-ink-950)" strokeWidth="1.2" />
      {/* aros do tanque */}
      <line x1="10.3" y1="12" x2="29.7" y2="12" stroke="var(--color-ink-950)" strokeWidth="0.7" opacity="0.7" />
      <line x1="10.8" y1="16" x2="29.2" y2="16" stroke="var(--color-ink-950)" strokeWidth="0.7" opacity="0.7" />
      {/* pernas */}
      <line x1="12" y1="20" x2="9" y2="34" stroke="var(--color-ink-500)" strokeWidth="1.8" />
      <line x1="28" y1="20" x2="31" y2="34" stroke="var(--color-ink-500)" strokeWidth="1.8" />
      <line x1="10.5" y1="27" x2="29.5" y2="27" stroke="var(--color-ink-500)" strokeWidth="1" />
      <line x1="11" y1="24" x2="26" y2="31" stroke="var(--color-ink-500)" strokeWidth="0.8" opacity="0.8" />
      <line x1="29" y1="24" x2="14" y2="31" stroke="var(--color-ink-500)" strokeWidth="0.8" opacity="0.8" />
      {/* cano + gota */}
      <line x1="20" y1="20" x2="20" y2="26" stroke="var(--color-ink-500)" strokeWidth="1.6" />
      <path d="M 20 28 Q 22 30.8 20 32.6 Q 18 30.8 20 28 Z" fill="var(--color-group-skyblue)" stroke="var(--color-ink-950)" strokeWidth="0.7" />
      {/* nível d'água pintado */}
      <path d="M 11.6 13.5 Q 20 15 28.4 13.5 L 29 20 L 11 20 Z" fill="var(--color-group-skyblue)" opacity="0.35" />
    </svg>
  )
}


// =====================================================================
// CANTOS DA FULIGEM (D-070) — os três cantos do Atlas são de outro mundo: o globo de
// loteria é de sorteio moderno, e o quepe com estrela é polícia americana de século XX.
// Numa cidade de 1870 nada disso existe.
// =====================================================================

// SORTE GRANDE — pilha de barras de ouro sobre a bancada, com o pó brilhando por cima.
// Substitui o globo de loteria: o prêmio da Fuligem é metal, não bolinha numerada.
export function GoldPileGlyph({ size = 24 }: GlyphProps) {
  const bar = (x: number, y: number, w: number) => (
    <>
      <path
        d={`M${x} ${y}h${w}l${w * 0.13} ${-3.2}h${-w * 0.74}Z`}
        fill="var(--color-brass-glow)"
        stroke="var(--color-ink-950)"
        strokeWidth="0.7"
        strokeLinejoin="round"
      />
      <rect x={x} y={y} width={w} height="3.4" fill="var(--color-brass)" stroke="var(--color-ink-950)" strokeWidth="0.7" />
    </>
  )
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      <ellipse cx="20" cy="34.5" rx="15" ry="1.6" fill="var(--color-ink-950)" opacity="0.5" />
      {/* fileira de baixo (três barras), fileira do meio (duas), coroamento (uma) */}
      {bar(6, 30, 9)}
      {bar(16, 30, 9)}
      {bar(26, 30, 8)}
      {bar(11, 25.5, 9)}
      {bar(21, 25.5, 9)}
      {bar(16, 21, 9)}
      {/* brilho do metal e pó de ouro no ar */}
      <path d="M17.6 22.4h6.2" stroke="var(--color-starlight)" strokeWidth="0.9" strokeLinecap="round" opacity="0.75" />
      <path d="M12.6 26.9h6.2M22.6 26.9h6.2" stroke="var(--color-starlight)" strokeWidth="0.8" strokeLinecap="round" opacity="0.55" />
      <circle cx="12" cy="15" r="1" fill="var(--color-brass-glow)" opacity="0.85" />
      <circle cx="28.5" cy="13.5" r="0.8" fill="var(--color-brass-glow)" opacity="0.7" />
      <circle cx="20.5" cy="11" r="1.2" fill="var(--color-brass-glow)" opacity="0.6" />
      <circle cx="25" cy="17.5" r="0.7" fill="var(--color-brass-glow)" opacity="0.5" />
    </svg>
  )
}

// PRISÃO (visita) — portão de ferro rebitado com grade e cadeado pesado. É a "casa de
// correção" da cidade, não a cadeia de faroeste do Atlas.
export function IronGateGlyph({ size = 24 }: GlyphProps) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      {/* vão de alvenaria */}
      <path d="M6 34V13.5C6 8.8 12.3 5 20 5s14 3.8 14 8.5V34H6Z" fill="var(--color-ink-abyss)" stroke="var(--color-ink-950)" strokeWidth="1.2" />
      {/* aro do portão, em ferro */}
      <path d="M8.5 33V13.8C8.5 10 13.7 7.2 20 7.2s11.5 2.8 11.5 6.6V33" fill="none" stroke="var(--color-brass)" strokeWidth="1.7" />
      {/* barras verticais e travessas */}
      <path d="M13 8.6V33M20 7.2V33M27 8.6V33" stroke="var(--color-brass-soft)" strokeWidth="1.5" />
      <path d="M9 18h22M9 26h22" stroke="var(--color-brass-soft)" strokeWidth="1.5" />
      {/* rebites nas travessas — o sinal de ferro forjado */}
      {[12, 17, 23, 28].map((x) => (
        <circle key={x} cx={x} cy="18" r="0.85" fill="var(--color-brass-glow)" />
      ))}
      {/* cadeado no encontro das duas folhas */}
      <path d="M18.2 21.4v-1.6a1.8 1.8 0 0 1 3.6 0v1.6" fill="none" stroke="var(--color-starlight)" strokeWidth="1.1" />
      <rect x="17" y="21.2" width="6" height="4.6" rx="0.8" fill="var(--color-brass-glow)" stroke="var(--color-ink-950)" strokeWidth="0.7" />
      <circle cx="20" cy="23.4" r="0.75" fill="var(--color-ink-950)" />
      <path d="M4.5 34h31" stroke="var(--color-brass)" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

// VÁ PARA A PRISÃO — ALGEMA: o par de argolas de ferro unido pela corrente curta, na
// diagonal. O quepe de polícia do Atlas é anacrônico aqui; a algema é o instrumento da
// época — e, ao contrário do grilhão de uma argola só, lê como algema a 20px porque o
// PAR é o que nomeia o objeto (uma argola sozinha vira "anel", "ferradura", "C").
export function ShackleGlyph({ size = 24 }: GlyphProps) {
  // Cada punho: anel grosso de ferro com miolo escuro (o vão do pulso) MAIS o corpo da
  // catraca — a peça reta tangente ao aro, virada para a corrente, por onde o arco entra
  // ao fechar. Sem ela dois anéis simétricos leem como binóculo; é a catraca que nomeia
  // a algema. `dir` é ±1: aponta a catraca para o centro do glifo em cada punho.
  const cuff = (cx: number, cy: number, r: number, dir: 1 | -1) => {
    // A catraca fica CENTRADA na linha do aro (offset r/√2 em cada eixo, na diagonal do
    // glifo), atravessando o ferro — dentro do miolo ela viraria um cadeado solto.
    const bx = cx + (dir * r) / Math.SQRT2
    const by = cy + (dir * r) / Math.SQRT2
    return (
      <>
        <circle cx={cx} cy={cy} r={r} fill="var(--color-ink-abyss)" stroke="var(--color-brass)" strokeWidth="3.4" />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--color-brass-glow)" strokeWidth="1.1" opacity="0.65" />
        <circle cx={cx} cy={cy} r={r - 2.1} fill="none" stroke="var(--color-ink-950)" strokeWidth="0.8" opacity="0.8" />
        {/* corpo da catraca: barra chata perpendicular à diagonal, cavalgando o aro */}
        <g transform={`rotate(-45 ${bx} ${by})`}>
          <rect
            x={bx - 3.3}
            y={by - 1.8}
            width="6.6"
            height="3.6"
            rx="1"
            fill="var(--color-brass)"
            stroke="var(--color-ink-950)"
            strokeWidth="0.8"
          />
          {/* ranhuras do dente — só duas, para não sujar em 20px */}
          <path
            d={`M${bx - 1.1} ${by - 0.9}v1.8M${bx + 1.1} ${by - 0.9}v1.8`}
            stroke="var(--color-ink-950)"
            strokeWidth="0.7"
            opacity="0.7"
          />
        </g>
      </>
    )
  }
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      <ellipse cx="20" cy="36" rx="12" ry="1.3" fill="var(--color-ink-950)" opacity="0.4" />
      {/* corrente central: dois elos que ligam os punhos, desenhados ANTES dos anéis
          para que o ferro das argolas passe por cima e feche a junção */}
      {[
        [18.7, 18.7],
        [21.3, 21.3],
      ].map(([cx, cy], i) => (
        <ellipse
          key={i}
          cx={cx}
          cy={cy}
          rx="3"
          ry="2.1"
          transform={`rotate(45 ${cx} ${cy})`}
          fill="none"
          stroke="var(--color-brass-soft)"
          strokeWidth="1.8"
        />
      ))}
      {/* punho de cima (esquerda) e punho de baixo (direita) */}
      {cuff(10.4, 10.4, 7, 1)}
      {cuff(29.6, 29.6, 7, -1)}
      {/* rebite do eixo de cada aro, na diagonal oposta à catraca */}
      <circle cx="5.7" cy="5.7" r="1" fill="var(--color-brass-glow)" stroke="var(--color-ink-950)" strokeWidth="0.5" />
      <circle cx="34.3" cy="34.3" r="1" fill="var(--color-brass-glow)" stroke="var(--color-ink-950)" strokeWidth="0.5" />
      {/* o brilho no ferro, só no punho de cima, para dar volume sem sujar */}
      <path d="M6.2 12.6a5.3 5.3 0 0 1 2.3-6.2" stroke="var(--color-starlight)" strokeWidth="1" strokeLinecap="round" opacity="0.45" fill="none" />
    </svg>
  )
}


// MINA (D-071) — boca de galeria escorada em madeira, com o vagonete e o minério à frente.
// A silhueta é a mesma nos quatro metais (é o mesmo conjunto, tem de ler como conjunto); o
// que muda é a COR do minério e o formato dos torrões, para os quatro serem distinguíveis
// de relance sem depender do nome.
export function MineGlyph({ metal, size = 24 }: GlyphProps & { metal: MetalId }) {
  const ore = METAL_ACCENT[metal]
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} data-glyph={`mina-${metal}`} aria-hidden="true">
      <ellipse cx="20" cy="35" rx="15" ry="1.5" fill="var(--color-ink-950)" opacity="0.45" />
      {/* encosta */}
      <path d="M2 34c3-9 8-15 18-15s15 6 18 15H2Z" fill="var(--color-ink-900)" stroke="var(--color-ink-950)" strokeWidth="0.9" />
      {/* boca da galeria, escorada em madeira */}
      <path d="M13 34V24.5a7 7 0 0 1 14 0V34H13Z" fill="var(--color-ink-abyss)" />
      <path d="M12 34V24.5a8 8 0 0 1 16 0V34" fill="none" stroke="var(--color-brass)" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M15.4 34V25.6M24.6 34v-8.4" stroke="var(--color-brass-soft)" strokeWidth="1.3" />
      <path d="M14 25.8h12" stroke="var(--color-brass-soft)" strokeWidth="1.3" />
      {/* trilho saindo da boca */}
      <path d="M11 33h18M13.5 30.5h13" stroke="var(--color-ink-500)" strokeWidth="0.9" opacity="0.7" />
      {/* torrões de minério — a cor e a forma são a identidade do metal */}
      {metal === 'carvao' && (
        <>
          <path d="m7 31 3-3 3.4 2-1 3.6-4.6.4Z" fill={ore} stroke="var(--color-brass-soft)" strokeWidth="0.7" />
          <path d="m30 32.2 2.6-2.6 3 2.2-1.4 2.2h-4Z" fill={ore} stroke="var(--color-brass-soft)" strokeWidth="0.7" />
        </>
      )}
      {metal === 'ferro' && (
        <>
          <path d="m6.6 30.4 4.2-1.8 2.4 3-2.6 2.6-3.8-1Z" fill={ore} stroke="var(--color-ink-950)" strokeWidth="0.7" />
          <path d="m29.6 31.6 3.6-1.4 2.6 2.4-2 1.6h-3.6Z" fill={ore} stroke="var(--color-ink-950)" strokeWidth="0.7" />
        </>
      )}
      {metal === 'cobre' && (
        <>
          {/* veio, não torrão: o cobre aparece em filete na rocha */}
          <path d="m5.8 32.6 4-4.6 3 1.2-2.2 4.8-4.8-.4Z" fill={ore} stroke="var(--color-ink-950)" strokeWidth="0.7" />
          <path d="m8 29.4 2.6 3.4" stroke="var(--color-brass-glow)" strokeWidth="0.9" strokeLinecap="round" />
          <path d="m30 33 3-3.4 2.8 1.6-1.4 2.6-4.4-.8Z" fill={ore} stroke="var(--color-ink-950)" strokeWidth="0.7" />
        </>
      )}
      {metal === 'estanho' && (
        <>
          {/* grãos redondos e claros — o estanho é aluvionar, vem lavado */}
          <circle cx="9" cy="31.4" r="2.4" fill={ore} stroke="var(--color-ink-950)" strokeWidth="0.7" opacity="0.9" />
          <circle cx="12.6" cy="33.4" r="1.5" fill={ore} stroke="var(--color-ink-950)" strokeWidth="0.6" opacity="0.75" />
          <circle cx="32" cy="32.4" r="2.2" fill={ore} stroke="var(--color-ink-950)" strokeWidth="0.7" opacity="0.9" />
        </>
      )}
      {/* picareta apoiada na escora */}
      <path d="M27.5 22 33 15.5" stroke="var(--color-brass-soft)" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M30.4 14.2c1.6-1.4 4-1.2 5.4.4-1.8.2-3 .8-4 2Z" fill="var(--color-brass)" stroke="var(--color-ink-950)" strokeWidth="0.6" />
    </svg>
  )
}

// ---------------------------------------------------------------------
// Ícones por tipo de casa especial — todos usam glifos SVG próprios. O
// glifo é escolhido pelo MAPA ativo quando o papel muda de mundo (avião →
// locomotiva, ônibus → bilhete, bomba de gasolina → vagonete de carvão…).
// ---------------------------------------------------------------------
export function SquareIcon({ square, size = 18 }: { square: Square; size?: number | string }) {
  const fuligem = activeCatalog().id === 'fuligem'
  switch (square.kind) {
    case 'airport':         return fuligem ? <TrainGlyph size={size} /> : <AirportGlyph size={size} />
    case 'utility':         return square.icon === 'fuel' ? (fuligem ? <CoalGlyph size={size} /> : <FuelGlyph size={size} />)
                                 : square.icon === 'bolt' ? <BoltGlyph size={size} />
                                 : (fuligem ? <WaterGlyph size={size} /> : <GasGlyph size={size} />)
    case 'mine':            return <MineGlyph metal={square.metal} size={size} />
    case 'tax':             return <TaxGlyph        size={size} />
    case 'acaso':           return <AcasoCellGlyph size={size} />
    case 'tesouro':         return <TesouroCellGlyph  size={size} />
    case 'bus-ticket':      return fuligem ? <TrainTicketGlyph size={size} /> : <BusGlyph size={size} />
    case 'corner-go':       return <GoGlyph         size={size} />
    case 'corner-jail':     return fuligem ? <IronGateGlyph size={size} /> : <JailGlyph size={size} />
    case 'corner-parking':  return fuligem ? <GoldPileGlyph size={size} /> : <LotteryGlyph size={size} />
    case 'corner-gotojail': return fuligem ? <ShackleGlyph  size={size} /> : <GoToJailGlyph size={size} />
    default: return null
  }
}
