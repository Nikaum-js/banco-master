---
description: "Task list — Modais informativos: Free Parking & Aquisição Hostil sofrida (§12.2)"
---

# Tasks: Modais informativos (§12.2)

**Input**: Design documents from `/specs/030-modais-notificacao/`

**Prerequisites**: plan.md, spec.md, data-model.md, contracts/notice.md, quickstart.md

**Tests**: registro + dispensa por Vitest; modal validado por build + `bun run dev`.

## Path Conventions

`Notice` no `GameState` (turn/types.ts); registro em balancing/ofensivas; UI em `game/ui/NoticeLayer.tsx`. Testes em `tests/game/economy/notice.test.ts`.

---

## Phase 2: Foundational

- [X] T001 Em `src/game/turn/types.ts`: `export type Notice = { kind:'free-parking'; playerId:string; amount:number } | { kind:'hostile-takeover'; victimId:string; attackerId:string; pos:number }`; `GameState += notice: Notice | null`.
- [X] T002 Em `src/game/turn/turnMachine.ts`: `dismissNotice(state): GameState` (clona, `notice = null`).
- [X] T003 Em `src/game/store.ts`: seed `notice: null` no `createSeedState`; comando `dismissNotice` (`() => set((st)=>({ game: dismissNotice(st.game) }))`).

---

## Phase 3: User Story 1 - Free Parking coletado (Priority: P1) 🎯 MVP

- [X] T004 [US1] Em `src/game/balancing/balancing.ts`: `collectCenter` registra `state.notice = { kind:'free-parking', playerId, amount }` (amount = pote antes do reset). Coleta/reabastecimento inalterados.

## Phase 4: User Story 2 - Aquisição Hostil sofrida (Priority: P1)

- [X] T005 [US2] Em `src/game/cards/ofensivas.ts`: `acquire` registra, no sucesso, `state.notice = { kind:'hostile-takeover', victimId: owner, attackerId, pos }` (depois da transferência). Preço/transferência inalterados.

## Phase 5: Tests (US1+US2)

- [X] T006 [P] Em `tests/game/economy/notice.test.ts`: `collectCenter` seta free-parking (playerId+amount; pote volta à semente); `acquire` válido seta hostile-takeover (vítima/atacante/pos; título transferido); `acquire` inválido não seta; `dismissNotice` limpa (SC-001/002/003/004).

---

## Phase 6: UI

- [X] T007 Criar `src/game/ui/NoticeLayer.tsx` — lê `game.notice`; overlay com texto por variante (free-parking / hostile-takeover, nome da propriedade via BOARD) + botão "OK" → `dismissNotice()`.
- [X] T008 Em `src/App.tsx`: montar `NoticeLayer`.

---

## Phase 7: Polish

- [X] T009 [P] `bunx vitest run tests/game` (verde, inclui notice; 007/016 intactos) + `bun run build` (exit 0).
- [ ] T010 Validação visual no `bun run dev` (roteiro do quickstart).

---

## Dependencies & Execution Order

- T001 → T002 → T003 (fundação) → T004 / T005 (registro) → T006 (teste) → T007 → T008 (UI) → T009/T010 (polish).

## Notes

- **Evento autônomo** (`notice`), não `resolution` — não bloqueia o turno. Padrão de `pendingTrade`/`houseAuction`.
- **Mínimo hook**: só registro em `collectCenter`/`acquire`; 007/016 garantem não-regressão.
- **`/speckit-implement` autorizado** (usuário pediu), exceto acabamento visual (T010).
- **Deferido (M3)**: roteamento per-cliente das notificações.
