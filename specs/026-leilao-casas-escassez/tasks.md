---
description: "Task list — Leilão de casas em escassez (M2)"
---

# Tasks: Leilão de casas em escassez (M2)

**Input**: Design documents from `/specs/026-leilao-casas-escassez/`

**Prerequisites**: plan.md, spec.md, data-model.md, contracts/houseAuction.md, quickstart.md

**Tests**: reducers do campo `houseAuction` por Vitest; modal validado por build + `bun run dev`.

## Format: `[ID] [P?] [Story] Description`

## Path Conventions

Campo em `turn/types.ts`; reducers em `economy/houseAuction.ts`; store em `store.ts`; remoções em `economy/types.ts`/`ui/modals/activeModal.ts`/`ModalLayer.tsx`; modal novo em `ui/houseAuction/HouseAuctionLayer.tsx`; botão em `boards/shared.tsx`; montagem em `App.tsx`. Testes em `tests/game/economy/houseAuction.test.ts` + `tests/game/ui/activeModal.test.ts`.

---

## Phase 2: Foundational (refactor → evento autônomo)

- [X] T001 Em `src/game/economy/types.ts`: remover `{ kind: 'house-auction'; auction: HouseAuction }` da `ResolutionSlice` (manter o tipo `HouseAuction`).
- [X] T002 Em `src/game/turn/types.ts`: `GameState += houseAuction: HouseAuction | null`. Em `src/game/store.ts`: seed `houseAuction: null`.
- [X] T003 Em `src/game/economy/houseAuction.ts`: refatorar `openHouseAuction(state, housesAvailable, bidders)` / `placeHouseBid(state, playerId, amount)` / `closeHouseAuction(state)` para operar em `state.houseAuction` (regras do contrato); `close` transfere casas/lance e limpa o campo **sem** tocar no turno; **remover** `declareBuildInterest`.
- [X] T004 Em `src/game/store.ts`: comandos `openHouseAuction(housesAvailable, bidders)` / `placeHouseBid(playerId, amount)` / `closeHouseAuction()` (assinaturas sem `now`); remover `declareBuildInterest`; `rearmAuction` deixa de tratar `house-auction` (só `auction`).
- [X] T005 Em `src/game/ui/modals/activeModal.ts`: remover a variante `house-auction` do `ModalView` e do switch. Em `src/game/ui/modals/ModalLayer.tsx`: `AuctionCard` passa a tratar só `auction` (remove o ramo house-auction).

**Checkpoint**: leilão de casas é evento autônomo no estado; código morto removido.

---

## Phase 3: User Story 1 - Abrir / lance / encerrar (Priority: P1) 🎯 MVP

### Tests for User Story 1 ⚠️

- [X] T006 [P] [US1] Reescrever `tests/game/economy/houseAuction.test.ts` para a API de campo: `openHouseAuction` seta o campo (no-op se já aberto); `placeHouseBid` válido atualiza, rejeita ≤ atual / > caixa / não-participante; `closeHouseAuction` com vencedor (paga + `bank.houses` cai + campo limpo) e sem lance (limpa, banco intacto); abrir/fechar **não** mexem em `turn`/`resolution` (SC-002/003/004/005).
- [X] T007 [P] [US1] Em `tests/game/ui/activeModal.test.ts`: remover o caso `house-auction` (não é mais resolução).

### Implementation for User Story 1

- [X] T008 [US1] Em `src/game/ui/houseAuction/HouseAuctionLayer.tsx`: modal dedicado (lê `game.houseAuction`; null → não renderiza) — casas em jogo, lance atual, maior licitante; `<select>` de licitante (não-eliminados) + valor (default `currentBid+50`) + "Dar lance" (`placeHouseBid`) + "Encerrar" (`closeHouseAuction`). Reusa o estilo de cartão central.
- [X] T009 [US1] Em `src/boards/shared.tsx`: botão "🏘 Leilão de casas" no `PlayersPanel`, habilitado quando `bank.houses ≥ 1` ∧ não-eliminados ≥ 2 ∧ `houseAuction === null` → `openHouseAuction(bank.houses, idsNãoEliminados)`. Em `src/App.tsx`: montar `<HouseAuctionLayer/>`.

**Checkpoint**: abrir leilão pelo botão, dar lances, encerrar — vencedor leva as casas; turno intacto.

---

## Phase 4: Polish

- [X] T010 [P] `bunx vitest run tests/game` (verde) + `bun run build` (exit 0).
- [ ] T011 Validação visual no `bun run dev` (roteiro do quickstart): abrir/lance/encerrar; gatilho desabilitado sem casas / <2 jogadores / leilão aberto; turno inalterado.

---

## Dependencies & Execution Order

- T001 → T002 → T003 → T004 → T005 (refactor) → T006/T007 (testes) → T008 → T009 (UI) → T010/T011 (polish).
- Refactor toca `types.ts`/`houseAuction.ts`/`store.ts`/`activeModal.ts`/`ModalLayer.tsx` (sequencial onde compartilham arquivo).

### Parallel Opportunities

- T006/T007 [P] (arquivos de teste distintos). Implementação é majoritariamente sequencial.

---

## Notes

- **Evento autônomo (não resolução)**: abrir/fechar não chamam `completeResolution` → turno intacto. Espelha `pendingTrade` (024).
- **Sem timer**: fecho manual; `deadline` do tipo é ignorado.
- **Remoção de código morto**: `house-auction` da resolução nunca foi acionado em jogo — sem regressão.
- **Diferido**: auto-disparo por demanda simultânea (M3); colocação física das casas; declarar interesse dinâmico; timer.
- **`/speckit-implement` autorizado**, exceto acabamento visual (T011).
