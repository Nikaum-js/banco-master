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
// Preços/aluguéis são uma escada PROVISÓRIA ($60–$400, crescente ao longo
// do percurso). Valores finais são dado de tema (spec FR-014 / research §5),
// tunáveis após playtesting.
// =====================================================================

export type GroupKey =
  | 'brown' | 'skyblue' | 'pink' | 'orange'
  | 'red' | 'yellow' | 'green' | 'navy' | 'purple'

// 9 países no total. Premium (4 cidades): Brasil e EUA. Novos médios (2):
// Alemanha e China. Novo premium: Rússia (4). Regulares (3): demais.
// A "cor" do grupo preserva o slot no schema; visualmente identificado
// pela bandeira-avatar (vide FlagAvatar).
export const GROUPS: Record<GroupKey, { name: string; bg: string; token: string }> = {
  brown:   { name: 'Itália',       bg: 'bg-group-brown',   token: 'group-brown' },
  skyblue: { name: 'Egito',        bg: 'bg-group-skyblue', token: 'group-skyblue' },
  pink:    { name: 'Japão',        bg: 'bg-group-pink',    token: 'group-pink' },
  purple:  { name: 'Espanha',      bg: 'bg-group-purple',  token: 'group-purple' },
  orange:  { name: 'Alemanha',     bg: 'bg-group-orange',  token: 'group-orange' },
  red:     { name: 'China',        bg: 'bg-group-red',     token: 'group-red' },
  yellow:  { name: 'Brasil',       bg: 'bg-group-yellow',  token: 'group-yellow' },
  green:   { name: 'EUA',          bg: 'bg-group-green',   token: 'group-green' },
  navy:    { name: 'França',       bg: 'bg-group-navy',    token: 'group-navy' },
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
  { pos: 1,  kind: 'property', group: 'brown',   name: 'Roma',       uf: 'IT', capital: 'Itália', price: 60,  rent: 4 },
  { pos: 2,  kind: 'tesouro',  name: 'Tesouro' },
  { pos: 3,  kind: 'property', group: 'brown',   name: 'Veneza',     uf: 'IT', capital: 'Itália', price: 80,  rent: 6 },
  { pos: 4,  kind: 'tax',      name: 'Imposto de Renda', amount: 200 },
  { pos: 5,  kind: 'property', group: 'brown',   name: 'Pisa',       uf: 'IT', capital: 'Itália', price: 100, rent: 8 },
  { pos: 6,  kind: 'airport',  name: 'Aeroporto JFK',    iata: 'JFK', price: 200, rent: 25 },
  { pos: 7,  kind: 'property', group: 'skyblue', name: 'Cairo',      uf: 'EG', capital: 'Egito',  price: 120, rent: 10 },
  { pos: 8,  kind: 'surpresa', name: 'Surpresa' },
  { pos: 9,  kind: 'property', group: 'skyblue', name: 'Gizé',       uf: 'EG', capital: 'Egito',  price: 120, rent: 10 },
  { pos: 10, kind: 'bus-ticket', name: 'Bus Ticket' },
  { pos: 11, kind: 'property', group: 'skyblue', name: 'Luxor',      uf: 'EG', capital: 'Egito',  price: 140, rent: 12 },

  // ---------- canto inferior esquerdo ----------
  { pos: 12, kind: 'corner-jail', name: 'Prisão · Visita', short: 'Prisão' },

  // ---------- lado esquerdo (baixo → cima) — Japão + Índia ----------
  { pos: 13, kind: 'property', group: 'pink',    name: 'Tóquio',     uf: 'JP', capital: 'Japão',  price: 160, rent: 14 },
  { pos: 14, kind: 'utility',  name: 'Petróleo Mundial', icon: 'fuel', price: 150 },
  { pos: 15, kind: 'property', group: 'pink',    name: 'Kyoto',      uf: 'JP', capital: 'Japão',  price: 180, rent: 16 },
  { pos: 16, kind: 'property', group: 'pink',    name: 'Osaka',      uf: 'JP', capital: 'Japão',  price: 200, rent: 18 },
  { pos: 17, kind: 'surpresa', name: 'Surpresa' },
  { pos: 18, kind: 'airport',  name: 'Aeroporto LHR',    iata: 'LHR', price: 200, rent: 25 },
  { pos: 19, kind: 'property', group: 'orange',  name: 'Délhi',      uf: 'IN', capital: 'Índia',  price: 200, rent: 18 },
  { pos: 20, kind: 'tesouro',  name: 'Tesouro' },
  { pos: 21, kind: 'property', group: 'orange',  name: 'Mumbai',     uf: 'IN', capital: 'Índia',  price: 220, rent: 20 },
  { pos: 22, kind: 'property', group: 'orange',  name: 'Agra',       uf: 'IN', capital: 'Índia',  price: 220, rent: 20 },
  { pos: 23, kind: 'property', group: 'orange',  name: 'Calcutá',    uf: 'IN', capital: 'Índia',  price: 240, rent: 22 },

  // ---------- canto superior esquerdo ----------
  { pos: 24, kind: 'corner-parking', name: 'Férias · Loteria', short: 'Férias' },

  // ---------- lado superior (esquerda → direita) — China + Brasil ----------
  { pos: 25, kind: 'property', group: 'red',     name: 'Pequim',     uf: 'CN', capital: 'China',  price: 240, rent: 24 },
  { pos: 26, kind: 'property', group: 'red',     name: 'Xangai',     uf: 'CN', capital: 'China',  price: 260, rent: 26 },
  { pos: 27, kind: 'surpresa', name: 'Surpresa' },
  { pos: 28, kind: 'property', group: 'red',     name: 'Hong Kong',  uf: 'CN', capital: 'China',  price: 260, rent: 26 },
  { pos: 29, kind: 'property', group: 'red',     name: 'Macau',      uf: 'CN', capital: 'China',  price: 280, rent: 28 },
  { pos: 30, kind: 'airport',  name: 'Aeroporto NRT',    iata: 'NRT', price: 200, rent: 25 },
  { pos: 31, kind: 'property', group: 'yellow',  name: 'Rio de Janeiro', short: 'Rio', uf: 'BR', capital: 'Brasil', price: 280, rent: 30 },
  { pos: 32, kind: 'utility',  name: 'Energia Mundial',  icon: 'bolt', price: 150 },
  { pos: 33, kind: 'property', group: 'yellow',  name: 'São Paulo',  uf: 'BR', capital: 'Brasil', price: 300, rent: 32 },
  { pos: 34, kind: 'property', group: 'yellow',  name: 'Salvador',   uf: 'BR', capital: 'Brasil', price: 300, rent: 32 },
  { pos: 35, kind: 'property', group: 'yellow',  name: 'Brasília',   uf: 'BR', capital: 'Brasil', price: 320, rent: 36 },

  // ---------- canto superior direito ----------
  { pos: 36, kind: 'corner-gotojail', name: 'Vá para Prisão', short: 'Vá pra Prisão' },

  // ---------- lado direito (cima → baixo) — EUA + França ----------
  { pos: 37, kind: 'property', group: 'green',   name: 'Nova York',   uf: 'US', capital: 'EUA', price: 320, rent: 40 },
  { pos: 38, kind: 'property', group: 'green',   name: 'Los Angeles', uf: 'US', capital: 'EUA', price: 340, rent: 44 },
  { pos: 39, kind: 'tesouro',  name: 'Tesouro' },
  { pos: 40, kind: 'property', group: 'green',   name: 'Chicago',     uf: 'US', capital: 'EUA',    price: 340, rent: 44 },
  { pos: 41, kind: 'property', group: 'green',   name: 'Miami',       uf: 'US', capital: 'EUA',    price: 360, rent: 48 },
  { pos: 42, kind: 'airport',  name: 'Aeroporto SYD',    iata: 'SYD', price: 200, rent: 25 },
  { pos: 43, kind: 'utility',  name: 'Gás Mundial',      icon: 'gas',  price: 150 },
  { pos: 44, kind: 'property', group: 'navy',    name: 'Nice',        uf: 'FR', capital: 'França', price: 380, rent: 55 },
  { pos: 45, kind: 'tax',      name: 'Imposto de Luxo',  amount: 100 },
  { pos: 46, kind: 'property', group: 'navy',    name: 'Lyon',        uf: 'FR', capital: 'França', price: 400, rent: 65 },
  { pos: 47, kind: 'property', group: 'navy',    name: 'Paris',       uf: 'FR', capital: 'França', price: 400, rent: 75 },
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
