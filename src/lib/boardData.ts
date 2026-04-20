// =====================================================================
// Magnata Imobiliário — Tabuleiro tema "Países do Mundo"
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
  | 'mine'
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

/** Ícone de apresentação de propriedade em mapas SEM bandeira (055/D-069).
 *
 * Os quatro últimos (`kiln`…`powerhouse`) existem porque o ÍCONE é o que declara o ofício
 * do bairro, e para isso ele precisa ser específico: `chimney` e `factory` servem a
 * qualquer indústria, `train` colide com a locomotiva das ferrovias e `lamp` é iluminação
 * a GÁS num bairro que o mapa define como elétrico. Genérico e errado leem igual de longe. */
export type PropertyIconId =
  | 'chimney' | 'factory' | 'anvil' | 'crane' | 'house'
  | 'gear' | 'clock' | 'train' | 'lamp' | 'building' | 'bank' | 'mansion'
  | 'kiln' | 'loom' | 'switch' | 'powerhouse'

export interface PropertySquare extends SquareBase {
  kind: 'property'
  group: GroupKey
  price: number
  rent: number
  /** Código ISO do país (mapa Cidades do Mundo). Mapas sem bandeira não o definem. */
  uf?: string
  capital?: string
  /** Ícone de apresentação quando não há bandeira (mapa Cidade da Fuligem). */
  icon?: PropertyIconId
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

/** O metal de uma mina — identifica QUAL bônus passivo ela carrega (D-071). */
export type MetalId = 'ferro' | 'cobre' | 'carvao' | 'estanho'

/**
 * MINA (D-071, mapa Fuligem) — quarto conjunto comprável, ao lado de propriedade,
 * ferrovia e utilidade.
 *
 * Não cobra aluguel. Seu valor econômico é o bônus passivo por metal
 * (`THEME.MINE_BONUS`): cada mina altera uma classe de ativo diferente que o dono já tem,
 * então qual delas vale mais depende da carteira — e é isso que dá conteúdo ao leilão.
 */
export interface MineSquare extends SquareBase {
  kind: 'mine'
  price: number
  metal: MetalId
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
  | PropertySquare | AirportSquare | UtilitySquare | MineSquare | TaxSquare
  | AcasoSquare | TesouroSquare | BusTicketSquare
  | CornerGoSquare | CornerJailSq | CornerParkingSq | CornerGoToJail

// ---------------------------------------------------------------------
// Sequência horária a partir do GO (canto inferior direito).
// Cantos em 0/12/24/36 · 11 casas por lado.
//   Inferior: 0–12 · Esquerda: 12–24 · Superior: 24–36 · Direita: 36–47→0
// Sequência canônica: specs/001-tabuleiro-48-casas/research.md §Decisão 3.
// ---------------------------------------------------------------------
const ATLAS_BOARD: readonly Square[] = [
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

// ---------------------------------------------------------------------
// O TABULEIRO ATIVO (D-070)
//
// `BOARD` era `const` e valia 48 casas para sempre: o motor inteiro (aluguel,
// construção, hipoteca, cartas, falência, leilão — ~20 arquivos) lia daqui direto, e
// era exatamente isso que impedia um segundo mapa de ter tamanho ou disposição própria.
//
// Agora é um `let` reatribuível por `setActiveBoard`. Binding de módulo ES é VIVO: quem
// fez `import { BOARD }` passa a ver o tabuleiro novo sem precisar de mudança nenhuma —
// é o que torna os ~20 arquivos do motor board-aware sem tocá-los.
//
// Por que um singleton mutável é aceitável aqui: `BOARD` JÁ era um singleton de módulo,
// e um cliente renderiza uma sala por vez (o mapa é imutável depois da criação, D-069).
// Quem manda é sempre a autoridade: `roomStore.setRoom` aplica o `boardId` da sala e
// `boardTheme.setTheme` chama este setter. Ninguém mais deve chamá-lo.
// ---------------------------------------------------------------------
export let BOARD: readonly Square[] = ATLAS_BOARD

// O store registra uma única reação síncrona depois de ser carregado. No boot com `?map=`,
// este handler ainda não existe — e isso é correto: o store nascerá logo depois já lendo o
// tabuleiro escolhido. Em trocas posteriores, os títulos precisam ser realinhados no mesmo tick
// para nunca haver uma janela com casas de um mapa e `titles` de outro.
let onActiveBoardChange: (() => void) | null = null

export function registerActiveBoardChangeHandler(handler: () => void): void {
  onActiveBoardChange = handler
}

/** Troca o tabuleiro ativo. Chamado só por `boardTheme.setTheme` (fonte: a sala). */
export function setActiveBoard(board: readonly Square[]): void {
  if (BOARD === board) return
  BOARD = board
  onActiveBoardChange?.()
}

/** O tabuleiro do Atlas, para quem precisa dele nominalmente (catálogo, testes). */
export { ATLAS_BOARD }

/** Nº de casas do tabuleiro ativo (Atlas 48, Fuligem 40). */
export function boardSize(): number {
  return BOARD.length
}

// GEOMETRIA DO TABULEIRO ATIVO — as duas coisas que o MOTOR (não o layout) precisa saber
// sobre a forma: onde estão os cantos e onde é a prisão. Ambas eram literais (`JAIL_POS =
// 12`, `pos === 0 || pos === 12 || pos === 24 || pos === 36` no `busSideOf`) e por isso
// silenciosamente erradas em qualquer tabuleiro que não fosse o de 48.
//
// Memoizado pela IDENTIDADE do array: `busSideOf` roda dentro de laço sobre o tabuleiro
// inteiro (Bilhete de Trem, sim de invariantes), e recalcular a varredura a cada chamada
// tornaria isso quadrático.
const CORNER_KINDS: readonly SquareKind[] = [
  'corner-go', 'corner-jail', 'corner-parking', 'corner-gotojail',
]

let geoCache: { of: readonly Square[]; corners: readonly number[]; jail: number } | null = null

function geo() {
  if (geoCache?.of !== BOARD) {
    const corners = BOARD.filter((s) => CORNER_KINDS.includes(s.kind)).map((s) => s.pos)
    geoCache = {
      of: BOARD,
      corners,
      jail: BOARD.find((s) => s.kind === 'corner-jail')?.pos ?? 0,
    }
  }
  return geoCache
}

/** Índices dos quatro cantos do tabuleiro ativo (Atlas 0/12/24/36, Fuligem 0/10/20/30). */
export function boardCorners(): readonly number[] {
  return geo().corners
}

/** Índice da casa `corner-jail` do tabuleiro ativo (Atlas 12, Fuligem 10). */
export function jailPos(): number {
  return geo().jail
}
