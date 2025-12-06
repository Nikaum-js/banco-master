---
description: "Task list — Tema Cidades do Mundo (valores oficiais)"
---

# Tasks: Tema "Cidades do Mundo" — valores oficiais

**Input**: Design documents from `/specs/018-tema-cidades-do-mundo/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/theme.md, quickstart.md

**Tests**: a **suíte 002–017 existente é a prova de não-regressão** (verde sem edição). +1 teste leve de nomes únicos.

**Organization**: foundational (`theme.ts`) + US1 (derivações) + US2 (polimento/doc). Sem nova regra; calibração/oficialização.

## Format: `[ID] [P?] [Story] Description`

## Path Conventions

Novo `src/game/theme.ts`; derivações em `store`/`rent`/`construction`/`mortgage`/`balancing`/`turnMachine`; `boardData` (nomes/comentário); `docs/TEMA.md`. Teste em `tests/game/theme.test.ts`.

---

## Phase 2: Foundational (Blocking Prerequisites)

- [X] T001 Em `src/game/theme.ts`: exportar `THEME` com todos os knobs (INITIAL_CASH, BANK, PARKING_SEED, GO_BONUS, HOUSE/HOTEL/SKYSCRAPER mult, AIRPORT_RENT, UTILITY_MULT, HANGAR_COST, BUILD_COST_RATIO, MORTGAGE_RATIO, UNMORTGAGE_SURCHARGE, TRANSFER_FEE_RATIO, JAIL_FINE, TAX) com os **valores atuais**; módulo folha (sem imports do jogo)

**Checkpoint**: fonte única existe.

---

## Phase 3: User Story 1 - Derivações centralizadas (Priority: P1) 🎯 MVP

**Goal**: os módulos derivam de `theme.ts` preservando exports e valores → suíte verde sem edição.

**Independent Test**: rodar `bunx vitest run tests/game` → 002–017 verdes sem tocar nos testes.

### Implementation for User Story 1

- [X] T002 [US1] `src/game/economy/rent.ts`: `HOUSE_RENT_MULT`/`HOTEL_RENT_MULT`/`SKYSCRAPER_RENT_MULT`/`AIRPORT_RENT`/`UTILITY_MULT` ← `THEME.*`
- [X] T003 [US1] `src/game/economy/construction.ts`: `HANGAR_COST = THEME.HANGAR_COST`; `buildCost = round(price * THEME.BUILD_COST_RATIO)`
- [X] T004 [US1] `src/game/economy/mortgage.ts`: `mortgageValue`/`unmortgageCost`/`transferKeepFee` via `THEME.MORTGAGE_RATIO`/`UNMORTGAGE_SURCHARGE`/`TRANSFER_FEE_RATIO`
- [X] T005 [US1] `src/game/balancing/balancing.ts`: `PARKING_SEED = THEME.PARKING_SEED`; `goBonus` usa `THEME.GO_BONUS.min/max`
- [X] T006 [US1] `src/game/turn/turnMachine.ts`: `JAIL_FINE = THEME.JAIL_FINE`
- [X] T007 [US1] `src/game/store.ts`: `cash = THEME.INITIAL_CASH`; `bank = { ...THEME.BANK }`; `centerPot = THEME.PARKING_SEED`
- [X] T008 [US1] Rodar `bunx vitest run tests/game` → **002–017 verdes sem editar testes** (prova de zero regressão)

**Checkpoint**: fonte única ligada; comportamento idêntico.

---

## Phase 4: User Story 2 - Polimento e documentação (Priority: P2)

**Goal**: tema coerente (nomes únicos), relabelado e documentado.

### Implementation for User Story 2

- [X] T009 [US2] `src/lib/boardData.ts`: renomear os 4 aeroportos (nomes próprios, IATA preservado); relabelar o comentário do cabeçalho ("PROVISÓRIA" → oficial do tema, tunável em `theme.ts`)
- [X] T010 [US2] `tests/game/theme.test.ts`: todos os `BOARD[].name` únicos; (sanity) `createSeedState` reflete `THEME`
- [X] T011 [US2] `docs/TEMA.md`: ficha do tema (cidades por grupo, aeroportos, utilidades, impostos, tabela de knobs)

**Checkpoint**: tema oficializado, coerente e documentado.

---

## Phase 5: Polish

- [X] T012 [P] `bun run build` verde (tsc -b + vite); suíte completa verde (incl. theme.test.ts)

---

## Dependencies & Execution Order

- **T001** bloqueia as derivações (T002–T007). **T008** valida não-regressão. **US2** (T009–T011) independente. **T012** fecha.

### Parallel Opportunities

- T002–T006 [P] (arquivos distintos); T007 (store) separado. T009/T010/T011 [P].

---

## Implementation Strategy

1. `theme.ts` → derivações → **VALIDAR suíte verde sem editar testes** → polimento (nomes/doc) → build.

---

## Notes

- **Oficializar ≠ rebalancear**: valores preservados; tuning futuro é editar `theme.ts`.
- Prova de não-regressão = suíte 002–017 verde **sem edição**.
- Sem nova regra/estado; modelo base×mult mantido (tabela por-propriedade fora de escopo).
- **`/speckit-implement` autorizado** para o pipeline desta feature.
