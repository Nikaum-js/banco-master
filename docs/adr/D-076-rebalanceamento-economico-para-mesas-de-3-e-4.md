# D-076 — Rebalanceamento econômico para mesas de 3 e 4 jogadores

**Data:** 2026-07-30 · **Status:** aceita · **Contexto SRS:** §3.1 (caixa inicial), §3.3/§13.5 (GO),
§13.4 (Loteria), §4 (impostos), §2.4 (aeroportos), §13.6 (Hangar) · **Refina:**
[D-017](./D-017-tabuleiro-de-48-casas.md), [D-024](./D-024-economia-recalibrada-tiers-de-casa-aluguel-por-grupo.md),
[D-070](./D-070-fuligem-tem-topologia-e-regras-proprias.md)

## Problema

A economia foi calibrada para uma mesa cheia. A mesa real tem **3 ou 4 jogadores**, e nesse
tamanho ela não fecha. Dois defeitos distintos, medidos:

### 1. A mesa pequena não compra o tabuleiro

| | valor do tabuleiro | 3 jogadores × $2.000 | 4 jogadores |
|---|---|---|---|
| Atlas | $8.600 | **70%** | 93% |
| Fuligem | $9.610 | **62%** | 83% |

Com 3 jogadores, a primeira volta terminava com quase metade das casas sem dono. O jogo virava
fila de leilão antes de virar jogo, e ninguém tinha caixa para construir depois de comprar.

Agrava a conta a **renda por turno**, que é o que de fato financia o meio-jogo. O Atlas tem 48
casas — uma volta custa ~6,9 lançamentos contra os ~5,7 de um tabuleiro de 40. A $200 por volta,
ele pagava **$29 por turno**, um terço abaixo do padrão do gênero.

### 2. A curva da Fuligem estava INVERTIDA

Este é o defeito grave, e ele estava escondido porque ninguém olha a tabela inteira de uma vez:

| bairro | preço médio | aluguel-base | ROI da fábrica cheia |
|---|---|---|---|
| Olaria (brown) | $95 | **6,3%** do preço | **122%** |
| Fundição (pink) | $180 | 7,8% | 98% |
| Guilhermina (red) | $340 | 4,7% | 68% |
| Alto do Desvio (yellow) | $463 | 3,7% | 61% |
| Salto (green) | $633 | **3,6%** | **58%** |

Quanto mais caro o bairro, **pior** o negócio. Subir no tabuleiro era punição. No Atlas a mesma
curva sobe corretamente (5,0% → 11,4%, ROI estável em ~100–128%).

A causa é precisa: `THEME.HOUSE_COST` e `THEME.RENT_MULT` são indexados **pela `GroupKey`**
(D-024). A chave não é uma cor — é um **tier econômico**, calibrado para uma faixa de preço. A
Fuligem reusava as chaves do Atlas e precificava fora da faixa (`yellow` a $463 num tier calibrado
para ~$308), então o multiplicador, correto para o Atlas, produzia lixo na Fuligem.

## Decisão

### Alvos declarados

1. **A mesa de 3 compra o tabuleiro na largada** (~100%, e a de 4 sobra para construir).
2. **O aluguel-base cresce monotonicamente como fração do preço**, de ~5% a ~11%, **nos dois mapas**.
3. **O ROI da construção cheia fica em 95–136%** em todo grupo dos dois mapas.
4. **Renda de GO por turno na faixa do gênero** (~$35), o que num tabuleiro de 48 exige mais que $200.

### Knobs globais (`theme.ts`)

| | antes | depois |
|---|---|---|
| `INITIAL_CASH` | $2.000 | **$3.000** |
| `GO_PASS` | $200 | **$250** (dobrado ao parar no GO: $500) |
| `PARKING_SEED` | $500 | **$750** |
| `TAX` renda / luxo | $200 / $100 | **$250 / $150** |
| `AIRPORT_RENT` | 25/50/100/200 | **30/60/125/250** (preço 200 → **250**) |
| `HANGAR_COST` | $100 | **$125** |
| utilidades (preço) | $150 | **$175** |

