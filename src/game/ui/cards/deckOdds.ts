// VITRINE DE PROBABILIDADES DE UM BARALHO (spec 057) — projeção pura do CATÁLOGO.
//
// A ASSINATURA É O REQUISITO, e é a única coisa aqui que não se deve mexer sem ler a spec:
// `deckOdds` recebe SÓ o id do baralho. Não há parâmetro de `GameState`, então é impossível ler
// baralho vivo, descarte ou mão sem alterar a assinatura — e alterar assinatura aparece em code
// review, enquanto disciplina não aparece.
//
// Por que isso importa (SRS §10.3 + D-037): a privacidade de cartas é assegurada NA DISTRIBUIÇÃO.
// A mão alheia e o BARALHO chegam ao cliente como CONTAGEM; o conteúdo não trafega. Duas
// consequências, e as duas condenam qualquer desenho baseado no estado vivo:
//
//   1. probabilidade sobre o baralho RESTANTE é um canal de informação sobre o que já foi sacado
//      — exatamente o vazamento que a D-037 existe para fechar;
//   2. o baralho vivo não existe fora do anfitrião, então a conta quebraria em 7 dos 8 clientes
//      de uma mesa cheia (o anfitrião é a exceção conhecida: ele roda a autoridade).
//
// O catálogo e os pesos canônicos de raridade são as únicas fontes que TODO cliente tem, e são
// iguais do primeiro ao último turno. É a chance estática do sorteio, não a chance condicional
// do baralho vivo — e é isso que se quer ensinar.
import { CARD_DEFS } from '@/game/cards/catalog'
import type { DeckId, Rarity } from '@/game/cards/types'
import { RARITY_WEIGHT } from '@/game/cards/decks'
import { cardDesc, cardLabel } from './cardMeta'

/** Um efeito na vitrine — a unidade que a lista ordena. */
export interface DeckOddsRow {
  /** Chave no registry de efeitos: identidade estável, não depende de texto. */
  effect: string
  title: string
  desc: string
  rarity: Rarity
  /** Quantas cartas deste efeito existem no baralho. */
  copies: number
  /** Fração 0..1, NÃO arredondada — o arredondamento é da formatação. */
  probability: number
}

export interface DeckOdds {
  deck: DeckId
  /** Tamanho do baralho, DERIVADO da soma de `copies`. Nunca uma constante 21/18. */
  total: number
  /** Ordenada da MENOR chance para a MAIOR. */
  rows: DeckOddsRow[]
}

// Lendária > épica > rara > comum. Usado só como desempate, para a ordem não depender da ordem
// de declaração no catálogo: dentro de um nível todas as cartas empatam em chance.
const RARITY_ORDER: Record<Rarity, number> = { lendaria: 4, epica: 3, rara: 2, comum: 1 }

/**
 * Probabilidades de cada efeito de um baralho, da menor chance para a maior.
 *
 * Não recebe estado de propósito — ver o comentário no topo do arquivo.
 */
export function deckOdds(deck: DeckId): DeckOdds {
  // Só o que o jogo REALMENTE faz entra na vitrine. Uma carta `deferido` listada como recompensa
  // possível mentiria sobre o jogo, e contá-la no denominador estragaria todas as outras chances.
  // Hoje as 39 estão `implementado`; o filtro existe para que amanhã continue verdade.
  const defs = CARD_DEFS.filter((d) => d.deck === deck && d.status === 'implementado')

  const total = defs.reduce((sum, d) => sum + d.copies, 0)

  // A CHANCE É PONDERADA, e não `copies / total`. O baralho é embaralhado por peso
  // (`weightedShuffle`, Efraimidis–Spirakis), no qual a probabilidade de uma carta sair primeiro
  // é `peso / soma dos pesos`. Dividir cópias pelo total mostrava a COMPOSIÇÃO do baralho e a
  // chamava de probabilidade — dois números diferentes, e a vitrine exibia o errado. Era por isso
  // que lendária e comum apareciam empatadas em 5,6%: em composição elas empatam mesmo; em chance
  // de saque, nunca.
  const peso = (d: (typeof defs)[number]) => RARITY_WEIGHT[d.rarity] * d.copies
  const somaPesos = defs.reduce((sum, d) => sum + peso(d), 0)

  const rows: DeckOddsRow[] = defs.map((d) => ({
    effect: d.effect,
    title: cardLabel(d.effect),
    desc: cardDesc(d.effect),
    rarity: d.rarity,
    copies: d.copies,
    // `somaPesos` 0 só aconteceria com baralho inteiro deferido; evita NaN na vitrine.
    probability: somaPesos === 0 ? 0 : peso(d) / somaPesos,
  }))

  rows.sort((a, b) => (
    a.probability - b.probability
    || RARITY_ORDER[b.rarity] - RARITY_ORDER[a.rarity]
    || a.title.localeCompare(b.title, 'pt-BR')
  ))

  return { deck, total, rows }
}

/** Chance como texto, uma casa decimal. Duas casas não mudam decisão e poluem 18 linhas. */
export function formatOdds(probability: number): string {
  return `${(probability * 100).toFixed(1).replace('.', ',')}%`
}
