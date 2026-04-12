---
description: "Task list — UI de construção e hipoteca (M2)"
---

# Tasks: UI de construção e hipoteca (M2)

**Input**: Design documents from `/specs/023-construcao-hipoteca-ui/`

**Prerequisites**: plan.md, spec.md, data-model.md, contracts/deedView.md, quickstart.md

**Tests**: `deedView` + predicados cobertos por Vitest; o refactor de predicados é validado pela suíte existente 004/005/011 (não pode quebrar). Popovers validados por build + `bun run dev`.

## Format: `[ID] [P?] [Story] Description`

## Path Conventions

Predicados em `src/game/economy/construction.ts` e `mortgage.ts`; `deedView` em `src/game/ui/deed/deedView.ts`; popovers e marcas em `src/boards/shared.tsx`. Teste em `tests/game/ui/deedView.test.ts`.

---

## Phase 1: Setup

- [X] T001 Criar a pasta `src/game/ui/deed/`.

---

## Phase 2: Foundational

- [X] T002 [P] Em `src/game/economy/construction.ts`: extrair `canBuildHouse`/`canSellBuilding`/`canBuildHangar`/`canSellHangar` (puros, encapsulando as guardas atuais conforme contrato) e fazer `buildHouse`/`sellBuilding`/`buildHangar`/`sellHangar` **delegarem** (`if (!canX(state,pos)) return state`) — sem mudança de comportamento.
- [X] T003 [P] Em `src/game/economy/mortgage.ts`: extrair `canMortgage`/`canUnmortgage` e fazer `mortgageProperty`/`unmortgageProperty` delegarem — sem mudança de comportamento.
- [X] T004 Em `src/game/ui/deed/deedView.ts`: tipos `DeedFlags`/`BuildBlock`/`DeedView` + `deedView(game, pos): DeedView | null` (dados reais + flags via os predicados; `ownedByActive`; `buildBlock` com o motivo do bloqueio; `null` se não for property/airport/utility).
- [X] T005 Rodar `bunx vitest run tests/game` para confirmar que a suíte **004/005/011 segue verde** após o refactor (gate do refactor).

**Checkpoint**: predicados + `deedView` prontos; refactor provado não-quebrador.

---

## Phase 3: User Story 1 - Construir e vender (Priority: P1) 🎯 MVP

### Tests for User Story 1 ⚠️

- [X] T006 [P] [US1] Em `tests/game/ui/deedView.test.ts`: cenários de construir (habilitado; bloqueado por uniformidade/estoque/grupo-incompleto/caixa com `buildBlock` correto) e vender (`podeVender` na de maior nível); propriedade de terceiro/livre → flags todas `false` (SC-002/SC-004/SC-005).

### Implementation for User Story 1

- [X] T007 [US1] Em `src/boards/shared.tsx`: `PropertyPopover` consome `deedView(game,pos)` (dono/nível/hipotecada/aluguéis **reais**, substituindo MOCK) e exibe, quando `ownedByActive`, "Construir" (`buildHouse`) e "Vender" (`sellBuilding`) — desabilitadas conforme as flags, com dica do `buildBlock`.
- [X] T008 [US1] Em `src/boards/shared.tsx`: `BuildingMark` lê `useGameStore(s => s.game.titles[pos])` (casas/hotel/2º hotel/arranha-céu) em vez de `MOCK_BUILDINGS`.

**Checkpoint**: construir/vender pelo popover, refletindo no tabuleiro.

---

## Phase 4: User Story 2 - Hipotecar e deshipotecar (Priority: P2)

### Tests for User Story 2 ⚠️

- [X] T009 [P] [US2] Em `tests/game/ui/deedView.test.ts`: hipotecar bloqueado por construção no grupo; deshipotecar bloqueado sem caixa / habilitado com caixa (SC-005).

### Implementation for User Story 2

- [X] T010 [US2] Em `src/boards/shared.tsx`: `PropertyPopover`/`AirportPopover`/`UtilityPopover` exibem "Hipotecar" (`mortgageProperty`) e "Deshipotecar" (`unmortgageProperty`) quando `ownedByActive`, conforme `podeHipotecar`/`podeDeshipotecar`; `AirportPopover`/`UtilityPopover` passam a usar dados reais via `deedView`.
- [X] T011 [US2] Em `src/boards/shared.tsx`: `MortgageMark` lê `game.titles[pos].mortgaged` em vez de `MOCK_MORTGAGED`.

**Checkpoint**: hipoteca/deshipoteca pelo popover, marca no tabuleiro.

---

## Phase 5: User Story 3 - Hangar (Priority: P3)

### Tests for User Story 3 ⚠️

- [X] T012 [P] [US3] Em `tests/game/ui/deedView.test.ts`: aeroporto próprio sem hangar → `podeConstruirHangar`; com hangar → `podeVenderHangar` (SC-005).

### Implementation for User Story 3

- [X] T013 [US3] Em `src/boards/shared.tsx`: `AirportPopover` exibe "Construir Hangar" (`buildHangar`) / "Vender Hangar" (`sellHangar`) quando `ownedByActive`, conforme as flags.

**Checkpoint**: hangar gerenciável; todas as ações de gestão pelo tabuleiro.

---

## Phase 6: Polish

- [X] T014 [P] `bunx vitest run tests/game` (verde, inclui `deedView` + 004/005/011) + `bun run build` (exit 0).
- [ ] T015 Validação visual no `bun run dev` (roteiro do quickstart) — construir/vender/hipotecar/hangar e ausência de ações em propriedade de terceiro/livre.

---

## Dependencies & Execution Order

- T001 → T002/T003 (predicados, [P]) → T004 (`deedView`) → T005 (gate refactor) → US1 (T006–T008) → US2 (T009–T011) → US3 (T012–T013) → Polish (T014–T015).
- `shared.tsx` é tocado por T007/T008/T010/T011/T013 (mesmo arquivo → sequencial). `deedView.test.ts` acumula casos (T006/T009/T012).

### Parallel Opportunities

- T002 e T003 são [P] (arquivos distintos). Os testes de `deedView` ([P] em conteúdo) vivem no mesmo arquivo → incrementais. A independência real é por user story (cada uma adiciona um conjunto de ações + sua cobertura).

---

## Notes

- **Regra numa fonte só**: os predicados ficam no motor; UI e comandos os reusam. O refactor não muda comportamento — T005 é o gate que prova isso (004/005/011 verdes).
- **Gating por turno**: flags só ligam para o jogador da vez (motor gateia por `activePlayer`); terceiro/livre → popover informativo.
- **Diferido**: gatilho do leilão por escassez (construir sem estoque fica desabilitado), trade, painel-lista "Minhas propriedades".
- **`/speckit-implement` autorizado** para o pipeline desta feature, **exceto** o acabamento visual (T015), que você valida no `bun run dev`.
