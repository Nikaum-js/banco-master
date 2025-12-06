---
description: "Task list — Limpeza na eliminação (§9.4)"
---

# Tasks: Limpeza na eliminação (§9.4) — imunidades e efeitos

**Input**: Design documents from `/specs/019-limpeza-eliminacao/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/limpeza.md, quickstart.md

**Tests**: INCLUÍDOS — Vitest (puro). SC-001..003 + não-regressão.

## Format: `[ID] [P?] [Story] Description`

## Path Conventions

`Immunity` em `economy/types.ts`; `granterId` em `economy/trade.ts`; limpeza em `falencia/falencia.ts`. Teste novo em `tests/game/falencia/limpeza-eliminacao.test.ts`; ajuste em `tests/game/economy/imunidade.test.ts`.

---

## Phase 2: Foundational

- [X] T001 Em `src/game/economy/types.ts`: `Immunity += granterId?: string`
- [X] T002 Em `src/game/economy/trade.ts`: `executeTrade` seta `granterId` ao conceder (`fromImmunities`→fromId; `toImmunities`→toId)

**Checkpoint**: imunidade carrega o concedente.

---

## Phase 3: User Story 1 - Eliminação limpa imunidades e efeitos (Priority: P1) 🎯 MVP

**Goal**: na eliminação, remover imunidades concedidas/recebidas pelo eliminado e tempEffects originados por ele; terceiros intactos.

**Independent Test**: ver `tests/game/falencia/limpeza-eliminacao.test.ts`.

### Tests for User Story 1 ⚠️

- [X] T003 [P] [US1] Vitest em `tests/game/falencia/limpeza-eliminacao.test.ts`: após `declareBankruptcy`, removidas as imunidades com `granterId`==eliminado e com `beneficiaryId`==eliminado, e os `tempEffects` com `ownerId`==eliminado; imunidade/efeito de terceiro intactos (SC-001/002/003)

### Implementation for User Story 1

- [X] T004 [US1] Em `src/game/falencia/falencia.ts`: em `declareBankruptcy`, após `eliminated=true`, `immunities = filter(granterId!=elim && beneficiaryId!=elim)` e `tempEffects = filter(ownerId!=elim)`

**Checkpoint**: §9.4 implementado.

---

## Phase 4: Polish

- [X] T005 Em `tests/game/economy/imunidade.test.ts`: a asserção do registro pós-troca passa a incluir `granterId`
- [X] T006 [P] `bunx vitest run tests/game` (suíte verde) + `bun run build` (exit 0)

---

## Dependencies & Execution Order

- T001 → T002 (trade usa o campo) → T004 (limpeza). T003 [P]. T005 ajusta o teste afetado. T006 fecha.

---

## Notes

- §9.4 literal: imunidades concedidas E recebidas canceladas. tempEffects do eliminado removidos (relógio órfão).
- Transferência de imunidade (§8.4) deferida.
- **`/speckit-implement` autorizado** para o pipeline desta feature.
