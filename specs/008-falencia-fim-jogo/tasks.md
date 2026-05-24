---
description: "Task list — Falência & Fim de jogo"
---

# Tasks: Falência & Fim de jogo

**Input**: Design documents from `/specs/008-falencia-fim-jogo/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/falencia.md, quickstart.md

**Tests**: INCLUÍDOS — Vitest; funções puras. SC-001…004 como asserções.

**Organization**: por user story (P1/P2) + integração. Fecha o ciclo econômico (dívida → pagar/falir) e o fim de jogo.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: paralelizável · **[Story]**: US1/US2 (foundational/polish sem label)

## Path Conventions

Novo `src/game/falencia/falencia.ts` + variante em `economy/types.ts`; ajustes em `economy/resolveRentable.ts`, `turn/resolution.ts`, `store.ts`, `ui/GameHUD.tsx`. Testes em `tests/game/falencia/`.

---

## Phase 2: Foundational (Blocking Prerequisites)

- [X] T001 [P] Em `src/game/economy/types.ts`: `ResolutionSlice += { kind: 'debt'; amount: number; creditorId: string | null }`
- [X] T002 Em `src/game/falencia/falencia.ts`: `liquidationValue(state, id)` (caixa + construções/2 + hipoteca das livres), `isBankrupt(state, id, debt)`, `payDebt(state)` (paga se cobrir → credor/pote, `completeResolution`), `declareBankruptcy(state, ctx)` (§9.2 + `eliminated` + `checkEndGame` + `advanceSeat`), `checkEndGame(state)` (1 não-eliminado → `phase='ended'`) — puras; reusa `buildCost` (004), `mortgageValue` (005)

**Checkpoint**: variante de dívida e a lógica de falência prontas.

---

## Phase 3: User Story 1 - Falir e transferir os ativos (Priority: P1) 🎯 MVP

**Goal**: dívida sem caixa bloqueia o turno; pagar (após liquidar) ou falir transfere ativos (§9.2) e elimina.

**Independent Test**: pôr dívida > liquidação total → falir → ativos ao destino certo + eliminado; quem cobre liquidando paga e não fale.

### Tests for User Story 1 ⚠️

- [X] T003 [P] [US1] Vitest em `tests/game/falencia/falencia.test.ts`: `isBankrupt` (liquidação < dívida); `declareBankruptcy` devendo a jogador (props+caixa ao credor) e ao banco (props→banco), devedor `eliminated`; construções voltam ao estoque (SC-001/002/003)

### Implementation for User Story 1

- [X] T004 [US1] Em `src/game/economy/resolveRentable.ts`: aluguel com `payer.cash < amount` → abrir `resolution = { kind:'debt', amount, creditorId: owner }` e `{ done:false }` (em vez de `onInsolvency`)
- [X] T005 [US1] Em `src/game/turn/resolution.ts` (handler `tax`): `cash < amount` → abrir `resolution = { kind:'debt', amount, creditorId: null }`, `{ done:false }` (sem debitar ainda)
- [X] T006 [US1] Em `src/game/store.ts`: comandos `payDebt()` e `declareBankruptcy()` (guarda de `resolution.kind==='debt'`)
- [X] T007 [US1] Atualizar o teste legado de insolvência em `tests/game/economy/rent.test.ts` (era `onInsolvency`; agora aluguel sem caixa abre `resolution.kind==='debt'`)

**Checkpoint**: dívida resolve por pagamento (após liquidar) ou falência.

---

## Phase 4: User Story 2 - Fim de jogo (Priority: P2)

**Goal**: 1 jogador não-eliminado → `phase='ended'`, vencedor.

**Independent Test**: eliminar até sobrar um → `phase='ended'` com o vencedor; com ≥2, continua.

### Tests for User Story 2 ⚠️

- [X] T008 [P] [US2] Vitest em `tests/game/falencia/falencia.test.ts`: `checkEndGame` — 1 não-eliminado → `phase='ended'`; ≥2 → `'playing'` (SC-004)

### Implementation for User Story 2

> `checkEndGame` já implementada em T002 e chamada por `declareBankruptcy`; esta story valida o estado terminal.

**Checkpoint**: a partida termina com vencedor.

---

## Phase 5: Integração & Polish

- [X] T009 Em `src/game/ui/GameHUD.tsx`: estado de **dívida** (mostra valor/credor + botões **Pagar** / **Falir**) e **fim de jogo** (banner do vencedor quando `phase==='ended'`)
- [X] T010 [P] Rodar `npx vitest run tests/game`: SC-001…004 verdes **e** zero regressão em 002–007 (atenção ao novo fluxo de aluguel/imposto sem caixa); round-trip JSON com a variante `debt`
- [X] T011 [P] `npm run build` verde

---

## Dependencies & Execution Order

- **Foundational (P2)** bloqueia tudo (variante `debt` + `falencia.ts`).
- **US1 (P3)**: dívida + pagar/falir. **US2 (P4)**: fim de jogo (lógica já em T002; só valida).
- **Polish (P5)**: HUD + suíte + build.

### Parallel Opportunities

- P2: T001 (types) e a esqueleto de T002 podem andar juntos.
- ⚠️ `resolveRentable.ts` (T004), `resolution.ts` (T005), `store.ts` (T006) e `GameHUD.tsx` (T009) sequenciais por arquivo.

---

## Implementation Strategy

### MVP First (US1)

1. Foundational → US1 (dívida/pagar/falir) → **VALIDAR** (SC-001/002/003).

### Incremental Delivery

1. Fundação → 2. US1 (falência) → 3. US2 (fim de jogo) → 4. HUD + suíte.

---

## Notes

- A dívida é uma **resolução pendente** — reusa o gating do turno (não finaliza com `resolution !== null`).
- Liquidar = comandos existentes (`sellBuilding` 004 / `mortgageProperty` 005) + `payDebt`.
- Fora de escopo: §9.3 (empréstimo), imunidades (no-op), leilão-em-cascata dos bens da dívida-ao-banco (simplificado p/ retorno ao banco).
- **`/speckit-implement` autorizado** para o pipeline desta feature.
