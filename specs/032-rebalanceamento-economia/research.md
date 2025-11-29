# Research — Rebalanceamento de economia e tabuleiro (032)

Sem `NEEDS CLARIFICATION` (design fechado em discovery). Decisões técnicas:

## R1 — Fonte única do ladder de aluguel (`rentLadder`)

- **Decisão:** criar `rentLadder(group, base)` puro em `rent.ts`, retornando `{ house: [h1,h2,h3,h4], hotel, hotel2, skyscraper }`. `rentCity` (motor) e TODAS as UIs de deed (ModalLayer/leilão comum, LandAuctionLayer/031, popovers) passam a consumi-lo. O `computeRents` de `shared.tsx` (que tinha multiplicadores próprios desatualizados — rent×5/15/40/70/100/150) é **removido**; callers migram pro `rentLadder`.
- **Rationale:** hoje motor e UI calculam aluguel por fontes diferentes que já divergem (ex.: 3 casas = ×45 no motor vs ×40 na UI). Uma fonte só elimina o bug por construção (FR da spec).
- **Alternativas:** manter dois e "sincronizar na mão" → rejeitado (volta a divergir).

## R2 — Multiplicadores POR GRUPO (não único)

- **Decisão:** `THEME.RENT_MULT: Record<GroupKey, { houses: [4], hotel, hotel2, skyscraper }>`. Grupos baratos têm multiplicadores **maiores**; caros, **menores** (espelha o clássico, onde terreno barato tem multiplicador enorme). Forma comum (frações do hotel): h1≈0,11 · h2≈0,30 · h3≈0,68 (salto) · h4≈0,85 · hotel 1,0 · 2ºhotel 1,30 · arranha 1,60.
- **Rationale:** um multiplicador único não reproduz a curva clássica (vide spec). Por grupo dá controle do topo (~$1.800) e dos sweet spots.
- **Alternativas:** por cidade individual (28 ladders) → rejeitado por ora (granularidade por grupo já entrega os sweet spots; variação fina vem do aluguel-base).

## R3 — Custo de casa por tier (`HOUSE_COST`)

- **Decisão:** `THEME.HOUSE_COST: Record<GroupKey, number>`. Remove `BUILD_COST_RATIO`. `construction.ts buildCost(sq)` passa a retornar `HOUSE_COST[sq.group]` (para `property`; aeroporto/utilidade não constroem).
- **Rationale:** tier por grupo recria o sweet spot (casa barata pro aluguel) e desacopla custo do preço da cidade.
- **Impacto:** `buildCost` é usado em construir, vender (metade) e no deed (Casa/Hotel) — todos passam a tier automaticamente.

## R4 — Rebalance do board (laranja→3)

- **Decisão:** no `boardData.ts`, lado superior (pos 25–35) vira Alemanha 3 / China 3 / Brasil 3; verde (EUA) segue 4. Realocação: **pos27** Hong Kong→**Hamburgo** (orange); **pos31** Rio→**Hong Kong** (red); **pos33** São Paulo→**Rio**, **pos34** Salvador→**São Paulo** (yellow); **pos35** Brasília fica. **Salvador sai, Hamburgo entra.** Preço/aluguel-base seguem a **posição** (inalterados); só nome/grupo mudam.
- **Rationale:** mantém 48 casas e a escada de preços; corrige a assimetria 2/4 → 8×3 + verde×4.
- **Alternativas:** criar 29ª cidade e remover uma carta/utilidade → rejeitado (muda composição do board).

## R5 — Reconciliação de docs

- **Decisão:** SRS §2.3 reescrito para 9 grupos reais (8 de 3 + verde de 4; temas reais: Itália/Egito/Japão/Espanha/Alemanha/China/Brasil/EUA/França). §5.1 atualizado para "aluguel por grupo" + tabela de tiers de casa. ADR: atualizar D-017 (composição/economia) + ADR novo (D-024) registrando a recalibração (modelo de custo/aluguel + alvos).
- **Rationale:** Princípio I — o SRS estava divergente; é a hora de acertar.

## R6 — Impacto em testes

- **Decisão:** atualizar asserts de valor que mudam: `construction.test` (buildCost: brown round(60/2)=30 → tier $40), `construcao-avancada.test` (COST1, aluguel hotel/2ºhotel/arranha por grupo), `deedView.test` (se assertar custo), `landAuction.test` (rentRows não assertava valor exato — confirmar). Testes de **regra** (uniformidade, maioria, gating, escassez 031, etc.) não mudam.
- **Rationale:** a mudança é de valores; a lógica é a mesma. Atualizar números, preservar a cobertura de regra.
