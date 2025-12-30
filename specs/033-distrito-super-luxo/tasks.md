---
description: "Task list — Distrito Super-Luxo 'Alta Roda' (033)"
---

# Tasks: Distrito Super-Luxo "Alta Roda"

**Input**: Design documents from `/specs/033-distrito-super-luxo/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/super-luxo.md, quickstart.md

**Tests**: INCLUÍDOS (motor/board com Vitest). A **cor** valida no `bun run dev` (sem teste de UI).

## Format: `[ID] [P?] [Story] Description`

- **[Story]**: US1 (economia da zona nobre) · US2 (board 10 grupos) · US3 (cor visual).

⚠️ Feature **aditiva** sobre 032/D-024 (`rentLadder`/`RENT_MULT`/`HOUSE_COST` por grupo — motor inalterado). **Não** reintroduzir `bank`/`BankStock` (D-022). Manter aeroportos/utilidades/impostos/caixa/GO. A cor vive em **3 fontes** — adicionar nas três.

---

## Phase 1: Setup

- [x] T001 Confirmar baseline: `bunx vitest run tests/game` (267 verdes) e `bun run build` (exit 0).

---

## Phase 2: Foundational (Blocking — entradas do grupo `platinum`; o novo GroupKey força os Records)

**⚠️ CRITICAL**: adicionar `platinum` ao `GroupKey` quebra o build até `GROUPS`/`HOUSE_COST`/`RENT_MULT` terem a entrada. Fazer junto.

- [x] T002 `src/lib/boardData.ts`: `GroupKey` += `'platinum'`; `GROUPS.platinum = { name: 'Alta Roda', bg: 'bg-group-platinum', token: 'group-platinum' }`.
- [x] T003 `src/game/theme.ts`: `HOUSE_COST.platinum = 300` + `RENT_MULT.platinum = { houses: [4,10,22,27], hotel: 32, hotel2: 42, skyscraper: 50 }` (depende de T002 p/ compilar os `satisfies Record<GroupKey>`).
- [x] T004 [P] Cor (2 fontes): `src/index.css` `@theme` += `--color-group-platinum: #26233a;` (gera `bg-group-platinum`) e `src/boards/shared.tsx` `GROUP_COLOR` += `platinum: '#26233a'`.

**Checkpoint**: compila; grupo `platinum` existe com economia + cor.

---

## Phase 3: User Story 1 — Economia da zona nobre (Priority: P1) 🎯 MVP

**Goal**: aluguel-armadilha de prestígio (hotel ~$2.300, arranha ~$3.600) e ROI propositalmente fraco (< sweet spots).

**Independent Test**: `rentLadder('platinum', 72)` (Dubai) → hotel ~2.304, arranha ~3.600; ROI(platinum) < ROI(orange) e ROI(red).

### Tests for User Story 1 ⚠️

- [x] T005 [US1] Testes em `tests/game/economy/rebalance.test.ts`: `rentLadder('platinum', 72).hotel` ≈ 2.304 e `.skyscraper` ≈ 3.600; ladder crescente (hotel < 2ºhotel < arranha); ROI (`hotel ÷ THEME.HOUSE_COST.platinum`) **< orange e < red** (não é sweet spot).

### Implementation for User Story 1

- [x] T006 [US1] Rodar `bunx vitest run tests/game` e ajustar `RENT_MULT.platinum`/`HOUSE_COST.platinum` se os alvos/ROI não baterem.

**Checkpoint**: economia da zona nobre validada.

---

## Phase 4: User Story 2 — Board rebalanceado (10 grupos, 48 casas) (Priority: P2)

**Goal**: Mônaco/Dubai no clímax; verde 4→3 (Chicago sai), navy 3→2 (Lyon sai); 10 grupos, 28 cidades, 48 casas.

**Independent Test**: composição correta; Mônaco/Dubai presentes e mais caras; Chicago/Lyon ausentes.

### Implementation for User Story 2

