---
description: "Task list — Sistema de Cartas"
---

# Tasks: Sistema de Cartas

**Input**: Design documents from `/specs/006-sistema-cartas/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/cards.md, quickstart.md

**Tests**: INCLUÍDOS — Vitest; RNG injetável. SC-001…007 como asserções.

**Organization**: por user story (P1→P3) + integração. Nova camada `cards/`; integra por composição de `ctx.resolve`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: paralelizável · **[Story]**: US1/US2/US3 (foundational/polish sem label)

## Path Conventions

Código em `src/game/cards/` (novo) + extensões em `src/game/turn/types.ts`, `src/game/store.ts`, `src/game/economy/purchase.ts` e `src/game/economy/mortgage.ts`. Testes em `tests/game/cards/`. Docs (D-018) em `docs/SRS.md` e `docs/CARTAS.md`.

---

## Phase 2: Foundational (Blocking Prerequisites)

> Sem Phase 1: diretórios/deps já existem.

**⚠️ CRITICAL**: nenhuma user story começa antes desta fase.

- [X] T001 [P] Tipos em `src/game/cards/types.ts`: `Card`, `DeckId`, `Rarity`, `CardMode`, `Timing`, `EffectId`; e extensões — `GameState.decks` (em `src/game/turn/types.ts`), `Player.hand`/`busTickets`/`nextPurchaseDiscount`, e variantes `card-discard`/`card-shortcut` em `ResolutionSlice`
- [X] T002 [P] Catálogo das 32 cartas em `src/game/cards/catalog.ts` (id+cópias, deck, raridade, modo, timing, `effect`, `status`) conforme SRS §10.4-10.5
- [X] T003 Decks em `src/game/cards/decks.ts`: `shuffle(ids, rng)` (Fisher-Yates), `drawTop`, `returnToBottom` (puras)
- [X] T004 Estender `createSeedState` em `src/game/store.ts`: `decks` embaralhados (do catálogo, via `ctx.rng`); `Player.hand = []`, `busTickets = 0`, `nextPurchaseDiscount = 0`

**Checkpoint**: tipos, catálogo, decks e seed prontos.

---

## Phase 3: User Story 1 - Sacar e aplicar carta (Priority: P1) 🎯 MVP

**Goal**: parar em Acaso/Tesouro saca a carta do topo; imediata aplica + volta ao fundo; mão vai pra mão; deck nunca esgota.

**Independent Test**: parar numa casa de carta e verificar saque; imediata aplica e volta ao fundo; mão entra na mão; muitos saques não esgotam.

### Tests for User Story 1 ⚠️ (escrever primeiro, devem FALHAR)

- [X] T005 [P] [US1] Vitest em `tests/game/cards/decks.test.ts`: saca do topo; carta imediata volta ao fundo; deck nunca esgota; embaralhar determinístico com RNG fixo (SC-001/006)
- [X] T006 [P] [US1] Vitest em `tests/game/cards/effects.test.ts`: efeitos autocontidos (Boom +200 todos; Erro +200; Aniversário; Honorários −50→centro; Crise −5% netWorth; Conserto; movimento Volta GO/Vá Prisão/Avance/Volte 3; Investidor Anjo flag; Refinanciamento 5%; Passagem +ticket); carta **deferida** → no-op + volta ao fundo (SC-004/005)

### Implementation for User Story 1

- [X] T007 [US1] Em `src/game/cards/effects.ts`: registry `EffectId → handler` + `netWorth(state, playerId)` (caixa + preços[hipotecada ÷2] + construções) + handlers autocontidos + `noopDeferred` para os deferidos
- [X] T008 [US1] Em `src/game/cards/draw.ts`: `cardResolve(rctx)` — saca do topo do deck de `acaso`/`tesouro`; imediato → aplica efeito + `returnToBottom` (`{done:true}`; Atalho → `{done:false}` com slice `card-shortcut`); mão → `addToHand`; outros kinds → `null`
- [X] T009 [US1] Em `src/game/store.ts`: compor `ctx.resolve = (r) => economyResolve(r) ?? cardResolve(r)`; comando `chooseCardShortcut(dir)`

**Checkpoint**: casas de carta vivas; efeitos autocontidos funcionam; deferidas são no-op seguro.

---

## Phase 4: User Story 2 - Gerir a mão (Priority: P2)

**Goal**: mão limite 3, privacidade (contador), descarte forçado na 4ª, Bus Ticket separado.

**Independent Test**: encher a mão e sacar a 4ª (descarte forçado); conferir contador público; Bus Ticket fora do limite.

### Tests for User Story 2 ⚠️ (escrever primeiro, devem FALHAR)

- [X] T010 [P] [US2] Vitest em `tests/game/cards/hand.test.ts`: mão ≤ 3; 4ª de mão abre `card-discard` e `discardCard` resolve; `handCount` é a visão pública; Bus Ticket não conta no limite (SC-002/003)

### Implementation for User Story 2

- [X] T011 [US2] Em `src/game/cards/hand.ts`: `addToHand` (se >3 → abre `card-discard`), `discard`, `handCount` (privacidade) — puras
- [X] T012 [US2] Em `src/game/store.ts`: comando `discardCard(id)` (resolve `card-discard`)

**Checkpoint**: mão completa (limite/privacidade/descarte).

---

## Phase 5: User Story 3 - Jogar carta de mão na janela (Priority: P3)

**Goal**: jogar carta de mão respeitando timing (próprio turno / preso / reação); "Saia da Prisão" integra com o 002.

**Independent Test**: jogar carta de "próprio turno" no turno (ok) e fora (no-op); usar "Saia da Prisão" preso (sai via 002).

### Tests for User Story 3 ⚠️ (escrever primeiro, devem FALHAR)

- [X] T013 [P] [US3] Vitest em `tests/game/cards/effects.test.ts` (estender): `playHandCard` aplica na janela certa e bloqueia fora dela; "Saia da Prisão" sai da prisão via integração com 002 (SC-007)

### Implementation for User Story 3

- [X] T014 [US3] Em `src/game/store.ts`: comando `playHandCard(id)` — valida janela de timing (própria-turno/preso/reação), aplica o efeito, devolve a carta ao fundo
- [X] T015 [US3] Integrar "Saia da Prisão" com o turno de prisão do 002: a opção `card` (jailDecision) consome uma carta "Saia da Prisão" da mão se houver (FR-010)

**Checkpoint**: todas as user stories funcionam.

---

## Phase 6: Integração & Polish

- [X] T016 Em `src/game/economy/purchase.ts`: aplicar `nextPurchaseDiscount` (Investidor Anjo) ao preço na compra e zerar após; em `src/game/economy/mortgage.ts`: permitir deshipoteca a 5% (parâmetro de taxa) para o Refinanciamento
- [X] T017 [P] Propagar D-018 (FR-016): find-replace "Surpresa" → "Acaso" em `docs/SRS.md` §2.1/§4.6/§10/§13.4 e em `docs/CARTAS.md` (apenas docs)
- [X] T018 [P] Rodar `npx vitest run tests/game`: SC-001…007 verdes **e** zero regressão em 002–005; incluir teste de round-trip JSON do `GameState` estendido (decks/hand/contadores)
- [X] T019 Documentar no header de `src/game/cards/effects.ts` os handlers **deferidos** (ofensivas/reação/temporários) e o ponto de extensão do subsistema futuro

---

## Dependencies & Execution Order

- **Foundational (P2)** bloqueia tudo (tipos/catálogo/decks/seed).
- **US1 (P3)**: saque + efeitos — núcleo. **US2 (P4)**: mão (descarte). **US3 (P5)**: jogar carta de mão (timing) — depende de US2 (haver mão).
- **Integração/Polish (P6)**: desconto na compra, taxa de refinanciamento, D-018, suíte.

### Within Each Story

- Testes escritos e falhando antes da implementação.
- Tipos/catálogo/decks (P2) → efeitos/saque → comandos do store.

### Parallel Opportunities

- P2: T001/T002 em paralelo (T003/T004 dependem deles).
- Testes `[P]` por story.
- ⚠️ `store.ts` (T004/T009/T012/T014) e `effects.ts` (T007) e `draw.ts` (T008) sequenciais por arquivo.

---

## Implementation Strategy

### MVP First (US1)

1. Foundational → US1 (saque + efeitos autocontidos) → **VALIDAR** (SC-001/004/005/006).

### Incremental Delivery

1. Fundação → 2. US1 (saque) → 3. US2 (mão) → 4. US3 (jogar) → 5. Integração/Polish (desconto, refinanciamento 5%, D-018).

---

## Notes

- `[P]` = arquivos diferentes, sem dependência pendente.
- Integra por **composição** de `ctx.resolve` (card + economy) e chamadas a funções puras de 002–005 — sem reabrir essas specs (exceto a edição de desconto em `purchase.ts` e a taxa de refinanciamento em `mortgage.ts`).
- Efeitos **deferidos** (ofensivas/reação/temporários) = no-op seguro; subsistema futuro.
- Catálogo é **dado**; valores seguem o SRS §10.
- **D-018** finalmente propagado ao SRS §10 + CARTAS (fecha o T035).
- Tudo puro/serializável; embaralhar com RNG injetável.
- **`/speckit-implement` autorizado** para o pipeline desta feature.
