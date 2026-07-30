// =====================================================================
// Magnata Imobiliário — Tabuleiro "Cidade da Fuligem"
//
// 40 casas (D-070 + D-071), tabuleiro PRÓPRIO — não derivado do `BOARD` do Atlas.
// Composição: 4 cantos + 22 propriedades + 4 ferrovias + 4 MINAS
// + 3 Acaso + 2 Tesouro + 1 Bilhete de Trem.
// Cantos em 0/10/20/30 · 9 casas por lado.
//
// AS MINAS ENTRARAM POR TROCA, NÃO POR ADIÇÃO (D-071). O tamanho não mudou: as
// quatro minas ocupam as casas que eram as TRÊS UTILIDADES e o IMPOSTO.
//
//   pos  4  Décima Urbana (imposto)         → Mina do Morro do Ferro
//   pos 17  Carbonífera Santa Rita (util.)  → Carbonífera Santa Rita (mina de carvão)
//   pos 28  Usina do Salto (utilidade)      → Lavra do Estanho
//   pos 34  Águas do Ribeirão (utilidade)   → Cata do Cobre
//
// Nenhuma propriedade, ferrovia ou casa de carta foi cortada, e o Bilhete de Trem
// ficou. Duas consequências assumidas:
//
//   1. O MAPA NÃO TEM MAIS UTILIDADE. O aluguel "× valor dos dados"
//      (`THEME.UTILITY_MULT`) desaparece da Fuligem — segue vivo e intacto no
//      Atlas. Foi o que sobrou de escolha: com 40 casas fixas não havia quatro
//      vagas sem cortar propriedade (o que quebraria um bairro) ou carta.
//   2. O MAPA NÃO TEM MAIS IMPOSTO. Isso incomoda menos do que parece: a Taxa de
//      Fumaça (D-070) já é o ralo de dinheiro do mapa, e ela é MELHOR que um
//      imposto porque o dinheiro vai ao pote em vez de sumir no banco.
//
// Como o cobre não tem mais utilidade para dobrar, o passivo dele mudou de alvo —
// ver `THEME.MINE_BONUS`.
//
// POR QUE 40 E NÃO 48: as 48 casas do Atlas (D-017) vinham do Monopoly Mega
// Edition. A Fuligem volta ao tamanho clássico — mesma jogabilidade, partida
// mais curta, e 8 bairros em vez de 10 (saíram Porto do Vapor/`purple` e
// Centro da Cidade/`navy`; o `purple` tinha custo de construção IDÊNTICO ao
// `orange`, então cortá-lo não abre buraco na curva de `THEME.HOUSE_COST`).
//
// A DISPOSIÇÃO É A MECÂNICA. A prisão é a casa mais pisada de qualquer
// tabuleiro de Monopoly (há muitos jeitos de cair lá: a casa, o "Vá pra
// Prisão", cartas, três duplas) e o resultado mais provável de 2d6 é 7 — logo
// as casas 6 a 9 passos DEPOIS da prisão são as mais visitadas do jogo. No
// Monopoly clássico é o grupo laranja que ocupa essa faixa, e é por isso que
// ele é o melhor investimento do jogo enquanto as utilidades são o pior: não
// é o preço, é a POSIÇÃO.
//
// Com a prisão em 10, a faixa quente é 16–19. A Fuligem coloca ali:
//   16 Estação Alto da Serra (ferrovia) · 17 CARBONÍFERA SANTA RITA (mina de carvão)
//   18 Praça do Chafariz · 19 Rua Treze de Maio (Colônia Nova)
// Ou seja: a casa no pico exato do dado é a mina cujo passivo aumenta o aluguel de
// ferrovia — e ela fica a 1 passo de uma ferrovia. Quem toma as duas leva a faixa
// mais pisada do tabuleiro. Nenhuma regra nova produz isso; só o layout.
//
// As ferrovias ficam em 5/16/25/36 e as minas em 4/17/28/34 — uma de cada por
// lado, DESIGUAIS de propósito. No clássico as ferrovias são simétricas
// (5/15/25/35) e por isso intercambiáveis; aqui cada uma vale uma coisa diferente,
// o que dá peso à carta "vá à ferrovia mais próxima" e ao Desvio pela Ferrovia.
//
// A Carbonífera divide a Colônia Nova (15 · 18 · 19). Partir grupo com casa
// comprável no meio é layout de Monopoly legítimo: no tabuleiro original a
// Electric Company corta o grupo roxo.
//
// NOMES: lugar de verdade nunca se chama pelo que se faz nele. Os nomes aqui
// vêm de quem mandou construir (Coronel Amaro, Barão de Itamonte, Marechal
// Deodoro, Visconde), do que estava ali antes e já não está (a olaria, a
// capela, a bica, o marmeleiro, a Estação Velha, o gasômetro) ou da data que
// batizou a rua (Treze de Maio, Sete de Setembro) — os três padrões reais da
// toponímia brasileira. A versão anterior era `[via] + da/dos + [substantivo
// industrial]` nas 22 casas (Rua da Fumaça, Rua do Ferro, Rua das
// Engrenagens…): fórmula, não nome.
// =====================================================================
import type { GroupKey, Square } from './boardData'

