---
description: "Task list — Cartas de reação (Diplomacia, Bunker Fiscal)"
---

# Tasks: Cartas de reação — Diplomacia e Bunker Fiscal

**Input**: Design documents from `/specs/017-cartas-reacao/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/reacao.md, quickstart.md

**Tests**: INCLUÍDOS — Vitest; `respondReaction`/`reactorFor`/`taxBunkerResolve` puros. SC-001…005 como asserções.

**Organization**: foundational (subsistema) + US1 (Diplomacia) + US2 (Bunker) + polish.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: paralelizável · **[Story]**: US1/US2 (foundational/polish sem label)

## Path Conventions

`ResolutionSlice` em `economy/types.ts`; predicados em `cards/ofensivas.ts`; novo `cards/reacao.ts`; interceptação em `cards/draw.ts`; composição/comando no `store.ts`; catálogo; HUD. Testes em `tests/game/cards/reacao.test.ts`.

---

## Phase 2: Foundational (Blocking Prerequisites)

- [X] T001 [P] Em `src/game/economy/types.ts`: `ResolutionSlice += { kind:'reaction-diplomacia'; reactorId; attackerId; effect; cardId; deck; targetPos; targetPlayer }` e `{ kind:'reaction-bunker'; reactorId; amount }`
- [X] T002 Em `src/game/cards/ofensivas.ts`: extrair `canAcquire`/`canEvict`/`canAudit` (acquire/evict/audit chamam `if (!canX) return false`)
- [X] T003 Em `src/game/cards/reacao.ts`: `findReactionCard`, `reactorFor` (usa canX + gate do Boicote), `applyOffensive` (acquire/evict/audit/boicote), `taxBunkerResolve`, `respondReaction(state, use, ports)` — puras

**Checkpoint**: subsistema de reação pronto (sem fios ligados ainda).

---

## Phase 3: User Story 1 - Diplomacia cancela uma ofensiva (Priority: P1) 🎯 MVP

**Goal**: ofensiva contra alvo com Diplomacia abre reação; usar cancela (recicla ambas), recusar aplica; sem Diplomacia aplica direto.

**Independent Test**: dar Diplomacia ao alvo; atacante joga as 4 ofensivas → reação; usar/recusar; alvo sem Diplomacia → direto.

### Tests for User Story 1 ⚠️

- [X] T004 [P] [US1] Vitest em `tests/game/cards/reacao.test.ts`: ofensiva contra alvo com Diplomacia → `resolution.kind==='reaction-diplomacia'` (ofensiva fora da mão do atacante); `respondReaction(true)` cancela (sem efeito, ambas recicladas); `respondReaction(false)` aplica; alvo sem Diplomacia → aplica direto (SC-001/SC-002/SC-004)

### Implementation for User Story 1

- [X] T005 [US1] Em `src/game/cards/draw.ts`: `playHandCard` — para as 4 ofensivas, `reactorFor` + `findReactionCard(reactor,'diplomacia')` → abre `reaction-diplomacia` (retira a ofensiva da mão); senão aplica (015/016)
- [X] T006 [US1] Em `src/game/store.ts`: comando `respondReaction(use)` (interface + impl, repassa ports)

**Checkpoint**: Diplomacia intercepta e cancela/aplica as ofensivas.

---

## Phase 4: User Story 2 - Bunker Fiscal cancela um imposto (Priority: P2)

**Goal**: imposto de casa com Bunker abre reação; usar cancela, recusar paga (ou dívida); sem Bunker cobra direto.

**Independent Test**: dar Bunker ao jogador; parar em casa de imposto → reação; usar → não paga; recusar → paga.

### Tests for User Story 2 ⚠️

- [X] T007 [P] [US2] Vitest em `tests/game/cards/reacao.test.ts`: casa de imposto com Bunker → `taxBunkerResolve` abre `reaction-bunker`; `respondReaction(true)` cancela (sem débito, Bunker reciclada); `respondReaction(false)` cobra; sem Bunker → cobra direto (SC-003)

### Implementation for User Story 2

- [X] T008 [US2] Em `src/game/store.ts`: `ctx.resolve = (r) => economyResolve(r) ?? cardResolve(r) ?? taxBunkerResolve(r)`

**Checkpoint**: Bunker intercepta o imposto.

---

## Phase 5: Integração & Polish

- [X] T009 Em `src/game/cards/catalog.ts`: `status: 'implementado'` para `diplomacia`, `bunker-fiscal` (**0 deferidas**)
- [X] T010 Em `src/game/ui/GameHUD.tsx`: ramo de `resolution` `reaction-diplomacia`/`reaction-bunker` → **Usar** / **Recusar** (`respondReaction`)
- [X] T011 [P] Rodar `bunx vitest run tests/game`: SC-001…005 verdes **e** zero regressão em 002–016 (atenção: novas variantes de `resolution`; composição do `ctx.resolve`); round-trip JSON com as variantes
- [X] T012 [P] `bun run build` verde (tsc -b + vite)

---

## Dependencies & Execution Order

- **Foundational (T001–T003)** bloqueia tudo (variantes + predicados + reacao.ts).
- **US1**: interceptação no `playHandCard` (T005) + comando (T006). **US2**: composição do resolve (T008) — `taxBunkerResolve`/`respondReaction` já em T003.
- **Polish (P5)**: catálogo + HUD + suíte + build.

### Parallel Opportunities

- T001 [P]; T004/T007 (testes) em paralelo.
- ⚠️ Sequenciais por arquivo: `draw.ts` (T005), `store.ts` (T006/T008), `ofensivas.ts` (T002).

---

## Implementation Strategy

1. Foundational (variantes + canX + reacao.ts) → US1 (Diplomacia) → **VALIDAR** → US2 (Bunker) → catálogo + HUD + suíte + build.

---

## Notes

- A reação reusa o slot `resolution` (bloqueio existente); a ofensiva fica "em voo" na variante; reciclada sempre.
- Privacidade: o atacante não sabe da Diplomacia até o uso (princípio VI).
- Deferido: Bunker sobre Auditoria recebida (Diplomacia cobre); timer 10s (UI/M2).
- **Fecha o sistema de cartas** — 0 cartas no-op após esta spec.
- **`/speckit-implement` autorizado** para o pipeline desta feature.
