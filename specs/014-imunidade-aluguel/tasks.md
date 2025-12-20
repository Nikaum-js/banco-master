---
description: "Task list — Imunidade de aluguel (negociável)"
---

# Tasks: Imunidade de aluguel (negociável)

**Input**: Design documents from `/specs/014-imunidade-aluguel/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/imunidade.md, quickstart.md

**Tests**: INCLUÍDOS — Vitest; concessão/isenção/expiração puras. SC-001…005 como asserções.

**Organization**: por user story (P1 conceder+isentar / P2 expirar) + polish. Estende a `Trade` do 013 e o `afterPassGo` do 010.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: paralelizável · **[Story]**: US1/US2 (foundational/polish sem label)

## Path Conventions

`Immunity` em `economy/types.ts`; `immunities` em `turn/types.ts`; novo `economy/imunidade.ts`; extensão de `economy/trade.ts`; skip em `economy/resolveRentable.ts`; seed/`afterPassGo` no `store.ts`; HUD. Testes em `tests/game/economy/imunidade.test.ts`.

---

## Phase 2: Foundational (Blocking Prerequisites)

- [X] T001 [P] Em `src/game/economy/types.ts`: `interface Immunity { beneficiaryId: string; pos: number; lapsRemaining: number | null }`
- [X] T002 [P] Em `src/game/turn/types.ts`: `GameState += immunities: Immunity[]`
- [X] T003 Em `src/game/store.ts`: `createSeedState` define `immunities: []`
- [X] T004 Em `src/game/economy/imunidade.ts`: `hasImmunity(state, beneficiaryId, pos)` e `tickImmunities(state, beneficiaryId)` (decrementa número; remove ≤0; null intacto) — puras

**Checkpoint**: tipo, estado e helpers prontos.

---

## Phase 3: User Story 1 - Conceder imunidade e não pagar aluguel (Priority: P1) 🎯 MVP

**Goal**: conceder imunidade dentro de uma troca (sobre propriedade própria mantida) e isentar o beneficiário do aluguel; pessoal (outros pagam).

**Independent Test**: conceder imunidade a B em pos de A; B para → não paga; C para → paga; concessão inválida → troca rejeitada.

### Tests for User Story 1 ⚠️

- [X] T005 [P] [US1] Vitest em `tests/game/economy/imunidade.test.ts`: `executeTrade` com `fromImmunities` registra a imunidade (beneficiário = outro lado); rejeita se pos não é do concedente ou está sendo cedida ou `laps≤0`; `resolveRentable` — beneficiário no destino não paga (`done:true`), outro jogador paga normal (SC-001/SC-002)

### Implementation for User Story 1

- [X] T006 [US1] Em `src/game/economy/trade.ts`: `ImmunityGrant`; `Trade += fromImmunities?/toImmunities?`; validar (próprio + não cedida + laps null|>0) junto da troca; aplicar push em `immunities` (atômico)
- [X] T007 [US1] Em `src/game/economy/resolveRentable.ts`: após `owner!==playerId` e `!mortgaged`, `if (hasImmunity(state, playerId, pos)) return { done: true }`

**Checkpoint**: imunidade concedida na troca isenta o beneficiário; pessoal.

---

## Phase 4: User Story 2 - A imunidade expira por voltas (Priority: P2)

**Goal**: imunidade por N voltas decrementa no GO do beneficiário e expira em 0; permanente nunca.

**Independent Test**: imunidade de 1 volta; beneficiário passa pelo GO → expira; aluguel volta a ser cobrado.

### Tests for User Story 2 ⚠️

- [X] T008 [P] [US2] Vitest em `tests/game/economy/imunidade.test.ts`: `tickImmunities` decrementa (2→1), expira (1→0 removida), permanente (`null`) intacta; integração — beneficiário cruza o GO via `advance`/ctx com `afterPassGo` → imunidade decrementa; Tax Man não consulta imunidade (cobra o dono) (SC-003/SC-004)

### Implementation for User Story 2

- [X] T009 [US2] Em `src/game/store.ts`: `afterPassGo: (s, id) => { chargeLoanInterest(s, id); tickImmunities(s, id) }`

**Checkpoint**: caráter temporal (N voltas) funcional.

---

## Phase 5: Integração & Polish

- [X] T010 Em `src/game/ui/GameHUD.tsx`: linha de status das imunidades ativas (`beneficiário→pos·voltas`), visível a todos
- [X] T011 [P] Rodar `bunx vitest run tests/game`: SC-001…005 verdes **e** zero regressão em 002–013 (atenção: `immunities` novo no seed; `afterPassGo` agora também tica imunidade); round-trip JSON com `immunities`
- [X] T012 [P] `bun run build` verde (tsc -b + vite)

---

## Dependencies & Execution Order

- **Foundational (T001–T004)** bloqueia tudo (tipo + estado + helpers).
- **US1**: concessão na `Trade` (T006) + skip no aluguel (T007). **US2**: tick no `afterPassGo` (T009) — depende de `tickImmunities` (T004).
- **Polish (P5)**: HUD + suíte + build.

### Parallel Opportunities

- T001/T002 [P]; T005/T008 (testes) em paralelo.
- ⚠️ Sequenciais por arquivo: `store.ts` (T003/T009), `trade.ts` (T006), `resolveRentable.ts` (T007).

---

## Implementation Strategy

1. Foundational → US1 (conceder + isentar) → **VALIDAR** (SC-001/002) → US2 (expirar) → HUD + suíte + build.

---

## Notes

- Imunidade entra pela **troca** (013) — `Trade` estendida; recusar/propor é M2/M3.
- Expiração reusa `afterPassGo` (010); "volta" = GO do beneficiário.
- Tied a (beneficiário, pos): persiste em mudança de dono (literal §8.4). Tax Man não consulta.
- **Transferência** de imunidade existente: deferida (FR-009).
- **`/speckit-implement` autorizado** para o pipeline desta feature.
