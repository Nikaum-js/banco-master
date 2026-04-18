---
description: "Task list — Compra & Aluguel"
---

# Tasks: Compra & Aluguel

**Input**: Design documents from `/specs/003-compra-aluguel/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/economy.md, quickstart.md

**Tests**: INCLUÍDOS — Vitest, com SC-001…007 como asserções. Leilão testado com **fake timers**. Escrever os testes antes da implementação.

**Organization**: por user story (P1→P3). Estende a camada `src/game/` do 002 (não reabre a FSM).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: paralelizável (arquivos diferentes, sem dependência pendente)
- **[Story]**: US1/US2/US3 (setup/foundational/polish sem label)

## Path Conventions

Código em `src/game/economy/` (novo) + extensões em `src/game/turn/resolution.ts` e `src/game/store.ts`. Testes em `tests/game/economy/`. Board (001) e FSM (002) só lidos/integrados.

---

## Phase 1: Setup

- [X] T001 [P] Criar diretórios `src/game/economy/` e `tests/game/economy/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: tipos de economia, consultas de posse, seed e o ponto de integração com a resolução do 002.

**⚠️ CRITICAL**: nenhuma user story começa antes desta fase.

- [X] T002 [P] Definir tipos em `src/game/economy/types.ts`: `Title` (`ownerId`/`mortgaged`), `ResolutionSlice` (`purchase`|`auction`), `Auction` (`pos`/`currentBid`/`highBidder`/`activeBidders`/`deadline`); e as extensões `Player.cash` e `GameState.titles`/`GameState.resolution` (conforme `data-model.md`)
- [X] T003 [P] Implementar consultas puras de posse em `src/game/economy/titles.ts`: `ownerOf(state,pos)`, `isMortgaged(state,pos)`, `groupOwnedCount(state,group,ownerId)`, `countOwned(state,kind,ownerId)` (lê `BOARD` de 001 + `titles`)
- [X] T004 Estender `createSeedState` em `src/game/store.ts`: `Player.cash = 2000` (SRS §3.1), `titles` com todas as casas compráveis em `{ ownerId: null, mortgaged: false }`, `resolution = null`
- [X] T005 Integração com a FSM do 002: estender `ResolveCtx` em `src/game/turn/resolution.ts` com `state` (clone mutável) e ajustar `resolvePending` em `src/game/turn/turnMachine.ts` para passá-lo; adicionar helper `completeResolution(state)` (seta `turn.pendingResolve = false`, `turn.state = 'aguardando-finalizacao'`, `resolution = null`) usado pelos comandos de economia

**Checkpoint**: economia plugável — as user stories podem começar.

---

## Phase 3: User Story 1 - Comprar propriedade livre (Priority: P1) 🎯 MVP

**Goal**: parar em propriedade livre → modal comprar/recusar; comprar transfere título e debita o preço; recusar abre leilão; turno bloqueado até resolver.

**Independent Test**: comprar uma propriedade livre e conferir título + caixa −preço; recusar não cobra; sem caixa, Comprar indisponível; `finalizeTurn` no-op enquanto `resolution !== null`.

### Tests for User Story 1 ⚠️ (escrever primeiro, devem FALHAR)

- [X] T006 [P] [US1] Vitest em `tests/game/economy/purchase.test.ts`: comprar debita o preço e dá o título; recusar não cobra; caixa insuficiente → não compra; `finalizeTurn` bloqueado enquanto `resolution !== null` (SC-001, SC-007)

### Implementation for User Story 1

- [X] T007 [US1] Em `src/game/turn/resolution.ts`, handler de `property`/`airport`/`utility`: se a casa é **livre** (`ownerId === null`), abrir `state.resolution = { kind:'purchase', pos }` e retornar `{ done: false, blocksFinalize: true }` (FR-001/FR-005)
- [X] T008 [P] [US1] Em `src/game/economy/purchase.ts`: `buyProperty(state, ctx)` (valida caixa ≥ preço, debita, `titles[pos].ownerId = ativo`, `completeResolution`) e `declineProperty(state, ctx)` (abre `Auction` em `resolution`) — puras (FR-002/FR-003/FR-004)
- [X] T009 [US1] Em `src/game/store.ts`: comandos `buyProperty()`/`declineProperty()` com guarda de `resolution.kind === 'purchase'` e de caixa; respeitam `paused` (no-op)

**Checkpoint**: compra/recusa jogáveis; turno integra corretamente.

---

## Phase 4: User Story 2 - Pagar aluguel (Priority: P2)

**Goal**: parar em propriedade de outro (não hipotecada) → cobra aluguel escalonado (cidade base/150%/200%, aeroporto, utilidade); própria/hipotecada → nada; sem caixa → sinaliza insolvência.

**Independent Test**: montar posses e conferir o aluguel em cada caso; confirmar isenção de hipotecada/própria; caixa insuficiente chama `onInsolvency`.

### Tests for User Story 2 ⚠️ (escrever primeiro, devem FALHAR)

- [X] T010 [P] [US2] Vitest em `tests/game/economy/rent.test.ts`: cidade base / 150% (maioria 2-de-3 e 3-de-4) / 200% (completo); aeroporto $25/$50/$100/$200; utilidade 4×/10×/20× o valor dos dados; hipotecada e própria → 0 (SC-003/004/005/006)

