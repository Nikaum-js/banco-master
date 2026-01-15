---
description: "Task list — Cartas: efeitos temporários de N voltas"
---

# Tasks: Cartas — efeitos temporários de N voltas

**Input**: Design documents from `/specs/015-cartas-efeitos-temporarios/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/efeitos-temporarios.md, quickstart.md

**Tests**: INCLUÍDOS — Vitest; registro/consulta/expiração e handlers puros. SC-001…005 como asserções.

**Organization**: por user story (P1 Apagão/Greve / P2 Boicote / P3 Imunidade Temporária) + polish. Reusa `afterPassGo` (014).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: paralelizável · **[Story]**: US1/US2/US3 (foundational/polish sem label)

## Path Conventions

`TempEffect` em `economy/types.ts`; `tempEffects` em `turn/types.ts`; novo `economy/tempEffects.ts`; handlers em `cards/effects.ts`; alvo em `cards/draw.ts`; checagens em `economy/resolveRentable.ts` e `balancing/taxMan.ts`; catálogo; seed/`afterPassGo`/`playHandCard` no `store.ts`; HUD. Testes em `tests/game/cards/tempEffects.test.ts`.

---

## Phase 2: Foundational (Blocking Prerequisites)

- [X] T001 [P] Em `src/game/economy/types.ts`: `interface TempEffect { kind: 'apagao'|'greve'|'boicote'|'imunidade-temp'; ownerId: string; pos: number | null; lapsRemaining: number }`
- [X] T002 [P] Em `src/game/turn/types.ts`: `GameState += tempEffects: TempEffect[]`
- [X] T003 Em `src/game/store.ts`: `createSeedState` define `tempEffects: []`
- [X] T004 Em `src/game/economy/tempEffects.ts`: `apagaoActive`, `greveActive`, `isBoycotted(pos)`, `isTempImmune(pos)`, `addTempEffect`, `tickTempEffects(ownerId)` — puras
- [X] T005 Em `src/game/store.ts`: `afterPassGo` também chama `tickTempEffects(s, id)` (junto de `chargeLoanInterest`/`tickImmunities`)

**Checkpoint**: tipo, estado, helpers e expiração no GO prontos.

---

## Phase 3: User Story 1 - Apagão e Greve (imediatas) (Priority: P1) 🎯 MVP

**Goal**: sacar Apagão → Hangares inativos 1 volta; sacar Greve → utilidades $0 por 1 volta; aplicado no aluguel e no Tax Man; expira no GO do sacador.

**Independent Test**: registrar apagão → aeroporto com Hangar cobra base; greve → utilidade $0; após GO do sacador, expira.

### Tests for User Story 1 ⚠️

- [X] T006 [P] [US1] Vitest em `tests/game/cards/tempEffects.test.ts`: handler `apagao`/`greveUtilidades` registram efeito (laps 1); `resolveRentable` — aeroporto com Hangar sob apagão cobra base; utilidade sob greve cobra $0; expira no `tickTempEffects(owner)`; Tax Man respeita ambos (SC-001/SC-004/SC-005)

### Implementation for User Story 1

- [X] T007 [US1] Em `src/game/cards/effects.ts`: handlers `apagao` e `greveUtilidades` (registram `addTempEffect`, laps 1, owner = sacador)
- [X] T008 [US1] Em `src/game/economy/resolveRentable.ts`: aeroporto `* (hangar && !apagaoActive ? 2 : 1)`; utilidade `greveActive ? 0 : rentUtility(...)`
- [X] T009 [US1] Em `src/game/balancing/taxMan.ts`: mesmas checagens de apagão (aeroporto sem dobra) e greve (utilidade $0)

**Checkpoint**: Apagão e Greve afetam aluguel e Fiscal, e expiram.

---

## Phase 4: User Story 2 - Boicote (Priority: P2)

**Goal**: jogar Boicote (mão, próprio turno) em propriedade de outro (não imune) → ninguém paga aluguel nela por 2 voltas.

**Independent Test**: jogar Boicote em propriedade alheia → quem parar não paga; alvo próprio/sem dono/imune → no-op; expira em 2 voltas.

### Tests for User Story 2 ⚠️

- [X] T010 [P] [US2] Vitest em `tests/game/cards/tempEffects.test.ts`: `playHandCard('boicote', target)` registra boicote (laps 2); `resolveRentable`/Tax Man não cobram na propriedade boicotada; alvo próprio/sem dono/imune → no-op; expira após 2 GOs do que jogou (SC-002/SC-004)

### Implementation for User Story 2

- [X] T011 [US2] Em `src/game/cards/draw.ts`: `playHandCard(..., target?)`; caso `boicote` — exige `target` de outro jogador e não `isTempImmune` → `addTempEffect(boicote, laps 2)`; remove carta + recicla
- [X] T012 [US2] Em `src/game/economy/resolveRentable.ts` e `balancing/taxMan.ts`: `if (isBoycotted(pos)) → sem aluguel/cobrança`
- [X] T013 [US2] Em `src/game/store.ts`: comando `playHandCard(cardId, target?)` repassa o `target`

**Checkpoint**: Boicote zera o aluguel da propriedade-alvo por 2 voltas.

---

## Phase 5: User Story 3 - Imunidade Temporária (Priority: P3)

**Goal**: jogar Imunidade Temporária (mão, próprio turno) em propriedade própria → não pode ser alvo de Boicote por 2 voltas.

**Independent Test**: jogar Imunidade em propriedade própria; tentar Boicote nela → rejeitado; expira em 2 voltas.

### Tests for User Story 3 ⚠️

- [X] T014 [P] [US3] Vitest em `tests/game/cards/tempEffects.test.ts`: `playHandCard('imunidade', target)` registra imunidade-temp (laps 2) só sobre propriedade própria (alvo não-próprio → no-op); Boicote sobre propriedade imune → no-op; expira após 2 GOs (SC-003/SC-004)

### Implementation for User Story 3

- [X] T015 [US3] Em `src/game/cards/draw.ts`: caso `imunidade` — exige `target` próprio → `addTempEffect(imunidade-temp, laps 2)`; remove carta + recicla

**Checkpoint**: Imunidade Temporária bloqueia Boicote naquela propriedade.

---

## Phase 6: Integração & Polish

- [X] T016 Em `src/game/cards/catalog.ts`: `status: 'implementado'` para `apagao`, `greve-utilidades`, `boicote`, `imunidade`
- [X] T017 Em `src/game/ui/GameHUD.tsx`: linha de status dos efeitos ativos (Apagão/Greve/Boicotes/Imunidades Temporárias), visível a todos (§12.3)
- [X] T018 [P] Rodar `bunx vitest run tests/game`: SC-001…005 verdes **e** zero regressão em 002–014 (atenção: `tempEffects` novo no seed; `afterPassGo` agora tica 3 coisas); round-trip JSON com `tempEffects`
- [X] T019 [P] `bun run build` verde (tsc -b + vite)

---

## Dependencies & Execution Order

- **Foundational (T001–T005)** bloqueia tudo (tipo, estado, helpers, expiração).
- **US1**: handlers + checagens de aluguel/Fiscal. **US2**: Boicote (alvo) + skip no aluguel. **US3**: Imunidade Temporária (depende de `isTempImmune` consultado pelo Boicote).
- **Polish (P6)**: catálogo + HUD + suíte + build.

### Parallel Opportunities

- T001/T002 [P]; T006/T010/T014 (testes) em paralelo.
- ⚠️ Sequenciais por arquivo: `resolveRentable.ts` (T008/T012), `taxMan.ts` (T009/T012), `draw.ts` (T011/T015), `store.ts` (T003/T005/T013).

---

## Implementation Strategy

1. Foundational → US1 (Apagão/Greve) → **VALIDAR** → US2 (Boicote) → US3 (Imunidade Temporária) → catálogo + HUD + suíte + build.

---

## Notes

- "Volta" = passagem pelo GO do **originador** (§10.6); reusa `afterPassGo` (010/014).
- Apagão/Greve imediatas (saque); Boicote/Imunidade de mão com `target` (parâmetro em `playHandCard`).
- Imunidade Temporária (carta, proteção de alvo) ≠ imunidade de aluguel (014, isenção do beneficiário) — listas separadas.
- Ofensivas (Aquisição/Despejo/Auditoria) → spec 016; reação (Diplomacia/Bunker) → 017. As demais deferidas seguem no-op.
- **`/speckit-implement` autorizado** para o pipeline desta feature.
