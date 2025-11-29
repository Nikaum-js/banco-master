---
description: "Task list — Rebalanceamento de economia e tabuleiro (032)"
---

# Tasks: Rebalanceamento de economia e tabuleiro

**Input**: Design documents from `/specs/032-rebalanceamento-economia/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/economy.md, quickstart.md

**Tests**: INCLUÍDOS — motor de reducers/puros testado com Vitest. UI validada no `bun run dev`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: arquivos diferentes, sem dependência pendente.
- **[Story]**: US1 (curva de aluguel) · US2 (tiers/sweet spot) · US3 (rebalance board).

⚠️ É **calibração de valores** + remanejo de board, reusando o motor (004/011). **Não** reintroduzir `bank`/`BankStock` (D-022). Manter aeroportos/utilidades/impostos/caixa/GO.

---

## Phase 1: Setup

- [x] T001 Confirmar baseline: `bunx vitest run tests/game` (258 verdes) e `bun run build` (exit 0) antes de iniciar.

---

## Phase 2: Foundational (Blocking — modelo + valores, em arquivos compartilhados)

**⚠️ CRITICAL**: troca o modelo de custo/aluguel; bloqueia todas as stories.

- [x] T002 `src/game/theme.ts`: remover `BUILD_COST_RATIO`, `HOUSE_RENT_MULT`, `HOTEL_RENT_MULT`, `HOTEL2_RENT_MULT`, `SKYSCRAPER_RENT_MULT`; adicionar `HOUSE_COST: Record<GroupKey,number>` (tiers da data-model) e `RENT_MULT: Record<GroupKey,{houses:[4],hotel,hotel2,skyscraper}>` (tabela da data-model).
- [x] T003 `src/game/economy/rent.ts`: criar `rentLadder(group, base)` (fonte única, lê `RENT_MULT`) e refatorar `rentCity` para derivar a tabela de construção dela — **preservando** grupo parcial (×0,7) / completo (×1,0) e ×3 com arranha-céu no grupo.
- [x] T004 [P] `src/game/economy/construction.ts`: `buildCost(sq)` retorna `THEME.HOUSE_COST[sq.group]` (property); 0 p/ aeroporto/utilidade. Remove o cálculo `preço × ratio`.
- [x] T005 UI usa a fonte única: **remover** `computeRents` de `src/boards/shared.tsx`; `ModalLayer` (`deedRows`) e `LandAuctionLayer` (`rentRows`) passam a chamar `rentLadder` (depende de T003).
- [x] T006 Atualizar os testes existentes que assertam valores antigos para os novos: `tests/game/economy/construction.test.ts`, `tests/game/economy/construcao-avancada.test.ts`, `tests/game/ui/deedView.test.ts`, `tests/game/economy/landAuction.test.ts` — manter a suíte **verde** (regras inalteradas, só números).

**Checkpoint**: motor compila, suíte verde com os novos valores, engine e UI lendo a mesma `rentLadder`.

---

## Phase 3: User Story 1 — Aluguéis que cabem no caixa (Priority: P1) 🎯 MVP

**Goal**: curva clássica suavizada — hotel-topo navy ~$1.800 (não $5.000), salto na 3ª casa, 2ºhotel/arranha acima.

**Independent Test**: `rentLadder` da cidade-topo de cada grupo bate os alvos; topo ≤ ~$1.800; curva crescente com salto na 3ª casa.

### Tests for User Story 1 ⚠️

- [x] T007 [US1] Testes em `tests/game/economy/rent.test.ts` (criar se não existir): `rentLadder` hotel-topo por grupo ≈ alvos (brown 360 … navy 1.800); salto acentuado de 2→3 casas; 2ºhotel ≈ 1,3× hotel e arranha ≈ 1,6× hotel; nenhuma cidade passa de ~$1.800 no hotel; spread hotel (navy/brown) ~5–8×.

### Implementation for User Story 1

- [x] T008 [US1] Rodar `bunx vitest run tests/game` e **ajustar `RENT_MULT`** (em `theme.ts`) até os alvos/curva baterem (tuning fino dos multiplicadores por grupo).

**Checkpoint**: curva validada; sem hotel de falência-instantânea.

---

## Phase 4: User Story 2 — Sweet spots / tiers de casa (Priority: P1)

**Goal**: custo de casa fixo por grupo; orange/red com melhor ROI (sweet spot).

**Independent Test**: `buildCost` igual para cidades do mesmo grupo (independe do preço); ROI(orange/red) > ROI(green).

### Tests for User Story 2 ⚠️

- [x] T009 [US2] Testes em `tests/game/economy/construction.test.ts`: `buildCost` de 2 cidades do mesmo grupo é **igual** e **≠** `preço×0,5`; e em `rent`/novo teste: ROI (hotel-topo ÷ `HOUSE_COST`) de **orange e red > green** (sweet spot mensurável).

### Implementation for User Story 2

- [x] T010 [US2] Rodar e **ajustar `HOUSE_COST`** (tiers em `theme.ts`) se o ROI não confirmar o sweet spot.

**Checkpoint**: tiers + sweet spot validados.

---

## Phase 5: User Story 3 — Rebalance do tabuleiro (laranja→3) (Priority: P2)

**Goal**: 8 grupos de 3 + verde de 4; laranja com 3 (Hamburgo entra, Salvador sai).

**Independent Test**: contagem por grupo = 8×3 + verde×4; laranja=3; 28 cidades / 48 casas; aeroportos/utilidades/cantos intactos.

### Implementation for User Story 3

- [x] T011 [US3] `src/lib/boardData.ts`: pos27 → **Hamburgo** (orange), pos31 → **Hong Kong** (red), pos33 → **Rio** (yellow), pos34 → **São Paulo** (yellow) — **Salvador removido**; preço/aluguel-base seguem a posição (inalterados).
- [x] T012 [US3] Testes em `tests/game/` (board): composição **8 grupos com 3 + verde com 4**; laranja=3; total 28 cidades / 48 casas; posições de aeroporto (6/18/30/42), utilidade (14/32/43) e cantos (0/12/24/36) inalteradas.

**Checkpoint**: tabuleiro rebalanceado e validado.

---

## Phase 6: Polish & Cross-Cutting (docs + verificação)

- [x] T013 [P] `docs/SRS.md`: §2.3 reescrito para a estrutura real (9 grupos: 8 de 3 + verde de 4; temas reais) e §5.1 atualizado (aluguel por grupo + tabela de tiers de casa).
- [x] T014 [P] `docs/DECISIONS.md`: atualizar **D-017** (composição/economia recalibrada) + registrar **ADR novo (D-024)** sobre o modelo de custo/aluguel por grupo + os alvos; índice.
- [x] T015 [P] Atualizar `HANDOVER.md`, `docs/MILESTONES.md` (032 entregue) e `.specify/feature.json`.
- [x] T016 Verificação final: `bunx vitest run tests/game` (verde) + `bun run build` (exit 0) + `grep` garantindo zero `bank`/`BankStock`; conferir no `bun run dev` que deed/popover, leilão comum e pregão 031 mostram os mesmos valores que o motor cobra (fonte única).

---

## Dependencies & Execution Order

- **Setup (1)** → **Foundational (2)** bloqueia tudo. Em Foundational: T002 → T003 (precisa de `RENT_MULT`); T004 [P] (precisa de `HOUSE_COST`, paralelo a T003); T005 (precisa de `rentLadder` de T003); T006 após T002–T005.
- **US1 (3)**, **US2 (4)**: dependem de Foundational; são tuning + verificação dos valores já postos. Podem ir em paralelo (arquivos de teste distintos), mas ambas tunam `theme.ts` (sequencial nesse arquivo).
- **US3 (5)**: independente (só `boardData` + teste de composição).
- **Polish (6)**: após as stories. T013/T014/T015 [P] (arquivos distintos); T016 por último.

## Parallel Opportunities

- T004 [P] junto de T003. T013/T014/T015 [P] no polish.
- US3 (board) pode rodar em paralelo com US1/US2 (arquivos distintos), se o tuning de `theme.ts` não colidir.

## Implementation Strategy

- **MVP** = Setup + Foundational + US1 (curva que cabe no caixa). Já dá pra jogar sem falência-relâmpago.
- **Incremental**: + US2 (sweet spots) → + US3 (board) → Polish (docs).
- Commit por tarefa/grupo lógico; `/micro-commits` (sem push) fecha ao final quando o usuário pedir.

## Notes

- Valores (tiers, multiplicadores) são **tunáveis** no `theme.ts` (fonte única, 018).
- A regra de jogo NÃO muda (uniformidade, maioria, gating, escassez 031, arranha-céu) — só valores + composição.
- `rentLadder` é a **única** fonte do ladder (motor + UI) — não recriar cálculo paralelo.
