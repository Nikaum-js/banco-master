# D-074 — Raridade de carta é chance de saque, não rótulo

**Data:** 2026-07-30 · **Status:** aceita · **Contexto SRS:** §10.2 (raridade), §10.4–10.5
(composição) · **Refina:** [D-064](./D-064-rebalanceamento-do-catalogo-de-cartas.md) ·
**Refinada por:** [D-075](./D-075-quarto-nivel-de-raridade-epica.md)

> Os nomes e pesos abaixo registram a decisão de três níveis como ela foi aceita. A D-075
> preserva sua invariante, mas introduz Épica e substitui a escala `9/10/11` por
> `90/104/107/109`.

## Problema

O SRS §10.2 declara três raridades com hierarquia — Lendária, Rara, Comum — e a UI as exibe com
cor e selo de losangos. Mas a chance de cada carta não seguia essa hierarquia. Na vitrine de
probabilidades (spec 057), Lendária e Comum apareciam **empatadas em 5,6%**; antes disso, uma Rara
com 2 cópias saía a 11,1%, o **dobro** de uma Lendária.

## O erro de diagnóstico, registrado porque é a parte instrutiva

A primeira tentativa concluiu que hierarquia estrita era **impossível**: com cópias inteiras
exigiria lendária 1 · rara 2 · comum 3, o que dá `2 + 8 + 24 = 34` cartas no Tesouro contra as 18
da §10.4. A conta está certa; a conclusão estava errada, porque **cópias não são o único eixo de
probabilidade neste jogo**.

O baralho é embaralhado com **peso** (`weightedShuffle`, Efraimidis–Spirakis): a chance de uma
carta sair primeiro é `peso / soma dos pesos`. Daí duas falhas que passaram sem ser notadas:

1. **A vitrine exibia o número errado.** Calculava `cópias / total`, que é a **composição** do
   baralho, não a chance de saque. Era por isso que Lendária e Comum empatavam em 5,6%: em
   composição elas empatam mesmo.
2. **O peso era regido por `mode`, não por raridade** (`imediato` 14; carta de mão 1 ou 3). Boom
   Econômico, que é Rara mas é evento imediato, pesava 14 — igual a uma Comum.

## Decisão

**Raridade é o eixo único da chance de saque, com hierarquia estrita:** lendária sai menos que
rara, que sai menos que comum, para toda carta, sem exceção por modo.

- `RARITY_WEIGHT = { lendaria: 9, rara: 10, comum: 11 }` em `decks.ts`. A intenção antiga ("evento é
  frequente, carta de mão é rara") sobrevive como **consequência**: no catálogo toda comum é
  imediata e toda lendária é de mão.
- A vitrine mostra `peso × cópias / soma` — a chance real de saque.
- `copies` de lendárias e raras ficam em 1; o excedente de cada baralho vai para as comuns, para
  nenhuma duplicação contrariar o peso.
- Tamanhos de baralho **não mudam** (Acaso 21, Tesouro 18); nenhuma carta entra ou sai.

| Nível | Acaso (soma 219) | Tesouro (soma 190) |
|---|---|---|
| Lendária | 4,1% | 4,7% |
| Rara | 4,6% | 5,3% |
| Comum | 5,0% (10,0% duplicada) | 5,8% (11,6% duplicada) |

**Magnitude é decisão separada do eixo**, e foi o segundo erro. A primeira versão usou 1 · 4 · 14 e
pôs lendária em **0,5%** — 1 em 200 saques. Hierarquia pede ORDEM, não abismo.

Há um teto aritmético que vale registrar, porque toda tentativa futura de "subir a lendária" vai
bater nele: com 2 lendárias em 18 cartas, peso **igual** para todas já dá 5,6% por lendária; sendo
ela a mais rara, fica necessariamente **abaixo** disso. Não existe desenho em que lendária tenha 6%
e seja a mais improvável — são poucas lendárias e muitas comuns. Daí 9 · 10 · 11: ordem estrita com
~10% de diferença entre níveis vizinhos, encostando no valor de peso igual em vez de afundar.

## Consequências

- **Boom Econômico cai de peso 14 para 10** — a mudança de jogo mais sensível, e o ponto do
  conserto: uma Rara não pode sair como Comum.
- **Aquisição Hostil e Bunker Fiscal caem de 2 para 1 cópia.** A janela de reação (§12.2) fica mais
  escassa, o que reforça a leitura de reação como recurso raro.
- A distribuição por nível em soma não muda (Acaso 4/4/13, Tesouro 2/4/12): muda a chance **por
  carta**.
- A invariante é afirmada varrendo **todos os pares** de cartas dos dois baralhos
  (`tests/game/cards/deckOdds.test.ts`), com comparação **estrita**. Peso ou cópia que quebre a
  hierarquia reprova.

## Alternativas descartadas

- **Crescer os baralhos** para permitir ordenação estrita por cópias: muda §10.4–10.5, o ciclo de
  reembaralhamento e o ritmo. Desnecessário, já que o peso resolve.
- **Redefinir raridade como impacto, não frequência**: mantém a UI ensinando errado, e a §10.2 usa
  a palavra "raridade".
- **Esconder as probabilidades da vitrine**: apagar o termômetro em vez de tratar a febre.
