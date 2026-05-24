import { cn } from '@/lib/utils'
import { Crown } from 'lucide-react'
import { motion, AnimatePresence, useAnimate } from 'motion/react'
import { useEffect, useRef, useState } from 'react'

import type { Square, PropertySquare, AirportSquare, TaxSquare, UtilitySquare } from '@/lib/boardData'
import { BOARD } from '@/lib/boardData'
import { useGameStore } from '@/game/store'
import { goBonus } from '@/game/balancing/balancing'
import { cityLevel } from '@/game/economy/construction'
import { THEME } from '@/game/theme'
import { deedView } from '@/game/ui/deed/deedView'
import { useTradeUI } from '@/game/ui/trade/TradeLayer'
import { HandPanel } from '@/game/ui/cards/HandPanel'
import { tradesView } from '@/game/ui/trade/tradesView'
import type { GameState } from '@/game/turn/types'
import type { TempEffect, Trade, ImmunityGrant } from '@/game/economy/types'

// ---------------------------------------------------------------------
// Glifos SVG próprios para casas especiais — substituem ícones lucide
// genéricos por ilustrações com personalidade.
// Cada glifo aceita size: number|string (suporta "1em" pra escala via cqi).
// ---------------------------------------------------------------------
type GlyphProps = { size?: number | string }

// GO — moeda gigante "R$ 200" (o bônus de passar pelo GO, SRS §13.6).
// O R$200 explícito comunica imediatamente "ganhei dinheiro aqui", sem
// precisar de label textual fora do ícone.
function GoGlyph({ size = 24 }: GlyphProps) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      {/* raios/sparkles ao redor */}
      <g stroke="#ffd97a" strokeWidth="1.1" strokeLinecap="round" opacity="0.6">
        <line x1="20" y1="1.5" x2="20" y2="3.5" />
        <line x1="38.5" y1="20" x2="36.5" y2="20" />
        <line x1="20" y1="38.5" x2="20" y2="36.5" />
        <line x1="1.5" y1="20" x2="3.5" y2="20" />
        <line x1="33"   y1="7"  x2="31.5" y2="8.5" />
        <line x1="33"   y1="33" x2="31.5" y2="31.5" />
        <line x1="7"    y1="33" x2="8.5"  y2="31.5" />
        <line x1="7"    y1="7"  x2="8.5"  y2="8.5" />
      </g>
      <ellipse cx="20" cy="36.5" rx="13" ry="1.2" fill="#0f0c09" opacity="0.45" />
      {/* moeda dourada grande */}
      <circle cx="20" cy="20" r="15" fill="#d4af37" stroke="#0f0c09" strokeWidth="1.8" />
      <circle cx="20" cy="20" r="12.6" fill="none" stroke="#b8941f" strokeWidth="0.7" strokeDasharray="1 1.4" />
      {/* highlight 3D no topo */}
      <ellipse cx="14" cy="12" rx="4" ry="2" fill="#ffd97a" opacity="0.55" />
      {/* R$ */}
      <text x="20" y="17.5" textAnchor="middle"
        fontFamily="Roboto Slab, Roboto Slab Variable, serif"
        fontSize="7.5" fontWeight="800" fill="#0f0c09">R$</text>
      {/* 200 */}
      <text x="20" y="28.5" textAnchor="middle"
        fontFamily="Roboto Slab, Roboto Slab Variable, serif"
        fontSize="10" fontWeight="800" fill="#0f0c09" letterSpacing="-0.06em">200</text>
    </svg>
  )
}

// Prisão (visita) — cela com paredes de pedra, barras de ferro, prisioneiro.
function JailGlyph({ size = 24 }: GlyphProps) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      {/* parede de pedra externa */}
      <rect x="1" y="1" width="38" height="38" rx="1.5"
        fill="#3d3528" stroke="#0f0c09" strokeWidth="1.2" />

      {/* tijolos em padrão alternado */}
      <g stroke="#1a1410" strokeWidth="0.6" opacity="0.6">
        <line x1="1"  y1="7"  x2="39" y2="7"  />
        <line x1="1"  y1="14" x2="39" y2="14" />
        <line x1="1"  y1="26" x2="39" y2="26" />
        <line x1="1"  y1="33" x2="39" y2="33" />
        {/* linhas verticais alternadas por fileira */}
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

      {/* abertura da cela (vão escuro) */}
      <rect x="6" y="9" width="28" height="22" rx="0.5"
        fill="#0a0805" stroke="#0f0c09" strokeWidth="1" />

      {/* fundo "fim do corredor" com gradiente */}
      <defs>
        <radialGradient id="cellDark" cx="50%" cy="60%" r="60%">
          <stop offset="0%" stopColor="#1a1410" />
          <stop offset="100%" stopColor="#0a0805" />
        </radialGradient>
      </defs>
      <rect x="7" y="10" width="26" height="20" fill="url(#cellDark)" />

      {/* PRISIONEIRO atrás das barras */}
      {/* corpo (ombros sugeridos) */}
      <path d="M 13 28 Q 13 22 20 22 Q 27 22 27 28 L 27 31 L 13 31 Z"
        fill="#5c4a36" stroke="#0f0c09" strokeWidth="0.6" />
      {/* listras de presidiário */}
      <line x1="13" y1="25" x2="27" y2="25" stroke="#a89683" strokeWidth="0.8" />
      <line x1="13" y1="27.5" x2="27" y2="27.5" stroke="#a89683" strokeWidth="0.8" />

      {/* cabeça */}
      <circle cx="20" cy="19" r="4.5" fill="#b07a4a" stroke="#0f0c09" strokeWidth="0.6" />
      {/* highlight do rosto */}
      <ellipse cx="18.5" cy="17" rx="1.5" ry="0.8" fill="#ffffff" opacity="0.18" />
      {/* olhos */}
      <circle cx="18.2" cy="18.7" r="0.9" fill="#f4e8d0" />
      <circle cx="21.8" cy="18.7" r="0.9" fill="#f4e8d0" />
      <circle cx="18.3" cy="18.8" r="0.5" fill="#0f0c09" />
      <circle cx="21.9" cy="18.8" r="0.5" fill="#0f0c09" />
      {/* sobrancelhas */}
      <line x1="16.5" y1="16.6" x2="19" y2="17.4" stroke="#0f0c09" strokeWidth="0.7" strokeLinecap="round" />
      <line x1="23.5" y1="16.6" x2="21" y2="17.4" stroke="#0f0c09" strokeWidth="0.7" strokeLinecap="round" />
      {/* boca triste */}
      <path d="M 17.5 21.6 Q 20 20.5 22.5 21.6" stroke="#0f0c09" strokeWidth="0.7" fill="none" strokeLinecap="round" />

      {/* mãos agarradas nas barras (visíveis ao lado das mãos do prisioneiro) */}
      <g fill="#b07a4a" stroke="#0f0c09" strokeWidth="0.4">
        <ellipse cx="14" cy="23" rx="1.4" ry="1.1" />
        <ellipse cx="26" cy="23" rx="1.4" ry="1.1" />
      </g>

      {/* travessa horizontal de ferro (atrás das barras verticais) */}
      <rect x="6" y="15" width="28" height="2" fill="#a89683" stroke="#5c4a36" strokeWidth="0.5" />
      <line x1="6" y1="15.4" x2="34" y2="15.4" stroke="#f4e8d0" strokeWidth="0.3" opacity="0.5" />

      {/* BARRAS VERTICAIS DE FERRO — grossas, com brilho lateral */}
      <g>
        <rect x="10" y="9" width="2.4" height="22" fill="#a89683" stroke="#5c4a36" strokeWidth="0.5" />
        <line x1="10.4" y1="9" x2="10.4" y2="31" stroke="#f4e8d0" strokeWidth="0.3" opacity="0.5" />

        <rect x="18.8" y="9" width="2.4" height="22" fill="#a89683" stroke="#5c4a36" strokeWidth="0.5" />
        <line x1="19.2" y1="9" x2="19.2" y2="31" stroke="#f4e8d0" strokeWidth="0.3" opacity="0.5" />

        <rect x="27.6" y="9" width="2.4" height="22" fill="#a89683" stroke="#5c4a36" strokeWidth="0.5" />
        <line x1="28" y1="9" x2="28" y2="31" stroke="#f4e8d0" strokeWidth="0.3" opacity="0.5" />
      </g>

      {/* CADEADO pendurado numa das barras inferiores */}
      <g transform="translate(4 32)">
        <path d="M 1.5 1.8 Q 1.5 0 3 0 Q 4.5 0 4.5 1.8" fill="none" stroke="#5c4a36" strokeWidth="0.8" strokeLinecap="round" />
        <rect x="0.5" y="1.8" width="5" height="4" rx="0.4" fill="#3d3528" stroke="#0f0c09" strokeWidth="0.5" />
        <circle cx="3" cy="3.6" r="0.5" fill="#a89683" />
        <line x1="3" y1="3.6" x2="3" y2="5" stroke="#a89683" strokeWidth="0.4" />
      </g>
    </svg>
  )
}

// Vá pra Prisão — quepe de polícia (cap azul com viseira preta e estrela
// dourada no centro). Substitui as algemas — quepe lê mais rápido como
// "polícia" e tem leitura clara em tamanho pequeno.
function GoToJailGlyph({ size = 24 }: GlyphProps) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      <ellipse cx="20" cy="36" rx="14" ry="1.3" fill="#0f0c09" opacity="0.45" />
      {/* coroa/topo do quepe */}
      <path d="M 8 22 Q 8 8 20 8 Q 32 8 32 22 L 32 23 L 8 23 Z"
        fill="#1e3a8a" stroke="#0f0c09" strokeWidth="1.6" strokeLinejoin="round" />
      {/* highlight 3D no topo */}
      <ellipse cx="14" cy="11.5" rx="3.5" ry="1.4" fill="#ffffff" opacity="0.18" />
      {/* faixa preta com borda dourada (cinta do quepe) */}
      <rect x="7" y="22.5" width="26" height="4" fill="#0f0c09" stroke="#0f0c09" strokeWidth="0.5" />
      <line x1="7" y1="22.5" x2="33" y2="22.5" stroke="#ffd97a" strokeWidth="0.5" opacity="0.7" />
      <line x1="7" y1="26.5" x2="33" y2="26.5" stroke="#ffd97a" strokeWidth="0.5" opacity="0.7" />
      {/* viseira (visor) */}
      <path d="M 4 29 Q 12 32.5 20 32.5 Q 28 32.5 36 29 L 36 27.5 L 4 27.5 Z"
        fill="#1a1410" stroke="#0f0c09" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M 6 29 Q 13 31 20 31 Q 27 31 34 29" stroke="#5c4a36" strokeWidth="0.6" fill="none" />
      {/* estrela dourada no centro do quepe */}
      <polygon points="20,12 21.6,16 25.8,16 22.4,18.7 23.7,22.6 20,20.1 16.3,22.6 17.6,18.7 14.2,16 18.4,16"
        fill="#ffd97a" stroke="#0f0c09" strokeWidth="0.7" strokeLinejoin="round" />
      {/* miolinho da estrela */}
      <circle cx="20" cy="17.5" r="0.9" fill="#0f0c09" />
    </svg>
  )
}

// Loteria — globo/drum da Mega-Sena com 3 bolas coloridas dentro.
// Versão anterior tinha só 3 bolas flutuantes — sem contexto, parecia
// "esferas aleatórias" e não "máquina de loteria".
function LotteryGlyph({ size = 24 }: GlyphProps) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      <ellipse cx="20" cy="36" rx="14" ry="1.3" fill="#0f0c09" opacity="0.45" />
      {/* base/pedestal */}
      <rect x="13" y="33.5" width="14" height="2.5" rx="0.5" fill="#0f0c09" />
      <rect x="17" y="30" width="6" height="4" fill="#3d3528" stroke="#0f0c09" strokeWidth="0.8" />
      {/* esfera do globo (vidro escuro com aro dourado) */}
      <circle cx="20" cy="17" r="13" fill="#1a1410" stroke="#d4af37" strokeWidth="1.8" />
      {/* highlight de vidro */}
      <ellipse cx="13.5" cy="10" rx="3.5" ry="2" fill="#ffffff" opacity="0.3" />
      {/* aro inferior do drum */}
      <ellipse cx="20" cy="28" rx="13" ry="3" fill="#3d3528" stroke="#0f0c09" strokeWidth="1" />
      <ellipse cx="20" cy="27.5" rx="11.5" ry="2" fill="#1a1410" />
      {/* 3 bolas dentro do globo, com cores fortes */}
      <circle cx="14" cy="21" r="3.4" fill="#dc2626" stroke="#0f0c09" strokeWidth="0.7" />
      <text x="14" y="22.2" textAnchor="middle"
        fontFamily="Roboto Slab, Roboto Slab Variable, serif"
        fontSize="3.2" fontWeight="800" fill="#f4e8d0">07</text>
      <circle cx="22" cy="14.5" r="3.8" fill="#ffd97a" stroke="#0f0c09" strokeWidth="0.8" />
      <text x="22" y="15.8" textAnchor="middle"
        fontFamily="Roboto Slab, Roboto Slab Variable, serif"
        fontSize="3.6" fontWeight="800" fill="#0f0c09">22</text>
      <circle cx="26" cy="22" r="3.2" fill="#22c55e" stroke="#0f0c09" strokeWidth="0.7" />
      <text x="26" y="23.2" textAnchor="middle"
        fontFamily="Roboto Slab, Roboto Slab Variable, serif"
        fontSize="3" fontWeight="800" fill="#f4e8d0">58</text>
    </svg>
  )
}

// Aeroporto — avião top-down com rastro de viagem.
function AirportGlyph({ size = 24 }: GlyphProps) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      {/* rastro pontilhado */}
      <path d="M 4 35 Q 13 30 20 24 T 34 8"
        stroke="#d4af37" strokeWidth="1" strokeDasharray="2 2.5"
        fill="none" opacity="0.5" />
      {/* avião */}
      <g stroke="#0f0c09" strokeWidth="1.2" strokeLinejoin="round">
        <path d="M 20 6 Q 22.5 7 22.5 15 L 22.5 24 L 20 28 L 17.5 24 L 17.5 15 Q 17.5 7 20 6 Z"
          fill="#d4af37" />
        <path d="M 4 18 L 17.5 15.5 L 17.5 21 L 4 22.5 Z" fill="#d4af37" />
        <path d="M 36 18 L 22.5 15.5 L 22.5 21 L 36 22.5 Z" fill="#d4af37" />
        <path d="M 13 28 L 20 27 L 27 28 L 25 32 L 15 32 Z" fill="#d4af37" />
      </g>
      <ellipse cx="20" cy="10" rx="1.5" ry="2.4" fill="#1a1410" />
      <ellipse cx="20" cy="9.5" rx="0.9" ry="1.1" fill="#67c3e0" opacity="0.65" />
    </svg>
  )
}

// Petrobras — bomba de combustível com display + label PETRO.
// Composição centralizada em x=20: corpo + base + mangueira em arco simétrico
// sobre o topo. Versão anterior tinha mangueira lateral puxando peso visual
// pra direita-baixo, fazendo o ícone parecer "deslocado" na célula.
function FuelGlyph({ size = 24 }: GlyphProps) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      {/* sombra do chão */}
      <ellipse cx="20" cy="36" rx="14" ry="1.2" fill="#0f0c09" opacity="0.4" />
      {/* base */}
      <rect x="9" y="33" width="22" height="2.5" rx="0.5" fill="#0f0c09" />
      {/* corpo da bomba */}
      <rect x="10" y="11" width="20" height="22" rx="1.5"
        fill="#5c4a36" stroke="#0f0c09" strokeWidth="1.4" />
      <rect x="10" y="11" width="20" height="3" rx="1.5" fill="#3d3528" stroke="#0f0c09" strokeWidth="1" />
      {/* display */}
      <rect x="12" y="15.5" width="16" height="6" rx="0.5"
        fill="#1a1410" stroke="#0f0c09" strokeWidth="0.6" />
      <text x="20" y="20" textAnchor="middle"
        fontFamily="Roboto Slab, Roboto Slab Variable, serif"
        fontSize="4" fontWeight="700" fill="#d4af37" letterSpacing="0.3">88.88</text>
      {/* label PETRO */}
      <rect x="12" y="23" width="16" height="7" rx="0.5"
        fill="#22c55e" stroke="#0f0c09" strokeWidth="0.5" />
      <text x="20" y="27.9" textAnchor="middle"
        fontFamily="Inter Variable, sans-serif"
        fontSize="3.8" fontWeight="800" fill="#0f0c09" letterSpacing="0.2">PETRO</text>
      {/* mangueira em arco simétrico sobre o topo + bico central */}
      <path d="M 13 11 Q 13 5 17 5 L 23 5 Q 27 5 27 11"
        fill="none" stroke="#3d3528" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <rect x="18.5" y="3.5" width="3" height="2.5" rx="0.5" fill="#3d3528" stroke="#0f0c09" strokeWidth="0.4" />
    </svg>
  )
}

