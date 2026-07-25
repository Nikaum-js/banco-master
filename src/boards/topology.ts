// TOPOLOGIA DO TABULEIRO — card 7 do review de arquitetura (2026-07-25).
//
// Toda a geometria do board num módulo só: dado um índice ou um lado, onde a coisa fica.
// Puro, sem React, sem store, sem arte — e por isso testável, o que nada disto era.
//
// Antes vivia espalhado por nove sites em dois arquivos: `sideOf` em `shared.tsx`,
// `gridArea` em `Board01Classic.tsx` (a mesma família, com os MESMOS cantos 0/12/24/36
// escritos duas vezes), `markLayout` no meio dos selos de construção, e o posicionamento
// de popover **escrito três vezes** — uma por popover (property/airport/utility).
//
// É também o que um Board02 precisaria: hoje `LiveTokens` já recebe `gridArea` como prop
// (o único corte certo do board layer), mas `sideOf` é import fixo. A seam estava cortada
// pela metade; `BoardTopology` fecha o corte.
import type { CSSProperties } from 'react'

/** Lado do tabuleiro a que uma casa pertence. `corner` = as quatro esquinas. */
export type Side = 'bottom' | 'left' | 'top' | 'right' | 'corner'

/** Índices de canto do tabuleiro de 48 casas (D-017). */
export const CORNERS = [0, 12, 24, 36] as const

/**
 * Faixas da grade 13×13: cantos (2fr) + 11 casas por lado (1fr).
 *
 * `minmax(0, …)` é ESSENCIAL e não é estilo: sem ele, o conteúdo grande dos cantos
 * (glifo 56px + label) infla as LINHAS de canto além do fr, o tabuleiro sai retangular e
 * as casas laterais (62×45) deixam de ser congruentes com as de cima/baixo (50×102).
 * Com `minmax(0,…)` as faixas ficam puramente proporcionais → board quadrado → casas do
 * perímetro congruentes (cima/baixo 50×102 = transposto das laterais 102×50).
 */
export const TRACK_TEMPLATE = 'minmax(0, 2fr) repeat(11, minmax(0, 1fr)) minmax(0, 2fr)'

export function isCorner(pos: number): boolean {
  return (CORNERS as readonly number[]).includes(pos)
}

export function sideOf(pos: number): Side {
  if (isCorner(pos)) return 'corner'
  if (pos < 12) return 'bottom' // 1–11
  if (pos < 24) return 'left' // 13–23
  if (pos < 36) return 'top' // 25–35
  return 'right' // 37–47
}

/** Célula da grade 13×13 a partir do índice clockwise (pos 0 = canto SE). */
export function gridArea(pos: number): CSSProperties {
  if (pos >= 0 && pos <= 12) return { gridRow: 13, gridColumn: 13 - pos } // linha de baixo
  if (pos >= 13 && pos <= 24) return { gridRow: 13 - (pos - 12), gridColumn: 1 } // coluna esquerda
  if (pos >= 25 && pos <= 36) return { gridRow: 1, gridColumn: pos - 23 } // linha de cima
  return { gridRow: pos - 35, gridColumn: 13 } // coluna direita
}

/** Onde os selos de construção se empilham dentro da casa, por lado. */
export function markLayout(side: Side): CSSProperties {
  switch (side) {
    case 'bottom': return { top: '89%', left: '50%', transform: 'translate(-50%, -50%)', flexDirection: 'row' }
    case 'top': return { top: '11%', left: '50%', transform: 'translate(-50%, -50%)', flexDirection: 'row' }
    case 'left': return { left: '9%', top: '50%', transform: 'translate(-50%, -50%)', flexDirection: 'column' }
    case 'right': return { left: '91%', top: '50%', transform: 'translate(-50%, -50%)', flexDirection: 'column' }
    default: return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)', flexDirection: 'row' }
  }
}

// — POPOVER: abre adjacente à casa, sempre para DENTRO do tabuleiro (onde sobra espaço) —

export interface PopoverPlacement {
  /** Ancoragem do balão relativa à casa. */
  position: CSSProperties
  /** Centralização no eixo paralelo ao lado. */
  centerTransform: string
  /** Rabicho: quadrado rotado 45° na borda, apontando para a casa. */
  tail: CSSProperties
}

const TAIL_BASE = {
  position: 'absolute' as const,
  width: 12,
  height: 12,
  background: 'var(--color-coffee-800)',
  border: '2px solid var(--color-coffee-500)',
  transform: 'rotate(45deg)',
}

export function popoverPlacement(side: Side, gap = 10): PopoverPlacement {
  const off = -7
  const centerTransform = side === 'left' || side === 'right' ? 'translateY(-50%)' : 'translateX(-50%)'
  switch (side) {
    case 'bottom':
      return {
        position: { bottom: '100%', left: '50%', marginBottom: gap },
        centerTransform,
        tail: { ...TAIL_BASE, bottom: off, left: '50%', marginLeft: -6, borderTop: 'none', borderLeft: 'none' },
      }
    case 'top':
      return {
        position: { top: '100%', left: '50%', marginTop: gap },
        centerTransform,
        tail: { ...TAIL_BASE, top: off, left: '50%', marginLeft: -6, borderBottom: 'none', borderRight: 'none' },
      }
    case 'left':
      return {
        position: { left: '100%', top: '50%', marginLeft: gap },
        centerTransform,
        tail: { ...TAIL_BASE, left: off, top: '50%', marginTop: -6, borderTop: 'none', borderRight: 'none' },
      }
    case 'right':
      return {
        position: { right: '100%', top: '50%', marginRight: gap },
        centerTransform,
        tail: { ...TAIL_BASE, right: off, top: '50%', marginTop: -6, borderBottom: 'none', borderLeft: 'none' },
      }
    default:
      return { position: { left: '50%', top: '50%' }, centerTransform, tail: TAIL_BASE }
  }
}

/**
 * Tudo que um tabuleiro precisa declarar sobre a própria forma. Um Board02 com outra
 * topologia implementa esta interface em vez de copiar ~110 linhas de `Board01Classic`.
 */
export interface BoardTopology {
  readonly size: number
  readonly corners: readonly number[]
  readonly trackTemplate: string
  sideOf(pos: number): Side
  gridArea(pos: number): CSSProperties
}

export const CLASSIC_TOPOLOGY: BoardTopology = {
  size: 48,
  corners: CORNERS,
  trackTemplate: TRACK_TEMPLATE,
  sideOf,
  gridArea,
}
