---
description: "Task list — Hipoteca"
---

# Tasks: Hipoteca

**Input**: Design documents from `/specs/005-hipoteca/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/mortgage.md, quickstart.md

**Tests**: INCLUÍDOS — Vitest; funções puras. SC-001…004 como asserções; escrever antes da implementação.

**Organization**: por user story (P1→P3). Feature pequena — escreve a flag `mortgaged` (efeitos já em 003/004); sem novo estado.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: paralelizável · **[Story]**: US1/US2/US3 (foundational/polish sem label)

## Path Conventions

Código em `src/game/economy/mortgage.ts` (novo) + comandos em `src/game/store.ts`. Testes em `tests/game/economy/mortgage.test.ts`.

---

## Phase 2: Foundational (Blocking Prerequisites)

> Sem Phase 1: diretórios/deps já existem (003/004).

- [X] T001 [P] Em `src/game/economy/mortgage.ts`: helpers puros `mortgageValue(square)` (`round(price/2)`), `unmortgageCost(square)` (`round(valor×1,10)`), `transferKeepFee(square)` (`round(valor×0,10)`) e `groupHasConstruction(state, group, ownerId)` (varre o grupo por `houses>0 || hotel`) — base das US1–US3

**Checkpoint**: helpers de valor e do bloqueio §6.1 prontos.

---

## Phase 3: User Story 1 - Hipotecar (Priority: P1) 🎯 MVP

**Goal**: hipotecar uma propriedade própria sem construção → recebe metade do preço, marca `mortgaged`.

**Independent Test**: hipotecar e conferir crédito de metade + marca; bloquear quando há construção no grupo.

### Tests for User Story 1 ⚠️ (escrever primeiro, devem FALHAR)

- [X] T002 [P] [US1] Vitest em `tests/game/economy/mortgage.test.ts`: hipotecar credita `price/2` e seta `mortgaged`; bloqueia com construção no grupo; já hipotecada / não-dono → no-op (SC-001)

### Implementation for User Story 1

- [X] T003 [US1] Em `src/game/economy/mortgage.ts`: `mortgageProperty(state, pos)` pura — valida (dono ativo, não-hipotecada, `!groupHasConstruction`), credita `mortgageValue`, seta `mortgaged = true`; no-op se inválido (FR-001/002/008)
- [X] T004 [US1] Em `src/game/store.ts`: comando `mortgageProperty(pos)` (guarda de turno + `paused`)

**Checkpoint**: hipoteca acionável; ciclo da flag começa a fechar.

---

## Phase 4: User Story 2 - Deshipotecar (Priority: P2)

**Goal**: pagar metade × 1,10 → remove `mortgaged`; volta a cobrar aluguel.

**Independent Test**: deshipotecar e conferir débito de `metade×1,10` + desmarca; sem caixa → no-op.

### Tests for User Story 2 ⚠️ (escrever primeiro, devem FALHAR)

- [X] T005 [P] [US2] Vitest em `tests/game/economy/mortgage.test.ts` (estender): deshipotecar debita `round(price/2 × 1,10)` e remove `mortgaged`; caixa insuficiente / não-hipotecada → no-op (SC-002)

### Implementation for User Story 2

- [X] T006 [US2] Em `src/game/economy/mortgage.ts`: `unmortgageProperty(state, pos)` pura — valida (dono ativo, hipotecada, `cash ≥ unmortgageCost`), debita, seta `mortgaged = false`; no-op se inválido (FR-004/005/008)
- [X] T007 [US2] Em `src/game/store.ts`: comando `unmortgageProperty(pos)` (guarda de turno + `paused`)

**Checkpoint**: ciclo da hipoteca completo (liga/desliga).

---

## Phase 5: User Story 3 - Regra de transferência (Priority: P3)

**Goal**: helpers de regra prontos para o gatilho de transferência (negociação/falência): manter = metade × 0,10; deshipotecar = metade × 1,10.

**Independent Test**: validar `transferKeepFee` e `unmortgageCost` para um preço conhecido.

### Tests for User Story 3 ⚠️ (escrever primeiro, devem FALHAR)

- [X] T008 [P] [US3] Vitest em `tests/game/economy/mortgage.test.ts` (estender): `transferKeepFee(square) === round(price/2 × 0,10)` e `unmortgageCost(square) === round(price/2 × 1,10)` (SC-004)

> Implementação dos helpers já em T001; o gatilho de transferência (negociação/falência) é de outras specs — esta story só valida a regra.

**Checkpoint**: regra de transferência disponível para Negociação/Falência.

---

## Phase 6: Polish & Cross-Cutting

- [X] T009 [P] Rodar `npx vitest run tests/game` e confirmar SC-001…004 verdes **e** zero regressão em 002/003/004 (a flag `mortgaged` passa a ser **escrita**, sem alterar os efeitos lidos por 003/004)

---

## Dependencies & Execution Order

- **Foundational (P2 / T001)** bloqueia tudo.
- **US1 (P3)**: hipotecar. **US2 (P4)**: deshipotecar (independente de US1 na lógica; compartilha `mortgage.ts`/`store.ts` — sequenciar). **US3 (P5)**: só valida os helpers de T001.
- **Polish (P6)**: após as stories.

### Parallel Opportunities

- Testes `[P]` por story podem ser escritos juntos.
- ⚠️ `mortgage.ts` (T001/T003/T006) e `store.ts` (T004/T007) são sequenciais por arquivo.

---

## Implementation Strategy

### MVP First (US1)

1. Foundational (T001) → US1 (hipotecar) → **VALIDAR** (SC-001).

### Incremental Delivery

1. Helpers → 2. US1 (hipotecar) → 3. US2 (deshipotecar) → 4. US3 (regra de transferência) → 5. Polish.

---

## Notes

- Sem novo estado — escreve `Title.mortgaged` (003). Efeitos (aluguel/construção) já existem em 003/004.
- Tudo puro; no-op em operação inválida (padrão 002–004).
- Fora de escopo: trade (Negociação) e falência (Falência) — só os helpers de regra de transferência.
- **`/speckit-implement` autorizado** para o pipeline desta feature.
