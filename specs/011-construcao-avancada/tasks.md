---
description: "Task list — Construção avançada (2º hotel, Hangar, Skyscraper)"
---

# Tasks: Construção avançada — 2º hotel, Hangar e Skyscraper

**Input**: Design documents from `/specs/011-construcao-avancada/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/construcao-avancada.md, quickstart.md

**Tests**: INCLUÍDOS — Vitest; funções puras (sem RNG). SC-001…005 como asserções.

**Organization**: por user story (P1 2º hotel / P2 Hangar / P3 Skyscraper) + polish. Estende o ladder do 004. **Sem UI** (construção não está no HUD mínimo; M2).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: paralelizável · **[Story]**: US1/US2/US3 (foundational/polish sem label)

## Path Conventions

`economy/types.ts` (Title/BankStock), `economy/construction.ts` (ladder + Hangar), `economy/rent.ts` (Skyscraper/×3), `economy/resolveRentable.ts`, `economy/titles.ts`, `falencia/falencia.ts`, `cards/effects.ts`, `store.ts`. Testes em `tests/game/economy/construcao-avancada.test.ts`.

---

## Phase 2: Foundational (Blocking Prerequisites)

- [X] T001 [P] Em `src/game/economy/types.ts`: `Title += hotel2: boolean; skyscraper: boolean; hangar: boolean`; `BankStock += skyscrapers: number`
- [X] T002 Em `src/game/store.ts`: `seedTitles` define `hotel2:false, skyscraper:false, hangar:false`; seed `bank.skyscrapers: 4`
- [X] T003 Em `src/game/economy/construction.ts`: substituir `levelNum` por `cityLevel` (skyscraper→7, hotel2→6, hotel→5, casas 0–4); constantes `HANGAR_COST=100`

**Checkpoint**: tipos, estado e o nível de cidade estendido prontos (sem comportamento novo ainda).

---

## Phase 3: User Story 1 - Segundo hotel (Priority: P1) 🎯 MVP

**Goal**: subir do hotel ao 2º hotel (nível 6) consumindo estoque de hotéis, sem mudar o aluguel; vender devolve metade + 1 hotel.

**Independent Test**: grupo com hotéis → buildHouse sobe ao 6, debita custo, `bank.hotels-1`, aluguel inalterado; sem estoque → no-op; vender reverte.

### Tests for User Story 1 ⚠️

- [X] T004 [P] [US1] Vitest em `tests/game/economy/construcao-avancada.test.ts`: 2º hotel — build 5→6 (custo, `bank.hotels-1`, `hotel2=true`); aluguel igual ao hotel; sem estoque → no-op; venda 6→5 (`bank.hotels+1`, metade); uniformidade (SC-001/SC-004)

### Implementation for User Story 1

- [X] T005 [US1] Em `src/game/economy/construction.ts`: `buildHouse` cobre 5→6 (2º hotel; `bank.hotels≥1`; `hotel2=true`, `bank.hotels-=1`); `sellBuilding` cobre 6→5 (`hotel2=false`, `bank.hotels+=1`, metade) — uniformidade reusada

**Checkpoint**: 2º hotel funcional (base do ladder estendido).

---

## Phase 4: User Story 2 - Hangar em aeroporto (Priority: P2)

**Goal**: construir/vender Hangar; aeroporto com Hangar cobra o dobro.

**Independent Test**: aeroporto do jogador → buildHangar ($100), aluguel 2×; sellHangar ($50), aluguel base; máx. 1; hipotecado não cobra.

### Tests for User Story 2 ⚠️

- [X] T006 [P] [US2] Vitest em `tests/game/economy/construcao-avancada.test.ts`: `buildHangar` (cash-100, `hangar=true`; segundo → no-op; hipotecado/sem caixa → no-op); aluguel de aeroporto com Hangar = 2× base via `resolveRentable`; `sellHangar` (cash+50, base) (SC-002/SC-004)

### Implementation for User Story 2

- [X] T007 [US2] Em `src/game/economy/construction.ts`: `buildHangar(state, pos)` e `sellHangar(state, pos)` (aeroporto, dono ativo, não hipotecado p/ build; $100/$50; não pausado)
- [X] T008 [US2] Em `src/game/economy/resolveRentable.ts`: aeroporto → `rentAirport(count) * (title.hangar ? 2 : 1)`
- [X] T009 [US2] Em `src/game/store.ts`: comandos `buildHangar(pos)` / `sellHangar(pos)` (interface `GameStore` + impl, dono = ativo)

**Checkpoint**: Hangar dobra o aluguel do aeroporto e reverte na venda.

---

## Phase 5: User Story 3 - Skyscraper (Priority: P3)

**Goal**: erguer Skyscraper (nível 7) em grupo completo todo no 2º hotel; aluguel fixo + ×3 nas demais do grupo; vender reverte.

**Independent Test**: grupo completo no nível 6 → buildHouse sobe ao 7 (consome `bank.skyscrapers`); cidade com Skyscraper cobra fixo; demais ×3; só maioria → no-op; vender reverte ao 6 (devolve 1 Skyscraper, não mexe em hotels).

### Tests for User Story 3 ⚠️

- [X] T010 [P] [US3] Vitest em `tests/game/economy/construcao-avancada.test.ts`: Skyscraper — build 6→7 exige grupo completo + todas no 6 + `bank.skyscrapers≥1` (`skyscraper=true`, `bank.skyscrapers-1`, hotels inalterado); só maioria → no-op; aluguel fixo na cidade com Skyscraper; ×3 nas demais do grupo; venda 7→6 (`bank.skyscrapers+1`, metade, hotels inalterado) (SC-003/SC-004/SC-005)

### Implementation for User Story 3

- [X] T011 [US3] Em `src/game/economy/titles.ts`: `groupHasSkyscraper(state, group): boolean`
- [X] T012 [US3] Em `src/game/economy/rent.ts`: `rentCity` aceita `groupHasSkyscraper?` e `build.skyscraper?` → Skyscraper fixo (`SKYSCRAPER_RENT_MULT=250`) e ×3 nas demais; retrocompatível (params opcionais)
- [X] T013 [US3] Em `src/game/economy/construction.ts`: `buildHouse` cobre 6→7 (gate grupo completo + `bank.skyscrapers≥1`; `skyscraper=true`, `bank.skyscrapers-=1`); `sellBuilding` cobre 7→6 (`bank.skyscrapers+=1`, metade, sem mexer em hotels/houses)
- [X] T014 [US3] Em `src/game/economy/resolveRentable.ts`: cidade passa `{houses,hotel,hotel2,skyscraper}` + `groupHasSkyscraper(state, square.group)` ao `rentCity`

**Checkpoint**: Skyscraper com aluguel fixo e efeito ×3 de grupo.

---

## Phase 6: Integração & Polish

- [X] T015 Em `src/game/falencia/falencia.ts`: `declareBankruptcy` devolve `bank.hotels+=1` (se hotel2) e `bank.skyscrapers+=1` (se skyscraper) e zera os flags; `liquidationValue` soma venda de 2º hotel/Skyscraper/Hangar
- [X] T016 [P] Em `src/game/cards/effects.ts`: `netWorth` inclui o valor de 2º hotel/Skyscraper/Hangar
- [X] T017 [P] Rodar `bunx vitest run tests/game`: SC-001…005 verdes **e** zero regressão em 002–010 (atenção a `rentCity` retrocompatível, novos campos no seed, falência/netWorth); round-trip JSON com os novos flags/estoque
- [X] T018 [P] `bun run build` verde (tsc -b + vite)

---

## Dependencies & Execution Order

- **Foundational (T001–T003)** bloqueia tudo (tipos + ladder).
- **US1 (P3)**: 2º hotel (build/sell 5↔6). **US2 (P4)**: Hangar — **independente** de US1/US3. **US3 (P5)**: Skyscraper — depende do nível 6 existir (US1) e de `groupHasSkyscraper`/`rentCity`.
- **Polish (P6)**: falência/netWorth + suíte + build.

### Parallel Opportunities

- T004/T006/T010 (testes por story) em paralelo. T016 [P] independente.
- ⚠️ Sequenciais por arquivo: `construction.ts` (T003/T005/T007/T013), `rent.ts` (T012), `resolveRentable.ts` (T008/T014), `store.ts` (T002/T009), `falencia.ts` (T015).

---

## Implementation Strategy

### MVP First (US1)

1. Foundational → US1 (2º hotel) → **VALIDAR** (SC-001).

### Incremental Delivery

1. Fundação → 2. US1 (2º hotel) → 3. US2 (Hangar) → 4. US3 (Skyscraper) → 5. falência/netWorth + suíte + build.

---

## Notes

- `buildHouse`/`sellBuilding` sobem/descem o ladder inteiro — comando do store inalterado para cidades; Hangar tem comandos próprios.
- `hotel` permanece `true` nos níveis 6/7 (não quebra `groupHasConstruction` 005 nem o aluguel-com-hotel).
- `rentCity` ganha params **opcionais** (retrocompatível com os testes do 003/004).
- Skyscraper exige **grupo completo** (≠ casas a 70%) — luxo de topo, princípio V intacto.
- Valores de tema (Hangar $100, Skyscraper custo/aluguel, estoque 4) são **provisórios** (research R8).
- **`/speckit-implement` autorizado** para o pipeline desta feature.
