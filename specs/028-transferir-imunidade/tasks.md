---
description: "Task list — Transferência de imunidade existente (§8.4)"
---

# Tasks: Transferência de imunidade existente (§8.4)

**Input**: Design documents from `/specs/028-transferir-imunidade/`

**Prerequisites**: plan.md, spec.md, data-model.md, contracts/transferencia.md, quickstart.md

**Tests**: validação + re-atribuição por Vitest; compositor validado por build + `bun run dev`.

## Format: `[ID] [P?] [Story] Description`

## Path Conventions

Tipos em `economy/types.ts`; regra em `economy/trade.ts`; UI em `ui/trade/TradeLayer.tsx`. Testes em `tests/game/economy/negociacao-ui.test.ts`.

---

## Phase 2: Foundational

- [X] T001 Em `src/game/economy/types.ts`: `Trade += fromImmunityTransfers?: number[]` e `toImmunityTransfers?: number[]`.

---

## Phase 3: User Story 1 - Transferir no motor (Priority: P1) 🎯 MVP

### Tests for User Story 1 ⚠️

- [X] T002 [P] [US1] Em `tests/game/economy/negociacao-ui.test.ts` (+casos): `validateTrade` com `fromImmunityTransfers:[X]` → true se `from` é beneficiário de X, false se não; `executeTrade` (via proposeTrade+acceptTrade) re-atribui o beneficiário (recebedor passa a ter `hasImmunity`, ofertante deixa de ter), preservando `lapsRemaining` (incl. permanente `null`); transferir + conceder nova juntos → ambos aplicados (SC-001/002/005).

### Implementation for User Story 1

- [X] T003 [US1] Em `src/game/economy/trade.ts`: `validImmunityTransfers(state, transfers, beneficiaryId)` = `(transfers ?? []).every(pos => hasImmunity(state, beneficiaryId, pos))` (import `hasImmunity` de `./imunidade`); `validateTrade` chama p/ `fromImmunityTransfers`(fromId) e `toImmunityTransfers`(toId).
- [X] T004 [US1] Em `src/game/economy/trade.ts`: `executeTrade` — antes de empurrar as concessões novas, para cada `pos` em `fromImmunityTransfers` achar `s.immunities.find(i => i.beneficiaryId === fromId && i.pos === pos)` e setar `beneficiaryId = toId`; idem `toImmunityTransfers` (to→from). Preserva `lapsRemaining`/`granterId`. Concessão de novas inalterada.

**Checkpoint**: transferência válida re-atribui; inválida rejeitada; 013/014/024 verdes.

---

## Phase 4: User Story 2 - Compositor expõe transferência (Priority: P2)

### Implementation for User Story 2

- [X] T005 [US2] Em `src/game/ui/trade/TradeLayer.tsx`: no `Side` do compositor, seção "Transferir imunidade" — lista `game.immunities` onde `beneficiaryId === <lado>` (posições por nome) e marca/desmarca; o lado "ofereço" alimenta `fromImmunityTransfers`, o lado "o outro dá" alimenta `toImmunityTransfers`. No modal recebido, listar as transferências (🛡️ "transfere {propriedade}").

**Checkpoint**: dá pra transferir imunidade pelo compositor.

---

## Phase 5: Polish

- [X] T006 [P] `bunx vitest run tests/game` (verde, inclui transferência; 013/014/024 intactos) + `bun run build` (exit 0).
- [ ] T007 Validação visual no `bun run dev` (roteiro do quickstart): transferir imunidade própria → outro fica isento, eu volto a pagar; conceder novas segue OK.

---

## Dependencies & Execution Order

- T001 → T002 (teste) → T003 → T004 (motor) → T005 (UI) → T006/T007 (polish).
- `trade.ts` tocado por T003/T004 (sequencial). `TradeLayer.tsx` por T005.

### Parallel Opportunities

- Pouca (arquivos compartilhados). US1 (motor) é o MVP; US2 (UI) adiciona em cima.

---

## Notes

- **Reusa `hasImmunity` (014)** p/ validar; re-atribui só `beneficiaryId` (preserva voltas + `granterId`).
- **Coexiste** com a concessão de novas (inalterada). T002 garante 013/014/024 verdes.
- **§9.4 (019)**: `granterId` preservado.
- **`/speckit-implement` autorizado**, exceto acabamento visual (T007).