Resultado: Atlas **101%** do tabuleiro com 3 jogadores (135% com 4), Fuligem **107%** (142%).
Renda de GO: $36/turno no Atlas, $44/turno na Fuligem — diferença que sustenta o prêmio de cerca
de 10% aplicado às propriedades da Fuligem dentro do tier equivalente.

### Atlas

Só o **marrom** mudou de aluguel-base (2/4/6 → **4/5/7**). Era o único grupo fora da faixa: 5,0% de
aluguel-base e ROI de 86%, contra ~100–128% de todos os outros. Preços de cidade **não mudaram**.

### Fuligem — reprecificada dentro do tier

Cada bairro passa a ser precificado **na faixa do seu tier**, ~10% acima do gêmeo do Atlas — a
margem que a volta de 40 casas justifica em renda por turno. Minas e ferrovias vão a $250,
acompanhando a escala.

| bairro | preço antes | depois | aluguel-base | ROI |
|---|---|---|---|---|
| Olaria | 90–100 | **70–90** | 6,9% | 118% |
| Vila Bonfim | 120–150 | **125–150** | 7,1% | 115% |
| Fundição | 160–200 | **175–205** | 8,1% | 105% |
| Colônia Nova | 220–280 | **260–295** | 9,2% | 136% |
| Guilhermina | 300–380 | **300–320** | 9,4% | 127% |
| Alto do Desvio | 410–520 | **330–360** | 9,5% | 128% |
| Salto | 560–710 | **375–420** | 10,1% | 117% |
| Serrano | 800–940 | **600–700** | 11,1% | 107% |

A curva volta a subir, e o topo do tabuleiro volta a ser um bom negócio caro em vez de um mau
negócio caríssimo.

## Consequências

- **Os testes deixaram de escrever o balanceamento à mão.** Era o custo escondido desta mudança:
  ~80 asserções travavam `2000`, `$200`, `25/50/100/200` como literais em suítes que não têm
  opinião sobre economia (projeção de escritura, log, leilão da largada, conservação do simulador).
  Todas passaram a derivar de `THEME`/`BOARD`. Sem isso, a próxima recalibragem custa outra
  varredura — e a anterior já tinha ensinado isso sem ser ouvida.
- **O mock de portas do simulador espelhava valores fixos** (`onPassGo: () => 200`,
  `centerPot = 500`) enquanto o ledger de conservação lia o `THEME`: divergiam em silêncio até o
  primeiro rebalanceamento. Agora os dois leem a mesma fonte.
- **A Fuligem perdeu o topo de $940.** O Serrano segue sendo o distrito mais caro do mapa; deixa de
  ser o mais caro do projeto.
- **Não se mexeu na topologia da Fuligem.** Ela continua sem casa de imposto — o único dreno de
  caixa dela são as cartas. Fica **registrado como pendência**: é a assimetria econômica que sobra
  entre os dois mapas, e resolvê-la exige trocar uma casa do tabuleiro, o que é decisão da D-070.

## Alternativas descartadas

- **Dar à Fuligem seus próprios `RENT_MULT`/`HOUSE_COST`.** Resolveria a curva sem reprecificar, e é
  tentador porque são só dois pontos de consumo. Mas cria uma segunda tabela de tiers para manter
  em paralelo, quando o contrato "`GroupKey` = tier econômico" já existia e só não estava sendo
  respeitado. Consertar o mapa é mais barato que duplicar a economia — e mantém verdadeiro um
  contrato que hoje é mentira.
- **Baixar os preços em vez de subir o caixa.** Trata a razão caixa/tabuleiro, mas não a renda por
  turno: o meio-jogo continuaria pobre, que é a queixa de fato.
- **Caixa inicial por número de jogadores.** Resolveria a mesa de 3 sem tocar na de 8, mas faz o
  mesmo tabuleiro jogar duas economias diferentes, e nenhuma delas fica testada de verdade.
