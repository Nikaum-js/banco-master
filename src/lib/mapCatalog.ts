// CATÁLOGO DE MAPAS (055/D-069) — a fonte única do que um mapa jogável fornece:
// identificador estável, nome público, as 48 casas de APRESENTAÇÃO, nomes de grupo,
// rótulos dos contratos do motor e overrides de texto de carta.
//
// O ESQUELETO ECONÔMICO é um só: `BOARD` (posições, tipos, grupos, preços, aluguéis)
// continua sendo a fonte que o motor consome — o motor não conhece mapa. O board da
// Cidade da Fuligem é DERIVADO de `BOARD` por overlay de posição, o que garante a
// paridade econômica por construção (e um teste a prova byte a byte).
//
// Contratos internos (`airport`, `hangar`, `bus-ticket`, `corner-parking`, centerPot)
// permanecem; o catálogo os APRESENTA (Ferrovia, Estação de Carga, Bilhete de Trem,
// Sorte Grande) via `labels`.
import {
  BOARD,
  GROUPS,
  type GroupKey,
  type PropertyIconId,
  type Square,
} from './boardData'

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

export interface MapCatalog {
  id: BoardId
  /** Nome público do mapa (home, lobby, landing). */
  name: string
  /** As 48 casas de apresentação — MESMO esqueleto econômico de `BOARD`. */
  board: readonly Square[]
  /** Nome público de cada grupo (a cor/token vem de `GROUPS`, compartilhada). */
  groupNames: Record<GroupKey, string>
  labels: MapLabels
  /** Overrides de texto de carta (apresentação; efeitos/raridades intocados). */
  cardText: Record<string, CardTextOverride>
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
  board: BOARD,
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
}

// ---------------------------------------------------------------------
// FULIGEM — Cidade da Fuligem: Revolução Industrial. Board derivado de
// `BOARD` por overlay de posição; nada econômico muda.
//
// Reparo registrado na spec 055: o brief listou Bairro da Fumaça com 2
// propriedades e Centro da Cidade com 3, mas as posições fixam 3 e 2 —
// a Fumaça ganhou "Travessa do Carvão" e "Rua do Comércio" ficou de fora.
// ---------------------------------------------------------------------

export const FULIGEM_GROUP_NAMES: Record<GroupKey, string> = {
  brown: 'Bairro da Fumaça',
  skyblue: 'Bairro das Fábricas',
  pink: 'Bairro do Ferro',
  purple: 'Porto do Vapor',
  orange: 'Vila dos Trabalhadores',
  red: 'Bairro das Máquinas',
  yellow: 'Bairro dos Trens',
  green: 'Bairro da Energia',
  navy: 'Centro da Cidade',
  platinum: 'Bairro dos Magnatas',
}

interface PropertyOverlay {
  name: string
  short?: string
  icon: PropertyIconId
}

// Propriedades por posição (28). O grupo/preço/aluguel vêm do esqueleto.
const FULIGEM_PROPERTIES: Record<number, PropertyOverlay> = {
  1: { name: 'Rua da Fumaça', icon: 'chimney' },
  3: { name: 'Beco da Chaminé', icon: 'chimney' },
  5: { name: 'Travessa do Carvão', icon: 'chimney' },
  7: { name: 'Fábrica Velha', icon: 'factory' },
  9: { name: 'Rua das Oficinas', icon: 'factory' },
  11: { name: 'Pátio da Caldeira', icon: 'factory' },
  13: { name: 'Rua do Ferro', icon: 'anvil' },
  15: { name: 'Ponte de Aço', icon: 'anvil' },
  16: { name: 'Mercado das Peças', icon: 'anvil' },
  19: { name: 'Doca da Fumaça', icon: 'crane' },
  21: { name: 'Cais das Máquinas', icon: 'crane' },
  22: { name: 'Armazém do Porto', icon: 'crane' },
  25: { name: 'Rua da Vila', icon: 'house' },
  26: { name: 'Praça dos Trabalhadores', icon: 'house' },
  27: { name: 'Mercado da Estação', icon: 'house' },
  28: { name: 'Rua das Engrenagens', icon: 'gear' },
  29: { name: 'Fábrica Central', icon: 'gear' },
  31: { name: 'Torre do Relógio', icon: 'clock' },
  33: { name: 'Rua dos Trilhos', icon: 'train' },
  34: { name: 'Pátio dos Vagões', icon: 'train' },
  35: { name: 'Avenida da Estação', icon: 'train' },
  37: { name: 'Rua das Lâmpadas', icon: 'lamp' },
  38: { name: 'Praça da Usina', icon: 'lamp' },
  40: { name: 'Avenida da Luz', icon: 'lamp' },
  41: { name: 'Avenida Central', icon: 'building' },
  44: { name: 'Praça do Banco', icon: 'bank' },
  46: { name: 'Avenida do Progresso', icon: 'building' },
  47: { name: 'Mansão da Colina', icon: 'mansion' },
}

// Ferrovias por LADO do tabuleiro: pos 6 (inferior) Sul · 18 (esquerdo) Oeste ·
// 30 (superior) Norte · 42 (direito) Leste. O campo `iata` vira a sigla da estação.
const FULIGEM_AIRPORTS: Record<number, { name: string; iata: string }> = {
  6: { name: 'Ferrovia Sul', iata: 'SUL' },
  18: { name: 'Ferrovia Oeste', iata: 'OESTE' },
  30: { name: 'Ferrovia Norte', iata: 'NORTE' },
  42: { name: 'Ferrovia Leste', iata: 'LESTE' },
}

const FULIGEM_UTILITIES: Record<number, string> = {
  14: 'Mina de Carvão',
  32: 'Usina Elétrica',
  43: 'Companhia de Água',
}

const FULIGEM_TAXES: Record<number, string> = {
  4: 'Imposto da Cidade',
  45: 'Taxa de Fumaça',
}

function fuligemSquare(sq: Square): Square {
  switch (sq.kind) {
    case 'property': {
      const overlay = FULIGEM_PROPERTIES[sq.pos]
      if (!overlay) throw new Error(`Fuligem sem overlay para a propriedade ${sq.pos}`)
      const { uf: _uf, capital: _capital, short: _short, ...rest } = sq
      return {
        ...rest,
        name: overlay.name,
        ...(overlay.short ? { short: overlay.short } : {}),
        capital: FULIGEM_GROUP_NAMES[sq.group],
        icon: overlay.icon,
      }
    }
    case 'airport': {
      const overlay = FULIGEM_AIRPORTS[sq.pos]
      if (!overlay) throw new Error(`Fuligem sem overlay para a ferrovia ${sq.pos}`)
      return { ...sq, name: overlay.name, iata: overlay.iata }
    }
    case 'utility':
      return { ...sq, name: FULIGEM_UTILITIES[sq.pos] ?? sq.name }
    case 'tax':
      return { ...sq, name: FULIGEM_TAXES[sq.pos] ?? sq.name }
    case 'bus-ticket':
      return { ...sq, name: 'Bilhete de Trem' }
    case 'corner-parking':
      return { ...sq, name: 'Sorte Grande', short: 'Sorte Grande' }
    default:
      return { ...sq }
  }
}

const FULIGEM_BOARD: readonly Square[] = BOARD.map(fuligemSquare)

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
}

const CATALOGS: Record<BoardId, MapCatalog> = { atlas: ATLAS, fuligem: FULIGEM }

export function catalogOf(id: BoardId): MapCatalog {
  return CATALOGS[coerceBoardId(id)]
}
