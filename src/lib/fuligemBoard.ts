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
//   2. O MAPA NÃO TEM MAIS IMPOSTO. A D-072 também removeu a Taxa de Fumaça:
//      construção usa somente seu custo normal, sem ralo exclusivo deste mapa.
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
//   16 Estação Serra (ferrovia) · 17 MINA DE CARVÃO
//   18 União · 19 Treze de Maio (Colônia Nova)
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
// NOMES: CADA PALAVRA CURTA, E O ÍCONE CARREGA O OFÍCIO.
//
// As duas versões anteriores falharam pelo MESMO motivo, e vale registrar porque é fácil
// recair nele. A primeira era `[via] + da/dos + [substantivo industrial]` (Rua da Fumaça,
// Rua do Ferro, Rua das Engrenagens). A segunda dizia estar consertando isso, mas 15 dos
// 22 nomes eram a mesma fórmula com o substantivo trocado por um pitoresco: Rua do Barão,
// Largo do Marmelo, Praça do Chafariz, Pátio da Bica, Beco da Capela, Travessa do
// Realejo… Trocar a palavra não desmonta a fórmula. O sintoma é que todos os nomes soam
// iguais e nenhum funciona como marca.
//
// O conserto separa dois canais que antes disputavam a mesma string:
//
//   o ÍCONE diz o OFÍCIO do bairro   (forno, tear, bigorna, casa, engrenagem, desvio…)
//   o NOME diz o LUGAR               (Barro Preto, Glória, Bica, Aurora, Brás…)
//
// Nenhum dos dois precisa fazer o trabalho do outro, e é por isso que o nome pode voltar a
// ser um lugar em vez de um rótulo de função. Os topônimos seguem os padrões reais do
// Brasil — acidente do terreno (Barro Preto, Riacho, Represa), devoção (Glória, Piedade,
// Lapa), bairro industrial histórico (Brás, Mooca, Barreto), entroncamento ferroviário
// (Piraí, Engenho), figura (Deodoro, Barão) e data/ideia republicana (Treze de Maio,
// União, Aurora — nomes de vila operária pós-abolição).
//
// O TETO É POR PALAVRA, NÃO POR NOME — e é de DADO, não de CSS. A casa mede ~63px por
// linha a 14px fixos e o rótulo mostra o nome COMPLETO (spec 056: "nomes completos sem
// truncamento programático", podendo quebrar em linhas). Medido, uma PALAVRA cabe em ~45px,
// ou seja 7 letras em caixa alta; a partir de 8 ela toma a linha toda e fica estranha.
// Nome de duas ou três palavras é livre desde que cada uma respeite o teto — "Treze de
// Maio" cabe, "Liberdade" não. Quem inventar nome novo aqui mede a PALAVRA MAIS LONGA
// antes, não o nome.
//
// Cuidado com HOMONÍMIA entre casas de tipos diferentes: a propriedade da pos 6 já se
// chamou "Bonfim" ao lado da ferrovia "Estação Bonfim" (pos 5) — duas casas vizinhas, com
// regras distintas, dizendo a mesma palavra no tabuleiro.
//
// As QUATRO ferrovias são `Estação + topônimo`, sem preposição no meio: Bonfim, Serra,
// Cascata, Vale. O "da"/"do" gastava uma linha inteira do rótulo para não dizer nada —
// e deixava as quatro desalinhadas entre si, que é o oposto do que um grupo precisa.
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

