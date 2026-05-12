/**
 * Fatos de um ALVO de carta ofensiva (029, CARD 07) — projeção pura, testável sem React.
 *
 * O seletor de alvo mostrava uma lista de nomes de casa com "de <jogador>" ao lado. Para o
 * Boicote isso é quase nada: a carta desliga o aluguel de uma propriedade por 2 voltas, e para
 * decidir QUAL propriedade o jogador precisa saber quanto ela cobra hoje, de quem ela é, e se
 * ela é uma peça de país fechado ou um lote solto. Nome de cidade não responde nenhuma delas.
 *
 * Reusa `deedPresentation` (nome, subtítulo, cor do grupo, bandeira, aluguéis) e o motor para
 * dono e nível de construção — nenhum número é recalculado aqui.
 */
import { cityLevel } from '@/game/economy/construction'
import { rentDue } from '@/game/economy/rent'
import { ownerOf, isMortgaged, groupOwnedCount, groupSize } from '@/game/economy/titles'
import { deedPresentation } from '@/game/ui/deed/presentation'
import { countryName } from '@/boards/glyphs/countries'
import type { GameState } from '@/game/turn/types'
import { activeBoard, activeLabels } from '@/game/ui/theme/boardTheme'

export interface TargetFacts {
  pos: number
  /** Nome da cidade / aeroporto / utilidade. */
  name: string
  /** País por extenso (só cidade tem); `null` em aeroporto e utilidade. */
  country: string | null
  /** ISO2 para a bandeira local; `null` quando não é cidade. */
  flagCode: string | null
  /** Cor do grupo — a "stripe" que identifica o país no tabuleiro. */
  accent: string
  /** Rótulo do grupo/tipo, como aparece na escritura ("Brasil", "Aeroporto", "Utilidade"). */
  groupLabel: string
  ownerId: string | null
  /**
   * Aluguel que a propriedade cobra AGORA — o número que o Boicote vai zerar. É o valor
   * completo do motor (construção, país fechado, Hangar, dobras), não o aluguel de tabela: é o
   * que o alvo perde de verdade, e é por isso que ele decide a jogada.
   *
   * `null` quando não há aluguel a zerar (hipotecada), caso em que boicotar é desperdício.
   */
  currentRent: number | null
  /** Nível de construção 0–7 (0 em aeroporto/utilidade). */
  level: number
  mortgaged: boolean
  /** Cidades do grupo que o dono possui, e o tamanho do grupo — "3/4" lê país incompleto. */
  groupOwned: number
  groupTotal: number
}

/**
 * Fatos do alvo em `pos`. `null` se a casa não é negociável (não deveria acontecer: os alvos
 * vêm de `cardTargets`, que já filtra pelos gates do motor).
 *
 * `roll` fica de fora de propósito: utilidade cobra por valor dos dados, e o "aluguel atual" de
 * uma utilidade depende de uma rolagem que ainda não aconteceu. Ali `currentRent` usa a última
 * rolagem conhecida, que é a melhor estimativa honesta que o estado tem — e a interface diz que
 * utilidade varia com os dados em vez de apresentar o número como fixo.
 */
export function targetFacts(game: GameState, pos: number): TargetFacts | null {
  const sq = activeBoard()[pos]
  if (sq.kind !== 'property' && sq.kind !== 'airport' && sq.kind !== 'utility') return null
  const deed = deedPresentation(sq)
  if (!deed) return null

  const owner = ownerOf(game, pos)
  const mortgaged = isMortgaged(game, pos)
  const title = game.titles[pos]

  return {
    pos,
    name: deed.name,
    country: sq.kind === 'property' ? (sq.uf ? countryName(sq.uf) : sq.capital ?? null) : null,
    flagCode: deed.flagCode,
    accent: deed.accent,
    groupLabel: deed.subtitle,
    ownerId: owner,
    // Hipotecada não cobra aluguel (§6.1) — boicotar não tira nada de ninguém.
    currentRent: owner && !mortgaged ? rentDue(game, pos, owner, game.turn.lastRoll) : null,
    level: sq.kind === 'property' ? cityLevel(title) : 0,
    mortgaged,
    groupOwned: sq.kind === 'property' && owner ? groupOwnedCount(game, sq.group, owner) : 0,
    groupTotal: sq.kind === 'property' ? groupSize(sq.group) : 0,
  }
}

/**
 * Alvos ordenados pelo que o jogador realmente quer saber primeiro: **o que dói mais**.
 *
 * A ordem anterior era a do tabuleiro, que é a ordem em que as casas aparecem andando — inútil
 * para escolher onde bater. Aluguel atual decrescente põe o alvo mais caro no topo; hipotecada
 * (aluguel nulo) desce para o fim, porque boicotá-la é jogar a carta no lixo.
 */
export function sortedTargets(game: GameState, positions: number[]): TargetFacts[] {
  return positions
    .map((pos) => targetFacts(game, pos))
    .filter((f): f is TargetFacts => f !== null)
    .sort((a, b) => (b.currentRent ?? -1) - (a.currentRent ?? -1))
}

/**
 * O que a carta faz, em uma frase, com a duração e a consequência — o "efeito" que o CARD 07
 * pede no modal. Vive aqui e não no componente porque é texto de REGRA (§10.6): a duração e o
 * alcance saem da spec, e uma frase errada aqui é uma promessa errada ao jogador.
 */
export const TARGET_EFFECT: Record<string, { effect: string; duration: string; consequence: string }> = {
  boicote: {
    effect: 'A propriedade para de cobrar aluguel.',
    duration: '2 voltas do dono',
    consequence: 'Ninguém paga aluguel nela, nem você. O dono continua com o título e pode construir, vender e hipotecar normalmente.',
  },
  aquisicaoHostil: {
    effect: 'Você compra a propriedade à força, pela metade do preço de tabela.',
    duration: 'permanente',
    get consequence() { return `O dono recebe a metade e não pode recusar. ${activeLabels().airport} e utilidade custam 1,5× da metade; hipoteca mantida cobra a taxa de transferência.` },
  },
  confiscoGeral: {
    effect: 'Demole TODAS as construções da propriedade.',
    duration: 'permanente',
    get consequence() { const l = activeLabels(); return `${l.houses.charAt(0).toUpperCase() + l.houses.slice(1)}, ${l.hotel}s e ${l.skyscraper} voltam ao banco e o dono NÃO é reembolsado. O terreno continua com ele.` },
  },
  valorizacao: {
    effect: 'A propriedade passa a cobrar aluguel em dobro.',
    duration: '1 volta',
    consequence: 'Todo aluguel pago nela é dobrado enquanto durar. Escolha onde a cobrança já dói.',
  },
  impostoFederal: {
    effect: 'O alvo paga 25% do patrimônio líquido.',
    duration: 'imediato',
    get consequence() { return `O valor vai para a ${activeLabels().lottery}, no centro do tabuleiro. Sem caixa, ele paga o que tiver, e esta cobrança não abre dívida.` },
  },
  embargoDeObras: {
    effect: 'O alvo fica proibido de construir.',
    duration: '2 voltas',
    get consequence() { const l = activeLabels(); return `Nenhuma ${l.house}, ${l.hotel}, ${l.skyscraper} ou ${l.hangar} enquanto durar. Vender e hipotecar continuam livres.` },
  },
  permutaForcada: {
    effect: 'Troca uma propriedade sua por uma do adversário.',
    duration: 'permanente',
    consequence: 'Sem restrição de preço e sem dinheiro envolvido; nenhuma das duas pode ter construção. O alvo não pode recusar.',
  },
}
