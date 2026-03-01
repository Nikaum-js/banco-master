---
description: "Task list — Cartas ofensivas com alvo"
---

# Tasks: Cartas ofensivas com alvo

**Input**: Design documents from `/specs/016-cartas-ofensivas/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ofensivas.md, quickstart.md

**Tests**: INCLUÍDOS — Vitest; `acquire`/`evict`/`audit` puros. SC-001…005 como asserções.

**Organization**: por user story (P1 Aquisição / P2 Despejo / P3 Auditoria) + polish. Despacho por `playHandCard` (006/015).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: paralelizável · **[Story]**: US1/US2/US3 (foundational/polish sem label)

## Path Conventions

Novo `cards/ofensivas.ts`; despacho em `cards/draw.ts` (`playHandCard` += `targetPlayer?`); catálogo; store. Testes em `tests/game/cards/ofensivas.test.ts`. Reusa `ownerOf`/`isMortgaged` (003), `cityLevel` (011), `transferKeepFee` (005), `isTempImmune` (015), `netWorth` (006).

---

## Phase 2: Foundational (Blocking Prerequisites)

- [X] T001 Em `src/game/cards/ofensivas.ts`: `acquire(state, attackerId, pos)`, `evict(state, attackerId, pos)`, `audit(state, attackerId, targetId, ports)` — puras, mutam o clone, retornam `boolean`; helper `nonMortgagedCount`
- [X] T002 Em `src/game/store.ts`: `playHandCard(cardId, target?, targetPlayer?)` repassa os alvos (interface + impl)

**Checkpoint**: lógica das 3 ofensivas e o canal de alvo prontos.

---

## Phase 3: User Story 1 - Aquisição Hostil (Priority: P1) 🎯 MVP

**Goal**: forçar a venda de uma propriedade (sem construção) de alvo com ≥2 não-hipotecadas, pagando preço (×1,5 aeroporto/utilidade; +10% ao banco se hipotecada); respeita Imunidade Temporária.

**Independent Test**: alvo com ≥2 não-hipotecadas; jogar Aquisição numa sem construção → posse transferida + preço ao dono; gates → no-op.

### Tests for User Story 1 ⚠️

- [X] T003 [P] [US1] Vitest em `tests/game/cards/ofensivas.test.ts`: `acquire` válido (cidade: posse→atacante, dono +preço, atacante −preço); aeroporto/utilidade ×1,5; hipotecada (+`transferKeepFee` ao banco, chega hipotecada); gates → false (própria, com construção/Hangar, dono <2 não-hipotecadas, `isTempImmune`, sem caixa) (SC-001/SC-004)

### Implementation for User Story 1

- [X] T004 [US1] Em `src/game/cards/draw.ts`: despacho `aquisicaoHostil` em `playHandCard` (exige `target`; clona; `acquire` → `discardPlayed` ou no-op)

**Checkpoint**: Aquisição Hostil transfere a propriedade.

---

## Phase 4: User Story 2 - Despejo (Priority: P2)

**Goal**: demolir 1 casa de cidade de outro (não hotel); dono não recebe; respeita Imunidade Temporária.

**Independent Test**: cidade de outro com casas → −1 casa ao banco, dono não recebe; sem casa/hotel/próprio/imune → no-op.

### Tests for User Story 2 ⚠️

- [X] T005 [P] [US2] Vitest em `tests/game/cards/ofensivas.test.ts`: `evict` remove 1 casa (`bank.houses+1`, dono inalterado); rejeita cidade sem casa / com hotel / própria / imune (SC-002/SC-004)

### Implementation for User Story 2

- [X] T006 [US2] Em `src/game/cards/draw.ts`: despacho `despejo` em `playHandCard` (exige `target`; `evict`)

**Checkpoint**: Despejo derruba 1 casa.

---

## Phase 5: User Story 3 - Auditoria Fiscal (Priority: P3)

**Goal**: alvo (jogador) paga 10% do patrimônio ao pote (ou o caixa que tiver).

**Independent Test**: alvo com patrimônio conhecido → 10% ao pote; sem caixa → o que houver; self → no-op.

### Tests for User Story 3 ⚠️

- [X] T007 [P] [US3] Vitest em `tests/game/cards/ofensivas.test.ts`: `audit` debita `round(netWorth*0.10)` ao pote (`onPayToCenter`); alvo sem caixa → debita o que houver; self/eliminado → false (SC-003)

### Implementation for User Story 3

- [X] T008 [US3] Em `src/game/cards/draw.ts`: despacho `auditoriaFiscal` em `playHandCard` (exige `targetPlayer`; `audit`)

**Checkpoint**: Auditoria alimenta o pote.

---

## Phase 6: Integração & Polish

- [X] T009 Em `src/game/cards/catalog.ts`: `status: 'implementado'` para `aquisicao-hostil`, `despejo`, `auditoria-fiscal`
- [X] T010 [P] Rodar `bunx vitest run tests/game`: SC-001…005 verdes **e** zero regressão em 002–015; round-trip JSON após cada ofensiva
- [X] T011 [P] `bun run build` verde (tsc -b + vite)

---

## Dependencies & Execution Order

- **Foundational (T001–T002)** bloqueia tudo (lógica + canal de alvo).
- **US1/US2/US3**: cada despacho em `playHandCard` (sequenciais por arquivo `draw.ts`). Testes T003/T005/T007 em paralelo.
- **Polish (P6)**: catálogo + suíte + build.

### Parallel Opportunities

- T003/T005/T007 (testes) em paralelo.
- ⚠️ Sequenciais por arquivo: `draw.ts` (T004/T006/T008), `store.ts` (T002).

---

## Implementation Strategy

1. Foundational (`ofensivas.ts` + store) → US1 (Aquisição) → **VALIDAR** → US2 (Despejo) → US3 (Auditoria) → catálogo + suíte + build.

---

## Notes

- "Preço original" = preço de tabela (motor não rastreia preço pago) — research R5.
- Imunidade Temporária (015) bloqueia Aquisição/Despejo (alvo propriedade); não Auditoria (alvo jogador).
- Auditoria sem caixa → debita o que houver (sem falir, como Tax Man) — R6.
- Reação (Diplomacia/Bunker) → spec 017; até lá "não pode recusar".
- **`/speckit-implement` autorizado** para o pipeline desta feature.
