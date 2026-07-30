// CATÁLOGO DE MAPAS (055/D-069, 056/D-070) — a fonte única do que um mapa jogável
// fornece: identificador estável, nome público, o TABULEIRO, nomes de grupo, rótulos
// dos contratos do motor, overrides de texto de carta e as regras próprias do mapa.
//
// MUDANÇA DA D-070: cada mapa tem tabuleiro PRÓPRIO, de tamanho próprio. Antes a
// Fuligem era derivada do `BOARD` do Atlas por overlay de posição — o que garantia
// paridade econômica byte a byte, mas travava os dois mapas em 48 casas e reduzia o
// segundo mapa a uma troca de nomes. A Fuligem agora tem 40 casas, 8 bairros e uma
// disposição própria (ver `fuligemBoard.ts`), e o motor passa a ler o tabuleiro do
// mapa ativo em vez de `BOARD` direto.
//
// Contratos internos (`airport`, `hangar`, `bus-ticket`, `corner-parking`, centerPot)
// permanecem; o catálogo os APRESENTA (Ferrovia, Estação de Carga, Bilhete de Trem,
// Sorte Grande) via `labels`.
import {
  ATLAS_BOARD,
  GROUPS,
  type GroupKey,
  type Square,
} from './boardData'
import { FULIGEM_BOARD, FULIGEM_GROUP_NAMES } from './fuligemBoard'

/** Identificador estável de mapa jogável — gravado na sala (D-069). */
export const BOARD_IDS = ['atlas', 'fuligem'] as const
export type BoardId = (typeof BOARD_IDS)[number]

export function coerceBoardId(value: unknown): BoardId {
  return value === 'fuligem' ? 'fuligem' : 'atlas'
}

/** Rótulos de apresentação dos contratos do motor, por mapa. */
export interface MapLabels {
  /** Tipo da casa `airport` (ex.: "Aeroporto" / "Ferrovia"). */
  airport: string
  /** Melhoria do aeroporto (ex.: "Hangar" / "Estação de Carga"). */
  hangar: string
  /** Item `bus-ticket` (ex.: "Bus Ticket" / "Bilhete de Trem"). */
  busTicket: string
  /** Prêmio do centro (`centerPot`) (ex.: "Loteria" / "Sorte Grande"). */
  lottery: string
  /** Nível 1–4 de construção, singular/plural minúsculos (ex.: "casa" / "oficina"). */
  house: string
  houses: string
  /** Hotel (ex.: "hotel" / "fábrica"). */
  hotel: string
  /** Segundo hotel (ex.: "2º hotel" / "Complexo de Fábricas"). */
  hotel2: string
  /** Skyscraper (ex.: "arranha-céu" / "Torre de Ferro"). */
  skyscraper: string
  /** Palavra para o conjunto de propriedades (ex.: "país" / "bairro"). */
  group: string
}

/** Override de apresentação de carta, chaveado pelo EFFECT ID do motor. */
export interface CardTextOverride {
  label?: string
  desc?: string
}

/**
 * Regras próprias do mapa (D-070). O default é o comportamento do Atlas, então um mapa
 * que não declara nada joga exatamente como sempre — a Fuligem liga as duas dela.
 */
export interface MapRules {
  /**
   * Desvio pela Ferrovia: cair numa ferrovia SUA permite embarcar até outra ferrovia
   * sua (mínimo 2 no seu nome), resolvendo a casa de destino normalmente e SEM o bônus
   * de GO. Zero mudança em preço ou aluguel — é uma escolha, no seu turno.
   */
  railHop: boolean
  /**
   * Taxa de Fumaça: valor que vai ao pote central (`centerPot`) a cada construção de
   * FÁBRICA OU ACIMA — `cityLevel >= 5`, ou seja fábrica/Complexo/Torre de Ferro, nunca
   * oficina. 0 = desligado. Quem constrói grande engorda um pote que qualquer um pode
   * levar: freio no líder que é sorte pura, portanto discreto (Princípio IV).
   */
  smokeTax: number
}

export const DEFAULT_RULES: MapRules = { railHop: false, smokeTax: 0 }

// REGRAS DO MAPA ATIVO — mesmo desenho de `setActiveBoard` em `boardData.ts` e pela mesma
// razão: o motor precisa consultá-las sem importar da camada de UI (onde vive o store do
// tema). Quem chama o setter é só `boardTheme.setTheme`, junto do tabuleiro.
let activeRulesRef: MapRules = DEFAULT_RULES

/** Aplica as regras do mapa ativo. Chamado só por `boardTheme.setTheme`. */
export function setActiveRules(rules: MapRules): void {
  activeRulesRef = rules
}

/** Regras do mapa ativo (Atlas = `DEFAULT_RULES`). */
export function activeRules(): MapRules {
  return activeRulesRef
}