// PREÇOS REPRECIFICADOS NA D-076 — e o motivo é que a `GroupKey` não é só uma cor.
//
// `THEME.HOUSE_COST` e `THEME.RENT_MULT` são indexados PELO GRUPO (D-024): escolher `yellow` é
// aderir ao tier do yellow, calibrado para propriedades em torno de $300. A Fuligem usava as
// mesmas chaves e precificava fora da faixa — `yellow` a $463, `green` a $633, `platinum` a $870 —
// e o resultado era uma curva INVERTIDA: o aluguel-base caía de 6,3% do preço no bairro mais
// barato para 3,6% no mais caro, e o retorno de uma fábrica cheia despencava de 122% para 58%.
// Quanto mais caro o bairro, pior o negócio. O tabuleiro punia quem subia nele.
//
// Agora cada bairro é precificado DENTRO da faixa do seu tier, ~10% acima do gêmeo do Atlas — a
// margem que a volta de 40 casas (contra 48) justifica em renda por turno. O aluguel-base volta a
// subir monotonicamente (6,9% → 11,1%) e o ROI fica na mesma faixa dos dois mapas.
export const FULIGEM_BOARD: readonly Square[] = [
  // ---------- canto inferior direito ----------
  { pos: 0, kind: 'corner-go', name: 'GO', short: 'GO' },

  // ---------- lado SUL (direita → esquerda) — Olaria + Vila Bonfim ----------
  { pos: 1, kind: 'property', group: 'brown', name: 'Barro Preto', capital: 'Olaria', price: 70, rent: 5, icon: 'kiln' },
  { pos: 2, kind: 'acaso', name: 'Acaso' },
  { pos: 3, kind: 'property', group: 'brown', name: 'Caieira', capital: 'Olaria', price: 90, rent: 6, icon: 'kiln' },
  { pos: 4, kind: 'mine', name: 'Mina de Ferro', short: 'Ferro', metal: 'ferro', price: 250 },
  { pos: 5, kind: 'airport', name: 'Estação Bonfim', short: 'Bonfim', iata: 'BFM', price: 250, rent: 30 },
  { pos: 6, kind: 'property', group: 'skyblue', name: 'Glória', capital: 'Vila Bonfim', price: 125, rent: 9, icon: 'loom' },
  { pos: 7, kind: 'tesouro', name: 'Tesouro' },
  { pos: 8, kind: 'property', group: 'skyblue', name: 'Piedade', capital: 'Vila Bonfim', price: 135, rent: 9, icon: 'loom' },
  { pos: 9, kind: 'property', group: 'skyblue', name: 'Lapa', capital: 'Vila Bonfim', price: 150, rent: 11, icon: 'loom' },

  // ---------- canto inferior esquerdo ----------
  { pos: 10, kind: 'corner-jail', name: 'Prisão · Visita', short: 'Prisão' },

  // ---------- lado OESTE (baixo → cima) — Fundição + Colônia Nova ----------
  // A faixa 16–19 é a mais pisada do tabuleiro (6 a 9 passos da prisão).
  { pos: 11, kind: 'property', group: 'pink', name: 'Bica', capital: 'Fundição', price: 175, rent: 14, icon: 'anvil' },
  { pos: 12, kind: 'property', group: 'pink', name: 'Vila Inglesa', capital: 'Fundição', price: 190, rent: 15, icon: 'anvil' },
  { pos: 13, kind: 'property', group: 'pink', name: 'Barreto', capital: 'Fundição', price: 205, rent: 17, icon: 'anvil' },
  { pos: 14, kind: 'bus-ticket', name: 'Bilhete de Trem', short: 'Bilhete' },
  { pos: 15, kind: 'property', group: 'orange', name: 'Aurora', capital: 'Colônia Nova', price: 260, rent: 24, icon: 'house' },
  { pos: 16, kind: 'airport', name: 'Estação Serra', short: 'Serra', iata: 'SRA', price: 250, rent: 30 }, // +6 da prisão
  { pos: 17, kind: 'mine', name: 'Mina de Carvão', short: 'Carvão', metal: 'carvao', price: 250 }, // +7 da prisão: o pico do 2d6
  { pos: 18, kind: 'property', group: 'orange', name: 'União', capital: 'Colônia Nova', price: 280, rent: 26, icon: 'house' },
  { pos: 19, kind: 'property', group: 'orange', name: 'Treze de Maio', capital: 'Colônia Nova', price: 295, rent: 27, icon: 'house' },

  // ---------- canto superior esquerdo ----------
  { pos: 20, kind: 'corner-parking', name: 'Sorte Grande', short: 'Sorte Grande' },

  // ---------- lado NORTE (esquerda → direita) — Guilhermina + Alto do Desvio ----------
  { pos: 21, kind: 'property', group: 'red', name: 'Brás', capital: 'Guilhermina', price: 300, rent: 28, icon: 'gear' },
  { pos: 22, kind: 'property', group: 'red', name: 'Mooca', capital: 'Guilhermina', price: 310, rent: 29, icon: 'gear' },
  { pos: 23, kind: 'acaso', name: 'Acaso' },
  { pos: 24, kind: 'property', group: 'red', name: 'Marmelo', capital: 'Guilhermina', price: 320, rent: 30, icon: 'gear' },
  { pos: 25, kind: 'airport', name: 'Estação Cascata', short: 'Cascata', iata: 'CSC', price: 250, rent: 30 },
  { pos: 26, kind: 'property', group: 'yellow', name: 'Piraí', capital: 'Alto do Desvio', price: 330, rent: 31, icon: 'mountain' },
  { pos: 27, kind: 'property', group: 'yellow', name: 'Engenho', capital: 'Alto do Desvio', price: 345, rent: 33, icon: 'mountain' },
  { pos: 28, kind: 'mine', name: 'Mina de Estanho', short: 'Estanho', metal: 'estanho', price: 250 },
  { pos: 29, kind: 'property', group: 'yellow', name: 'Quinze', capital: 'Alto do Desvio', price: 360, rent: 34, icon: 'mountain' },

  // ---------- canto superior direito ----------
  { pos: 30, kind: 'corner-gotojail', name: 'Vá para Prisão', short: 'Vá pra Prisão' },

  // ---------- lado LESTE (cima → baixo) — Salto + Serrano ----------
  { pos: 31, kind: 'property', group: 'green', name: 'Deodoro', capital: 'Salto', price: 375, rent: 36, icon: 'dam' },
  { pos: 32, kind: 'tesouro', name: 'Tesouro' },
  { pos: 33, kind: 'property', group: 'green', name: 'Represa', capital: 'Salto', price: 395, rent: 40, icon: 'dam' },
  { pos: 34, kind: 'mine', name: 'Mina de Cobre', short: 'Cobre', metal: 'cobre', price: 250 },
  { pos: 35, kind: 'property', group: 'green', name: 'Riacho', capital: 'Salto', price: 420, rent: 44, icon: 'dam' },
  { pos: 36, kind: 'airport', name: 'Estação Vale', short: 'Vale', iata: 'VAL', price: 250, rent: 30 },
  { pos: 37, kind: 'acaso', name: 'Acaso' },
  { pos: 38, kind: 'property', group: 'platinum', name: 'Barão', capital: 'Serrano', price: 600, rent: 66, icon: 'mansion' },
  { pos: 39, kind: 'property', group: 'platinum', name: 'Cristal', capital: 'Serrano', price: 700, rent: 78, icon: 'mansion' },
]
