---
description: "Task list — Balanceamento: GO Progressivo & Free Parking"
---

# Tasks: Balanceamento — GO Progressivo & Free Parking

**Input**: Design documents from `/specs/007-balanceamento-catchup/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/balancing.md, quickstart.md

**Tests**: INCLUÍDOS — Vitest; funções puras. SC-001…005 como asserções.

**Organization**: por user story (P1/P2) + integração. Completa o fluxo de dinheiro (portas no-op → reais).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: paralelizável · **[Story]**: US1/US2 (foundational/polish sem label)

## Path Conventions

Novo `src/game/balancing/balancing.ts` + extensões em `turn/types.ts`, `turn/resolution.ts`, `turn/turnMachine.ts`, `cards/effects.ts`, `cards/draw.ts`, `store.ts`. Testes em `tests/game/balancing/` + ajustes em `tests/game/turn/jail.test.ts` e `tests/game/cards/effects.test.ts`.

---

## Phase 2: Foundational (Blocking Prerequisites)

> Sem Phase 1: diretórios/deps já existem.

- [X] T001 [P] Em `src/game/turn/types.ts`: `GameState += centerPot: number`; em `src/game/store.ts` (`createSeedState`): semente `centerPot: 500`
- [X] T002 [P] Em `src/game/balancing/balancing.ts`: `goBonus(state, playerId)` (ranking por `netWorth` do 006, linear $100→$400, desempate por assento), `payToCenter(state, amount)`, `collectCenter(state, playerId)` — puras
- [X] T003 Atualizar a assinatura das portas em `src/game/turn/resolution.ts` (`TurnPorts`): `onPassGo(state, playerId)`, `onPayToCenter(state, amount)`, `onCollectCenter(state, playerId)`

**Checkpoint**: pote no estado, helpers de balanceamento e portas com `state`.

---

## Phase 3: User Story 1 - GO Progressivo creditado (Priority: P1) 🎯 MVP

**Goal**: passar/parar no GO credita bônus por ranking (último +$400, primeiro +$100).

**Independent Test**: dois jogadores de patrimônios diferentes passam pelo GO → o mais pobre recebe mais; extremos $100/$400.

### Tests for User Story 1 ⚠️

- [X] T004 [P] [US1] Vitest em `tests/game/balancing/balancing.test.ts`: `goBonus` — último=400, primeiro=100, meio entre; usa `netWorth` (caixa + ativos, hipotecada ÷2) (SC-001/005)

### Implementation for User Story 1

- [X] T005 [US1] Em `src/game/turn/turnMachine.ts`: `advance` recebe `state` e credita `player.cash += ports.onPassGo(state, player.id)` ao cruzar/parar no GO; atualizar todos os call-sites de `advance` (rollDice, mr-banco, saída da prisão) e em `src/game/cards/effects.ts` (voltaGo, avance3) e `src/game/cards/draw.ts` (resolveCardShortcut)
- [X] T006 [US1] Em `src/game/store.ts`: injetar `onPassGo: (s, id) => goBonus(s, id)` no `ctx.ports`

**Checkpoint**: passar pelo GO credita de verdade.

---

## Phase 4: User Story 2 - Free Parking (pote do centro) (Priority: P2)

**Goal**: pote acumula imposto/multa-de-carta/multa-de-prisão (todos passam a debitar) e é coletado em Férias (reset $500).

**Independent Test**: pagar imposto e multa de prisão → caixa cai e pote sobe; parar em Férias → coleta o pote e reseta a $500.

### Tests for User Story 2 ⚠️

- [X] T007 [P] [US2] Vitest em `tests/game/balancing/balancing.test.ts`: `payToCenter` soma ao pote; `collectCenter` credita e reseta a 500; e em `tests/game/turn/jail.test.ts`: pagar a multa debita $50 e soma ao pote (SC-002/003/004)

### Implementation for User Story 2

- [X] T008 [US2] Em `src/game/turn/resolution.ts`: handler `tax` passa a **debitar** o jogador (`square.amount`) e `onPayToCenter(state, amount)`; handler `corner-parking` → `onCollectCenter(state, playerId)`
- [X] T009 [US2] Em `src/game/turn/turnMachine.ts` (`jailDecision` pay + 3ª tentativa): **debitar** $50 + `onPayToCenter(s, 50)`; em `src/game/cards/effects.ts` (honorarios/criseImobiliaria/consertoImoveis): trocar para `onPayToCenter(s, amount)` (assinatura nova)
- [X] T010 [US2] Em `src/game/store.ts`: injetar `onPayToCenter: (s, a) => payToCenter(s, a)` e `onCollectCenter: (s, id) => collectCenter(s, id)`

**Checkpoint**: pote acumula e Férias coleta; imposto/prisão debitam de fato.

---

## Phase 5: Integração & Polish

- [X] T011 Atualizar mocks afetados pela nova assinatura das portas: `tests/game/turn/jail.test.ts` (porta recebe `state`; caixa agora cai $50) e `tests/game/cards/effects.test.ts` (capturar o **2º** argumento `amount` em `onPayToCenter`)
- [X] T012 [P] Rodar `npx vitest run tests/game`: SC-001…005 verdes **e** zero regressão em 002–006; incluir round-trip JSON do `GameState` com `centerPot`

---

## Dependencies & Execution Order

- **Foundational (P2)** bloqueia tudo (pote, helpers, assinatura das portas).
- **US1 (P3)**: GO Progressivo. **US2 (P4)**: Free Parking + débitos. Independentes na lógica; ambas dependem da assinatura nova (T003).
- **Polish (P5)**: ajustar testes legados + suíte.

### Parallel Opportunities

- P2: T001/T002 em paralelo (T003 é em `resolution.ts`).
- ⚠️ `turnMachine.ts` (T005/T009), `resolution.ts` (T003/T008), `store.ts` (T001/T006/T010) e `cards/effects.ts` (T005/T009) são sequenciais por arquivo.

---

## Implementation Strategy

### MVP First (US1)

1. Foundational → US1 (GO Progressivo) → **VALIDAR** (SC-001/005). Já corrige o buraco mais visível do demo.

### Incremental Delivery

1. Fundação → 2. US1 (GO credita) → 3. US2 (pote + débitos) → 4. Polish (testes legados + suíte).

---

## Notes

- O 002 **não** importa o 007: o balanceamento entra pelas **implementações de porta** injetadas no store; as portas ganham `state` e mutam o clone.
- `goBonus` reusa `netWorth` (006). Curva linear é **tunável** (§13.5).
- A mudança de assinatura das portas exige ajustar 2 suítes legadas (jail/efeitos) — previsto na T011.
- Catch-up **discreto** (princípio IV): porta retorna só o número.
- **`/speckit-implement` autorizado** para o pipeline desta feature.
