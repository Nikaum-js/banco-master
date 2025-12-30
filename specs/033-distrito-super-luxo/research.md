# Research — Distrito Super-Luxo "Alta Roda" (033)

Sem `NEEDS CLARIFICATION` (design fechado). Decisões técnicas:

## R1 — Cor do grupo vive em 3 fontes (sincronizar)

- **Decisão:** adicionar a entrada `platinum` nos **três** lugares: `GROUPS` (`boardData.ts` — `{ name: 'Alta Roda', bg: 'bg-group-platinum', token: 'group-platinum' }`), `GROUP_COLOR` (`shared.tsx` — hex), e `--color-group-platinum` no `@theme` do `index.css` (Tailwind v4 gera `bg-group-platinum` a partir dele).
- **Cor:** **ônix com toque dourado** — candidato `#26233a` (ônix arroxeado, distinto do navy `#3b82f6` e purple `#9333ea`), com borda/realce dourado nos deeds. Hex final confirmável no `bun run dev`.
- **Rationale:** ônix/preto "lê" como black-card/VIP, destacando a zona nobre sem colidir com as 9 cores nem com o gold do app.

## R2 — Economia do grupo (reusa D-024)

- **Decisão:** `HOUSE_COST.platinum = 300` (tier mais caro, acima do navy 240) e `RENT_MULT.platinum = { houses: [4, 10, 22, 27], hotel: 32, hotel2: 42, skyscraper: 50 }`.
- **Resultados (via `rentLadder`):** Dubai (base 72) → 1🏠 288 · 3🏠 1.584 · **hotel 2.304** · 2º hotel 3.024 · **arranha 3.600**. Mônaco (base 60) → hotel 1.920 · arranha 3.000.
- **ROI (hotel ÷ casa):** Dubai 2.304/300 = **7,7** — abaixo de orange (~9,6) e red (~8,4): **não é sweet spot** (FR-004/SC-003). É o tier mais caro de construir, prestígio/ralo de caixa.
- **Rationale:** mult menor (grupo caro) + base alta → topo ~$2.300 (acima do navy $1.800, mas reachável com hipoteca/venda a partir de $2.000). House cost $300 (não $280 do rascunho) garante ROI claramente < sweet spots.

## R3 — Layout do lado direito (rebalance)

- **Decisão:** os 7 slots de cidade do lado direito (pos 37,38,40,41,44,46,47) passam a green 3 + navy 2 + platinum 2 (preço sobe com a posição):

| Pos | Cidade | Grupo | Preço | Base | (era) |
|---|---|---|---|---|---|
| 37 | Nova York | green | 325 | 30 | = |
| 38 | Los Angeles | green | 340 | 34 | = |
| 40 | Miami | green | 360 | 38 | (era Chicago) |
| 41 | Cannes | navy | 380 | 40 | (era Miami) |
| 44 | Paris | navy | 430 | 52 | (era Cannes; Paris ↑ de 400) |
| 46 | Mônaco | platinum | 550 | 60 | (era Lyon) |
| 47 | Dubai | platinum | 650 | 72 | (era Paris) |

- **Removidos do acervo:** Chicago (green) e Lyon (navy). Mônaco (uf `MC`) e Dubai (uf `AE`) entram — flags válidas no avatar (flagcdn).
- **Não-cidades intactas:** 39 tesouro, 42 aeroporto (Sydney), 43 utilidade (Gas), 45 imposto, 36 canto. Mônaco/Dubai (46,47) são adjacentes; 47 é a última antes do GO (clímax). ✅

## R4 — Grupo de 2 (maioria)

- **Decisão:** `majority(2) = 2` (já é o comportamento — `size===4?3:2`). Grupo de 2 exige **as duas** pra construir; sem desconto de grupo parcial. Vale também pro navy, que agora é 2.
- **Rationale:** padrão Boardwalk (sets de 2 precisam de ambos). Consistente com a regra existente; nenhum código de `majority` muda.

## R5 — Docs

- **Decisão:** SRS §2.3 → 10 grupos (tabela: 8 de 3 + navy 2 + Alta Roda 2); §5.1 ganha nota da zona nobre. DECISIONS: **D-025** (novo — distrito super-luxo) + atualizar **D-017** (composição → 10 grupos).
