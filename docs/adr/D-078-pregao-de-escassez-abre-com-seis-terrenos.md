# D-078 — O Pregão de escassez abre com seis terrenos livres, não três

**Data:** 2026-07-31 · **Status:** aceita · **Refina:** [D-060](D-060-leilao-de-escassez-restaurado-com-janela-legivel.md) (que restaurou a [D-023](D-023-leilao-de-escassez-de-terrenos-pregao-simultaneo.md))

**Decisão:** o limiar do gatilho da §7.5 sobe de **≤3** para **≤6** terrenos compráveis sem dono. `THEME.LAND_AUCTION_THRESHOLD: 3 → 6`. Tudo o mais do mecanismo fica **intacto**:

- **7 ou mais livres:** não abre. **A descida de 7 para 6:** abre.
- **De 1 a 6 livres:** entram **todos**, simultaneamente, num pregão só.
- **0 livres:** não há pregão a abrir (guarda U1 — pregão vazio nunca existiu).
- Continua exigindo **≥2 jogadores vivos** e **nenhum pregão em curso**.
- Continua disparando **uma vez por episódio**, e só **re-arma** quando a contagem volta a **superar seis** e depois cai de novo.
- Cronômetro **autoritativo e independente de 24s por lote**, reinício só com lance **naquele** lote, fecho lote a lote, trava de solvência por soma, as três procedências (`scarcity`/`bankruptcy`/`mixed`), reconexão e replay: sem mudança.
- O **Leilão comum** por recusa de compra (§7.2) e as **regras do espólio** (§9.2) não são tocados.

Vale igual nos dois mapas publicados: Cidades do Mundo (35 terrenos compráveis) e Cidade da Fuligem (30).

**Por quê:** a três terrenos, o pregão chegava tarde demais para ser o que a D-023 prometeu. Três lotes são **9% do inventário** do Atlas e **10% do da Fuligem** — quando a contagem chega ali, o tabuleiro já tem dono, os países já estão fechados ou fechados-o-bastante, e o "clímax de pregão" vira formalidade sobre as sobras que ninguém quis. O evento coletivo só é coletivo se ainda houver o que disputar.

Seis é o menor número que devolve substância ao evento sem transformá-lo em outra coisa. A **um sexto do inventário** ainda há grupo incompleto para completar e aeroporto para fechar, então o lance carrega decisão, não descarte. Acima disso o gatilho começaria a competir com o cair-e-comprar, que é o meio normal de o tabuleiro encontrar donos — e a D-023 nunca quis substituí-lo.

**Medido, com o que confirma e o que não confirma.** A/B determinístico nas MESMAS seeds, único delta = o limiar (`scripts/sim-threshold-ab.ts`, **120 partidas por contagem**, seeds a partir de 20260731, teto de 3000 rodadas):

| | 2 jogadores | 3 jogadores | 6 jogadores |
|---|---|---|---|
| partidas ok / falhas (3 e 6) | 120/0 · 120/0 | 120/0 · 120/0 | 120/0 · 120/0 |
| partidas com pregão de escassez (3 → 6) | 112 → 117 | 117 → 120 | 120 → 120 |
| lotes **arrematados** no pregão (3 → 6) | 177 → 296 (**+119**) | 234 → 428 (**+194**) | 417 → 416 (**−1**) |
| lotes sem lance (3 → 6) | 0 → 22 | 35 → 107 | 134 → 98 |
| rodadas, média (3 → 6) | 253,1 → 249,8 (**−3,3**) | 327,7 → 327,8 (**0,0**) | 500,8 → 532,7 (**+31,9**) |
| falências, média (3 → 6) | 1,0 → 1,0 | 2,0 → 2,0 | 5,0 → 5,0 |

Conservação monetária e invariantes do motor: **sem violação em nenhum dos dois braços**, nas três contagens.

O que **se confirma**: muito mais tabuleiro passa pelo pregão em mesas pequenas e médias — **+119 lotes arrematados em 2 jogadores e +194 em 3**, sobre 120 partidas cada. É exatamente o efeito pretendido, e é grande. A **incidência** quase não muda porque já era quase total: o limiar decide **quando** o pregão acontece, não **se**.

O que **não se confirma**: a partida não fica mais curta. Em 2 e 3 jogadores a duração é **indistinguível** (−3,3 e 0,0 rodadas); em 6 jogadores ela **sobe** (+31,9), e ali o pregão não vende lote a mais (−1). Mesa de 6 já esgota o tabuleiro por compra normal antes de a escassez importar, então mexer no limiar não muda nada nela exceto o instante do evento.

