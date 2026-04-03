# D-081 — O custo de construção escala por nível, não é flat

**Data:** 2026-08-01 · **Status:** aceita · **Refina:** [D-024](D-024-custo-de-casa-e-tier-por-grupo.md) (custo por tier de grupo) · **Corrige efeito colateral de:** [D-076](D-076-rebalanceamento-economico-para-mesas-de-3-e-4.md)

**Decisão:** o custo de subir um degrau da escada de construção passa a escalar com o degrau. `THEME.HOUSE_COST[grupo]` continua sendo o tier do grupo, mas agora é o preço do **nível 1**; os demais saem de um multiplicador novo:

```
THEME.BUILD_LEVEL_MULT = [1, 1, 1.25, 1.5, 2, 2.5, 3]   // níveis 1..7
```

Valor final arredondado a múltiplos de 5. No laranja (tier $110): **110 · 110 · 140 · 165 · 220 · 275 · 330**.

O que **não** muda: o tier por grupo continua fixo dentro do grupo e não-proporcional ao preço (D-024 intacta), a escada de aluguel (`RENT_MULT`), a construção ilimitada sem estoque de banco (D-022), o país parcial (D-026/D-050), a uniformidade, o pré-requisito de país completo para o arranha-céu (§13.7) e o desconto da Mina de Ferro (D-071, que agora incide sobre o degrau).

## Por quê

O custo era **flat**: os sete níveis custavam o tier do grupo. Isso nasceu correto na D-024, quando a escada tinha o formato clássico. A escada de 7 níveis (011 — 2º hotel e arranha-céu) manteve o custo flat enquanto o aluguel seguia superlinear, e a curva de retorno **inverteu**.

ROI marginal medido — aluguel que o degrau acrescenta ÷ custo do degrau, Berlim (laranja, base 22), país completo:

| degrau | 1ª casa | 2ª | 3ª | 4ª | hotel | 2º hotel | arranha |
|---|---|---|---|---|---|---|---|
| custo (antes) | 110 | 110 | 110 | 110 | 110 | 110 | 110 |
| ROI (antes) | 0,6x | 1,6x | **3,4x** | 1,4x | 1,4x | **2,6x** | **2,6x** |
| custo (agora) | 110 | 110 | 140 | 165 | 220 | 275 | 330 |
| ROI (agora) | 0,6x | 1,6x | 2,7x | 0,9x | 0,7x | 1,0x | 0,9x |

Um arranha-céu custava **$110** e acrescentava **$286** de aluguel por batida. O topo da escada era o melhor negócio do tabuleiro — exatamente onde a decisão deveria doer mais. Um país completo levado ao topo se pagava em **1,6 a 2,5 visitas** de adversário (laranja: $3.075 investidos contra $4.900 de aluguel se cada cidade for pisada uma vez).

A **D-076 agravou sem tocar aqui**: subiu o caixa inicial de $2.000 para $3.000 e o GO de $200 para $250, mas deixou `HOUSE_COST` parado. Construir ficou ~33% mais barato em termos reais da noite pro dia. O país laranja completo no topo passou a custar 1,02× o caixa inicial — no Monopoly clássico o equivalente custa 1,37×.

## A curva escolhida

Retorno **decrescente no topo**, preservando a entrada:

- **Níveis 1–2 intactos.** A entrada continua barata; ninguém trava fora do jogo por não conseguir a primeira casa.
- **A 3ª casa segue o sweet spot** (ROI ~2,7x no laranja), de propósito — é a assinatura do gênero, e um teste a trava (`rebalance.test.ts`).
- **Hotel, 2º hotel e arranha-céu caem para 0,5–1,0x de ROI imediato.** Viram investimento de longo prazo com decisão real de caixa, não lucro automático. O arranha-céu continua muito atrativo porque **triplica o aluguel das outras cidades do país** (§13.7) — bônus que não entra na conta acima.
- **Payback do país completo no topo:** de ~1,9 para ~3,3 visitas.

## Consequências

`nível × custo` deixou de valer como atalho. Três lugares somavam assim e passaram a usar `investedCost` (soma real da escada 1..nível):

- `falencia.liquidationValue` — subestimava quem tinha construção alta e declarava falência de quem tinha caixa;
- `cards/effects.netWorth` — patrimônio;
- `sellBuilding` reembolsa metade do **degrau demolido**, não metade do tier. Sem isso a escada viraria armadilha de mão única: o arranha-céu devolveria o preço de meia primeira casa.

O invariante de conservação do simulador (`tests/sim/engine/conservation.ts`) re-deriva o custo de forma independente e foi atualizado junto — ele reprovou a mudança antes dos testes de unidade, que é o papel dele.

Nas UIs, um número só passou a mentir (era o preço da 1ª casa, lido como o preço de qualquer degrau). A escritura, o leilão comum e o pregão de escassez mostram a **faixa** (`110 → 330`). No pregão, os campos "Casa" e "Hotel" liam o mesmo `buildCost` e imprimiam o mesmo valor; agora leem degraus distintos da escada.

## Validação

Lote de 240 partidas simuladas (120 × 3 jogadores, 120 × 4, mesmas seeds do baseline), comparado com a curva flat:

| métrica | antes | depois |
|---|---|---|
| rodadas — mediana | 257 | 259 |
| rodadas — média | 321,8 | 344,8 |
| rodadas — p90 | 630 | 671 |
| gini no decil 10 | 0,59 | 0,59 |
| fatia do líder no decil 10 | 0,80 | 0,80 |
| falências | 514 | 502 |
| cobranças de aluguel | 48.064 | 51.224 |

Nenhuma partida falhou invariante. A partida não alonga de forma relevante na mediana (+2 rodadas) e a concentração de patrimônio não muda — a mudança age no **custo da decisão**, não na duração.

Ressalva honesta sobre o instrumento: os bots do simulador são gulosos e oscilam construção (`sell-building` ≈ `build-house`, 160k contra 165k no lote), então esses números atestam **estabilidade**, não *feel*. A calibração fina do topo da escada precisa de playtest humano.