export interface MapCatalog {
  id: BoardId
  /** Nome público do mapa (home, lobby, landing). */
  name: string
  /** O tabuleiro do mapa — tamanho próprio (Atlas 48, Fuligem 40). */
  board: readonly Square[]
  /** Nome público de cada grupo (a cor/token vem de `GROUPS`, compartilhada). */
  groupNames: Partial<Record<GroupKey, string>>
  labels: MapLabels
  /** Overrides de texto de carta (apresentação; efeitos/raridades intocados). */
  cardText: Record<string, CardTextOverride>
  /** Regras próprias do mapa. */
  rules: MapRules
}

// ---------------------------------------------------------------------
// ATLAS — Cidades do Mundo: a apresentação incumbente, intacta.
// ---------------------------------------------------------------------

const ATLAS_GROUP_NAMES = Object.fromEntries(
  (Object.keys(GROUPS) as GroupKey[]).map((k) => [k, GROUPS[k].name]),
) as Record<GroupKey, string>

const ATLAS: MapCatalog = {
  id: 'atlas',
  name: 'Cidades do Mundo',
  board: ATLAS_BOARD,
  groupNames: ATLAS_GROUP_NAMES,
  labels: {
    airport: 'Aeroporto',
    hangar: 'Hangar',
    busTicket: 'Bus Ticket',
    lottery: 'Loteria',
    house: 'casa',
    houses: 'casas',
    hotel: 'hotel',
    hotel2: '2º hotel',
    skyscraper: 'arranha-céu',
    group: 'país',
  },
  cardText: {},
  rules: DEFAULT_RULES,
}

// ---------------------------------------------------------------------
// FULIGEM — Cidade da Fuligem: 40 casas próprias (D-070). O tabuleiro, os 8
// bairros e a disposição vivem em `fuligemBoard.ts`, junto do raciocínio de
// por que cada coisa está onde está.
// ---------------------------------------------------------------------

// Overrides de texto de carta — chave = EFFECT ID (`cardMeta.CARD_LABEL`/`CARD_DESC`).
// O motor e o log seguem intocados; só o rótulo/descrição apresentados mudam.
const FULIGEM_CARD_TEXT: Record<string, CardTextOverride> = {
  passagemOnibus: {
    label: 'Bilhete de Trem',
    desc: 'Ganhe um Bilhete de Trem.',
  },
  obrasNaPista: {
    label: 'Obras na Linha',
    desc: 'Vá à Ferrovia mais próxima. Se tiver dono, pague aluguel em dobro.',
  },
  greve: {
    desc: 'Greve geral por 1 volta: Estações de Carga ficam inativas e utilidades não cobram aluguel.',
  },
  consertoImoveis: {
    desc: 'Pague pela manutenção dos seus imóveis: $25 por oficina e $100 por fábrica.',
  },
  multaAmbiental: {
    desc: 'Pague $50 + $50 por fábrica ou Torre de Ferro que possui, à Sorte Grande.',
  },
  obraRelampago: {
    desc: 'Sua próxima construção sai de graça (oficina, fábrica, Torre de Ferro ou Estação de Carga).',
  },
  resgateDoPote: {
    desc: 'Receba metade da Sorte Grande acumulada no centro do tabuleiro.',
  },
  impostoFederal: {
    desc: 'No seu turno, escolha um adversário: ele paga 25% do patrimônio à Sorte Grande.',
  },
  criseImobiliaria: {
    desc: 'Crise no mercado: cada adversário paga 10% do patrimônio à Sorte Grande. Você não paga.',
  },
  estatizacao: {
    desc: 'Por 2 voltas, todo aluguel pago na mesa vai direto para a Sorte Grande em vez do dono.',
  },
  desvalorizacaoCambial: {
    desc: 'Pague 10% do seu dinheiro em caixa à Sorte Grande.',
  },
  honorarios: {
    desc: 'Pague $50 de honorários médicos à Sorte Grande.',
  },
}

const FULIGEM: MapCatalog = {
  id: 'fuligem',
  name: 'Cidade da Fuligem',
  board: FULIGEM_BOARD,
  groupNames: FULIGEM_GROUP_NAMES,
  labels: {
    airport: 'Ferrovia',
    hangar: 'Estação de Carga',
    busTicket: 'Bilhete de Trem',
    lottery: 'Sorte Grande',
    house: 'oficina',
    houses: 'oficinas',
    hotel: 'fábrica',
    hotel2: 'Complexo de Fábricas',
    skyscraper: 'Torre de Ferro',
    group: 'bairro',
  },
  cardText: FULIGEM_CARD_TEXT,
  // As duas mecânicas próprias do mapa (D-070). Ver `MapRules` para o contrato.
  rules: { railHop: true, smokeTax: 50 },
}

const CATALOGS: Record<BoardId, MapCatalog> = { atlas: ATLAS, fuligem: FULIGEM }

export function catalogOf(id: BoardId): MapCatalog {
  return CATALOGS[coerceBoardId(id)]
}
