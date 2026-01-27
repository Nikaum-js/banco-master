---
description: "Task list — Log de eventos real (M2)"
---

# Tasks: Log de eventos real (M2)

**Input**: Design documents from `/specs/021-log-eventos/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/log.md, quickstart.md

**Tests**: emissor coberto por Vitest; painel validado por build + `bun run dev`.

## Format: `[ID] [P?] [Story] Description`

## Path Conventions

`LogEntry` em `economy/types.ts`; `log` em `turn/types.ts`; `src/game/log.ts` (novo); emissão em turnMachine/purchase/resolveRentable/resolution/falencia/draw; seed no store; Histórico em `boards/shared.tsx`. Teste em `tests/game/log.test.ts`.

---

## Phase 2: Foundational

- [X] T001 [P] Em `src/game/economy/types.ts`: `LogEntry { who; what }`
- [X] T002 [P] Em `src/game/turn/types.ts`: `GameState += log: LogEntry[]`
- [X] T003 Em `src/game/store.ts`: `createSeedState` define `log: []`
- [X] T004 Em `src/game/log.ts`: `logEvent(state, who, what)` (push + bound 50) — leaf

**Checkpoint**: estado + helper prontos.

---

## Phase 3: User Story 1 - Eventos do núcleo + Histórico real (Priority: P1) 🎯 MVP

### Tests for User Story 1 ⚠️

- [X] T005 [P] [US1] Vitest em `tests/game/log.test.ts`: cada ação emite a entrada esperada (rolar/GO/compra/aluguel/imposto/payDebt/falência/saque); saque mostra só o deck; `log` nunca > 50 (SC-001/002/003)

### Implementation for User Story 1

- [X] T006 [US1] `turnMachine.ts`: `rollDice` loga "rolou a+b(+speed)"; `advance` loga "passou pelo GO (+$bônus)" quando cruza
- [X] T007 [US1] `economy/purchase.ts`: `buyProperty` loga "comprou {nome} por ${preço}"
- [X] T008 [US1] `economy/resolveRentable.ts`: aluguel pago loga "pagou ${valor} de aluguel a {dono}"
- [X] T009 [US1] `turn/resolution.ts`: handler `tax` (pago) loga "pagou ${valor} de imposto"
- [X] T010 [US1] `falencia/falencia.ts`: `payDebt` loga "pagou dívida ${valor}"; `declareBankruptcy` loga "faliu"
- [X] T011 [US1] `cards/draw.ts`: `cardResolve` loga "sacou {Acaso|Tesouro}" (só o deck)
- [X] T012 [US1] `boards/shared.tsx`: Histórico consome `[...game.log].reverse()` (substitui MOCK; sem coluna "when")

**Checkpoint**: log real do núcleo + painel ao vivo.

---

## Phase 4: Polish

- [X] T013 [P] `bunx vitest run tests/game` (verde) + `bun run build` (exit 0); conferir Histórico no `bun run dev`

---

## Dependencies & Execution Order

- T001–T004 (estado+helper) → T006–T011 (emissões) → T012 (painel). T005 [P]. T013 fecha.

### Parallel Opportunities

- T001/T002 [P]; emissões em arquivos distintos podem ir juntas (mesmo helper).

---

## Notes

- Sem "when" (motor determinístico; recência = ordem); bound 50.
- Privacidade: saque loga só o deck.
- Eventos não cobertos (construção/hipoteca/trade/loan/reação): adições futuras (one-liner com `logEvent`).
- **`/speckit-implement` autorizado** para o pipeline desta feature.
