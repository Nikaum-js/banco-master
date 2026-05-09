---
description: "Task list — Painel Trades ao vivo (M2)"
---

# Tasks: Painel Trades ao vivo (M2)

**Input**: Design documents from `/specs/027-trades-ao-vivo/`

**Prerequisites**: plan.md, spec.md, data-model.md, contracts/tradesView.md, quickstart.md

**Tests**: `tradesView` + registro no `acceptTrade` por Vitest; painel validado por build + `bun run dev`.

## Format: `[ID] [P?] [Story] Description`

## Path Conventions

Campo em `turn/types.ts`; registro em `economy/trade.ts`; seed em `store.ts`; seletor novo em `ui/trade/tradesView.ts`; painel em `boards/shared.tsx`. Testes em `tests/game/ui/tradesView.test.ts` + `tests/game/economy/negociacao-ui.test.ts`.

---

## Phase 2: Foundational

- [X] T001 Em `src/game/turn/types.ts`: `GameState += tradeHistory: Trade[]` (import de `economy/types`). Em `src/game/store.ts`: seed `tradeHistory: []`.
- [X] T002 Em `src/game/economy/trade.ts`: `acceptTrade` — após `executeTrade`, `s.tradeHistory = [...s.tradeHistory, trade].slice(-12)` e `logEvent(s, trade.fromId, \`${trade.fromId} ↔ ${trade.toId}: troca aceita\`)` antes de limpar `pendingTrade`. `executeTrade` e `rejectTrade` inalterados (rejectTrade não registra).
- [X] T003 Em `src/game/ui/trade/tradesView.ts`: `TradesView` + `tradesView(game)` → `{ pending: game.pendingTrade, history: [...game.tradeHistory].reverse() }` (puro).

**Checkpoint**: registro das aceitas + seletor prontos.

---

## Phase 3: User Story 1 - Painel real (Priority: P1) 🎯 MVP

### Tests for User Story 1 ⚠️

- [X] T004 [P] [US1] Em `tests/game/ui/tradesView.test.ts`: vazio → `{ pending:null, history:[] }`; com `pendingTrade` → `pending` é ele; `history` reflete `tradeHistory` em ordem reversa (SC-001).
- [X] T005 [P] [US1] Em `tests/game/economy/negociacao-ui.test.ts` (+casos): `acceptTrade` válido → 1 item em `tradeHistory` + 1 entrada no `log` com os 2 ids + `pendingTrade` nulo; `rejectTrade` → histórico/log sem troca; histórico bounded (>12 → mantém 12) (SC-002/004/005).

### Implementation for User Story 1

- [X] T006 [US1] Em `src/boards/shared.tsx`: o painel "Trades" (no `PlayersPanel`) consome `tradesView(useGameStore(...))` — linha **ativa** para `pending` (de→para + resumo: nº props / $ / nº imunidades nos 2 sentidos), linhas **concluídas** para `history` (opacas); contador "N ativos" = `pending ? 1 : 0`; "+ Nova proposta" → `useTradeUI.show()`.
- [X] T007 [US1] Em `src/boards/shared.tsx`: remover `MOCK_TRADES` e o tipo `Trade`/`TradeStatus` mock; reescrever `TradeRow` para o `Trade` real (ids + resumo, cor por assento via `PLAYER_COLORS`); remover `playerByName` se ficar órfão.

**Checkpoint**: painel Trades ao vivo (pendente + histórico); 0 mock.

---

## Phase 4: Polish

- [X] T008 [P] `bunx vitest run tests/game` (verde, inclui tradesView + registro; 013/024 intactos) + `bun run build` (exit 0).
- [ ] T009 Validação visual no `bun run dev` (roteiro do quickstart): vazio → proposta ativa → aceitar (histórico+log) / recusar (não registra); "+ Nova proposta".

---

## Dependencies & Execution Order

- T001 → T002 → T003 (foundational) → T004/T005 (testes) → T006 → T007 (UI) → T008/T009 (polish).
- `shared.tsx` tocado por T006/T007 (sequencial). Testes T004/T005 [P] (arquivos distintos).

### Parallel Opportunities

- T004/T005 [P]. Implementação UI sequencial (mesmo arquivo).

---

## Notes

- **Regra de troca intacta**: `executeTrade` não muda; só o registro (histórico + log) é novo. T005 garante 013/024 verdes.
- **Bounded (VII)**: `tradeHistory` mantém só as ~12 últimas.
- **Privacidade (VI)**: trade não tem cartas; painel mostra propriedades/dinheiro/imunidades.
- **Diferido**: histórico de recusadas; persistência entre sessões; detalhe item-a-item no painel.
- **`/speckit-implement` autorizado**, exceto acabamento visual (T009).