Isto fica registrado como está, **sem correção compensatória**: nenhum outro parâmetro econômico foi mexido, porque não há evidência que justifique mexer, e a alavanca de duração é assunto de outra decisão, com dado próprio.

Ressalva honesta sobre os números: a política do harness é **aleatória**, não humana. Um bot que dá lance sem avaliar quanto o lote vale infla os "sem lance" (é o que explica 0 → 22 em mesa de 2) e desloca a duração de um jeito que não se transporta direto para a mesa real. A direção dos deltas de **lote arrematado** é robusta — centenas de lotes, mesma direção nas duas mesas onde a regra morde. A de **rodada** é ruído nas mesas de 2 e 3, e um efeito pequeno e real na de 6.

Uma execução anterior de 40 partidas por contagem sugeria alta de duração também em 3 jogadores (+38 rodadas); ela **não se sustentou** ao triplicar a amostra, e é por isso que o número acima é o de 120. Fica anotado para que ninguém refaça o lote pequeno e conclua o contrário.

Princípio III não se aplica (não é carta). Princípio IV: o pregão continua neutro, sem rótulo de catch-up. Princípio V: sem lance = sem compra forçada, o lote fica livre.

**O custo de desenho da D-059 continua aceito.** A escassez segue sendo a única regra cujo gatilho é uma **contagem global do tabuleiro** e não uma ação de jogador, e a tabela `LAND_TRIGGERING` no dispatcher segue sendo a consequência disso. Subir o limiar não agrava nem alivia esse acoplamento: ele reavalia a mesma comparação, com outro número.

**Como aplicar:**

*Regra.* SRS §1 (tabela de comparação), §7.1, §7.5 e §12.3 trocam "≤3"/"três" por "≤6"/"seis"; a nota de rodapé da §7.5 registra que o limiar era 3 até a v1.37. SRS v1.38.

*Motor.* Uma constante: `THEME.LAND_AUCTION_THRESHOLD: 6`. `maybeOpenLandAuction`, `lotsUntilScarcityAuction`, o re-arme e a tabela `LAND_TRIGGERING` já leem o tema — nada mais muda, e é esse o teste da decisão: um limiar que exigisse tocar em cinco lugares seria um limiar mal encapsulado. O gatilho é uma **comparação**, nunca uma contagem de lotes: a descida pode pular valores (uma troca que devolve dois terrenos, um espólio que fecha três de uma vez), e a regra é "cruzou para baixo", não "encostou exatamente em 6".

*Interface (§12.3).* Seis lotes não cabem onde três cabiam, e o `LandAuctionLayer` passa a ter **dois layouts com a mesma hierarquia de leitura** (identidade · tempo · lance e maior interessado · caixa disponível e comprometido · ação principal · incrementos · escritura sob demanda):

- **Grade** (desktop, tablet, retrato): até **3 colunas** a partir de 1280px e até **2** abaixo disso, nunca mais colunas do que lotes.
- **Faixa de seleção mais painel** (paisagem com altura ≤560px): todos os lotes em resumo — nome curto, cronômetro e estado, sempre visíveis — e o painel completo de um só embaixo. Sem carrossel e sem rolagem horizontal: os dois escondem lote, e num pregão simultâneo o que o jogador não vê ele perde. A seleção é preservada quando o lote encerra e cai no próximo **ainda aberto** só quando ele sai do pregão.

A escolha entre os dois é de **estrutura**, feita em React (`useMediaQuery`), não um `display: none`: com CSS os seis cartões continuariam na árvore, com seis paradas de tabulação e seis leituras para o leitor de tela.

A faixa é `tablist`/`tab`/`tabpanel`, com foco rovente e navegação por setas/Home/End. O estado de cada lote é **texto**, nunca só cor. A contagem regressiva fica **fora** de região viva (`aria-live="off"`, prazo sob demanda no `progressbar`); o **encerramento** é anunciado uma vez, em região polida.

*Dívida técnica paga no caminho.* As classes `.lot-*` existiam no JSX desde a reconstrução do CARD 03 e **nunca tiveram folha de estilo**: o pregão renderizava como texto corrido, sem cartão, sem cronômetro pintado e sem separação entre lotes. Não havia como caber seis numa tela que já não organizava três.