/** Nome público de cada bairro da Fuligem (a cor/token vem de `GROUPS`). */
export const FULIGEM_GROUP_NAMES: Partial<Record<GroupKey, string>> = {
  brown: 'Olaria', // o barro que veio antes da fábrica
  skyblue: 'Vila Bonfim', // tecelagem, crescida em volta da capela
  pink: 'Fundição',
  orange: 'Colônia Nova', // a colônia operária — o bairro mais pisado do mapa
  red: 'Guilhermina', // oficinas mecânicas
  yellow: 'Alto do Desvio', // o pátio ferroviário
  green: 'Salto', // a usina e a luz elétrica
  platinum: 'Serrano', // onde os donos moram, no alto, longe da fumaça
}

/** Os 8 bairros da Fuligem, do mais barato ao mais caro. */
export const FULIGEM_GROUPS = [
  'brown', 'skyblue', 'pink', 'orange', 'red', 'yellow', 'green', 'platinum',
] as const satisfies readonly GroupKey[]

export const FULIGEM_BOARD: readonly Square[] = [
  // ---------- canto inferior direito ----------
  { pos: 0, kind: 'corner-go', name: 'GO', short: 'GO' },

  // ---------- lado SUL (direita → esquerda) — Olaria + Vila Bonfim ----------
  { pos: 1, kind: 'property', group: 'brown', name: 'Ladeira do Barreiro', short: 'Barreiro', capital: 'Olaria', price: 90, rent: 6, icon: 'chimney' },
  { pos: 2, kind: 'acaso', name: 'Acaso' },
  { pos: 3, kind: 'property', group: 'brown', name: 'Vila Sabão', capital: 'Olaria', price: 100, rent: 6, icon: 'chimney' },
  { pos: 4, kind: 'mine', name: 'Mina de Ferro', short: 'Ferro', metal: 'ferro', price: 220 },
  { pos: 5, kind: 'airport', name: 'Estação Bonfim', short: 'Bonfim', iata: 'BFM', price: 200, rent: 25 },
  { pos: 6, kind: 'property', group: 'skyblue', name: 'Largo do Tear', short: 'Tear', capital: 'Vila Bonfim', price: 120, rent: 10, icon: 'factory' },
  { pos: 7, kind: 'tesouro', name: 'Tesouro' },
  { pos: 8, kind: 'property', group: 'skyblue', name: 'Rua dos Fiandeiros', short: 'Fiandeiros', capital: 'Vila Bonfim', price: 130, rent: 10, icon: 'factory' },
  { pos: 9, kind: 'property', group: 'skyblue', name: 'Beco da Capela', short: 'Capela', capital: 'Vila Bonfim', price: 150, rent: 10, icon: 'building' },

  // ---------- canto inferior esquerdo ----------
  { pos: 10, kind: 'corner-jail', name: 'Prisão · Visita', short: 'Prisão' },

  // ---------- lado OESTE (baixo → cima) — Fundição + Colônia Nova ----------
  // A faixa 16–19 é a mais pisada do tabuleiro (6 a 9 passos da prisão).
  { pos: 11, kind: 'property', group: 'pink', name: 'Rua Coronel Amaro', short: 'Cel. Amaro', capital: 'Fundição', price: 160, rent: 14, icon: 'anvil' },
  { pos: 12, kind: 'property', group: 'pink', name: 'Ponte dos Ingleses', short: 'Ingleses', capital: 'Fundição', price: 180, rent: 14, icon: 'anvil' },
  { pos: 13, kind: 'property', group: 'pink', name: 'Pátio da Bica', short: 'Bica', capital: 'Fundição', price: 200, rent: 14, icon: 'anvil' },
  { pos: 14, kind: 'bus-ticket', name: 'Bilhete de Trem', short: 'Bilhete' },
  { pos: 15, kind: 'property', group: 'orange', name: 'Travessa do Realejo', short: 'Realejo', capital: 'Colônia Nova', price: 220, rent: 14, icon: 'house' },
  { pos: 16, kind: 'airport', name: 'Estação da Serra', short: 'Serra', iata: 'SRA', price: 200, rent: 25 }, // +6 da prisão
  { pos: 17, kind: 'mine', name: 'Mina de Carvão', short: 'Carvão', metal: 'carvao', price: 220 }, // +7 da prisão: o pico do 2d6
  { pos: 18, kind: 'property', group: 'orange', name: 'Praça do Chafariz', short: 'Chafariz', capital: 'Colônia Nova', price: 250, rent: 14, icon: 'house' },
  { pos: 19, kind: 'property', group: 'orange', name: 'Rua Treze de Maio', short: 'Treze de Maio', capital: 'Colônia Nova', price: 280, rent: 14, icon: 'house' },

  // ---------- canto superior esquerdo ----------
  { pos: 20, kind: 'corner-parking', name: 'Sorte Grande', short: 'Sorte Grande' },

  // ---------- lado NORTE (esquerda → direita) — Guilhermina + Alto do Desvio ----------
  { pos: 21, kind: 'property', group: 'red', name: 'Rua do Barão', short: 'Barão', capital: 'Guilhermina', price: 300, rent: 16, icon: 'gear' },
  { pos: 22, kind: 'property', group: 'red', name: 'Largo do Marmelo', short: 'Marmelo', capital: 'Guilhermina', price: 340, rent: 16, icon: 'gear' },
  { pos: 23, kind: 'acaso', name: 'Acaso' },
  { pos: 24, kind: 'property', group: 'red', name: 'Rua da Boa Morte', short: 'Boa Morte', capital: 'Guilhermina', price: 380, rent: 16, icon: 'gear' },
  { pos: 25, kind: 'airport', name: 'Estação Cachoeira', short: 'Cachoeira', iata: 'CCH', price: 200, rent: 25 },
  { pos: 26, kind: 'property', group: 'yellow', name: 'Estação Velha', capital: 'Alto do Desvio', price: 410, rent: 17, icon: 'train' },
  { pos: 27, kind: 'property', group: 'yellow', name: 'Rua Quinze', short: 'Quinze', capital: 'Alto do Desvio', price: 460, rent: 17, icon: 'train' },
  { pos: 28, kind: 'mine', name: 'Mina de Estanho', short: 'Estanho', metal: 'estanho', price: 220 },
  { pos: 29, kind: 'property', group: 'yellow', name: 'Morro do Sino', short: 'Sino', capital: 'Alto do Desvio', price: 520, rent: 17, icon: 'clock' },

  // ---------- canto superior direito ----------
  { pos: 30, kind: 'corner-gotojail', name: 'Vá para Prisão', short: 'Vá pra Prisão' },

  // ---------- lado LESTE (cima → baixo) — Salto + Serrano ----------
  { pos: 31, kind: 'property', group: 'green', name: 'Avenida Marechal Deodoro', short: 'Deodoro', capital: 'Salto', price: 560, rent: 23, icon: 'lamp' },
  { pos: 32, kind: 'tesouro', name: 'Tesouro' },
  { pos: 33, kind: 'property', group: 'green', name: 'Alameda das Palmeiras', short: 'Palmeiras', capital: 'Salto', price: 630, rent: 23, icon: 'lamp' },
  { pos: 34, kind: 'mine', name: 'Mina de Cobre', short: 'Cobre', metal: 'cobre', price: 220 },
  { pos: 35, kind: 'property', group: 'green', name: 'Rua do Gasômetro', short: 'Gasômetro', capital: 'Salto', price: 710, rent: 23, icon: 'lamp' },
  { pos: 36, kind: 'airport', name: 'Estação do Vale', short: 'Vale', iata: 'VAL', price: 200, rent: 25 },
  { pos: 37, kind: 'acaso', name: 'Acaso' },
  { pos: 38, kind: 'property', group: 'platinum', name: 'Solar do Visconde', short: 'Visconde', capital: 'Serrano', price: 800, rent: 44, icon: 'mansion' },
  { pos: 39, kind: 'property', group: 'platinum', name: 'Alto do Cristal', short: 'Cristal', capital: 'Serrano', price: 940, rent: 44, icon: 'mansion' },
]