### Implementation for User Story 2

- [X] T011 [P] [US2] Em `src/game/economy/rent.ts`: `rentCity(base, ownedInGroup, groupSize)` (base/×1.5 maioria/×2 completo), `rentAirport(n)` (25/50/100/200), `rentUtility(n, diceValue)` (4/10/20 × dados) — puras; header documentando o ponto de extensão da Construção (FR-007/008/009)
- [X] T012 [US2] Em `src/game/turn/resolution.ts`, completar o handler: dono ≠ ativo e **não** hipotecada → calcula aluguel (via `rent.ts` + `titles.ts`, usando `ctx.roll` p/ utilidade) e transfere caixa dono↔pagador; própria/hipotecada → `{ done: true }`; caixa insuficiente → `ports.onInsolvency(...)` e `{ done: true }` (FR-006/010/011/016)
- [X] T013 [US2] Em `src/game/store.ts`: adicionar a porta `onInsolvency` ao `ctx.ports` (stub default no-op, deferida à spec Falência)

**Checkpoint**: US1 + US2 funcionam; aluguel cobrado corretamente.

---

## Phase 5: User Story 3 - Leilão ao recusar (Priority: P3)

**Goal**: recusa abre leilão; lances crescentes (≤ caixa); cronômetro por lance; fecho paga o lance ao banco; sem lance → banco.

**Independent Test**: recusar, dar lances, avançar o cronômetro (fake timers) e confirmar que o maior licitante paga o lance; leilão sem lances mantém a propriedade com o banco.

### Tests for User Story 3 ⚠️ (escrever primeiro, devem FALHAR)

- [X] T014 [P] [US3] Vitest em `tests/game/economy/auction.test.ts` (fake timers): lances devem ser > atual e ≤ caixa; cronômetro reinicia a cada lance; ao esgotar, maior licitante paga o lance e recebe o título; sem lance → permanece com o banco (SC-002)

### Implementation for User Story 3

- [X] T015 [P] [US3] Em `src/game/economy/auction.ts`: `placeBid(state, playerId, amount)` (valida `> currentBid`, `≤ cash`, reinicia `deadline`), `passBid(state, playerId)`, `closeAuction(state, ctx)` (paga e atribui título ou mantém banco; `completeResolution`) — puras; `deadline` serializável (FR-012/013/014/015)
- [X] T016 [US3] Em `src/game/store.ts`: comandos `placeBid`/`passBid` + agendamento do `setTimeout` pelo `deadline` que dispara `closeAuction` (rearmado a cada lance; cancelado/reconstruído conforme `paused` e reconexão); respeita `paused`

**Checkpoint**: todas as user stories funcionam independentemente.

---

## Phase 6: Polish & Cross-Cutting

- [X] T017 [P] Rodar `npx vitest run tests/game` e confirmar SC-001…007 verdes **e** que a suíte do 002 (`tests/game/turn`) continua passando (sem regressão na integração)
- [X] T018 [P] Teste de round-trip JSON do `GameState` estendido (titles/cash/`auction.deadline`) — invariante #9 do `data-model.md` — em `tests/game/economy/auction.test.ts`
- [X] T019 Documentar no header de `src/game/economy/rent.ts` o ponto de extensão da spec de Construção (onde os multiplicadores de casas/hotéis/Skyscraper serão somados)

---

## Dependencies & Execution Order

- **Setup (P1)** → **Foundational (P2)** bloqueia tudo.
- **US1 (P3)**: compra; abre o caminho da resolução interativa.
- **US2 (P4)**: aluguel; independente de US1 na lógica, mas compartilha `resolution.ts` (sequenciar edições nesse arquivo).
- **US3 (P5)**: leilão; **depende de US1** (a recusa em `declineProperty` abre o leilão).
- **Polish (P6)**: após as stories.

### Within Each Story

- Testes escritos e falhando antes da implementação.
- Tipos/consultas (P2) → cálculo puro → handler de resolução → comandos do store.

### Parallel Opportunities

- P2: T002 e T003 em paralelo (T004/T005 dependem de T002).
- Cálculos puros: T011 (`rent.ts`) e T015 (`auction.ts`) e T008 (`purchase.ts`) em paralelo entre si.
- ⚠️ `store.ts` (T004/T009/T013/T016) e `resolution.ts` (T005/T007/T012) são sequenciais por arquivo.

---

## Implementation Strategy

### MVP First (US1)

1. Setup + Foundational → 2. US1 (compra/recusa) → **PARAR e VALIDAR** (SC-001/007 verdes).

### Incremental Delivery

1. Fundação → 2. US1 (compra) → 3. US2 (aluguel) → 4. US3 (leilão) → 5. Polish.

---

## Notes

- `[P]` = arquivos diferentes, sem dependência pendente.
- Esta feature **preenche** os stubs de `property`/`airport`/`utility` do 002 e **introduz** `cash`/`titles`. A integração completa a resolução do turno via `pendingResolve` (sem reabrir a FSM).
- Tudo puro e serializável; o único efeito é o store (incl. o `setTimeout` do leilão, reconstruível pelo `deadline`).
- Fora de escopo (specs próprias): construção, hipoteca-mutação, negociação, falência (só `onInsolvency` sinaliza), Hangar/Skyscraper.
- **`/speckit-implement` autorizado pelo usuário** para o pipeline desta feature.
