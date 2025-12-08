// =====================================================================
// Banco Master — Tabuleiro tema "Países do Mundo"
// 48 casas no padrão SRS §2.1 / decisão D-017 (4 cantos + 28 propriedades
// + 4 aeroportos + 3 utilidades + 3 Acaso + 3 Tesouro + 2 impostos +
// 1 espaço Bus Ticket). 9 países: 2 premium (4 cidades), 3 regular (3),
// 2 médios (2), 1 novo premium (Rússia, 4). Inspirado no Monopoly Mega Edition.
// Posições começam em 0 (GO, canto inferior direito) e vão no sentido
// horário, encerrando na casa 47 (Paris). Cantos em 0/12/24/36.
//
// Campo `uf` é código ISO-3166-1 alfa-2 do país (BR, US, JP…) — usado
// como semente pra renderizar a bandeira-avatar no tabuleiro.
//
// Preços/aluguéis-base por cidade são os valores OFICIAIS do tema "Cidades do
// Mundo" (escada $60–$400). Os multiplicadores/knobs globais (aluguel, GO,
// estoques, custos, imposto) vivem em `src/game/theme.ts` (fonte única, tunável).
// Aeroporto: `rent` aqui é decorativo — o aluguel vem de `theme.AIRPORT_RENT`.
// =====================================================================

export type GroupKey =
  | 'brown' | 'skyblue' | 'pink' | 'orange'
  | 'red' | 'yellow' | 'green' | 'navy' | 'purple' | 'platinum'

// 10 grupos (032/033). 8 grupos de 3 cidades; França (navy) com 2 e Emirados
// (platinum, super-luxo: Abu Dhabi/Dubai) com 2 — os dois duos de prestígio do topo.
// A "cor" identifica a faixa; cada cidade tem a bandeira-avatar (vide FlagAvatar).
export const GROUPS: Record<GroupKey, { name: string; bg: string; token: string }> = {
  brown:    { name: 'Itália',    bg: 'bg-group-brown',    token: 'group-brown' },
  skyblue:  { name: 'Egito',     bg: 'bg-group-skyblue',  token: 'group-skyblue' },
  pink:     { name: 'Japão',     bg: 'bg-group-pink',     token: 'group-pink' },
  purple:   { name: 'Espanha',   bg: 'bg-group-purple',   token: 'group-purple' },
  orange:   { name: 'Alemanha',  bg: 'bg-group-orange',   token: 'group-orange' },
  red:      { name: 'China',     bg: 'bg-group-red',      token: 'group-red' },
  yellow:   { name: 'Brasil',    bg: 'bg-group-yellow',   token: 'group-yellow' },
  green:    { name: 'EUA',       bg: 'bg-group-green',    token: 'group-green' },
  navy:     { name: 'França',    bg: 'bg-group-navy',     token: 'group-navy' },
  platinum: { name: 'Emirados',  bg: 'bg-group-platinum', token: 'group-platinum' },
}

export type SquareKind =
  | 'corner-go'
  | 'corner-jail'
  | 'corner-parking'
  | 'corner-gotojail'
  | 'property'
  | 'airport'
  | 'utility'
  | 'acaso'
  | 'tesouro'
  | 'tax'
  | 'bus-ticket'

export interface SquareBase {
  pos: number
  kind: SquareKind
  name: string
  short?: string
}

export interface PropertySquare extends SquareBase {
  kind: 'property'
  group: GroupKey
  price: number
  rent: number
  uf: string
  capital?: string
}

export interface AirportSquare extends SquareBase {
  kind: 'airport'
  price: number
  rent: number
  iata: string
}

export interface UtilitySquare extends SquareBase {
  kind: 'utility'
  price: number
  icon: 'fuel' | 'bolt' | 'gas'
}

export interface TaxSquare extends SquareBase {
  kind: 'tax'
  amount: number
}

export type AcasoSquare      = SquareBase & { kind: 'acaso' }
export type TesouroSquare    = SquareBase & { kind: 'tesouro' }
export type BusTicketSquare  = SquareBase & { kind: 'bus-ticket' }
export type CornerGoSquare   = SquareBase & { kind: 'corner-go' }
export type CornerJailSq     = SquareBase & { kind: 'corner-jail' }
export type CornerParkingSq  = SquareBase & { kind: 'corner-parking' }
export type CornerGoToJail   = SquareBase & { kind: 'corner-gotojail' }

export type Square =
  | PropertySquare | AirportSquare | UtilitySquare | TaxSquare
  | AcasoSquare | TesouroSquare | BusTicketSquare
  | CornerGoSquare | CornerJailSq | CornerParkingSq | CornerGoToJail

