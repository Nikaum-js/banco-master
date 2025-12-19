# Tema "Cidades do Mundo" — ficha de valores

> Valores **oficiais** do tema v1 (tunáveis). Knobs globais em [`src/game/theme.ts`](../src/game/theme.ts); preços/aluguéis-base por cidade em [`src/lib/boardData.ts`](../src/lib/boardData.ts). Modelo de aluguel = **base × multiplicador** (não tabela por-propriedade). Ver SRS §2/§3/§5/§13.

## Knobs globais (`theme.ts`)

| Knob | Valor | Onde aplica |
|---|---|---|
| Dinheiro inicial | $2.000 | por jogador (D-017) |
| Estoque do banco | 40 casas · 16 hotéis · 4 skyscrapers | global |
| Pote Free Parking | $500 (semente/reabastece) | Férias (007) |
| GO Progressivo | $100 (líder) → $400 (lanterna) | passagem pelo GO, por ranking de patrimônio |
| Aluguel — casas | base × [5, 15, 45, 80] | 1–4 casas |
| Aluguel — hotel / 2º hotel | base × 100 | 2º hotel não altera aluguel (§14.4) |
| Aluguel — Skyscraper | base × 250 (fixo) | + ×3 nas demais do grupo (§13.7) |
| Aluguel — aeroporto | $25 / $50 / $100 / $200 | por nº de aeroportos do dono |
| Aluguel — utilidade | dados × [4, 10, 20] | por nº de utilidades |
| Hangar | custo $100 · venda $50 · dobra o aluguel do aeroporto | §13.6 |
| Custo de construção | round(preço × 0,5) | por nível |
| Hipoteca | metade do preço · deshipoteca +10% · transferência mantém hipotecada +10% | §6 |
| Multa de prisão | $50 | §7 |
| Imposto | Renda $200 · Luxo $100 | casas `tax` (fonte = `boardData.amount`) |

## Tabuleiro (`boardData`) — 48 casas

**9 grupos / 28 cidades** (preço · aluguel-base):

| Grupo (país) | Cidades (pos · preço · base) |
|---|---|
| Itália | Roma (1·60·2) · Veneza (3·80·4) · Pisa (5·100·6) |
| Egito | Cairo (7·115·8) · Gizé (9·120·8) · Luxor (11·140·10) |
| Japão | Tóquio (13·160·12) · Kyoto (15·180·14) · Osaka (16·190·16) |
| Espanha | Madri (19·200·18) · Ibiza (21·220·20) · Sevilha (22·225·20) |
| Alemanha | Berlim (25·240·22) · Munique (26·260·24) |
| China | Hong Kong (27·265·24) · Pequim (28·270·24) · Xangai (29·280·26) |
| Brasil | Rio (31·285·26) · São Paulo (33·300·28) · Salvador (34·305·28) · Brasília (35·320·30) |
| EUA | Nova York (37·325·30) · Los Angeles (38·340·34) · Chicago (40·345·34) · Miami (41·360·38) |
| França | Cannes (44·380·35) · Lyon (46·395·45) · Paris (47·400·50) |

**4 aeroportos** ($200 cada): Aeroporto JFK (6) · Aeroporto Heathrow (18) · Aeroporto Narita (30) · Aeroporto de Sydney (42).
**3 utilidades** ($150 cada): Petro Corp (14) · Eletro Corp (32) · Gas Corp (43).
**2 impostos**: Imposto de Renda $200 (4) · Imposto de Luxo $100 (45).
**Cantos** (0/12/24/36): GO · Prisão · Férias · Vá para Prisão. **Cartas**: 3 Acaso · 3 Tesouro. **1** espaço Bus Ticket (10).

## Calibração

Ajustar o balanceamento = editar **um** valor em `theme.ts` e rodar `bunx vitest run tests/game`. Os preços/aluguéis-base por cidade ficam no `boardData`. Revisitar após playtest.