// Eletrobras — raio dentro de círculo com pequenos arcos elétricos.
function BoltGlyph({ size = 24 }: GlyphProps) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      <g stroke="#ffd97a" strokeWidth="0.8" strokeLinecap="round" opacity="0.55" fill="none">
        <path d="M 4 12 Q 8 14 6 17" />
        <path d="M 36 12 Q 32 14 34 17" />
        <path d="M 4 28 Q 8 26 6 23" />
        <path d="M 36 28 Q 32 26 34 23" />
      </g>
      <circle cx="20" cy="20" r="14" fill="#1a1410" stroke="#d4af37" strokeWidth="1.6" />
      <circle cx="20" cy="20" r="12" fill="none" stroke="#b8941f" strokeWidth="0.5" strokeDasharray="1 1.5" />
      <path d="M 21 8 L 12 22 L 18 22 L 15 32 L 26 17 L 20 17 L 22 8 Z"
        fill="#ffd97a" stroke="#0f0c09" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  )
}

// Imposto — boleto/fatura: papel cream, cabeçalho vermelho com selo,
// linhas de campos e caixa de "TOTAL R$" destacada em vermelho.
function TaxGlyph({ size = 24 }: GlyphProps) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      {/* sombra do chão */}
      <ellipse cx="20" cy="36.5" rx="13" ry="1.3" fill="#0f0c09" opacity="0.4" />

      {/* papel — cream com borda escura */}
      <rect x="7" y="5" width="26" height="29" rx="1.5"
        fill="#f4e8d0" stroke="#0f0c09" strokeWidth="1.4" />

      {/* cabeçalho vermelho da fatura */}
      <path d="M 7 6.5 Q 7 5 8.5 5 L 31.5 5 Q 33 5 33 6.5 L 33 12 L 7 12 Z"
        fill="#dc2626" stroke="#0f0c09" strokeWidth="1.1" strokeLinejoin="round" />

      {/* selo redondo no header */}
      <circle cx="11.5" cy="8.5" r="1.7" fill="#f4e8d0" stroke="#991b1b" strokeWidth="0.5" />
      <circle cx="11.5" cy="8.5" r="0.7" fill="#dc2626" />

      {/* linhas sugerindo "REPÚBLICA / RECEITA" no header */}
      <line x1="15" y1="7.5" x2="29" y2="7.5" stroke="#f4e8d0" strokeWidth="0.7" opacity="0.85" />
      <line x1="15" y1="10" x2="26" y2="10" stroke="#f4e8d0" strokeWidth="0.6" opacity="0.65" />

      {/* linhas dos campos da fatura */}
      <line x1="10" y1="16" x2="30" y2="16" stroke="#5c4a36" strokeWidth="0.55" opacity="0.55" />
      <line x1="10" y1="18.5" x2="24" y2="18.5" stroke="#5c4a36" strokeWidth="0.55" opacity="0.55" />

      {/* caixa de "TOTAL" destacada */}
      <rect x="10" y="21" width="20" height="10" rx="0.8"
        fill="none" stroke="#dc2626" strokeWidth="1.2" />

      {/* R$ grande dentro da caixa */}
      <text x="20" y="29" textAnchor="middle"
        fontFamily="Roboto Slab, Roboto Slab Variable, serif"
        fontSize="8.5" fontWeight="800" fill="#dc2626">R$</text>
    </svg>
  )
}

// Acaso (na casa) — losango vermelho com "!" branco.
function AcasoCellGlyph({ size = 24 }: GlyphProps) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      <polygon points="20,4 36,20 20,36 4,20" fill="#dc2626" stroke="#0f0c09" strokeWidth="1.6" strokeLinejoin="round" />
      <polygon points="20,9 31,20 20,31 9,20" fill="none" stroke="#ffd97a" strokeWidth="0.7" strokeDasharray="1.5 1.5" />
      <path d="M 18 13 L 22 13 L 21 25 L 19 25 Z" fill="#f4e8d0" stroke="#0f0c09" strokeWidth="0.6" />
      <circle cx="20" cy="29" r="2" fill="#f4e8d0" stroke="#0f0c09" strokeWidth="0.6" />
    </svg>
  )
}

// Tesouro (na casa) — mini-baú dourado.
function TesouroCellGlyph({ size = 24 }: GlyphProps) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      <ellipse cx="20" cy="35" rx="14" ry="1.3" fill="#0f0c09" opacity="0.45" />
      {/* corpo */}
      <rect x="6" y="20" width="28" height="14" rx="1" fill="#5c4a36" stroke="#0f0c09" strokeWidth="1.2" />
      {/* tampa */}
      <path d="M 6 20 Q 6 10 20 10 Q 34 10 34 20 Z" fill="#3d3528" stroke="#0f0c09" strokeWidth="1.2" />
      {/* fita vertical */}
      <rect x="18" y="10" width="4" height="24" fill="#d4af37" stroke="#0f0c09" strokeWidth="0.6" />
      {/* fechadura */}
      <rect x="16" y="21" width="8" height="7" rx="0.8" fill="#ffd97a" stroke="#0f0c09" strokeWidth="0.8" />
      <circle cx="20" cy="24" r="1" fill="#0f0c09" />
      <line x1="20" y1="24" x2="20" y2="26.5" stroke="#0f0c09" strokeWidth="0.8" />
      {/* moedas em cima */}
      <circle cx="10" cy="11" r="2.2" fill="#ffd97a" stroke="#0f0c09" strokeWidth="0.6" />
      <circle cx="30" cy="9" r="1.8" fill="#d4af37" stroke="#0f0c09" strokeWidth="0.6" />
    </svg>
  )
}

// Carta na mão — silhueta de carta de baralho levemente inclinada, com
// borda dupla e um pip "?" no centro (são cartas-evento de Acaso/Tesouro,
// não baralho comum — o "?" comunica melhor que um naipe). currentColor
// pra herdar do contexto.
function CardGlyph({ size = 13 }: GlyphProps) {
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

// ---------------------------------------------------------------------
// Helpers de classe para o grupo (faixa colorida)
// ---------------------------------------------------------------------
export const GROUP_BG: Record<string, string> = {
  brown:   'bg-group-brown',
  skyblue: 'bg-group-skyblue',
  pink:    'bg-group-pink',
  orange:  'bg-group-orange',
  red:     'bg-group-red',
  yellow:  'bg-group-yellow',
  green:   'bg-group-green',
  navy:    'bg-group-navy',
  purple:  'bg-group-purple',
}

// Cores hex pros grupos (match com --color-group-* no index.css).
// Usadas onde Tailwind class não dá (style inline, JS dinâmico, modal etc).
export const GROUP_COLOR: Record<string, string> = {
  brown:   '#b07a4a',
  skyblue: '#67c3e0',
  pink:    '#ec4899',
  orange:  '#fb923c',
  red:     '#ef4444',
  yellow:  '#facc15',
  green:   '#22c55e',
  navy:    '#3b82f6',
  purple:  '#a855f7',
}

// Custo de casa por grupo (mock, SRS §13.7) — grupos mais caros = casas
// mais caras. Refletido no modal de Title Deed.
export const HOUSE_COST: Record<string, number> = {
  brown:   50,  skyblue: 50,
  pink:    100, orange:  100,
  red:     150, yellow:  150,
  green:   200, navy:    200,
  purple:  200,
}

// Gás (3ª utilidade, SRS §2.5) — botijão com chama. Mesmo estilo de aro
// dourado das outras utilidades (Petro/Eletro).
function GasGlyph({ size = 24 }: GlyphProps) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      <g stroke="#ffd97a" strokeWidth="0.8" strokeLinecap="round" opacity="0.5" fill="none">
        <path d="M 5 13 Q 9 15 7 18" />
        <path d="M 35 13 Q 31 15 33 18" />
      </g>
      <circle cx="20" cy="20" r="14" fill="#1a1410" stroke="#d4af37" strokeWidth="1.6" />
      <circle cx="20" cy="20" r="12" fill="none" stroke="#b8941f" strokeWidth="0.5" strokeDasharray="1 1.5" />
      {/* chama central */}
      <path d="M 20 9 Q 26 16 23 23 Q 28 22 26 28 Q 24 33 20 33 Q 14 33 13 27 Q 12 22 16 19 Q 16 24 19 24 Q 16 16 20 9 Z"
        fill="#fb923c" stroke="#0f0c09" strokeWidth="1.1" strokeLinejoin="round" />
      <path d="M 20 20 Q 23 24 20 29 Q 17 25 20 20 Z" fill="#ffd97a" />
    </svg>
  )
}

// Bus Ticket (espaço novo, SRS §2.7) — ônibus de frente, com letreiro,
// para-brisa e faróis. Lê rápido como "ônibus".
function BusGlyph({ size = 24 }: GlyphProps) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      <ellipse cx="20" cy="36" rx="13" ry="1.3" fill="#0f0c09" opacity="0.45" />
      {/* carroceria */}
      <rect x="7" y="6" width="26" height="29" rx="3.5"
        fill="#d4af37" stroke="#0f0c09" strokeWidth="1.6" />
      {/* letreiro */}
      <rect x="10" y="8.5" width="20" height="4.5" rx="1" fill="#1a1410" />
      <text x="20" y="12.2" textAnchor="middle"
        fontFamily="Inter Variable, sans-serif" fontSize="3.2" fontWeight="800" fill="#ffd97a">BUS</text>
      {/* para-brisa */}
      <rect x="10" y="15" width="20" height="8" rx="1.2" fill="#67c3e0" stroke="#0f0c09" strokeWidth="0.9" />
      <line x1="20" y1="15" x2="20" y2="23" stroke="#0f0c09" strokeWidth="0.8" />
      {/* faróis */}
      <circle cx="12" cy="27" r="1.8" fill="#ffd97a" stroke="#0f0c09" strokeWidth="0.6" />
      <circle cx="28" cy="27" r="1.8" fill="#ffd97a" stroke="#0f0c09" strokeWidth="0.6" />
      {/* para-choque + faixa */}
      <rect x="9" y="30.5" width="22" height="3" rx="1" fill="#3d3528" stroke="#0f0c09" strokeWidth="0.6" />
      {/* rodas */}
      <circle cx="13" cy="35" r="2.4" fill="#1a1410" stroke="#0f0c09" strokeWidth="0.8" />
      <circle cx="27" cy="35" r="2.4" fill="#1a1410" stroke="#0f0c09" strokeWidth="0.8" />
    </svg>
  )
}

// ---------------------------------------------------------------------
// Ícones por tipo de casa especial — todos usam glifos SVG próprios.
// ---------------------------------------------------------------------
export function SquareIcon({ square, size = 18 }: { square: Square; size?: number | string }) {
  switch (square.kind) {
    case 'airport':         return <AirportGlyph    size={size} />
    case 'utility':         return square.icon === 'fuel' ? <FuelGlyph size={size} />
                                 : square.icon === 'bolt' ? <BoltGlyph size={size} />
                                 : <GasGlyph size={size} />
    case 'tax':             return <TaxGlyph        size={size} />
    case 'acaso':           return <AcasoCellGlyph size={size} />
    case 'tesouro':         return <TesouroCellGlyph  size={size} />
    case 'bus-ticket':      return <BusGlyph        size={size} />
    case 'corner-go':       return <GoGlyph         size={size} />
    case 'corner-jail':     return <JailGlyph       size={size} />
    case 'corner-parking':  return <LotteryGlyph    size={size} />
    case 'corner-gotojail': return <GoToJailGlyph   size={size} />
    default: return null
  }
}

// ---------------------------------------------------------------------
// Side = qual lado do tabuleiro a casa pertence (decide a orientação)
// ---------------------------------------------------------------------
export type Side = 'bottom' | 'left' | 'top' | 'right' | 'corner'

export function sideOf(pos: number): Side {
  // Cantos em 0/12/24/36 · 11 casas por lado (tabuleiro de 48).
  if (pos === 0 || pos === 12 || pos === 24 || pos === 36) return 'corner'
  if (pos < 12)  return 'bottom'  // 1–11
  if (pos < 24)  return 'left'    // 13–23
  if (pos < 36)  return 'top'     // 25–35
  return 'right'                  // 37–47
}

// ---------------------------------------------------------------------
// Bandeira-avatar do país — chip redondo SVG (flagcdn.com, não emoji).
// Em todos os lados o flag fica ancorado na borda INTERNA da célula
// (voltada pro centro do tabuleiro): centro do círculo sobre a borda
// interna, centralizado no eixo paralelo. Metade dentro da célula,
// metade transbordando sobre o centro do tabuleiro. `.board-square` é
// renderizado sem `overflow-hidden` em propriedades pra metade externa
// não ser cortada; flag em `z-40` pra ficar acima de stripe, mortgage e
// center-arena.
// ---------------------------------------------------------------------
function FlagAvatar({ iso2, side }: { iso2: string; side: Side }) {
  // Leste/oeste: bandeira no TOPO da casa, dentro dela (início da pilha
  // avatar → nome → valor). Sul/norte: continua cravada na borda interna,
  // metade transbordando sobre o centro (anel de bandeiras).
  // Circulinho 32px em TODOS os lados, cravado/atravessado na borda INTERNA
  // (voltada pro centro), metade dentro da célula e metade transbordando
  // sobre o centro. Nas laterais é a borda vertical (direita na col esquerda,
  // esquerda na col direita) — mesmo tratamento de cima/baixo.
  const size = 32
  const position: React.CSSProperties = (() => {
    switch (side) {
      case 'bottom': return { top: 0,    left: '50%', transform: 'translate(-50%, -50%)' }
      case 'top':    return { bottom: 0, left: '50%', transform: 'translate(-50%, 50%)' }
      case 'left':   return { right: 0,  top: '50%',  transform: 'translate(50%, -50%)' }
      case 'right':  return { left: 0,   top: '50%',  transform: 'translate(-50%, -50%)' }
      default:       return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
    }
  })()
  // A BASE da bandeira aponta para o nome (que fica no lado externo). Como a
  // bandeira atravessa a borda interna, a base aponta pra fora → gira por lado.
  const artRotation =
    side === 'left' ? 90 : side === 'right' ? -90 : side === 'top' ? 180 : 0
  return (
    <div
      className="absolute rounded-full border-2 border-coffee-950 bg-coffee-900 overflow-hidden pointer-events-none z-40"
      style={{
        ...position,
        width: size,
        height: size,
        boxShadow: '0 2px 6px rgba(0,0,0,0.7), inset 0 0 0 1.5px rgba(212,175,55,0.6)',
      }}
      title={iso2}
    >
      <img
        src={`https://flagcdn.com/${iso2.toLowerCase()}.svg`}
        alt={iso2}
        className="w-full h-full object-cover block"
        style={{ transform: `rotate(${artRotation}deg)` }}
        draggable={false}
      />
    </div>
  )
}

