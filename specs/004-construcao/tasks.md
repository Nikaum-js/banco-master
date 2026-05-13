---
description: "Task list — Construção"
---

# Tasks: Construção

**Input**: Design documents from `/specs/004-construcao/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/construction.md, quickstart.md

**Tests**: INCLUÍDOS — Vitest; leilão de casas com fake timers. SC-001…006 como asserções; escrever antes da implementação.

**Organization**: por user story (P1→P4). Estende a economia da 003 de forma aditiva; não reabre a FSM do 002.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: paralelizável (arquivos diferentes, sem dependência pendente)
- **[Story]**: US1/US2/US3/US4 (foundational/polish sem label)

## Path Conventions

Código em `src/game/economy/` (novos `construction.ts`/`houseAuction.ts` + extensões em `types.ts`/`rent.ts`/`resolveRentable.ts`) e `src/game/{turn/types,store}.ts`. Testes em `tests/game/economy/`.

---

## Phase 2: Foundational (Blocking Prerequisites)

> Sem Phase 1 de setup: diretórios e dependências (zustand/vitest) já existem da 003.

**⚠️ CRITICAL**: nenhuma user story começa antes desta fase.

- [X] T001 [P] Estender tipos: em `src/game/economy/types.ts` adicionar `houses: number`/`hotel: boolean` ao `Title`, `BankStock`, `HouseAuction` e a variante `{ kind: 'house-auction'; auction: HouseAuction }` em `ResolutionSlice`; em `src/game/turn/types.ts` adicionar `bank: BankStock` ao `GameState` (conforme `data-model.md`)
- [X] T002 Estender `createSeedState` em `src/game/store.ts`: `Title` semente com `houses: 0`/`hotel: false`; `bank: { houses: 40, hotels: 16 }` (D-017)
- [X] T003 [P] Em `src/game/economy/construction.ts`: helpers puros `constructionLevel(title)`, `constructionRent(square, level)` e `buildCost(square)` (multiplicadores **provisórios** de tema — research D3), `canBuild(state, pos)` (maioria + sem hipoteca), `nextBuildTarget(state, group, ownerId)` (uniformidade) — com header documentando os valores provisórios

**Checkpoint**: tipos, estoque e helpers prontos.

---

## Phase 3: User Story 1 - Construir casas e hotel (Priority: P1) 🎯 MVP

**Goal**: construir 0→4 casas→hotel com uniformidade e pré-requisitos (maioria, sem hipoteca, caixa, estoque), movendo caixa e estoque.

**Independent Test**: dar a maioria de um grupo, construir em sequência + hotel, e verificar uniformidade, débito de caixa e consumo de estoque; tentativas inválidas são no-op.

### Tests for User Story 1 ⚠️ (escrever primeiro, devem FALHAR)

- [X] T004 [P] [US1] Vitest em `tests/game/economy/construction.test.ts`: sequência 0→4→hotel; uniformidade bloqueia construir na de mais casas; bloqueio sem maioria / com hipoteca / sem caixa / sem estoque; hotel troca 4 casas por 1 hotel no estoque (SC-001/002/005)

### Implementation for User Story 1

- [X] T005 [US1] Em `src/game/economy/construction.ts`: `buildHouse(state, pos)` pura — valida (canBuild + uniformidade + caixa + estoque), aplica casa ou hotel (4 casas → hotel: zera `houses`, seta `hotel`, devolve 4 casas e consome 1 hotel do `bank`), debita custo; no-op se inválido (FR-001…005)
- [X] T006 [US1] Em `src/game/store.ts`: comando `buildHouse(pos)` (guarda de turno do ativo + `paused`)

**Checkpoint**: construção jogável com todas as regras.

---

## Phase 4: User Story 2 - Aluguel por construção (Priority: P2)

**Goal**: cidade com construção cobra pela tabela (×0.7 parcial / ×1.0 completo), substituindo o escalonamento por posse da 003.

**Independent Test**: construir numa cidade e parar outro jogador; conferir aluguel pela tabela de construção e que a posse base/150%/200% foi substituída.

### Tests for User Story 2 ⚠️ (escrever primeiro, devem FALHAR)

- [X] T007 [P] [US2] Vitest em `tests/game/economy/rent.test.ts` (estender): aluguel com construção = `constructionRent(level) × 0.7` (parcial) / `× 1.0` (completo); substitui base/150%/200%; sem construção mantém a regra da 003 (SC-003)

### Implementation for User Story 2

- [X] T008 [US2] Em `src/game/economy/rent.ts`: estender `rentCity` para ramificar em construção (`title.hotel || title.houses > 0` → tabela × 70%/100%) antes do escalonamento por posse; ajustar assinatura para receber o `title`
- [X] T009 [US2] Em `src/game/economy/resolveRentable.ts`: passar o `title` (com construção) ao `rentCity` no cálculo do aluguel de cidade (FR-007/008/014)

**Checkpoint**: US1 + US2; aluguel reflete construção.

---

## Phase 5: User Story 3 - Vender construções (Priority: P3)

**Goal**: vender ao banco por metade; hotel → 4 casas (ou desmonte forçado do grupo quando faltam casas); construções voltam ao estoque.

**Independent Test**: vender casa e hotel, conferir crédito (metade), retorno ao estoque, conversão hotel→4 casas e o desmonte forçado do §5.5.

### Tests for User Story 3 ⚠️ (escrever primeiro, devem FALHAR)

- [X] T010 [P] [US3] Vitest em `tests/game/economy/construction.test.ts`: vender casa credita metade e devolve ao estoque; vender hotel com `bank.houses ≥ 4` → 4 casas; com `bank.houses < 4` → desmonte forçado de todos os hotéis do grupo, crédito só das casas disponíveis (SC-004)

### Implementation for User Story 3

- [X] T011 [US3] Em `src/game/economy/construction.ts`: `sellBuilding(state, pos)` pura — credita metade do custo, devolve ao `bank`, hotel→4 casas (consome 4) ou desmonte forçado do grupo (§5.5) quando `bank.houses < 4`; respeita uniformidade (FR-009/010/011)
- [X] T012 [US3] Em `src/game/store.ts`: comando `sellBuilding(pos)` (guarda de turno + `paused`)

**Checkpoint**: US1–US3 funcionam.

---

## Phase 6: User Story 4 - Leilão de casas em escassez (Priority: P4)

**Goal**: pedido de construção que excede o estoque → leilão pelas casas disponíveis entre interessados; vencedor paga ao banco e recebe as casas.

**Independent Test**: zerar o estoque, gerar interesse de 2+ jogadores, abrir o leilão, dar lances, avançar o cronômetro e confirmar o pagamento.

### Tests for User Story 4 ⚠️ (escrever primeiro, devem FALHAR)

- [X] T013 [P] [US4] Vitest em `tests/game/economy/houseAuction.test.ts` (fake timers): escassez abre `house-auction`; lances > atual e ≤ caixa; ao esgotar o cronômetro, maior lance paga ao banco e recebe as casas; sem lance → casas ficam no banco (SC-006)

### Implementation for User Story 4

- [X] T014 [P] [US4] Em `src/game/economy/houseAuction.ts`: `declareBuildInterest`/`placeHouseBid`/`closeHouseAuction` puras (deadline serializável; reusa o padrão de leilão da 003)
- [X] T015 [US4] Em `src/game/store.ts`: abrir `house-auction` quando `buildHouse` exceder `bank.houses` com interesse concorrente; comandos + timer (reusa o agendamento por `deadline` da 003; respeita `paused`)

**Checkpoint**: todas as user stories funcionam.

---

## Phase 7: Polish & Cross-Cutting

- [X] T016 [P] Rodar `npx vitest run tests/game` e confirmar SC-001…006 verdes **e** zero regressão nas suítes do 002 e 003 (especialmente o aluguel sem construção)
- [X] T017 [P] Teste de round-trip JSON do `GameState` estendido (`Title.houses/hotel`, `bank`, `house-auction`) em `tests/game/economy/construction.test.ts`
- [X] T018 Documentar no header de `src/game/economy/construction.ts` que custo e tabela de aluguel por nível são **valores de tema provisórios** (substituíveis sem mudar a regra)

---

## Dependencies & Execution Order

- **Foundational (P2)** bloqueia tudo.
- **US1 (P3)**: construir — base das demais.
- **US2 (P4)**: aluguel; estende `rent.ts` (compartilhado com 003 — sequenciar). Testável com construção setada à mão.
- **US3 (P5)**: vender — depende de US1 (haver construção).
- **US4 (P6)**: leilão de casas — depende de US1 (gatilho no build) e reusa o leilão da 003.
- **Polish (P7)**: após as stories.

### Within Each Story

- Testes escritos e falhando antes da implementação.
- Helpers/tipos (P2) → função pura → comando do store.

### Parallel Opportunities

- P2: T001 e T003 em paralelo (T002 depende de T001).
- Testes `[P]` por story; `houseAuction.ts` (T014) em paralelo com outras puras.
- ⚠️ `store.ts` (T002/T006/T012/T015), `rent.ts` (T008) e `construction.ts` (T003/T005/T011) são sequenciais por arquivo.

---

## Implementation Strategy

### MVP First (US1)

1. Foundational → 2. US1 (construir) → **PARAR e VALIDAR** (SC-001/002/005).

### Incremental Delivery

1. Fundação → 2. US1 (build) → 3. US2 (aluguel) → 4. US3 (venda) → 5. US4 (leilão de casas) → 6. Polish.

---

## Notes

- `[P]` = arquivos diferentes, sem dependência pendente.
- Estende a 003 aditivamente; o 002 (FSM) não é tocado.
- Custo/tabela de aluguel = **valores de tema provisórios** no código (como a escada de preços da 001) — T018 documenta.
- Tudo puro e serializável; efeito só no store (timer do leilão de casas reconstruível pelo `deadline`).
- Fora de escopo (specs próprias): 2º hotel, Skyscraper, Hangar, hipoteca-mutação, negociação.
- **`/speckit-implement` autorizado** para o pipeline desta feature.
