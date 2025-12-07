---
description: "Task list — Uso de Bus Tickets & espaço Bus Ticket"
---

# Tasks: Uso de Bus Tickets & espaço Bus Ticket

**Input**: Design documents from `/specs/009-bus-tickets/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/bus-ticket.md, quickstart.md

**Tests**: INCLUÍDOS — Vitest; funções puras (sem RNG: ticket não rola). SC-001…005 como asserções.

**Organization**: por user story (P1 uso / P2 espaço) + polish. Sem campos novos de estado — reusa `busTickets` (006) e o gating do turno (002).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: paralelizável · **[Story]**: US1/US2 (foundational/polish sem label)

## Path Conventions

Ajustes em `src/game/turn/turnMachine.ts` (helper `sideOf` + comando `useBusTicket`), `src/game/turn/resolution.ts` (handler `'bus-ticket'`), `src/game/store.ts` (comando), `src/game/ui/GameHUD.tsx` (controle). Testes em `tests/game/busticket/`.

---

## Phase 2: Foundational (Blocking Prerequisites)

- [X] T001 [P] Em `src/game/turn/turnMachine.ts`: helper puro `sideOf(pos): 0|1|2|3|null` (1–11→0, 13–23→1, 25–35→2, 37–47→3, cantos 0/12/24/36→null) — base da validação de destino

**Checkpoint**: a noção de "lado" existe e é testável isoladamente.

---

## Phase 3: User Story 1 - Usar um Bus Ticket no lugar de rolar (Priority: P1) 🎯 MVP

**Goal**: no estado `aguardando-rolagem`, fora de canto, com `busTickets ≥ 1`, escolher uma casa do mesmo lado e mover pra lá (gastando 1 ticket); resolve a casa de destino; sem re-rolagem.

**Independent Test**: dar 1 ticket a um jogador em `aguardando-rolagem` numa casa de lado; usar com dest válido → token em dest, contador −1, `casa-a-resolver`; tentativas inválidas não alteram nada.

### Tests for User Story 1 ⚠️

- [X] T002 [P] [US1] Vitest em `tests/game/busticket/busticket.test.ts`: `sideOf` (cada faixa + cantos→null); `useBusTicket` válido (pos→dest mesmo lado, `busTickets−1`, `casa-a-resolver`, `mayRollAgain=false`); rejeições (sem ticket, fora da vez/estado, sobre canto, dest fora do lado, dest=pos) deixam o estado inalterado; após resolver a casa, `finalizeTurn` passa a vez sem re-rolagem (SC-001/002/005)
- [X] T003 [P] [US1] Vitest no mesmo arquivo: dest = propriedade livre → abre `resolution.kind==='purchase'` (reuso 003); crédito de GO ao escolher casa "atrás" no lado 37–47 (ex.: pos 45 → dest 38 cruza o GO, `onPassGo` creditado) (SC-003)

### Implementation for User Story 1

- [X] T004 [US1] Em `src/game/turn/turnMachine.ts`: exportar `useBusTicket(state, dest, ctx)` — guards (paused; `state==='aguardando-rolagem'`; `busTickets≥1`; `sideOf(pos)!==null`; `dest` válido: mesmo lado e `≠pos`); clona; `busTickets−=1`; `advance(s,player,(dest-pos+48)%48,ctx.ports)`; `land(turn,player,null)`; `finishIfEnded(s,ctx)`
- [X] T005 [US1] Em `src/game/store.ts`: importar `useBusTicket`; adicionar `useBusTicket(dest: number): void` à interface `GameStore` e a impl `useBusTicket: (dest) => set((st) => ({ game: useBusTicket(st.game, dest, st.ctx) }))`

**Checkpoint**: o ticket move o jogador pelo lado e a casa de destino resolve pelo fluxo existente.

---

## Phase 4: User Story 2 - Parar no espaço Bus Ticket concede um ticket (Priority: P2)

**Goal**: parar na casa `bus-ticket` (pos 10) credita +1 ao contador; passar não credita.

**Independent Test**: posicionar para parar em pos 10 e resolver → `busTickets+1`, casa resolvida sem interação econômica.

### Tests for User Story 2 ⚠️

- [X] T006 [P] [US2] Vitest em `tests/game/busticket/busticket.test.ts`: resolver a casa `bus-ticket` (pos 10) → `busTickets+=1` e `{done:true}` (turno finalizável); confirmar que nenhuma `resolution` econômica é aberta (SC-004)

### Implementation for User Story 2

- [X] T007 [US2] Em `src/game/turn/resolution.ts`: trocar o handler `'bus-ticket'` de `stub` para `({ state, playerId }) => { const p = state.players.find((x) => x.id === playerId); if (p) p.busTickets += 1; return { done: true } }`

**Checkpoint**: a segunda fonte de tickets (espaço) funciona; passar sem parar não credita (consequência do fluxo do turno).

---

## Phase 5: Integração & Polish

- [X] T008 Em `src/game/ui/GameHUD.tsx`: controle **"Usar Bus Ticket (N)"** — habilitado só quando jogador da vez em `aguardando-rolagem`, `sideOf(pos)!==null` e `busTickets≥1`; ao armar, lista as casas válidas do lado (pos + nome do `BOARD`) como botões; clique → `useBusTicket(dest)` (estado local do componente para o seletor)
- [X] T009 [P] Rodar `npx vitest run tests/game`: SC-001…005 verdes **e** zero regressão em 002–008 (atenção: handler `'bus-ticket'` não é mais no-op); round-trip JSON do estado após uso do ticket
- [X] T010 [P] `npm run build` verde (tsc -b + vite)

---

## Dependencies & Execution Order

- **Foundational (T001 `sideOf`)** bloqueia US1 (validação de destino).
- **US1 (P3)**: comando de uso (depende de `sideOf`). **US2 (P4)**: handler do espaço — **independente** de US1 (arquivo diferente; pode ir em paralelo após T001).
- **Polish (P5)**: HUD (depende do comando do store, T005) + suíte + build.

### Parallel Opportunities

- T002/T003 (testes US1) e T006 (teste US2) podem ser escritos em paralelo.
- US2 (T007, `resolution.ts`) é independente de US1 (`turnMachine.ts`/`store.ts`) — arquivos distintos.
- ⚠️ T001 e T004 tocam o mesmo arquivo (`turnMachine.ts`) — sequenciais.

---

## Implementation Strategy

### MVP First (US1)

1. Foundational (`sideOf`) → US1 (comando `useBusTicket` + store) → **VALIDAR** (SC-001/002/003/005).

### Incremental Delivery

1. `sideOf` → 2. US1 (uso) → 3. US2 (espaço, +1) → 4. HUD + suíte + build.

---

## Notes

- O destino é **parâmetro** do comando (UI escolhe antes), análogo a `chooseTripleDest(pos)` — **sem** novo slice de `resolution`.
- Reuso total: `advance`/`land`/`finishIfEnded` (002), `onPassGo` (007), resolução de casa (002/003/006).
- Simplificação documentada (research R6): utilidade alcançada por ticket cobra **$0** (`diceValue(null)===0`), pois não houve rolagem — raro; revisitar se virar problema de balanceamento.
- Fora de escopo: negociação de tickets (proibida, D-012); face Ônibus do Speed Die (já no 002).
- **`/speckit-implement` autorizado** para o pipeline desta feature.