// ---------------------------------------------------------------------
// Sequência horária a partir do GO (canto inferior direito).
// Cantos em 0/12/24/36 · 11 casas por lado.
//   Inferior: 0–12 · Esquerda: 12–24 · Superior: 24–36 · Direita: 36–47→0
// Sequência canônica: specs/001-tabuleiro-48-casas/research.md §Decisão 3.
// ---------------------------------------------------------------------
export const BOARD: Square[] = [
  // ---------- canto inferior direito ----------
  { pos: 0,  kind: 'corner-go', name: 'GO', short: 'GO' },

  // ---------- lado inferior (direita → esquerda) — Itália + Egito ----------
  { pos: 1,  kind: 'property', group: 'brown',   name: 'Roma',       uf: 'IT', capital: 'Itália', price: 60,  rent: 2 },
  { pos: 2,  kind: 'tesouro',  name: 'Tesouro' },
  { pos: 3,  kind: 'property', group: 'brown',   name: 'Veneza',     uf: 'IT', capital: 'Itália', price: 80,  rent: 4 },
  { pos: 4,  kind: 'tax',      name: 'Imposto de Renda', amount: 200 },
  { pos: 5,  kind: 'property', group: 'brown',   name: 'Pisa',       uf: 'IT', capital: 'Itália', price: 100, rent: 6 },
  { pos: 6,  kind: 'airport',  name: 'JFK',      iata: 'JFK', price: 200, rent: 25 },
  { pos: 7,  kind: 'property', group: 'skyblue', name: 'Cairo',      uf: 'EG', capital: 'Egito',  price: 115, rent: 8 },
  { pos: 8,  kind: 'acaso', name: 'Acaso' },
  { pos: 9,  kind: 'property', group: 'skyblue', name: 'Gizé',       uf: 'EG', capital: 'Egito',  price: 120, rent: 8 },
  { pos: 10, kind: 'bus-ticket', name: 'Bus Ticket' },
  { pos: 11, kind: 'property', group: 'skyblue', name: 'Luxor',      uf: 'EG', capital: 'Egito',  price: 140, rent: 10 },

  // ---------- canto inferior esquerdo ----------
  { pos: 12, kind: 'corner-jail', name: 'Prisão · Visita', short: 'Prisão' },

  // ---------- lado esquerdo (baixo → cima) — Japão + Espanha ----------
  { pos: 13, kind: 'property', group: 'pink',    name: 'Tóquio',     uf: 'JP', capital: 'Japão',   price: 160, rent: 12 },
  { pos: 14, kind: 'utility',  name: 'Petro Corp', icon: 'fuel', price: 150 },
  { pos: 15, kind: 'property', group: 'pink',    name: 'Kyoto',      uf: 'JP', capital: 'Japão',   price: 180, rent: 14 },
  { pos: 16, kind: 'property', group: 'pink',    name: 'Osaka',      uf: 'JP', capital: 'Japão',   price: 190, rent: 16 },
  { pos: 17, kind: 'acaso', name: 'Acaso' },
  { pos: 18, kind: 'airport',  name: 'Londres',  iata: 'LHR', price: 200, rent: 25 },
  { pos: 19, kind: 'property', group: 'purple',  name: 'Madri',      uf: 'ES', capital: 'Espanha', price: 200, rent: 18 },
  { pos: 20, kind: 'tesouro',  name: 'Tesouro' },
  { pos: 21, kind: 'property', group: 'purple',  name: 'Ibiza',      uf: 'ES', capital: 'Espanha', price: 220, rent: 20 },
  { pos: 22, kind: 'property', group: 'purple',  name: 'Sevilha',    uf: 'ES', capital: 'Espanha', price: 225, rent: 20 },
  { pos: 23, kind: 'acaso', name: 'Acaso' },

  // ---------- canto superior esquerdo ----------
  { pos: 24, kind: 'corner-parking', name: 'Férias · Loteria', short: 'Férias' },

  // ---------- lado superior (esquerda → direita) — Alemanha + China + Brasil ----------
  { pos: 25, kind: 'property', group: 'orange',  name: 'Berlim',     uf: 'DE', capital: 'Alemanha', price: 240, rent: 22 },
  { pos: 26, kind: 'property', group: 'orange',  name: 'Munique',    uf: 'DE', capital: 'Alemanha', price: 260, rent: 24 },
  { pos: 27, kind: 'property', group: 'orange',  name: 'Hamburgo',   uf: 'DE', capital: 'Alemanha', price: 265, rent: 24 },
  { pos: 28, kind: 'property', group: 'red',     name: 'Pequim',     uf: 'CN', capital: 'China',    price: 270, rent: 24 },
  { pos: 29, kind: 'property', group: 'red',     name: 'Xangai',     uf: 'CN', capital: 'China',    price: 280, rent: 26 },
  { pos: 30, kind: 'airport',  name: 'Narita',   iata: 'NRT', price: 200, rent: 25 },
  { pos: 31, kind: 'property', group: 'red',     name: 'Hong Kong',  uf: 'CN', capital: 'China', price: 285, rent: 26 },
  { pos: 32, kind: 'utility',  name: 'Eletro Corp', icon: 'bolt', price: 150 },
  { pos: 33, kind: 'property', group: 'yellow',  name: 'Rio de Janeiro', short: 'Rio', uf: 'BR', capital: 'Brasil', price: 300, rent: 28 },
  { pos: 34, kind: 'property', group: 'yellow',  name: 'São Paulo',  uf: 'BR', capital: 'Brasil', price: 305, rent: 28 },
  { pos: 35, kind: 'property', group: 'yellow',  name: 'Brasília',   uf: 'BR', capital: 'Brasil', price: 320, rent: 30 },

  // ---------- canto superior direito ----------
  { pos: 36, kind: 'corner-gotojail', name: 'Vá para Prisão', short: 'Vá pra Prisão' },

  // ---------- lado direito (cima → baixo) — EUA + França + Emirados (super-luxo) ----------
  { pos: 37, kind: 'property', group: 'green',    name: 'Nova York',   uf: 'US', capital: 'EUA',    price: 325, rent: 30 },
  { pos: 38, kind: 'property', group: 'green',    name: 'Los Angeles', uf: 'US', capital: 'EUA',    price: 340, rent: 34 },
  { pos: 39, kind: 'tesouro',  name: 'Tesouro' },
  { pos: 40, kind: 'property', group: 'green',    name: 'Miami',       uf: 'US', capital: 'EUA',    price: 360, rent: 38 },
  { pos: 41, kind: 'property', group: 'navy',     name: 'Cannes',      uf: 'FR', capital: 'França', price: 380, rent: 40 },
  { pos: 42, kind: 'airport',  name: 'Sydney',   iata: 'SYD', price: 200, rent: 25 },
  { pos: 43, kind: 'utility',  name: 'Gas Corp',    icon: 'gas',  price: 150 },
  { pos: 44, kind: 'property', group: 'navy',     name: 'Paris',       uf: 'FR', capital: 'França',  price: 430, rent: 52 },
  { pos: 45, kind: 'tax',      name: 'Imposto de Luxo',  amount: 100 },
  { pos: 46, kind: 'property', group: 'platinum', name: 'Abu Dhabi',   uf: 'AE', capital: 'Emirados', price: 550, rent: 60 },
  { pos: 47, kind: 'property', group: 'platinum', name: 'Dubai',       uf: 'AE', capital: 'Emirados', price: 650, rent: 72 },
]