- [x] T007 [US2] `src/lib/boardData.ts` — lado direito: remover **Chicago** (green) e **Lyon** (navy); pos40 **Miami** (green, 360/38), pos41 **Cannes** (navy, 380/40), pos44 **Paris** (navy, 430/52), pos46 **Mônaco** (platinum, 550/60, uf MC, capital Mônaco), pos47 **Dubai** (platinum, 650/72, uf AE, capital Dubai). green=3, navy=2, platinum=2.

### Tests for User Story 2

- [x] T008 [US2] `tests/game/board.test.ts`: **10 grupos** (8 com 3 + navy 2 + platinum 2 = 28 cidades; 48 casas); `platinum` = [Mônaco, Dubai]; green = [Nova York, Los Angeles, Miami]; navy = [Cannes, Paris]; Chicago/Lyon ausentes; aeroportos (6/18/30/42), utilidades (14/32/43), cantos (0/12/24/36) intactos.
- [x] T009 [US2] `tests/game/economy/rebalance.test.ts`: Mônaco/Dubai são as 2 propriedades de **maior preço**; Dubai tem o **maior aluguel-hotel** do jogo (> navy).
- [x] T010 [US2] Rodar `bunx vitest run tests/game` — US2 verde.

**Checkpoint**: tabuleiro com 10 grupos e a zona nobre no fim.

---

## Phase 5: User Story 3 — Identidade visual (Priority: P3)

**Goal**: faixa/deed do Alta Roda com cor própria (ônix/dourado), distinta.

### Implementation for User Story 3

- [ ] T011 [US3] Validar no `bun run dev`: faixa de Mônaco/Dubai com a cor `bg-group-platinum` (ônix), distinta das 9; deed/popover mostra a cor + aluguel-topo. Ajustar o hex (`--color-group-platinum` + `GROUP_COLOR.platinum`) se não destacar.

**Checkpoint**: zona nobre reconhecível na tela.

---

## Phase 6: Polish & Cross-Cutting (docs + verificação)

- [x] T012 [P] `docs/SRS.md`: §2.3 → **10 grupos** (tabela 8×3 + navy 2 + Alta Roda 2; cidades reais) + §5.1 (nota da zona nobre super-luxo).
- [x] T013 [P] `docs/DECISIONS.md`: registrar **D-025** (distrito super-luxo Alta Roda) + atualizar **D-017** (composição → 10 grupos); índice.
- [x] T014 [P] Atualizar `HANDOVER.md`, `docs/MILESTONES.md` (033) e `.specify/feature.json`.
- [x] T015 Verificação final: `bunx vitest run tests/game` (verde) + `bun run build` (exit 0) + `grep` anti-`bank`/`BankStock`; conferir as **3 fontes de cor** sincronizadas (GROUPS/GROUP_COLOR/CSS) e que engine↔UI mostram o mesmo aluguel (rentLadder).

---

## Dependencies & Execution Order

- **Setup (1)** → **Foundational (2)** bloqueia tudo. T002 → T003 (Records dependem do GroupKey); T004 [P] (cor, arquivos distintos).
- **US1 (3)**: depende de Foundational (economia já posta); é teste + tuning.
- **US2 (4)**: depende de Foundational (precisa do GroupKey `platinum` p/ as cidades). Independente de US1.
- **US3 (5)**: depende de Foundational (cor) + US2 (cidades no board) p/ ver na tela.
- **Polish (6)**: após as stories. T012/T013/T014 [P]; T015 por último.

## Parallel Opportunities

- T004 [P] junto de T003. T012/T013/T014 [P] no polish.
- US1 (economia) e US2 (board) podem andar em paralelo após Foundational (arquivos/test files distintos).

## Implementation Strategy

- **MVP** = Setup + Foundational + US1 + US2 (a zona nobre existe, jogável e testada). US3 é acabamento visual; Polish são docs.
- Commit por tarefa/grupo lógico; `/micro-commits` (sem push) fecha ao final quando o usuário pedir.

## Notes

- Reusa `rentLadder` (fonte única) — não recriar cálculo. `majority` inalterado (grupo de 2 → 2).
- Cor em 3 fontes: esquecer uma quebra a faixa/deed.