// ---------------------------------------------------------------------
// Classic property square — bandeira-avatar do país na borda interna;
// stripe colorida só aparece quando há dono (na cor do jogador).
// Usado pelos boards 1, 2, 3
// ---------------------------------------------------------------------
export function ClassicSquare({
  square,
  side,
}: { square: Square; side: Side }) {
  const isProperty = square.kind === 'property'
  const isAirport  = square.kind === 'airport'
  const isUtility  = square.kind === 'utility'
  const isTax      = square.kind === 'tax'
  const isAcaso    = square.kind === 'acaso'
  const isTesouro  = square.kind === 'tesouro'
  const isBus      = square.kind === 'bus-ticket'
  const isCard     = isAcaso || isTesouro

  // Dono atual (real, do store) — cor por assento; comunica a posse na célula (023.1).
  const ownerColor = useGameStore((s) => {
    const t = s.game.titles[square.pos]
    if (!t?.ownerId) return undefined
    const i = s.game.players.findIndex((p) => p.id === t.ownerId)
    return i >= 0 ? PLAYER_COLORS[i % PLAYER_COLORS.length] : undefined
  })
  // Propriedade COMPRADA não exibe valor — a posse é comunicada pela stripe
  // colorida do jogador. Só propriedade À VENDA (sem dono) mostra o preço.

  // O flag transborda pelo lado interno da célula sobre o centro do
  // tabuleiro em todos os lados — `.board-square` precisa rodar sem
  // `overflow-hidden` pra metade externa do círculo não ser cortada.
  return (
    <div className="board-square relative w-full h-full">
      {/* POSSE — o card inteiro "veste" a cor do dono:
            1) tint suave da cor cobrindo o corpo inteiro;
            2) moldura fina na cor do dono cercando a célula;
            3) pílula arredondada da cor do dono, centralizada na borda
               externa — substitui a faixa chapada antiga (que lia como
               adesivo solto). Vertical nas laterais, horizontal em cima/baixo. */}
      {ownerColor && (
        <>
          {/* 1) Tint do corpo */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: ownerColor, opacity: 0.14 }}
          />
          {/* 2) Moldura na cor do dono */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              boxShadow: `inset 0 0 0 2px ${ownerColor}, inset 0 0 0 3px rgba(15,12,9,0.55)`,
            }}
          />
          {/* 3) Pílula removida — stripe exclusiva de aeroportos/utilidades */}
        </>
      )}
      {/* Bandeira-avatar do país — fincada na borda INTERNA (voltada
          pro centro do tabuleiro); metade dentro da célula, metade
          transbordando sobre o centro. */}
      {isProperty && (
        <FlagAvatar iso2={(square as PropertySquare).uf} side={side} />
      )}

      {/* Marcas mockadas: construções, hipoteca. Dono é comunicado pela cor
          da stripe externa; bandeira na interna carrega identidade do país. */}
      {isProperty && <BuildingMark pos={square.pos} />}
      <MortgageMark pos={square.pos} />
      <EffectMark pos={square.pos} />

      {/* Conteúdo da PROPRIEDADE — posicionado em valores absolutos pra
          separar valor (junto da stripe externa) do nome (centro).
          Em todos os lados, flag está na borda INTERNA (transbordando
          sobre o centro) e stripe na borda EXTERNA. Money fica colado na
          stripe; city no centro da célula.
            - sul/norte: stripe na borda externa (rodapé pro sul, topo pro
              norte); money perto dela; texto usa o eixo horizontal inteiro.
            - oeste/leste: stripe vertical externa, flag transbordando
              pelo lado interno. Texto fica no meio, com padding pra
              clear a stripe de um lado e a metade visível do flag do outro. */}
      {isProperty && (
        <>
          {(() => {
            // Nome no TOPO da casa (visualmente), preço no RODAPÉ.
            // Em sul/norte (cells tall) o nome fica logo abaixo da borda
            // superior; em leste/oeste (cells wide) o nome encosta na borda
            // superior dentro da área entre stripe e flag.
            const cityPos: React.CSSProperties = (() => {
              switch (side) {
                // Sul/norte: cidade colada na bandeira (sem espaço vazio
                // entre os dois). Bandeira ~32px ocupa de ~6% a ~26%;
                // cidade começa em ~27-28% (top do cell pra bottom row,
                // mirror pra top row).
                case 'bottom': return { top: '27%',    left: '3%', right: '3%' }
                case 'top':    return { bottom: '27%', left: '3%', right: '3%' }
                // Leste/oeste: igual cima/baixo, porém girado 90°. Nome na
                // VERTICAL, colado na bandeira (lado interno), indo pro externo.
                // left=90° (base do texto pra esquerda), right=-90°.
                case 'left':   return { left: '72%', top: '50%', transform: 'translate(-50%, -50%) rotate(90deg)' }
                case 'right':  return { left: '28%', top: '50%', transform: 'translate(-50%, -50%) rotate(-90deg)' }
                default:       return { top: '50%',    left: '4%', right: '4%', transform: 'translateY(-50%)' }
              }
            })()
            // Valor é um CHIP centralizado (pílula) — posiciona pelo centro
            // horizontal pra a pílula encolher pro conteúdo.
            const moneyPos: React.CSSProperties = (() => {
              switch (side) {
                case 'bottom': return { bottom: '5px', left: '50%', transform: 'translateX(-50%)' }
                case 'top':    return { top: '5px',    left: '50%', transform: 'translateX(-50%)' }
                // Leste/oeste: chip girado, no extremo EXTERNO (longe da bandeira).
                case 'left':   return { left: '7%',  top: '50%', transform: 'translate(-50%, -50%) rotate(90deg)' }
                case 'right':  return { left: '93%', top: '50%', transform: 'translate(-50%, -50%) rotate(-90deg)' }
                default:       return { bottom: '24%', left: '50%', transform: 'translateX(-50%)' }
              }
            })()
            return (
              <>
                {/* Preço como CHIP (pílula) — só em propriedade À VENDA (sem
                    dono). Comprada não mostra valor: a stripe colorida do
                    jogador já comunica a posse. */}
                {!ownerColor && (
                  <div
                    className="absolute currency leading-none whitespace-nowrap"
                    style={{
                      ...moneyPos,
                      fontSize: '11px',
                      fontWeight: 700,
                      color: 'var(--color-gold-glow)',
                      background: 'rgba(15,12,9,0.85)',
                      border: '1px solid rgba(212,175,55,0.45)',
                      borderRadius: 9999,
                      padding: '1px 5px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.55)',
                    }}
                  >
                    <span style={{ fontSize: '0.8em', opacity: 0.75, marginRight: 2 }}>R$</span>
                    {(square as PropertySquare).price}
                  </div>
                )}
                <p
                  className="absolute text-center display text-cream leading-none tracking-wide cell-text"
                  style={{
                    ...cityPos,
                    // Fonte UNIFORME 14px em todos os nomes (sem auto-fit —
                    // variação de tamanho lia como inconsistência). Nomes
                    // compostos quebram em 2 linhas; nas laterais o maxWidth
                    // ≈ altura da casa (cqmin) deixa o nome girado quebrar.
                    fontSize: '14px',
                    fontWeight: 700,
                    ...(side === 'left' || side === 'right' ? { maxWidth: '94cqmin' } : {}),
                  }}
                >
                  {(square as PropertySquare).short ?? square.name}
                </p>
              </>
            )
          })()}
        </>
      )}

      {/* Faixa de acento na borda externa — aeroportos (dourado) e
          utilidades (cor do ícone). Identidade visual sem dono. */}
      {(isAirport || isUtility) && (() => {
        const color = isAirport
          ? '#d4af37'
          : (square as UtilitySquare).icon === 'fuel' ? '#22c55e'
          : (square as UtilitySquare).icon === 'bolt' ? '#ffd97a'
          : '#fb923c'
        const style: React.CSSProperties = (() => {
          const base = { position: 'absolute' as const, borderRadius: 9999, pointerEvents: 'none' as const, background: color, boxShadow: '0 1px 3px rgba(0,0,0,0.5)' }
          switch (side) {
            case 'bottom': return { ...base, left: '20%', right: '20%', bottom: 4, height: 5 }
            case 'top':    return { ...base, left: '20%', right: '20%', top: 4,    height: 5 }
            case 'left':   return { ...base, top: '20%', bottom: '20%', left: 4,   width: 5 }
            case 'right':  return { ...base, top: '20%', bottom: '20%', right: 4,  width: 5 }
            default:       return base
          }
        })()
        return <div style={style} />
      })()}

      {/* Conteúdo das casas NÃO-propriedade — aeroporto, utility, tax,
          acaso, tesouro. Ícone + label no centro da célula.
          Leste/oeste: gira o bloco inteiro 90° (igual o nome das propriedades)
          + encolhe um pouco pra o label girado caber na altura. */}
      {!isProperty && (
        <div
          className="absolute inset-0 flex flex-col items-center text-center gap-1 justify-center p-1"
          style={{
            transform:
              side === 'left'  ? 'rotate(90deg)' :
              side === 'right' ? 'rotate(-90deg)' : undefined,
          }}
        >
          {(isAirport || isUtility || isCard || isTax || isBus) && (
            <div style={{ fontSize: 32 }} className="leading-none">
              <SquareIcon square={square} size="1em" />
            </div>
          )}
          {isAirport && (
            <p
              className="display mt-1 text-cream leading-none tracking-wider"
              style={{ fontSize: '14px' }}
            >
              {(square as AirportSquare).name}
            </p>
          )}
          {isUtility && (
            <p
              className="display mt-1 text-cream leading-none tracking-wide"
              style={{ fontSize: '14px' }}
            >
              {(() => {
                const icon = (square as UtilitySquare).icon
                return icon === 'fuel' ? 'Petro' : icon === 'bolt' ? 'Eletro' : 'Gás'
              })()}
            </p>
          )}
          {isTax && (
            <>
              <p className="display mt-1 text-cream leading-none" style={{ fontSize: '14px' }}>
                Taxa
              </p>
              <p className="currency text-logo leading-none" style={{ fontSize: '14px' }}>
                <span className="text-cream-muted text-[0.7em] mr-0.5">R$</span>
                {(square as TaxSquare).amount}
              </p>
            </>
          )}
          {isAcaso && (
            <p className="display mt-1 text-cream leading-none" style={{ fontSize: '14px' }}>
              Acaso
            </p>
          )}
          {isTesouro && (
            <p className="display mt-1 text-cream leading-none" style={{ fontSize: '14px' }}>
              Tesouro
            </p>
          )}
          {isBus && (
            <p className="display mt-1 text-cream leading-none tracking-wide text-center" style={{ fontSize: '14px' }}>
              Bus Ticket
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------
// Corner square — quadrado especial maior, sem rotação
// ---------------------------------------------------------------------
export function CornerSquare({ square, accent = 'cream' }:
  { square: Square; accent?: 'cream' | 'gold' | 'logo' }) {
  const isGo = square.kind === 'corner-go'
  void accent

  const label =
    square.kind === 'corner-go'       ? 'Start'         :
    square.kind === 'corner-jail'     ? 'Prisão'        :
    square.kind === 'corner-parking'  ? 'Loteria'       :
    square.kind === 'corner-gotojail' ? 'Vá pra Prisão' :
    ''

  return (
    <div
      className={cn(
        'board-square relative w-full h-full flex flex-col items-center justify-center p-1 gap-1',
        isGo && 'bg-coffee-700',
      )}
    >
      <div className="leading-none" style={{ fontSize: 56 }}>
        <SquareIcon square={square} size="1em" />
      </div>
      <p
        className="display mt-1 text-cream leading-none"
        style={{ fontSize: '14px' }}
      >
        {label}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------
// PlayerFace — carinha SVG simples (cabeça redonda + olhos + sorriso).
// Usada tanto como peça no tabuleiro quanto como avatar nos painéis.
// Animações: bob (respiração), blink (piscada) e pulse extra pro jogador
// da vez. Cada player tem delays dessincronizados via hash da cor.
// ---------------------------------------------------------------------
function hashStr(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = ((h * 31 + s.charCodeAt(i)) & 0xffff)
  return h
}

export function PlayerFace({
  color,
  size = 24,
  active = false,
  asleep = false,
  className,
}: {
  color: string
  size?: number | string
  active?: boolean
  asleep?: boolean
  className?: string
}) {
  // Delays únicos por player pra blink/bob não rodarem em sincronia.
  const h = hashStr(color)
  const bobDelay = `${(h % 2400) / 1000}s`
  const blinkDelayL = `${((h + 1300) % 5000) / 1000}s`
  const blinkDelayR = `${((h + 1430) % 5000) / 1000}s`  // levemente diferente

  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={cn(
        'shrink-0',
        !asleep && (active ? 'face-idle-active' : 'face-idle'),
        className,
      )}
      style={{
        filter: active ? 'drop-shadow(0 0 4px rgba(212,175,55,0.7))' : undefined,
        animationDelay: !asleep ? bobDelay : undefined,
      }}
      aria-hidden="true"
    >
      {/* Sombra da cabeça */}
      <ellipse cx="16" cy="30" rx="11" ry="1.6" fill="rgba(0,0,0,0.45)" />

      {/* Cabeça */}
      <circle cx="16" cy="15" r="13" fill={color} stroke="#0f0c09" strokeWidth="1.5" />

      {/* Highlight 3D no topo */}
      <ellipse
        cx="12"
        cy="9"
        rx="5.5"
        ry="3.5"
        fill="rgba(255,255,255,0.28)"
      />

      {/* Olhos — abertos ou fechados se "asleep" (jogador falido) */}
      {asleep ? (
        <>
          <path d="M9 15 Q11 16.5 13 15" stroke="#0f0c09" strokeWidth="1.4" fill="none" strokeLinecap="round" />
          <path d="M19 15 Q21 16.5 23 15" stroke="#0f0c09" strokeWidth="1.4" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          {/* Olho esquerdo (cada um piscando com delay próprio) */}
          <g className="face-eye" style={{ animationDelay: blinkDelayL }}>
            <circle cx="11" cy="14.5" r="2.2" fill="#fff" />
            <circle cx="11.4" cy="14.8" r="1.2" fill="#0f0c09" />
            <circle cx="11.0" cy="14.4" r="0.4" fill="#fff" />
          </g>
          {/* Olho direito */}
          <g className="face-eye" style={{ animationDelay: blinkDelayR }}>
            <circle cx="21" cy="14.5" r="2.2" fill="#fff" />
            <circle cx="21.4" cy="14.8" r="1.2" fill="#0f0c09" />
            <circle cx="21.0" cy="14.4" r="0.4" fill="#fff" />
          </g>
        </>
      )}

      {/* Boca */}
      {asleep ? (
        <line x1="13" y1="22" x2="19" y2="22" stroke="#0f0c09" strokeWidth="1.3" strokeLinecap="round" />
      ) : (
        <path
          d="M11.5 20.5 Q16 24 20.5 20.5"
          stroke="#0f0c09"
          strokeWidth="1.4"
          fill="none"
          strokeLinecap="round"
        />
      )}

      {/* Anel dourado pro jogador da vez */}
      {active && (
        <circle
          cx="16"
          cy="15"
          r="14.5"
          fill="none"
          stroke="#ffd97a"
          strokeWidth="1.5"
          strokeDasharray="2 2"
        >
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0 16 15"
            to="360 16 15"
            dur="14s"
            repeatCount="indefinite"
          />
        </circle>
      )}
    </svg>
  )
}

// ---------------------------------------------------------------------
// PlayerTokens — carinhas dos jogadores no CENTRO da célula, no espaço
// vazio entre o nome (topo) e o valor (fundo). Quando mais de um player
// ocupa a mesma casa, as carinhas se reorganizam em grid compacto e
// encolhem progressivamente pra evitar sobreposição.
// ---------------------------------------------------------------------
type TokenLayout = { size: number; cols: number }

// Tamanho/colunas em função da quantidade de players na mesma casa.
// Cell mais apertado: 80×160 (sul/norte) — 2 colunas até 4 players caem
// bem; a partir de 5 vai pra 3 cols com tamanho menor.
function layoutFor(count: number): TokenLayout {
  if (count <= 1) return { size: 38, cols: 1 }
  if (count === 2) return { size: 32, cols: 2 }
  if (count === 3) return { size: 26, cols: 3 }
  if (count === 4) return { size: 24, cols: 2 }
  if (count <= 6) return { size: 22, cols: 3 }
  return { size: 18, cols: 4 }
}

export function PlayerTokens({
  gridArea,
}: {
  gridArea: (pos: number) => React.CSSProperties
}) {
  // Agrupar jogadores por casa pra empilhar quando mais de um na mesma posição.
  const groups: Record<number, Player[]> = {}
  MOCK_PLAYERS.forEach((p) => {
    if (p.bankrupt) return
    groups[p.pos] = groups[p.pos] ?? []
    groups[p.pos].push(p)
  })

  return (
    <>
      {Object.entries(groups).map(([posStr, players]) => {
        const pos = Number(posStr)
        const { size, cols } = layoutFor(players.length)

        return (
          <div
            key={pos}
            className="relative z-30 pointer-events-none"
            style={gridArea(pos)}
          >
            {/* Grid de carinhas centralizado vertical/horizontal no cell.
                cols dita quantas por linha; size dita tamanho de cada
                avatar. Gap pequeno pra ficarem juntinhas mas separadas. */}
            <div
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 grid place-items-center"
              style={{
                gridTemplateColumns: `repeat(${cols}, auto)`,
                gap: 2,
              }}
            >
              {players.map((p) => (
                <PlayerFace
                  key={p.name}
                  color={p.color}
                  active={p.active}
                  size={size}
                />
              ))}
            </div>
          </div>
        )
      })}
    </>
  )
}

// ---------------------------------------------------------------------
// Mockups de painéis laterais — fiel ao HUD do SRS §12.3.
// Refletidos: saldo, cartas em mão (contador), Bus Tickets, empréstimos,
// imunidades, Pote de Férias, Speed Die, GO progressivo, log de eventos.
// ---------------------------------------------------------------------
export type Player = {
  name: string
  color: string
  money: number
  pos: number
  cardsInHand: number       // SRS §10.3 — privado, só contador é visível
  busTickets: number        // SRS §10.7 — contador separado
  loanActive?: boolean      // SRS §15
  immune?: boolean          // SRS §13.8 / §10 — imunidade ativa
  speedDieReady?: boolean   // SRS §13.2 — após 1ª volta
  active?: boolean
  bankrupt?: boolean
}

// Jogador local (você) — usado pra decidir quando o anel rodando do
// PlayerFace aparece. Só pisca em volta do avatar quando o jogador ativo
// é VOCÊ; turno dos outros mostra a carinha sem o anel.
export const LOCAL_PLAYER_NAME = 'Nikolas'

// Banco arranca a partida com $2000 cada — SRS §3.1 (tabuleiro de 48).
// Paleta dos jogadores é disjunta das 8 cores de grupo (brown/skyblue/pink/
// orange/red/yellow/green/navy) — boneco nunca pode ter a mesma cor da casa
// onde está parado, senão some na faixa colorida.
// Posições em índices 0–47 (tabuleiro de 48). Léo (falido) parado na Prisão (12).
export const MOCK_PLAYERS: Player[] = [
  { name: 'Nikolas', color: '#d4af37', money: 2000, pos: 0, cardsInHand: 0, busTickets: 0, speedDieReady: true, active: true },
  { name: 'Júlia',   color: '#a855f7', money: 2000, pos: 0, cardsInHand: 0, busTickets: 0, speedDieReady: true },
  { name: 'Caio',    color: '#06b6d4', money: 2000, pos: 0, cardsInHand: 0, busTickets: 0, speedDieReady: true },
  { name: 'Beatriz', color: '#14b8a6', money: 2000, pos: 0, cardsInHand: 0, busTickets: 0, speedDieReady: true },
  { name: 'Rafa',    color: '#d946ef', money: 2000, pos: 0, cardsInHand: 0, busTickets: 0, speedDieReady: true },
  { name: 'Léo',     color: '#f4e8d0', money: 2000, pos: 0, cardsInHand: 0, busTickets: 0, speedDieReady: true },
]

// Pote da Loteria (ex Free Parking) — SRS §13.5. Inicia com $500.
export const MOCK_PARKING_POT = 1250

// Propriedades possuídas (mock) — chave = pos, valor = nome do jogador.
// Cobre uma fatia variada do tabuleiro pra dar densidade visual.
export const MOCK_OWNERSHIP: Record<number, string> = {}

// Construções mock — pos → 1..4 casas · 5 = hotel · 6 = skyscraper (SRS §13.8)
// Cada pos abaixo TEM dono em MOCK_OWNERSHIP (stripe colorida vai aparecer).
export const MOCK_BUILDINGS: Record<number, number> = {}

// Propriedades hipotecadas (mock).
export const MOCK_MORTGAGED = new Set<number>([])

// (OwnerDot removido — bandeirinha de dono com inicial virou redundante
// quando a stripe ganhou a cor do jogador.)

// Casinhas/Hotel/Skyscraper construídos numa propriedade — empilhadas
// verticalmente na borda OPOSTA à stripe colorida do grupo.
// n: 1..4 = casas · 5 = hotel · 6 = skyscraper
//
// Posicionamento por lado:
//  - casa no sul do tabuleiro (stripe no topo) → buildings no rodapé
//  - casa no norte (stripe no rodapé)         → buildings no topo
//  - casa no oeste (stripe à direita)         → buildings à esquerda
//  - casa no leste (stripe à esquerda)        → buildings à direita
// Cada construção é um glifo independente — pra 4 casas, dá pra contar.
export function BuildingMark({ pos }: { pos: number }) {
  const title = useGameStore((s) => s.game.titles[pos])
  const n = title ? cityLevel(title) : 0 // 0–7 real (023)
  if (!n) return null

  const side = sideOf(pos)
  const isSkyscraper = n === 7
  const isHotel = n === 5 || n === 6 // hotel ou 2º hotel
  const houseCount = n >= 1 && n <= 4 ? n : 0

  // Centro do ícone fica exatamente em cima da stripe (que tem 22% da
  // dimensão menor da célula no lado externo). Em sul/norte os ícones
  // empilham horizontalmente ao longo da stripe; em laterais empilham
  // verticalmente.
  const layoutStyle: React.CSSProperties = (() => {
    switch (side) {
      case 'bottom': return { top: '89%',  left: '50%', transform: 'translate(-50%, -50%)', flexDirection: 'row' }
      case 'top':    return { top: '11%',  left: '50%', transform: 'translate(-50%, -50%)', flexDirection: 'row' }
      // Leste/oeste: construções no extremo EXTERNO (onde ficaria o preço;
      // casa comprada não tem chip). Empilhadas, fora do caminho do nome.
      case 'left':   return { left: '9%',  top: '50%', transform: 'translate(-50%, -50%)', flexDirection: 'column' }
      case 'right':  return { left: '91%', top: '50%', transform: 'translate(-50%, -50%)', flexDirection: 'column' }
      default:       return { top: '50%',  left: '50%', transform: 'translate(-50%, -50%)', flexDirection: 'row' }
    }
  })()

  return (
    <div
      className="absolute z-20 pointer-events-none flex items-center justify-center gap-1"
      style={{
        ...layoutStyle,
        filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.7))',
      }}
    >
      {isSkyscraper && <SkyscraperBadgeIcon />}
      {isHotel && <HotelBadgeIcon />}
      {houseCount > 0 && (
        <>
          <HouseBadgeIcon />
          {houseCount > 1 && (
            <span
              className="display leading-none text-cream"
              style={{
                fontSize: '13px',
                textShadow: '0 0 3px rgba(0,0,0,0.9), 0 1px 2px rgba(0,0,0,0.8)',
              }}
            >
              ×{houseCount}
            </span>
          )}
        </>
      )}
    </div>
  )
}

// Casa — chalé clássico: telhado vermelho de duas águas, paredes cream,
// janelas azuis com cruzeta, porta marrom com maçaneta dourada.
function HouseBadgeIcon() {
  return (
    <svg viewBox="0 0 16 14" width="22" height="20" aria-hidden="true">
      {/* sombra projetada no chão */}
      <ellipse cx="8" cy="13.5" rx="6" ry="0.55" fill="#0f0c09" opacity="0.5" />

      {/* chaminé atrás do telhado */}
      <rect x="10.6" y="2.5" width="1.3" height="2.4"
        fill="#7c2d12" stroke="#0f0c09" strokeWidth="0.5" />
      <rect x="10.3" y="2.3" width="1.9" height="0.5"
        fill="#5c1e0c" stroke="#0f0c09" strokeWidth="0.4" />

      {/* telhado triangular vermelho */}
      <path d="M 1.2 6.8 L 8 1.6 L 14.8 6.8 Z"
        fill="#dc2626" stroke="#0f0c09" strokeWidth="0.9" strokeLinejoin="round" />
      {/* lado em sombra do telhado (3D) */}
      <path d="M 8 1.6 L 14.8 6.8 L 8 4 Z"
        fill="#991b1b" opacity="0.7" />

      {/* faixa do beiral (sombra abaixo do telhado) */}
      <rect x="1.4" y="6.6" width="13.2" height="0.7"
        fill="#7c2d12" stroke="#0f0c09" strokeWidth="0.4" />

      {/* corpo cream */}
      <rect x="2" y="7.2" width="12" height="6"
        fill="#f4e8d0" stroke="#0f0c09" strokeWidth="0.85" />

      {/* janela esquerda — azul com cruzeta */}
      <rect x="3.2" y="8.6" width="2.4" height="2.1"
        fill="#67c3e0" stroke="#0f0c09" strokeWidth="0.5" />
      <line x1="4.4" y1="8.6" x2="4.4" y2="10.7" stroke="#0f0c09" strokeWidth="0.3" />
      <line x1="3.2" y1="9.65" x2="5.6" y2="9.65" stroke="#0f0c09" strokeWidth="0.3" />

      {/* porta marrom + maçaneta dourada */}
      <rect x="6.8" y="9.2" width="2.4" height="4"
        fill="#5c4a36" stroke="#0f0c09" strokeWidth="0.5" />
      <circle cx="8.8" cy="11.3" r="0.28" fill="#ffd97a" stroke="#0f0c09" strokeWidth="0.2" />

      {/* janela direita */}
      <rect x="10.4" y="8.6" width="2.4" height="2.1"
        fill="#67c3e0" stroke="#0f0c09" strokeWidth="0.5" />
      <line x1="11.6" y1="8.6" x2="11.6" y2="10.7" stroke="#0f0c09" strokeWidth="0.3" />
      <line x1="10.4" y1="9.65" x2="12.8" y2="9.65" stroke="#0f0c09" strokeWidth="0.3" />
    </svg>
  )
}

// Hotel — prédio art-déco: coroa dourada no topo, faixa de telhado vermelha,
// janelas em duas fileiras, marquise sobre entrada com arco.
function HotelBadgeIcon() {
  return (
    <svg viewBox="0 0 18 14" width="26" height="22" aria-hidden="true">
      {/* sombra */}
      <ellipse cx="9" cy="13.5" rx="7" ry="0.55" fill="#0f0c09" opacity="0.5" />

      {/* coroa decorativa dourada (placa) */}
      <rect x="5.5" y="0.3" width="7" height="1.2"
        fill="#ffd97a" stroke="#0f0c09" strokeWidth="0.5" />
      <line x1="5.5" y1="0.8" x2="12.5" y2="0.8" stroke="#b8941f" strokeWidth="0.3" />

      {/* faixa de telhado vermelha com trapézio (art-déco) */}
      <path d="M 0.5 4 L 17.5 4 L 17.5 2.4 L 16 1.5 L 2 1.5 L 0.5 2.4 Z"
        fill="#dc2626" stroke="#0f0c09" strokeWidth="0.75" strokeLinejoin="round" />
      <line x1="0.5" y1="3" x2="17.5" y2="3" stroke="#991b1b" strokeWidth="0.4" />

      {/* corpo cream */}
      <rect x="1" y="4" width="16" height="9.2"
        fill="#f4e8d0" stroke="#0f0c09" strokeWidth="0.85" />

      {/* coluna decorativa esquerda e direita */}
      <line x1="1.7" y1="4" x2="1.7" y2="13.2" stroke="#5c4a36" strokeWidth="0.35" opacity="0.6" />
      <line x1="16.3" y1="4" x2="16.3" y2="13.2" stroke="#5c4a36" strokeWidth="0.35" opacity="0.6" />

      {/* fileira superior de janelas */}
      <g fill="#67c3e0" stroke="#0f0c09" strokeWidth="0.45">
        <rect x="2.5" y="5" width="2" height="1.9" />
        <rect x="5.4" y="5" width="2" height="1.9" />
        <rect x="10.6" y="5" width="2" height="1.9" />
        <rect x="13.5" y="5" width="2" height="1.9" />
      </g>
      {/* divisão das janelas (cruzeta sutil) */}
      <g stroke="#0f0c09" strokeWidth="0.28">
        <line x1="3.5" y1="5" x2="3.5" y2="6.9" />
        <line x1="6.4" y1="5" x2="6.4" y2="6.9" />
        <line x1="11.6" y1="5" x2="11.6" y2="6.9" />
        <line x1="14.5" y1="5" x2="14.5" y2="6.9" />
      </g>

      {/* fileira inferior */}
      <g fill="#67c3e0" stroke="#0f0c09" strokeWidth="0.45">
        <rect x="2.5" y="8.2" width="2" height="1.9" />
        <rect x="13.5" y="8.2" width="2" height="1.9" />
      </g>

      {/* marquise vermelha sobre a entrada */}
      <rect x="6.3" y="8.5" width="5.4" height="0.9"
        fill="#dc2626" stroke="#0f0c09" strokeWidth="0.5" />
      <path d="M 6.3 9.4 L 11.7 9.4 L 11.2 9.7 L 6.8 9.7 Z" fill="#991b1b" />

      {/* entrada com arco */}
      <path d="M 7.2 13.2 L 7.2 11.2 Q 9 9.5 10.8 11.2 L 10.8 13.2 Z"
        fill="#1a1410" stroke="#0f0c09" strokeWidth="0.55" />
      <line x1="9" y1="9.8" x2="9" y2="13.2" stroke="#3d3528" strokeWidth="0.35" />
      <circle cx="8.45" cy="12" r="0.22" fill="#ffd97a" />
      <circle cx="9.55" cy="12" r="0.22" fill="#ffd97a" />
    </svg>
  )
}

// Skyscraper — torre dourada art-déco: coroa escalonada, antena com luz
// vermelha piscando, grid de janelas escuras, entrada com arco.
function SkyscraperBadgeIcon() {
  return (
    <svg viewBox="0 0 10 18" width="16" height="28" aria-hidden="true">
      {/* sombra */}
      <ellipse cx="5" cy="17.6" rx="3.5" ry="0.4" fill="#0f0c09" opacity="0.55" />

      {/* mastro/antena */}
      <line x1="5" y1="0" x2="5" y2="2.2" stroke="#0f0c09" strokeWidth="0.55" />
      {/* luz vermelha piscante no topo */}
      <circle cx="5" cy="0.45" r="0.5" fill="#dc2626" stroke="#0f0c09" strokeWidth="0.3">
        <animate attributeName="opacity" values="0.4;1;0.4" dur="1.6s" repeatCount="indefinite" />
      </circle>

      {/* coroa art-déco escalonada */}
      <polygon
        points="2.8,2.3 3.4,2.3 3.4,2.9 4,2.9 4,2.4 5.5,2.4 5.5,2.9 6.1,2.9 6.1,2.3 6.7,2.3 6.7,3.3 2.8,3.3"
        fill="#5c4a36" stroke="#0f0c09" strokeWidth="0.35" strokeLinejoin="round"
      />

      {/* topo recuado dourado */}
      <rect x="2.8" y="3.3" width="4.4" height="1.2"
        fill="#d4af37" stroke="#0f0c09" strokeWidth="0.45" />
      <line x1="2.8" y1="4" x2="7.2" y2="4" stroke="#b8941f" strokeWidth="0.3" />

      {/* corpo principal dourado */}
      <rect x="1.4" y="4.5" width="7.2" height="12.6"
        fill="#d4af37" stroke="#0f0c09" strokeWidth="0.7" />

      {/* sombra lateral (3D, gradiente fake via overlay) */}
      <rect x="6.8" y="4.5" width="1.8" height="12.6"
        fill="#b8941f" opacity="0.7" />

      {/* faixas decorativas horizontais (art-déco) */}
      <line x1="1.4" y1="7" x2="8.6" y2="7" stroke="#0f0c09" strokeWidth="0.25" opacity="0.6" />
      <line x1="1.4" y1="9.4" x2="8.6" y2="9.4" stroke="#0f0c09" strokeWidth="0.25" opacity="0.6" />
      <line x1="1.4" y1="11.8" x2="8.6" y2="11.8" stroke="#0f0c09" strokeWidth="0.25" opacity="0.6" />
      <line x1="1.4" y1="14.2" x2="8.6" y2="14.2" stroke="#0f0c09" strokeWidth="0.25" opacity="0.6" />

      {/* janelas escuras em grid 3×5 */}
      <g fill="#1a1410" stroke="#0f0c09" strokeWidth="0.2">
        <rect x="2"   y="5.1" width="1.3" height="1.5" />
        <rect x="3.7" y="5.1" width="1.3" height="1.5" />
        <rect x="5.4" y="5.1" width="1.3" height="1.5" />

        <rect x="2"   y="7.5" width="1.3" height="1.5" />
        <rect x="3.7" y="7.5" width="1.3" height="1.5" />
        <rect x="5.4" y="7.5" width="1.3" height="1.5" />

        <rect x="2"   y="9.9" width="1.3" height="1.5" />
        <rect x="3.7" y="9.9" width="1.3" height="1.5" />
        <rect x="5.4" y="9.9" width="1.3" height="1.5" />

        <rect x="2"   y="12.3" width="1.3" height="1.5" />
        <rect x="3.7" y="12.3" width="1.3" height="1.5" />
        <rect x="5.4" y="12.3" width="1.3" height="1.5" />
      </g>

      {/* alguns reflexos cream em janelas (iluminadas) */}
      <g fill="#ffd97a" opacity="0.85">
        <rect x="3.7" y="5.1" width="1.3" height="1.5" />
        <rect x="2"   y="9.9" width="1.3" height="1.5" />
        <rect x="5.4" y="12.3" width="1.3" height="1.5" />
      </g>

      {/* entrada com arco */}
      <path d="M 3.5 17 L 3.5 15.5 Q 5 14.4 6.5 15.5 L 6.5 17 Z"
        fill="#1a1410" stroke="#0f0c09" strokeWidth="0.5" />
      <line x1="5" y1="14.7" x2="5" y2="17" stroke="#3d3528" strokeWidth="0.3" />
    </svg>
  )
}

// Marca de hipoteca — apenas SOMBREAMENTO: a célula escurece e ganha uma
// sombra interna, parecendo "bloqueada / fora de jogo". Sem selo nem texto.
export function MortgageMark({ pos }: { pos: number }) {
  const mortgaged = useGameStore((s) => s.game.titles[pos]?.mortgaged)
  if (!mortgaged) return null
  return (
    <div
      className="absolute inset-0 pointer-events-none z-[25]"
      title="Hipotecada"
      style={{
        background: 'rgba(8,6,4,0.6)',
        boxShadow: 'inset 0 0 14px 3px rgba(0,0,0,0.6)',
      }}
    />
  )
}

// Marca de efeito temporário ativo na casa (024.1): apagão (aeroportos), greve
// (utilidades), boicote/imunidade-temp (casa específica). Pulsa pra chamar atenção.
export function EffectMark({ pos }: { pos: number }) {
  const effects = useGameStore((s) => s.game.tempEffects)
  const sq = BOARD[pos]
  let badge: { icon: string; title: string } | null = null
  for (const e of effects) {
    if (e.kind === 'apagao' && sq.kind === 'airport') badge = { icon: '⚡', title: 'Apagão — hangar inativo' }
    else if (e.kind === 'greve' && sq.kind === 'utility') badge = { icon: '⚡', title: 'Greve — utilidade sem aluguel' }
    else if (e.kind === 'boicote' && e.pos === pos) badge = { icon: '🚫', title: 'Boicote — sem aluguel' }
    else if (e.kind === 'imunidade-temp' && e.pos === pos) badge = { icon: '🛡️', title: 'Imunidade temporária' }
  }
  if (!badge) return null
  return (
    <motion.div
      className="absolute top-0.5 right-0.5 z-[26] pointer-events-none leading-none"
      style={{ fontSize: '11px', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.8))' }}
      title={badge.title}
      animate={{ opacity: [0.55, 1, 0.55] }}
      transition={{ duration: 1.6, repeat: Infinity }}
    >
      {badge.icon}
    </motion.div>
  )
}


// Efeitos ativos no tabuleiro — SRS §12.3. Derivado do estado real (`tempEffects`).
function effectRow(e: TempEffect, i: number): { key: string; label: string; desc: string; tone: 'logo' | 'gold' } {
  const laps = `${e.lapsRemaining}v`
  switch (e.kind) {
    case 'apagao': return { key: `a${i}`, label: 'Apagão', desc: `Hangares inativos · ${laps}`, tone: 'logo' }
    case 'greve': return { key: `g${i}`, label: 'Greve', desc: `Utilidades sem aluguel · ${laps}`, tone: 'logo' }
    case 'boicote': return { key: `b${i}`, label: 'Boicote', desc: `${BOARD[e.pos ?? 0]?.name ?? '—'} sem aluguel · ${laps}`, tone: 'logo' }
    case 'imunidade-temp': return { key: `i${i}`, label: 'Imunidade temp.', desc: `${BOARD[e.pos ?? 0]?.name ?? '—'} · ${laps}`, tone: 'gold' }
  }
}

// Trades em aberto + concluídas recentes — SRS §11. Dados reais via tradesView (027).
function tradeSummary(props: number[], cash: number, imm?: ImmunityGrant[]): string {
  const parts: string[] = []
  if (props.length) parts.push(`${props.length} propriedade${props.length > 1 ? 's' : ''}`)
  if (cash > 0) parts.push(`R$${cash}`)
  if (imm?.length) parts.push(`${imm.length} imunidade${imm.length > 1 ? 's' : ''}`)
  return parts.length ? parts.join(' + ') : '—'
}

// --- Ponte com o motor (020): estado reativo dos painéis ---------------------
// Paleta de token por assento (disjunta das cores de grupo). Nome/token reais
// virão do Lobby (M3); por ora nome = id e cor = assento.
export const PLAYER_COLORS = ['#d4af37', '#a855f7', '#06b6d4', '#14b8a6', '#d946ef', '#f97316', '#22c55e', '#3b82f6']

// Mapeia o GameState real → view-model `Player` dos painéis. PURO (testável).
export function playersView(game: GameState): Player[] {
  const activeId = game.players[game.turnOrder[game.activeSeat]]?.id
  return game.players.map((p, seat) => ({
    name: p.id,
    color: PLAYER_COLORS[seat % PLAYER_COLORS.length],
    money: p.cash,
    pos: p.pos,
    cardsInHand: p.hand.length, // só o contador é público (privacidade §10.3)
    busTickets: p.busTickets,
    speedDieReady: p.completouPrimeiraVolta,
    active: p.id === activeId,
    bankrupt: p.eliminated,
    loanActive: game.loans.some((l) => l.debtorId === p.id),
    immune: game.immunities.some((i) => i.beneficiaryId === p.id),
  }))
}

function useLivePlayers(): Player[] {
  return playersView(useGameStore((s) => s.game))
}

export function PlayersPanel() {
  const players = useLivePlayers()
  const log = useGameStore((s) => s.game.log) // 021 — log real do jogo
  const history = [...log].reverse() // mais recentes ao topo (recência = ordem no log)
  const effects = useGameStore((s) => s.game.tempEffects).map(effectRow) // 024.1 — efeitos reais
  const bankHouses = useGameStore((s) => s.game.bank.houses) // 026
  const auctionOpen = useGameStore((s) => s.game.houseAuction !== null)
  const openHouseAuction = useGameStore((s) => s.openHouseAuction)
  const liveIds = useGameStore((s) => s.game.players.filter((p) => !p.eliminated).map((p) => p.id))
  const canAuctionHouses = bankHouses >= 1 && liveIds.length >= 2 && !auctionOpen
  return (
    <aside className="side-panel">
      <div className="side-panel-section">
        <div className="flex items-baseline justify-between mb-3">
          <p className="label text-gold">Jogadores</p>
          <p className="label text-cream-muted">{players.filter((p) => !p.bankrupt).length} / 8</p>
        </div>
        <div className="flex flex-col gap-2">
          {players.map((p) => <PlayerRow key={p.name} player={p} />)}
        </div>
        {players.filter((p) => !p.bankrupt).length >= 2 && (
          <button
            type="button"
            onClick={() => useTradeUI.getState().show()}
            className="mt-3 w-full px-3 py-1.5 rounded-[var(--radius-sharp)] bg-coffee-700 border border-coffee-500 text-cream text-sm font-bold hover:border-gold hover:bg-coffee-600 transition-colors"
          >
            🤝 Negociar
          </button>
        )}
        {canAuctionHouses && (
          <button
            type="button"
            onClick={() => openHouseAuction(bankHouses, liveIds)}
            className="mt-2 w-full px-3 py-1.5 rounded-[var(--radius-sharp)] bg-coffee-700 border border-coffee-500 text-cream text-sm font-bold hover:border-gold hover:bg-coffee-600 transition-colors"
          >
            🏘 Leilão de casas ({bankHouses})
          </button>
        )}
      </div>

      <div className="side-panel-section">
        <p className="label text-gold mb-3">Histórico</p>
        {history.length === 0 ? (
          <div className="flex items-center justify-center px-3 py-4 rounded-[var(--radius-card)] border border-dashed border-coffee-500 bg-coffee-800/40">
            <p className="label text-cream-muted text-center leading-snug">
              Nenhum evento ainda
            </p>
          </div>
        ) : (
          <ol className="flex flex-col gap-0">
            {history.map((l, i) => (
              <li
                key={i}
                className="flex items-baseline gap-2 px-1 py-2 border-b border-coffee-500/60 last:border-0"
              >
                <span className={cn(
                  'display text-sm leading-none shrink-0',
                  l.who === 'Banco' ? 'text-logo' : 'text-cream',
                )}>
                  {l.who}
                </span>
                <span className="text-cream-muted text-sm leading-tight flex-1">
                  {l.what}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="side-panel-section">
        <p className="label text-gold mb-3">Efeitos ativos</p>
        {effects.length === 0 ? (
          <div className="flex items-center justify-center px-3 py-4 rounded-[var(--radius-card)] border border-dashed border-coffee-500 bg-coffee-800/40">
            <p className="label text-cream-muted text-center leading-snug">
              Nenhum efeito ativo no momento
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {effects.map((e) => (
              <li key={e.key} className="flex items-baseline gap-2">
                <span className={cn(
                  'inline-block w-1.5 h-1.5 rounded-full shrink-0 translate-y-[-2px]',
                  e.tone === 'logo' ? 'bg-logo' : 'bg-gold',
                )} />
                <span className={cn('display text-sm leading-none', e.tone === 'logo' ? 'text-logo' : 'text-gold')}>
                  {e.label}
                </span>
                <span className="text-cream-muted text-xs leading-snug">{e.desc}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  )
}

function PlayerRow({ player: p }: { player: Player }) {
  // Feedback de caixa (024.1): delta flutuante quando o saldo muda.
  const [pulse, setPulse] = useState<{ id: number; d: number } | null>(null)
  const prevMoney = useRef(p.money)
  const pulseId = useRef(0)
  useEffect(() => {
    if (p.money !== prevMoney.current) {
      const d = p.money - prevMoney.current
      prevMoney.current = p.money
      pulseId.current += 1
      setPulse({ id: pulseId.current, d })
      const t = setTimeout(() => setPulse(null), 1200)
      return () => clearTimeout(t)
    }
  }, [p.money])

  return (
    <div
      className={cn(
        'relative flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-card)]',
        'border transition-colors',
        p.active
          ? 'bg-coffee-700 border-gold shadow-[0_0_0_1px_rgba(212,175,55,0.3)]'
          : 'bg-coffee-800/60 border-coffee-500',
        p.bankrupt && 'opacity-50',
      )}
    >
      <AnimatePresence>
        {pulse && pulse.d !== 0 && (
          <motion.span
            key={pulse.id}
            initial={{ opacity: 0, y: 2 }}
            animate={{ opacity: 1, y: -16 }}
            exit={{ opacity: 0, y: -26 }}
            transition={{ duration: 0.45 }}
            className={cn(
              'absolute right-3 top-1.5 currency text-sm font-bold pointer-events-none z-10',
              pulse.d > 0 ? 'text-green-400' : 'text-logo',
            )}
            style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}
          >
            {pulse.d > 0 ? '+' : '−'}R${Math.abs(pulse.d).toLocaleString('pt-BR')}
          </motion.span>
        )}
      </AnimatePresence>
      <PlayerFace color={p.color} active={p.active} asleep={p.bankrupt} size={40} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5">
          <p className="display text-cream text-[17px] leading-none truncate">{p.name}</p>
          {p.loanActive  && <span title="Empréstimo ativo" className="label !text-logo">$$</span>}
          {p.immune      && <span title="Imunidade ativa"  className="label !text-gold">★</span>}
        </div>
        <div className="flex items-center gap-2 mt-1">
          {p.bankrupt ? (
            <span className="label text-cream-muted">Falido</span>
          ) : (
            <span title="Cartas em mão (privadas)" className="label inline-flex items-center gap-1">
              <CardGlyph size={13} />
              {p.cardsInHand}/3
            </span>
          )}
        </div>
      </div>
      <p
        className={cn(
          'currency text-right shrink-0',
          p.bankrupt ? 'text-cream-muted line-through' : 'text-gold-glow',
        )}
        style={{ fontSize: '16px' }}
      >
        <span className="text-gold-soft text-[11px] mr-0.5">R$</span>
        {p.money.toLocaleString('pt-BR')}
      </p>
    </div>
  )
}

// Log de eventos — SRS §12.3, alimentado pelas ações do turno.
const SPEED_FACES = ['one', 'two', 'three', 'mr', 'bus'] as const
type SpeedFace = (typeof SPEED_FACES)[number]

// Face do Speed Die do motor (1|2|3|'mr-banco'|'onibus') → face visual.
function toUiSpeedFace(speed: number | 'mr-banco' | 'onibus'): SpeedFace {
  if (speed === 1) return 'one'
  if (speed === 2) return 'two'
  if (speed === 3) return 'three'
  if (speed === 'mr-banco') return 'mr'
  return 'bus' // 'onibus'
}

const ROLL_DURATION_MS = 1050

// DiceArena — área central de arremesso (dados + botão). Vive no miolo do
// tabuleiro (CenterArena). Ligado ao motor (022.1): jogador da vez, faces e
// gating de turno vêm do store; o botão dispara rollDice.
export function DiceArena() {
  const players = useLivePlayers()
  const active = players.find((p) => p.active) ?? players[0]
  const turnState = useGameStore((s) => s.game.turn.state)
  const lastRoll = useGameStore((s) => s.game.turn.lastRoll)
  const paused = useGameStore((s) => s.game.paused)
  const phase = useGameStore((s) => s.game.phase)
  const rollDiceCmd = useGameStore((s) => s.rollDice)

  const [rollKey, setRollKey] = useState(0)
  const [rolling, setRolling] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  const canRoll = phase === 'playing' && !paused && turnState === 'aguardando-rolagem' && !rolling
  const d1 = lastRoll ? lastRoll.white[0] : 1
  const d2 = lastRoll ? lastRoll.white[1] : 1
  const sd: SpeedFace = lastRoll && lastRoll.speed != null ? toUiSpeedFace(lastRoll.speed) : 'one'

  function handleRoll() {
    if (!canRoll) return
    setRolling(true)
    rollDiceCmd() // motor: rola, move e abre a resolução da casa
    setRollKey((k) => k + 1)
    timeoutRef.current = setTimeout(() => setRolling(false), ROLL_DURATION_MS)
  }

  const status =
    phase === 'ended' ? 'Fim de jogo'
    : turnState === 'aguardando-rolagem' ? 'Sua vez'
    : turnState === 'prisao-decisao' ? 'Preso — veja o HUD'
    : turnState === 'casa-a-resolver' ? 'Resolva a jogada'
    : 'Finalize o turno'

  return (
    <div className="flex flex-col items-center gap-5">
      {/* Jogador da vez — carinha + nome acima dos dados. Anel pisca quando é
          hora de rolar (turno ativo no demo local de 1 cliente). */}
      <div className="flex flex-col items-center gap-1.5">
        <PlayerFace color={active.color} active={canRoll} size={88} />
        <p className="display text-cream text-xl leading-none tracking-wide">
          {active.name}
        </p>
        <p className="label text-cream-muted">{status}</p>
      </div>

      <div className="flex items-center justify-center gap-4">
        <Dice value={d1} rollKey={rollKey} />
        <Dice value={d2} rollKey={rollKey} />
        {THEME.SPEED_DIE_ENABLED && active.speedDieReady && <SpeedDie face={sd} rollKey={rollKey} />}
      </div>
      <p className="label text-cream-muted text-center">
        {THEME.SPEED_DIE_ENABLED ? (active.speedDieReady ? '2 dados + Speed Die' : '2 dados (1ª volta)') : '2 dados'}
      </p>
      <button
        onClick={handleRoll}
        disabled={!canRoll}
        className="
          px-7 py-3 rounded-[var(--radius-sharp)]
          bg-gold text-coffee-950 border border-gold-soft
          display text-lg leading-none tracking-wider
          hover:bg-gold-glow hover:shadow-[var(--shadow-glow)]
          disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-gold disabled:hover:shadow-none
          transition-all
        "
      >
        {rolling ? 'Rolando…' : 'Rolar dados'}
      </button>
    </div>
  )
}

export function ActionsPanel() {
  const game = useGameStore((s) => s.game)
  const players = playersView(game)
  const active = players.find((p) => p.active) ?? players[0]
  const activeId = game.players[game.turnOrder[game.activeSeat]]?.id
  const goNext = activeId ? goBonus(game, activeId) : 0
  const pot = game.centerPot
  const trades = tradesView(game) // 027 — painel ao vivo
  const colorById = Object.fromEntries(
    game.players.map((p, i) => [p.id, PLAYER_COLORS[i % PLAYER_COLORS.length]]),
  ) as Record<string, string>

  return (
    <aside className="side-panel">
      <div className="side-panel-section">
        <p className="label text-gold mb-3">Turno</p>
        <div className="bg-coffee-800 border border-coffee-500 rounded-[var(--radius-card)] p-5">
          {/* Cabeçalho com nome + avatar + GO progressivo */}
          <div className="flex items-center gap-3 mb-4">
            <PlayerFace color={active.color} active size={44} />
            <div className="flex-1">
              <p className="label text-cream-muted">Vez de</p>
              <p className="display text-gold text-xl leading-none">{active.name}</p>
            </div>
            <div className="text-right">
              <p className="label text-cream-muted">Próx. GO</p>
              <p className="currency text-gold-glow text-base leading-none mt-1">
                <span className="text-gold-soft text-[10px] mr-0.5">R$</span>
                {goNext}
              </p>
            </div>
          </div>

          {/* Pote da Loteria — substituiu o bloco de dados */}
          <div className="flex items-baseline justify-between bg-coffee-900 border border-coffee-500 px-4 py-3 rounded-[var(--radius-card)] mb-4">
            <div className="flex flex-col">
              <span className="label">Pote da Loteria</span>
              <span className="label text-cream-muted text-[9px] leading-snug mt-0.5">
                Acumulado
              </span>
            </div>
            <span className="currency text-gold-glow text-2xl leading-none">
              <span className="text-gold-soft text-sm mr-0.5">R$</span>
              {pot.toLocaleString('pt-BR')}
            </span>
          </div>

          {/* Mão do jogador ativo (próprio HUD — SRS §12.4) */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-coffee-900 border border-coffee-500 rounded-[var(--radius-sharp)] px-3 py-2 text-center">
              <p className="label text-cream-muted">Cartas</p>
              <p className="display text-cream text-lg leading-none mt-1">{active.cardsInHand}/3</p>
            </div>
            <div className="bg-coffee-900 border border-coffee-500 rounded-[var(--radius-sharp)] px-3 py-2 text-center">
              <p className="label text-cream-muted">Bus Tickets</p>
              <p className="display text-cream text-lg leading-none mt-1">{active.busTickets}</p>
            </div>
          </div>
        </div>
      </div>

      <HandPanel />

      <div className="side-panel-section">
        <div className="flex items-baseline justify-between mb-3">
          <p className="label text-gold">Trades</p>
          <p className="label text-cream-muted">{trades.pending ? 1 : 0} ativos</p>
        </div>
        {!trades.pending && trades.history.length === 0 ? (
          <div className="flex items-center justify-center px-3 py-4 rounded-[var(--radius-card)] border border-dashed border-coffee-500 bg-coffee-800/40">
            <p className="label text-cream-muted text-center leading-snug">
              Nenhuma proposta no momento
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {trades.pending && <TradeRow key="pending" trade={trades.pending} done={false} colorById={colorById} />}
            {trades.history.map((t, i) => <TradeRow key={`h${i}`} trade={t} done colorById={colorById} />)}
          </div>
        )}
        <button
          type="button"
          onClick={() => useTradeUI.getState().show()}
          className="
            w-full mt-3 px-3 py-2 rounded-[var(--radius-sharp)]
            border border-coffee-500 bg-coffee-800/60 text-cream-muted
            label hover:bg-coffee-700 hover:text-cream transition-colors
          "
        >
          + Nova proposta
        </button>
      </div>
    </aside>
  )
}

function TradeRow({ trade, done, colorById }: { trade: Trade; done: boolean; colorById: Record<string, string> }) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2 px-3 py-2.5 rounded-[var(--radius-card)] border',
        done ? 'bg-coffee-800/40 border-coffee-500 opacity-70' : 'bg-coffee-700 border-gold shadow-[0_0_0_1px_rgba(212,175,55,0.3)]',
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <PlayerFace color={colorById[trade.fromId] ?? '#888'} size={22} />
        <span className="display text-cream text-sm leading-none truncate">{trade.fromId}</span>
        <span className="text-cream-muted text-xs shrink-0">→</span>
        <PlayerFace color={colorById[trade.toId] ?? '#888'} size={22} />
        <span className="display text-cream text-sm leading-none truncate">{trade.toId}</span>
      </div>

      <div className="flex flex-col gap-0.5 px-1">
        <div className="flex items-baseline gap-2">
          <span className="label text-cream-muted w-14 shrink-0">Oferece</span>
          <span className="text-cream text-sm leading-tight">{tradeSummary(trade.fromProps, trade.fromCash, trade.fromImmunities)}</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="label text-cream-muted w-14 shrink-0">Pede</span>
          <span className="text-cream text-sm leading-tight">{tradeSummary(trade.toProps, trade.toCash, trade.toImmunities)}</span>
        </div>
      </div>

      <p className={cn('label text-center pt-1.5 border-t border-coffee-500/60', done ? 'text-gold' : 'text-cream-muted')}>
        {done ? 'Aceita' : 'Aguardando resposta…'}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------
// Dado 3D — cubo real com 6 faces posicionadas via translateZ.
// Padrão consagrado (David DeSandro / daily-dev-tips): cada face é um
// <div> absoluto rotacionado pro seu lado e empurrado pra fora com
// translateZ(metade_do_cubo). transform-style: preserve-3d no cubo
// + perspective no scene preserva profundidade.
// ---------------------------------------------------------------------
const DIE_PX = 56               // w-14 / h-14
const HALF = DIE_PX / 2

// Rotação a aplicar no CUBO INTEIRO pra trazer a face do valor N pra câmera.
// Layout de d6 ocidental: faces opostas somam 7 (1↔6, 2↔5, 3↔4).
const FACE_REST: Record<number, [number, number]> = {
  1: [   0,   0 ], // frente
  2: [   0, -90 ], // direita
  3: [ -90,   0 ], // topo
  4: [  90,   0 ], // base
  5: [   0,  90 ], // esquerda
  6: [   0, 180 ], // fundo
}

const DOT_LAYOUT: Record<number, number[]> = {
  1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9],
  5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9],
}

function DotFace({ value, transform }: { value: number; transform: string }) {
  const dots = DOT_LAYOUT[value]
  return (
    <div
      className="absolute inset-0 grid grid-cols-3 grid-rows-3 gap-1 p-2 bg-cream rounded-[var(--radius-card)]"
      style={{
        transform,
        backfaceVisibility: 'hidden',
        boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.25), inset 0 -2px 3px rgba(0,0,0,0.15)',
      }}
    >
      {[1,2,3,4,5,6,7,8,9].map(i => (
        <div key={i} className="flex items-center justify-center">
          {dots.includes(i) && <span className="w-2 h-2 rounded-full bg-coffee-950" />}
        </div>
      ))}
    </div>
  )
}

function SpeedFaceContent({ kind, transform }: { kind: SpeedFace; transform: string }) {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center bg-gold rounded-[var(--radius-card)]"
      style={{
        transform,
        backfaceVisibility: 'hidden',
        boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.3), inset 0 -2px 3px rgba(0,0,0,0.18)',
      }}
    >
      {kind === 'one'   && <span className="display text-coffee-950 text-3xl leading-none">1</span>}
      {kind === 'two'   && <span className="display text-coffee-950 text-3xl leading-none">2</span>}
      {kind === 'three' && <span className="display text-coffee-950 text-3xl leading-none">3</span>}
      {kind === 'mr'    && <Crown size={28} className="text-coffee-950" strokeWidth={1.75} fill="currentColor" />}
      {kind === 'bus'   && <span className="display text-coffee-950 text-xl leading-none">BUS</span>}
    </div>
  )
}

// Hook compartilhado: dispara o tumble quando rollKey muda.
// Acumula 720° a cada roll (2 voltas) e termina na rotação de repouso
// da face desejada — motion interpola monotonamente, então o cubo
// sempre gira "pra frente" e pousa exatamente na face certa.
function useDieAnimation(value: number, rollKey: number) {
  const [scope, animate] = useAnimate()

  useEffect(() => {
    if (rollKey === 0 || !scope.current) return
    const [rx, ry] = FACE_REST[value]
    animate(
      scope.current,
      {
        rotateX: rollKey * 720 + rx,
        rotateY: rollKey * 720 + ry,
        y: [0, -42, 0],
      },
      {
        duration: 1.0,
        ease: [0.16, 0.84, 0.44, 1],
        y: { duration: 1.0, times: [0, 0.45, 1], ease: [0.34, 0, 0.32, 1] },
      },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rollKey])

  return scope
}

function Dice({ value, rollKey }: { value: number; rollKey: number }) {
  const scope = useDieAnimation(value, rollKey)
  const [initRx, initRy] = FACE_REST[value]

  return (
    <div className="relative" style={{ width: DIE_PX, height: DIE_PX, perspective: 500 }}>
      <motion.div
        aria-hidden="true"
        className="dice-shadow absolute left-1/2 -translate-x-1/2 -bottom-1.5 w-10 h-1.5 rounded-full bg-black/60 blur-[3px]"
        animate={rollKey > 0 ? { scaleX: [1, 0.45, 1.1, 1], opacity: [0.6, 0.18, 0.65, 0.55] } : { scaleX: 1, opacity: 0.55 }}
        transition={{ duration: 1.0, times: [0, 0.45, 0.78, 1] }}
      />
      <motion.div
        ref={scope}
        className="absolute inset-0"
        style={{ transformStyle: 'preserve-3d' }}
        initial={{ rotateX: initRx, rotateY: initRy }}
      >
        <DotFace value={1} transform={`rotateY(0deg)   translateZ(${HALF}px)`} />
        <DotFace value={2} transform={`rotateY(90deg)  translateZ(${HALF}px)`} />
        <DotFace value={3} transform={`rotateX(90deg)  translateZ(${HALF}px)`} />
        <DotFace value={4} transform={`rotateX(-90deg) translateZ(${HALF}px)`} />
        <DotFace value={5} transform={`rotateY(-90deg) translateZ(${HALF}px)`} />
        <DotFace value={6} transform={`rotateY(180deg) translateZ(${HALF}px)`} />
      </motion.div>
    </div>
  )
}

// Speed Die — terceiro dado, SRS §13.2. Faces: 1/2/3, Mr. BM, BUS.
// Cubo precisa de 6 faces, então Mr. BM aparece duas vezes (faces opostas).
function SpeedDie({ face, rollKey }: { face: SpeedFace; rollKey: number }) {
  const FACE_INDEX: Record<SpeedFace, number> = {
    one: 1, two: 2, three: 3, mr: 4, bus: 5,
  }
  const value = FACE_INDEX[face]
  const scope = useDieAnimation(value, rollKey)
  const [initRx, initRy] = FACE_REST[value]

  return (
    <div className="relative" style={{ width: DIE_PX, height: DIE_PX, perspective: 500 }}>
      <motion.div
        aria-hidden="true"
        className="dice-shadow absolute left-1/2 -translate-x-1/2 -bottom-1.5 w-10 h-1.5 rounded-full bg-black/60 blur-[3px]"
        animate={rollKey > 0 ? { scaleX: [1, 0.45, 1.1, 1], opacity: [0.6, 0.18, 0.65, 0.55] } : { scaleX: 1, opacity: 0.55 }}
        transition={{ duration: 1.0, times: [0, 0.45, 0.78, 1] }}
      />
      <motion.div
        ref={scope}
        className="absolute inset-0"
        style={{ transformStyle: 'preserve-3d' }}
        initial={{ rotateX: initRx, rotateY: initRy }}
      >
        <SpeedFaceContent kind="one"   transform={`rotateY(0deg)   translateZ(${HALF}px)`} />
        <SpeedFaceContent kind="two"   transform={`rotateY(90deg)  translateZ(${HALF}px)`} />
        <SpeedFaceContent kind="three" transform={`rotateX(90deg)  translateZ(${HALF}px)`} />
        <SpeedFaceContent kind="mr"    transform={`rotateX(-90deg) translateZ(${HALF}px)`} />
        <SpeedFaceContent kind="bus"   transform={`rotateY(-90deg) translateZ(${HALF}px)`} />
        <SpeedFaceContent kind="mr"    transform={`rotateY(180deg) translateZ(${HALF}px)`} />
      </motion.div>
    </div>
  )
}

// ---------------------------------------------------------------------
// CardDeck — pilha de cartas (Acaso ou Tesouro) no centro do tabuleiro.
// 3 cartas empilhadas com rotações sutis e sombras pra parecer monte real.
// A faixa do topo mostra as 3 raridades — SRS §10.2 (laranja/azul/verde).
// ---------------------------------------------------------------------
// Glifo Acaso — losango vermelho com "!" branco; corner-pip pequeno.
function AcasoGlyph() {
  return (
    <svg viewBox="0 0 80 80" className="w-full h-full" aria-hidden="true">
      {/* sombra do losango */}
      <polygon
        points="40,11 70,40 40,69 10,40"
        fill="#0f0c09"
        opacity="0.45"
        transform="translate(2,3)"
      />
      {/* losango vermelho */}
      <polygon
        points="40,8 71,40 40,72 9,40"
        fill="#dc2626"
        stroke="#0f0c09"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* faixa interna */}
      <polygon
        points="40,14 65,40 40,66 15,40"
        fill="none"
        stroke="#ffd97a"
        strokeWidth="0.8"
        strokeDasharray="2 2"
      />
      {/* "!" — haste */}
      <path
        d="M 37 24 L 43 24 L 41.5 46 L 38.5 46 Z"
        fill="#f4e8d0"
        stroke="#0f0c09"
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
      {/* "!" — ponto */}
      <circle cx="40" cy="54" r="3.4" fill="#f4e8d0" stroke="#0f0c09" strokeWidth="0.8" />
    </svg>
  )
}

// Glifo Tesouro — baú dourado em vista frontal com moedas no topo.
function TesouroGlyph() {
  return (
    <svg viewBox="0 0 90 70" className="w-full h-full" aria-hidden="true">
      {/* moedas no topo */}
      <circle cx="18" cy="14" r="5" fill="#ffd97a" stroke="#0f0c09" strokeWidth="1.2" />
      <text x="18" y="17" textAnchor="middle" fontSize="6" fill="#0f0c09" fontFamily="Roboto Slab, serif" fontWeight="700">$</text>
      <circle cx="70" cy="11" r="4" fill="#d4af37" stroke="#0f0c09" strokeWidth="1" />
      <circle cx="74" cy="18" r="3" fill="#ffd97a" stroke="#0f0c09" strokeWidth="0.9" />

      {/* sombra do baú */}
      <ellipse cx="45" cy="65" rx="34" ry="2.5" fill="#0f0c09" opacity="0.5" />

      {/* corpo do baú */}
      <rect x="10" y="32" width="70" height="30" rx="2"
        fill="#5c4a36" stroke="#0f0c09" strokeWidth="1.5" />
      {/* tábuas */}
      <line x1="10" y1="46" x2="80" y2="46" stroke="#3d3528" strokeWidth="1" />
      <line x1="34" y1="32" x2="34" y2="62" stroke="#3d3528" strokeWidth="0.8" />
      <line x1="56" y1="32" x2="56" y2="62" stroke="#3d3528" strokeWidth="0.8" />

      {/* tampa arqueada */}
      <path d="M 10 32 Q 10 16 45 16 Q 80 16 80 32 Z"
        fill="#3d3528" stroke="#0f0c09" strokeWidth="1.5" />
      {/* brilho da tampa */}
      <path d="M 14 30 Q 14 20 45 20 Q 76 20 76 30"
        fill="none" stroke="#b8941f" strokeWidth="0.8" />

      {/* fitas douradas verticais */}
      <rect x="42" y="16" width="6" height="46" fill="#d4af37" stroke="#0f0c09" strokeWidth="0.8" />

      {/* fechadura */}
      <rect x="38" y="34" width="14" height="14" rx="1.5"
        fill="#ffd97a" stroke="#0f0c09" strokeWidth="1.2" />
      <circle cx="45" cy="40" r="1.8" fill="#0f0c09" />
      <rect x="44" y="40" width="2" height="5" fill="#0f0c09" />
    </svg>
  )
}

export function CardDeck({
  kind,
  tilt = -4,
  className,
}: {
  kind: 'acaso' | 'tesouro'
  tilt?: number
  className?: string
}) {
  const isAcaso = kind === 'acaso'
  const title = isAcaso ? 'Acaso' : 'Tesouro'
  // Cor accent em hex pra usar diretamente em gradientes/sombras (var()
  // dentro de gradiente CSS funciona, mas inline com hex é mais simples).
  const accentHex = isAcaso ? '#dc2626' /* logo */ : '#ffd97a' /* gold-glow */
  const accentClass = isAcaso ? 'text-logo' : 'text-gold-glow'

  return (
    <div
      className={cn('relative aspect-[5/7]', className)}
      style={{ containerType: 'inline-size' }}
    >
      {/* sombra projetada da pilha */}
      <div
        className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-[78%] h-2 rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 70%)',
          filter: 'blur(3px)',
        }}
      />

      {/* duas cartas embaixo dando sensação de monte */}
      <CardSlab rotation={tilt * 1.4} offsetX={tilt * 0.6} offsetY={1} muted />
      <CardSlab rotation={tilt * 0.7} offsetX={tilt * 0.3} offsetY={0.5} muted />

      {/* carta do topo — fundo com glow do accent + moldura interna
          tracejada + ornamento superior + faixa de título no rodapé */}
      <CardSlab rotation={0} offsetX={0} offsetY={0}>
        {/* Glow radial do accent atrás do glifo */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse 70% 55% at 50% 42%, ${accentHex}22 0%, transparent 70%)`,
          }}
        />

        {/* Moldura ornamental tracejada interna (cor do accent) */}
        <div
          className="absolute inset-[6%] pointer-events-none rounded-[2px]"
          style={{
            border: `1px dashed ${accentHex}66`,
          }}
        />

        {/* Ornamento superior — duas linhas + losango pequeno */}
        <div
          className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5 pointer-events-none"
          style={{ top: '10%' }}
        >
          <span
            className="block h-px"
            style={{ width: 'clamp(8px, 12cqi, 22px)', backgroundColor: `${accentHex}99` }}
          />
          <span
            className="block rotate-45"
            style={{
              width: 'clamp(3px, 1.6cqi, 5px)',
              height: 'clamp(3px, 1.6cqi, 5px)',
              backgroundColor: accentHex,
              boxShadow: `0 0 4px ${accentHex}80`,
            }}
          />
          <span
            className="block h-px"
            style={{ width: 'clamp(8px, 12cqi, 22px)', backgroundColor: `${accentHex}99` }}
          />
        </div>

        {/* Glifo central — agora ocupando o miolo da carta */}
        <div className="absolute inset-0 flex items-center justify-center px-[14%] pt-[22%] pb-[30%]">
          {isAcaso ? <AcasoGlyph /> : <TesouroGlyph />}
        </div>

        {/* Faixa de título no rodapé — banda escura com gradiente, linha
            acima em accent, título em Bebas Neue forte. */}
        <div
          className="absolute bottom-0 left-0 right-0 flex flex-col items-center justify-end pointer-events-none"
          style={{ height: '22%' }}
        >
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(to top, rgba(15,12,9,0.85) 0%, rgba(15,12,9,0.55) 55%, rgba(15,12,9,0) 100%)',
            }}
          />
          <span
            className="relative block"
            style={{
              height: '1px',
              width: '60%',
              background: `linear-gradient(to right, transparent, ${accentHex}cc, transparent)`,
              marginBottom: 'clamp(3px, 1.6cqi, 6px)',
            }}
          />
          <p
            className={cn('relative display leading-none uppercase', accentClass)}
            style={{
              fontSize: 'clamp(10px, 12cqi, 19px)',
              letterSpacing: '0.18em',
              paddingBottom: 'clamp(4px, 2.2cqi, 8px)',
              textShadow:
                `0 1px 2px rgba(0,0,0,0.7), 0 0 12px ${accentHex}33`,
            }}
          >
            {title}
          </p>
        </div>
      </CardSlab>
    </div>
  )
}

// Uma "carta" individual da pilha. Compartilhada pela base e pelo topo.
function CardSlab({
  rotation,
  offsetX,
  offsetY,
  muted = false,
  children,
}: {
  rotation: number
  offsetX: number
  offsetY: number
  muted?: boolean
  children?: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'absolute inset-0 flex flex-col overflow-hidden',
        'border-2 border-coffee-500',
        'rounded-[var(--radius-card)]',
        muted && 'opacity-90',
      )}
      style={{
        transform: `translate(${offsetX}px, ${offsetY}px) rotate(${rotation}deg)`,
        // Gradiente sutil top→bottom dando peso à carta, com inner highlight
        // no topo (luz batendo) e sombra dura embaixo.
        background:
          'linear-gradient(to bottom, var(--color-coffee-600) 0%, var(--color-coffee-700) 45%, var(--color-coffee-800) 100%)',
        boxShadow: [
          'inset 0 1px 0 rgba(255,217,122,0.08)',
          'inset 0 0 0 1px var(--color-coffee-800)',
          '0 6px 14px -4px rgba(0,0,0,0.75)',
          '0 2px 4px -1px rgba(0,0,0,0.5)',
        ].join(', '),
      }}
    >
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------
// CenterArena — composição premium do miolo do tabuleiro.
// Layout simétrico: dados centralizados pra arremesso, decks nos cantos
// inferiores, padrão de estrelas no fundo.
// ---------------------------------------------------------------------
export function CenterArena() {
  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{ containerType: 'inline-size' }}
    >
      {/* Fundo: gradiente radial dourado sutil sob o centro */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 60% 50% at center, rgba(212,175,55,0.10) 0%, rgba(212,175,55,0) 65%)',
        }}
      />

      {/* Padrão de estrelas (referência à bandeira) — SVG repetido */}
      <StarsPattern />

      {/* Molduras decorativas externas */}
      <div className="absolute inset-3 border border-coffee-500/50 rounded-[2px] pointer-events-none" />
      <div className="absolute inset-6 border border-coffee-500/25 rounded-[2px] pointer-events-none" />

      {/* CENTRO — arena de arremesso de dados */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <DiceArena />
      </div>

      {/* SURPRESA — extremidade superior-direita, virada pra baixo-esquerda */}
      <div
        className="absolute"
        style={{
          top: '9%',
          right: '8%',
          width: '17%',
          transform: 'rotate(-135deg)',
          transformOrigin: 'center',
        }}
      >
        <CardDeck kind="acaso" tilt={3} />
      </div>

      {/* TESOURO — extremidade inferior-esquerda, virado pra cima-direita */}
      <div
        className="absolute"
        style={{
          bottom: '9%',
          left: '8%',
          width: '17%',
          transform: 'rotate(45deg)',
          transformOrigin: 'center',
        }}
      >
        <CardDeck kind="tesouro" tilt={3} />
      </div>
    </div>
  )
}

// Padrão de estrelas no fundo do centro (referência sutil à bandeira BR).
function StarsPattern() {
  // Posições dispersas — não-uniforme, p/ parecer constelação.
  const stars = [
    { x: 14, y: 18, s: 2.6, op: 0.18 },
    { x: 25, y: 32, s: 1.6, op: 0.12 },
    { x: 38, y: 12, s: 2.2, op: 0.16 },
    { x: 52, y: 25, s: 1.8, op: 0.14 },
    { x: 66, y: 16, s: 2.6, op: 0.18 },
    { x: 80, y: 28, s: 1.8, op: 0.13 },
    { x: 88, y: 16, s: 2.2, op: 0.15 },
    { x: 12, y: 48, s: 1.5, op: 0.10 },
    { x: 90, y: 50, s: 1.5, op: 0.10 },
    { x: 18, y: 72, s: 2.0, op: 0.14 },
    { x: 32, y: 84, s: 1.6, op: 0.12 },
    { x: 50, y: 78, s: 2.4, op: 0.18 },
    { x: 68, y: 86, s: 1.8, op: 0.14 },
    { x: 82, y: 72, s: 2.0, op: 0.14 },
  ]
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      {stars.map((s, i) => (
        <polygon
          key={i}
          points={fivePointStar(s.x, s.y, s.s)}
          fill="#ffd97a"
          opacity={s.op}
        />
      ))}
    </svg>
  )
}

// Gera os pontos de uma estrela de 5 pontas centrada em (cx, cy) com raio r.
function fivePointStar(cx: number, cy: number, r: number) {
  const outer = r
  const inner = r * 0.4
  const pts: string[] = []
  for (let i = 0; i < 10; i++) {
    const angle = (Math.PI / 5) * i - Math.PI / 2
    const rad = i % 2 === 0 ? outer : inner
    pts.push(`${cx + Math.cos(angle) * rad},${cy + Math.sin(angle) * rad}`)
  }
  return pts.join(' ')
}

// Bilhete da Loteria — formato de stub real (canhoto à esquerda + corpo + perfuração).
// WIP: ainda não renderizado; exportado para uso futuro (prêmio do Free Parking).
export function LotteryCard({ amount }: { amount: number }) {
  return (
    <div className="relative w-full" style={{ containerType: 'inline-size' }}>
      {/* sombra projetada */}
      <div
        className="absolute -bottom-2 left-[4%] right-[4%] h-3 rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 70%)',
          filter: 'blur(5px)',
        }}
      />

      <div
        className="
          relative w-full flex overflow-hidden
          bg-coffee-700 border-2 border-coffee-500
          rounded-[var(--radius-card)]
          shadow-[inset_0_0_0_1px_var(--color-coffee-800),0_6px_18px_-4px_rgba(0,0,0,0.7)]
        "
      >
        {/* CANHOTO — coluna esquerda mais escura, com número do sorteio rotacionado */}
        <div
          className="
            relative shrink-0
            bg-coffee-900 border-r border-dashed border-coffee-500
            flex items-center justify-center
          "
          style={{ width: '14%', minWidth: '52px' }}
        >
          <p
            className="display text-gold tracking-[0.4em] whitespace-nowrap"
            style={{
              fontSize: 'clamp(9px, 1.5cqi, 13px)',
              writingMode: 'vertical-rl',
              transform: 'rotate(180deg)',
            }}
          >
            Sorteio Nº 042
          </p>
        </div>

        {/* PERFURAÇÃO — círculos do tom de fundo "rasgando" entre canhoto e corpo */}
        <div
          className="absolute top-0 bottom-0 flex flex-col justify-evenly pointer-events-none"
          style={{ left: 'calc(14% - 4px)', minWidth: '8px' }}
        >
          {Array.from({ length: 9 }).map((_, i) => (
            <span
              key={i}
              className="block w-2 h-2 rounded-full bg-coffee-900 border border-coffee-500"
            />
          ))}
        </div>

        {/* CORPO PRINCIPAL */}
        <div className="flex-1 relative" style={{ padding: 'clamp(12px, 2.4cqi, 22px) clamp(16px, 3cqi, 28px)' }}>
          {/* topo: brand + data */}
          <div className="flex items-baseline justify-between mb-1">
            <p
              className="label text-gold tracking-[0.35em]"
              style={{ fontSize: 'clamp(7px, 1.1cqi, 10px)' }}
            >
              Banco Master · Loteria Federal
            </p>
            <p
              className="currency text-cream-muted tracking-widest"
              style={{ fontSize: 'clamp(7px, 1.05cqi, 10px)' }}
            >
              22 · MAI · 2026
            </p>
          </div>

          {/* divisor */}
          <div className="border-t border-coffee-500 mb-2" />

          {/* prêmio dominante */}
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <div className="flex flex-col">
              <p
                className="label text-cream-muted tracking-[0.3em]"
                style={{ fontSize: 'clamp(7px, 1.1cqi, 10px)' }}
              >
                Prêmio acumulado
              </p>
              <p
                className="currency text-gold-glow leading-none mt-1 drop-shadow-[0_2px_3px_rgba(255,217,122,0.25)]"
                style={{
                  fontSize: 'clamp(30px, 9cqi, 72px)',
                  letterSpacing: '-0.02em',
                }}
              >
                <span className="text-gold-soft" style={{ fontSize: '0.46em', marginRight: '0.18em' }}>R$</span>
                {amount.toLocaleString('pt-BR')}
              </p>
            </div>

            {/* dezenas mock — referência visual a loteria */}
            <div className="flex gap-1.5 items-end">
              {['07','11','22','34','58','67'].map((n) => (
                <div
                  key={n}
                  className="flex items-center justify-center border border-gold/60 bg-coffee-900 rounded-full"
                  style={{
                    width:  'clamp(22px, 3.4cqi, 36px)',
                    height: 'clamp(22px, 3.4cqi, 36px)',
                  }}
                >
                  <span
                    className="currency text-gold"
                    style={{ fontSize: 'clamp(10px, 1.4cqi, 14px)' }}
                  >
                    {n}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* rodapé: serial + microcopy */}
          <div className="flex items-baseline justify-between mt-3 pt-2 border-t border-coffee-500/60">
            <p
              className="currency text-cream-muted tracking-widest"
              style={{ fontSize: 'clamp(7px, 1cqi, 10px)' }}
            >
              SR · 0428 · 1742
            </p>
            <p
              className="label text-cream-muted tracking-[0.25em]"
              style={{ fontSize: 'clamp(7px, 1.05cqi, 10px)' }}
            >
              Quem cair em Loteria, leva o pote
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------
// ParkingPotDisplay — caixa central com o pote acumulado de Férias.
// Visual de "prêmio" — moldura dourada, valor em destaque, cintilação.
// ---------------------------------------------------------------------
export function ParkingPotDisplay({ amount }: { amount: number }) {
  return (
    <div className="relative w-full" style={{ containerType: 'inline-size' }}>
      {/* halo dourado por trás */}
      <div
        className="absolute inset-0 -m-6 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(212,175,55,0.22) 0%, rgba(212,175,55,0) 70%)',
        }}
      />

      <div
        className="
          relative
          bg-gradient-to-b from-coffee-700 via-coffee-800 to-coffee-900
          border-2 border-gold
          rounded-[var(--radius-card)]
          shadow-[var(--shadow-lift),0_0_40px_-10px_rgba(212,175,55,0.55)]
        "
        style={{ padding: 'clamp(12px, 4cqi, 28px) clamp(18px, 6cqi, 40px)' }}
      >
        {/* cantos decorativos dourados */}
        {(['tl','tr','bl','br'] as const).map((c) => (
          <span
            key={c}
            className="absolute border-gold pointer-events-none"
            style={{
              width: 'clamp(8px, 2cqi, 16px)',
              height: 'clamp(8px, 2cqi, 16px)',
              top:    c.includes('t') ? '5px' : 'auto',
              bottom: c.includes('b') ? '5px' : 'auto',
              left:   c.includes('l') ? '5px' : 'auto',
              right:  c.includes('r') ? '5px' : 'auto',
              borderTopWidth:    c.includes('t') ? 1.5 : 0,
              borderBottomWidth: c.includes('b') ? 1.5 : 0,
              borderLeftWidth:   c.includes('l') ? 1.5 : 0,
              borderRightWidth:  c.includes('r') ? 1.5 : 0,
            }}
          />
        ))}

        <div className="flex items-center justify-center gap-3 mb-2">
          <span className="block h-px bg-gold/60" style={{ width: 'clamp(16px, 4cqi, 40px)' }} />
          <p className="label text-gold tracking-[0.35em]" style={{ fontSize: 'clamp(9px, 1.7cqi, 13px)' }}>
            Pote de Férias
          </p>
          <span className="block h-px bg-gold/60" style={{ width: 'clamp(16px, 4cqi, 40px)' }} />
        </div>

        <p
          className="currency text-gold-glow text-center leading-none drop-shadow-[0_2px_6px_rgba(255,217,122,0.4)]"
          style={{ fontSize: 'clamp(28px, 8cqi, 64px)' }}
        >
          <span className="text-gold-soft" style={{ fontSize: '0.55em', marginRight: '0.18em' }}>R$</span>
          {amount.toLocaleString('pt-BR')}
        </p>

        <p
          className="label text-cream-muted text-center mt-2"
          style={{ fontSize: 'clamp(8px, 1.4cqi, 11px)' }}
        >
          Quem parar em Férias, leva tudo.
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------
// Center plate — placa central usada em vários boards
// ---------------------------------------------------------------------
export function CenterPlate({
  title = 'Banco Master',
  subtitle = 'Países do Mundo',
  variant = 'default',
}: { title?: string; subtitle?: string; variant?: 'default' | 'compact' }) {
  return (
    <div className={cn(
      'flex flex-col items-center justify-center text-center select-none',
      variant === 'compact' && 'gap-1',
    )}>
      <Crown size={variant === 'compact' ? 28 : 44} className="text-gold mb-2" strokeWidth={1.25} />
      <p className="label text-gold-soft mb-1">Edição</p>
      <h2 className={cn(
        'display text-cream leading-none',
        variant === 'compact' ? 'text-3xl' : 'text-5xl md:text-6xl'
      )}>
        {title.split(' ').map((w, i, arr) => (
          <span key={i} className={i === arr.length - 1 ? 'text-logo block' : 'block'}>
            {w}
          </span>
        ))}
      </h2>
      <p className="label text-cream-muted mt-3 tracking-[0.3em]">{subtitle}</p>
    </div>
  )
}

// =====================================================================
// PropertyModal — Title Deed clicável, estilo Monopoly clássico
// com paleta Café Coado. Mostra: nome + bandeira, tabela completa de
// aluguéis (base / 1-4 casas / hotel / skyscraper), preço, custo de
// casa, hipoteca e dono se houver. Fecha clicando no backdrop ou Esc.
// =====================================================================
export function computeRents(rent: number) {
  return {
    base:       rent,
    house1:     rent * 5,
    house2:     rent * 15,
    house3:     rent * 40,
    house4:     rent * 70,
    hotel:      rent * 100,
    skyscraper: rent * 150,
  }
}

function fmtMoney(n: number) {
  if (n == null || Number.isNaN(n)) return '—' // blindagem: nunca quebra por valor ausente
  return n.toLocaleString('pt-BR')
}

// Popover estilo "balão" — abre adjacente à casa clicada, apontando pra
// dentro do tabuleiro (onde sobra espaço). Sem backdrop, sem cobrir tela
// inteira. Fecha com Esc, clicando fora, ou abrindo outra casa.
export function PropertyPopover({
  square,
  side,
  onClose,
}: {
  square: PropertySquare
  side: Side
  onClose: () => void
}) {
  // Esc fecha
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Posicionamento adjacente — sempre do lado interno do tabuleiro.
  const positionStyle: React.CSSProperties = (() => {
    const gap = 10
    switch (side) {
      case 'bottom': return { bottom: '100%', left: '50%', marginBottom: gap }
      case 'top':    return { top: '100%',    left: '50%', marginTop: gap }
      case 'left':   return { left: '100%',   top: '50%',  marginLeft: gap }
      case 'right':  return { right: '100%',  top: '50%',  marginRight: gap }
      default:       return { left: '50%',    top: '50%' }
    }
  })()
  const centerTransform =
    side === 'left' || side === 'right' ? 'translateY(-50%)' : 'translateX(-50%)'

  // Tail/rabicho — quadrado rotacionado 45° na borda apontando pra casa.
  const tailStyle: React.CSSProperties = (() => {
    const offset = -7
    const common = {
      position: 'absolute' as const,
      width: 12,
      height: 12,
      background: 'var(--color-coffee-800)',
      border: '2px solid var(--color-coffee-500)',
      transform: 'rotate(45deg)',
    }
    switch (side) {
      case 'bottom': return { ...common, bottom: offset, left: '50%', marginLeft: -6, borderTop: 'none', borderLeft: 'none' }
      case 'top':    return { ...common, top: offset,    left: '50%', marginLeft: -6, borderBottom: 'none', borderRight: 'none' }
      case 'left':   return { ...common, left: offset,   top: '50%',  marginTop: -6,  borderTop: 'none', borderRight: 'none' }
      case 'right':  return { ...common, right: offset,  top: '50%',  marginTop: -6,  borderBottom: 'none', borderLeft: 'none' }
      default:       return common
    }
  })()

  return (
    <div
      style={{
        position: 'absolute',
        zIndex: 50,
        transform: centerTransform,
        ...positionStyle,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ type: 'spring', stiffness: 380, damping: 26 }}
        style={{ position: 'relative' }}
      >
        {/* Body do balão — overflow-hidden pra cortar o conteúdo no border-radius */}
        <div
          className="
            w-[270px]
            bg-coffee-800 border-2 border-coffee-500
            rounded-[var(--radius-card)]
            shadow-[var(--shadow-dropdown)]
            overflow-hidden
          "
        >
          <PropertyDeedContent square={square} onClose={onClose} />
        </div>
        {/* Rabicho — dentro do motion.div pra animar junto (opacity + scale) */}
        <div style={tailStyle} />
      </motion.div>
    </div>
  )
}

// Botão de ação do deed (dourado; desabilita conforme as flags).
function DeedBtn({ onClick, disabled, title, children }: { onClick: () => void; disabled?: boolean; title?: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="px-2 py-1 rounded-[var(--radius-sharp)] text-xs font-bold bg-gold text-coffee-900 hover:brightness-110 active:translate-y-px disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:brightness-100"
    >
      {children}
    </button>
  )
}

const BUILD_BLOCK_MSG: Record<string, string> = {
  maioria: 'Precisa da maioria do grupo',
  'hipoteca-no-grupo': 'Há propriedade hipotecada no grupo',
  topo: 'Já está no nível máximo',
  uniformidade: 'Construa primeiro na cidade de menor nível',
  'grupo-incompleto': 'Arranha-céu exige o grupo completo',
  estoque: 'Banco sem estoque',
  caixa: 'Caixa insuficiente',
}

// Ações de gestão (023) — só para o dono da vez. Reusado pelos 3 popovers.
function DeedActions({ pos }: { pos: number }) {
  const game = useGameStore((s) => s.game)
  const buildHouse = useGameStore((s) => s.buildHouse)
  const sellBuilding = useGameStore((s) => s.sellBuilding)
  const buildHangar = useGameStore((s) => s.buildHangar)
  const sellHangar = useGameStore((s) => s.sellHangar)
  const mortgageProperty = useGameStore((s) => s.mortgageProperty)
  const unmortgageProperty = useGameStore((s) => s.unmortgageProperty)

  const dv = deedView(game, pos)
  if (!dv || !dv.ownedByActive) return null
  const { flags } = dv
  const blockMsg = dv.buildBlock ? BUILD_BLOCK_MSG[dv.buildBlock] : undefined

  return (
    <div className="mt-3 pt-2.5 border-t border-coffee-500/60 flex flex-col gap-1.5">
      <p className="label text-gold" style={{ fontSize: '9px' }}>Gerenciar</p>
      <div className="flex flex-wrap gap-1.5">
        {dv.kind === 'property' && (
          <>
            <DeedBtn disabled={!flags.podeConstruir} onClick={() => buildHouse(pos)} title={blockMsg}>
              🏗 Construir (${dv.buildCost})
            </DeedBtn>
            <DeedBtn disabled={!flags.podeVender} onClick={() => sellBuilding(pos)}>Vender</DeedBtn>
          </>
        )}
        {dv.kind === 'airport' && (
          <>
            <DeedBtn disabled={!flags.podeConstruirHangar} onClick={() => buildHangar(pos)}>🛩 Hangar</DeedBtn>
            <DeedBtn disabled={!flags.podeVenderHangar} onClick={() => sellHangar(pos)}>Vender Hangar</DeedBtn>
          </>
        )}
        {!dv.mortgaged ? (
          <DeedBtn disabled={!flags.podeHipotecar} onClick={() => mortgageProperty(pos)}>Hipotecar (+${dv.mortgageValue})</DeedBtn>
        ) : (
          <DeedBtn disabled={!flags.podeDeshipotecar} onClick={() => unmortgageProperty(pos)}>Deshipotecar (−${dv.unmortgageCost})</DeedBtn>
        )}
      </div>
      {dv.kind === 'property' && !flags.podeConstruir && blockMsg && (
        <p className="text-cream-muted" style={{ fontSize: '9px' }}>{blockMsg}</p>
      )}
    </div>
  )
}

function PropertyDeedContent({ square, onClose }: { square: PropertySquare; onClose: () => void }) {
  const game = useGameStore((s) => s.game)
  const dv = deedView(game, square.pos)!
  const owner = dv.owner
  const buildings = dv.level // 0–7 real
  const rents = computeRents(square.rent)
  const houseCost = dv.buildCost
  const mortgage = dv.mortgageValue
  const stripeColor = GROUP_COLOR[square.group]
  const isMortgaged = dv.mortgaged

  // Linha de aluguel ATIVA (highlight) pelo nível real
  const activeRow: keyof typeof rents =
    buildings === 7 ? 'skyscraper' :
    buildings >= 5 ? 'hotel' :
    buildings === 4 ? 'house4' :
    buildings === 3 ? 'house3' :
    buildings === 2 ? 'house2' :
    buildings === 1 ? 'house1' :
    'base'

  return (
    <>
      {/* Header com stripe colorida + bandeira + nome */}
      <div
        className="relative px-3.5 py-3 border-b-2 border-coffee-950"
        style={{
          background: `linear-gradient(180deg, ${stripeColor} 0%, ${stripeColor} 60%, color-mix(in srgb, ${stripeColor} 75%, #000) 100%)`,
        }}
      >
        <button
          onClick={onClose}
          aria-label="Fechar"
          className="
            absolute top-1.5 right-1.5 w-6 h-6 rounded-full
            bg-coffee-950/45 text-cream hover:bg-coffee-950/75
            flex items-center justify-center text-xs
            transition-colors
          "
        >
          ✕
        </button>
        <div className="flex items-center gap-2.5 pr-6">
          <div
            className="
              shrink-0 w-9 h-9 rounded-full
              bg-coffee-900 border-2 border-coffee-950
              overflow-hidden
              shadow-[0_2px_4px_rgba(0,0,0,0.55)]
            "
          >
            <img
              src={`https://flagcdn.com/${square.uf.toLowerCase()}.svg`}
              alt={square.uf}
              className="w-full h-full object-cover"
              draggable={false}
            />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="display text-coffee-950 text-xl leading-none truncate">
              {square.name}
            </h3>
            <p className="label text-coffee-950/80 mt-0.5" style={{ fontSize: '9px' }}>
              {square.capital}
            </p>
          </div>
        </div>
      </div>

      {/* Tabela de aluguéis */}
      <div className="px-3.5 py-3">
        <p className="label text-gold mb-2" style={{ fontSize: '9px' }}>Aluguel</p>
        <div className="flex flex-col gap-0.5">
          <CompactRent label="Base"        value={rents.base}       active={activeRow === 'base'} />
          <CompactRent label="1 casa"      value={rents.house1}     active={activeRow === 'house1'} />
          <CompactRent label="2 casas"     value={rents.house2}     active={activeRow === 'house2'} />
          <CompactRent label="3 casas"     value={rents.house3}     active={activeRow === 'house3'} />
          <CompactRent label="4 casas"     value={rents.house4}     active={activeRow === 'house4'} />
          <CompactRent label="Hotel"       value={rents.hotel}      active={activeRow === 'hotel'} />
          <CompactRent label="Arranha-céu" value={rents.skyscraper} active={activeRow === 'skyscraper'} accent />
        </div>

        {/* Bloco de valores fixos */}
        <div className="mt-3 pt-2.5 border-t border-coffee-500/60 flex flex-col gap-0.5">
          <CompactRent label="Preço"    value={square.price} muted />
          <CompactRent label="Casa"     value={houseCost}    muted />
          <CompactRent label="Hipoteca" value={mortgage}     muted />
        </div>

        {/* Rodapé: dono + status */}
        {(owner || isMortgaged) && (
          <div className="mt-3 pt-2.5 border-t border-coffee-500/60 flex items-center gap-2">
            {owner && (
              <div className="flex-1 min-w-0">
                <p className="label text-cream-muted" style={{ fontSize: '8px' }}>Dono</p>
                <p className="display text-cream text-xs leading-none mt-0.5 truncate">{owner}</p>
              </div>
            )}
            {isMortgaged && (
              <span className="
                ml-auto inline-flex items-center px-2 py-0.5 rounded-full
                bg-logo/20 border border-logo/60 text-logo
                label
              " style={{ fontSize: '8px' }}>
                Hipotecada
              </span>
            )}
          </div>
        )}

        <DeedActions pos={square.pos} />
      </div>
    </>
  )
}

// ---------------------------------------------------------------------
// AirportPopover — regras e aluguel de aeroporto (SRS §2.4 + §13.6)
// ---------------------------------------------------------------------
export function AirportPopover({
  square,
  side,
  onClose,
}: {
  square: AirportSquare
  side: Side
  onClose: () => void
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const positionStyle: React.CSSProperties = (() => {
    const gap = 10
    switch (side) {
      case 'bottom': return { bottom: '100%', left: '50%', marginBottom: gap }
      case 'top':    return { top: '100%',    left: '50%', marginTop: gap }
      case 'left':   return { left: '100%',   top: '50%',  marginLeft: gap }
      case 'right':  return { right: '100%',  top: '50%',  marginRight: gap }
      default:       return { left: '50%',    top: '50%' }
    }
  })()
  const centerTransform = side === 'left' || side === 'right' ? 'translateY(-50%)' : 'translateX(-50%)'
  const tailStyle: React.CSSProperties = (() => {
    const offset = -7
    const common = { position: 'absolute' as const, width: 12, height: 12, background: 'var(--color-coffee-800)', border: '2px solid var(--color-coffee-500)', transform: 'rotate(45deg)' }
    switch (side) {
      case 'bottom': return { ...common, bottom: offset, left: '50%', marginLeft: -6, borderTop: 'none', borderLeft: 'none' }
      case 'top':    return { ...common, top: offset,    left: '50%', marginLeft: -6, borderBottom: 'none', borderRight: 'none' }
      case 'left':   return { ...common, left: offset,   top: '50%',  marginTop: -6,  borderTop: 'none', borderRight: 'none' }
      case 'right':  return { ...common, right: offset,  top: '50%',  marginTop: -6,  borderBottom: 'none', borderLeft: 'none' }
      default:       return common
    }
  })()

  return (
    <div style={{ position: 'absolute', zIndex: 50, transform: centerTransform, ...positionStyle }} onClick={(e) => e.stopPropagation()}>
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ type: 'spring', stiffness: 380, damping: 26 }} style={{ position: 'relative' }}>
        <div className="w-[270px] bg-coffee-800 border-2 border-coffee-500 rounded-[var(--radius-card)] shadow-[var(--shadow-dropdown)] overflow-hidden">
          {/* Header dourado */}
          <div className="relative px-3.5 py-3 border-b-2 border-coffee-950" style={{ background: 'linear-gradient(180deg, #d4af37 0%, #b8941f 100%)' }}>
            <button onClick={onClose} aria-label="Fechar" className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-coffee-950/45 text-cream hover:bg-coffee-950/75 flex items-center justify-center text-xs transition-colors">✕</button>
            <div className="flex items-center gap-2.5 pr-6">
              <div className="shrink-0 w-9 h-9 flex items-center justify-center">
                <SquareIcon square={square} size={32} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="display text-coffee-950 text-lg leading-none truncate">{square.name}</h3>
                <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-coffee-950/25 text-coffee-950 font-bold" style={{ fontSize: '10px', letterSpacing: '0.08em' }}>{square.iata}</span>
              </div>
            </div>
          </div>
          {/* Corpo */}
          <div className="px-3.5 py-3">
            <p className="label text-gold mb-2" style={{ fontSize: '9px' }}>Aluguel por aeroportos possuídos</p>
            <div className="flex flex-col gap-0.5">
              <CompactRent label="1 aeroporto" value={25}  />
              <CompactRent label="2 aeroportos" value={50}  />
              <CompactRent label="3 aeroportos" value={100} />
              <CompactRent label="4 aeroportos" value={200} accent />
            </div>
            {/* Hangar bonus */}
            <div className="mt-3 pt-2.5 border-t border-coffee-500/60">
              <p className="text-cream-muted" style={{ fontSize: '9px' }}>
                <span className="text-gold font-semibold">Hangar</span> — dobra o aluguel deste aeroporto individualmente.
              </p>
            </div>
            <div className="mt-2.5 pt-2.5 border-t border-coffee-500/60 flex flex-col gap-0.5">
              <CompactRent label="Preço"    value={square.price}                 muted />
              <CompactRent label="Hipoteca" value={Math.floor(square.price / 2)} muted />
            </div>
            <DeedActions pos={square.pos} />
          </div>
        </div>
        <div style={tailStyle} />
      </motion.div>
    </div>
  )
}

// ---------------------------------------------------------------------
// UtilityPopover — regras e aluguel de utilidade (SRS §2.5)
// ---------------------------------------------------------------------
export function UtilityPopover({
  square,
  side,
  onClose,
}: {
  square: UtilitySquare
  side: Side
  onClose: () => void
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const positionStyle: React.CSSProperties = (() => {
    const gap = 10
    switch (side) {
      case 'bottom': return { bottom: '100%', left: '50%', marginBottom: gap }
      case 'top':    return { top: '100%',    left: '50%', marginTop: gap }
      case 'left':   return { left: '100%',   top: '50%',  marginLeft: gap }
      case 'right':  return { right: '100%',  top: '50%',  marginRight: gap }
      default:       return { left: '50%',    top: '50%' }
    }
  })()
  const centerTransform = side === 'left' || side === 'right' ? 'translateY(-50%)' : 'translateX(-50%)'
  const tailStyle: React.CSSProperties = (() => {
    const offset = -7
    const common = { position: 'absolute' as const, width: 12, height: 12, background: 'var(--color-coffee-800)', border: '2px solid var(--color-coffee-500)', transform: 'rotate(45deg)' }
    switch (side) {
      case 'bottom': return { ...common, bottom: offset, left: '50%', marginLeft: -6, borderTop: 'none', borderLeft: 'none' }
      case 'top':    return { ...common, top: offset,    left: '50%', marginLeft: -6, borderBottom: 'none', borderRight: 'none' }
      case 'left':   return { ...common, left: offset,   top: '50%',  marginTop: -6,  borderTop: 'none', borderRight: 'none' }
      case 'right':  return { ...common, right: offset,  top: '50%',  marginTop: -6,  borderBottom: 'none', borderLeft: 'none' }
      default:       return common
    }
  })()

  const accentColor = square.icon === 'fuel' ? '#22c55e' : square.icon === 'bolt' ? '#ffd97a' : '#fb923c'

  return (
    <div style={{ position: 'absolute', zIndex: 50, transform: centerTransform, ...positionStyle }} onClick={(e) => e.stopPropagation()}>
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ type: 'spring', stiffness: 380, damping: 26 }} style={{ position: 'relative' }}>
        <div className="w-[270px] bg-coffee-800 border-2 border-coffee-500 rounded-[var(--radius-card)] shadow-[var(--shadow-dropdown)] overflow-hidden">
          {/* Header colorido por tipo */}
          <div className="relative px-3.5 py-3 border-b-2 border-coffee-950" style={{ background: `linear-gradient(180deg, ${accentColor} 0%, color-mix(in srgb, ${accentColor} 70%, #000) 100%)` }}>
            <button onClick={onClose} aria-label="Fechar" className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-coffee-950/45 text-cream hover:bg-coffee-950/75 flex items-center justify-center text-xs transition-colors">✕</button>
            <div className="flex items-center gap-2.5 pr-6">
              <div className="shrink-0 w-9 h-9 flex items-center justify-center">
                <SquareIcon square={square} size={32} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="display text-coffee-950 text-lg leading-none truncate">{square.name}</h3>
                <p className="label text-coffee-950/80 mt-0.5" style={{ fontSize: '9px' }}>Utilidade</p>
              </div>
            </div>
          </div>
          {/* Corpo */}
          <div className="px-3.5 py-3">
            <p className="label text-gold mb-2" style={{ fontSize: '9px' }}>Aluguel baseado nos dados</p>
            <div className="flex flex-col gap-0.5">
              <CompactRentText label="1 utilidade"  value="4× os dados" />
              <CompactRentText label="2 utilidades" value="10× os dados" />
              <CompactRentText label="3 utilidades" value="20× os dados" accent />
            </div>
            <div className="mt-3 pt-2.5 border-t border-coffee-500/60">
              <p className="text-cream-muted" style={{ fontSize: '9px' }}>
                O aluguel é o total dos dados × o multiplicador. Não recebe construções.
              </p>
            </div>
            <div className="mt-2.5 pt-2.5 border-t border-coffee-500/60 flex flex-col gap-0.5">
              <CompactRent label="Preço"    value={square.price}                 muted />
              <CompactRent label="Hipoteca" value={Math.floor(square.price / 2)} muted />
            </div>
            <DeedActions pos={square.pos} />
          </div>
        </div>
        <div style={tailStyle} />
      </motion.div>
    </div>
  )
}

// Linha compacta com valor textual (não monetário) — para utilidades.
export function CompactRentText({
  label,
  value,
  accent = false,
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-2 px-1.5 py-1 rounded-[var(--radius-sharp)]">
      <span className="text-xs leading-none text-cream">{label}</span>
      <span className={cn('text-xs leading-none whitespace-nowrap', accent ? 'text-logo font-semibold' : 'text-gold-glow')}>{value}</span>
    </div>
  )
}

// Linha compacta da tabela de aluguel — versão menor pra caber no popover.
export function CompactRent({
  label,
  value,
  active = false,
  muted = false,
  accent = false,
}: {
  label: string
  value: number
  active?: boolean
  muted?: boolean
  accent?: boolean
}) {
  return (
    <div
      className={cn(
        'flex items-baseline justify-between gap-2 px-1.5 py-1 rounded-[var(--radius-sharp)]',
        active && 'bg-gold/15 ring-1 ring-gold/50',
      )}
    >
      <span
        className={cn(
          'text-xs leading-none',
          muted ? 'text-cream-muted' : 'text-cream',
          active && 'text-gold-glow font-medium',
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          'currency leading-none whitespace-nowrap',
          muted ? 'text-cream' : 'text-gold-glow',
          accent && !muted && !active && 'text-logo font-semibold',
          active && 'text-gold-glow font-bold',
        )}
        style={{ fontSize: active ? '13px' : '12px' }}
      >
        <span className="text-gold-soft text-[0.7em] mr-0.5">R$</span>
        {fmtMoney(value)}
      </span>
    </div>
  )
}