// Converte código ISO-3166-1 alfa-2 (BR, US, JP…) no emoji da bandeira via
// pares de Regional Indicator Symbol. "BR" → U+1F1E7 U+1F1F7 = 🇧🇷.
export function isoToFlagEmoji(iso2: string): string {
  return iso2
    .toUpperCase()
    .split('')
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join('')
}

// Helpers para layouts que precisam separar as quatro arestas do tabuleiro
// (cantos em 0/12/24/36).
export const BOTTOM_SIDE = BOARD.slice(0, 13)   // 0..12  (incluindo cantos)
export const LEFT_SIDE   = BOARD.slice(12, 25)  // 12..24
export const TOP_SIDE    = BOARD.slice(24, 37)  // 24..36
export const RIGHT_SIDE  = BOARD.slice(36, 48).concat(BOARD[0]) // 36..47, 0

// Versões sem repetir cantos — úteis quando o layout posiciona cantos à parte.
export const BOTTOM_INNER = BOARD.slice(1, 12)   // 1..11
export const LEFT_INNER   = BOARD.slice(13, 24)  // 13..23
export const TOP_INNER    = BOARD.slice(25, 36)  // 25..35
export const RIGHT_INNER  = BOARD.slice(37, 48)  // 37..47

export const CORNERS = {
  go:        BOARD[0],
  jail:      BOARD[12],
  parking:   BOARD[24],
  gotojail:  BOARD[36],
} as const
