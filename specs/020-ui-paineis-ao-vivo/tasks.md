---
description: "Task list — UI painéis ao vivo (M2 fatia 1)"
---

# Tasks: UI jogável (M2) — painéis laterais ao vivo

**Input**: Design documents from `/specs/020-ui-paineis-ao-vivo/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ui.md, quickstart.md

**Tests**: `playersView` (puro) em Vitest; UI validada por build + `bun run dev` (sem RTL).

## Format: `[ID] [P?] [Story] Description`

## Path Conventions

`src/boards/shared.tsx` (mapeamento + rewire dos painéis). Teste em `tests/game/ui/playersView.test.ts`.

---

## Phase 2: Foundational

- [X] T001 Em `src/boards/shared.tsx`: `PLAYER_COLORS` (8 cores por assento) + `playersView(game): Player[]` (puro, mapeia `GameState`→view-model) + hook `useLivePlayers()` (= `playersView(useGameStore(s=>s.game))`); imports de `@/game/store`, `@/game/turn/types`, `@/game/balancing/balancing`

**Checkpoint**: mapeamento puro + hook prontos.

---

## Phase 3: User Story 1 - Painel de jogadores ao vivo (Priority: P1) 🎯 MVP

- [X] T002 [P] [US1] Vitest em `tests/game/ui/playersView.test.ts`: `playersView(createSeedState([...]))` mapeia caixa/mão/Bus Tickets/pos; `active` segue o jogador da vez; `bankrupt`=eliminated; `loanActive`/`immune` derivados; cor por assento
- [X] T003 [US1] Em `src/boards/shared.tsx`: `PlayersPanel` usa `useLivePlayers()` (contador "N/8" e `PlayerRow`); Histórico segue MOCK

**Checkpoint**: lista de jogadores reflete o estado real.

---

## Phase 4: User Story 2 - Cabeçalho do turno ao vivo (Priority: P2)

- [X] T004 [US2] Em `src/boards/shared.tsx`: `ActionsPanel` seção "Turno" — ativo real (nome/cor/cartas/Bus Tickets), Próx. GO = `goBonus(game, activeId)`, pote = `game.centerPot`; Trades segue MOCK

**Checkpoint**: cabeçalho do turno reflete o ativo real.

---

## Phase 5: Polish

- [X] T005 [P] `bunx vitest run tests/game` (playersView + motor verdes) + `bun run build` (exit 0); conferir visual no `bun run dev`

---

## Dependencies & Execution Order

- T001 → T003/T004 (consomem o hook). T002 [P]. T005 fecha.

---

## Notes

- Reuso visual total (sem novo design); só troca a fonte (MOCK → store).
- Privacidade: painel mostra só o **contador** de mão.
- Log de eventos e Trades seguem MOCK (próximas fatias do M2).
- Nome=id, cor por assento até o Lobby (M3).
- **`/speckit-implement` autorizado** para o pipeline desta feature.
