---
description: "Task list — Revelação de carta sacada (M2)"
---

# Tasks: Revelação de carta sacada (M2)

**Input**: Design documents from `/specs/025-revelacao-carta/`

**Prerequisites**: plan.md, spec.md, data-model.md, contracts/card-reveal.md, quickstart.md

**Tests**: `cardRevealResolve`/`confirmCardReveal`/`activeModal(card-reveal)` por Vitest; `cardResolve` inalterado → suíte de cartas (006) deve seguir verde. Modal validado por build + `bun run dev`.

## Format: `[ID] [P?] [Story] Description`

## Path Conventions

`card-reveal` em `economy/types.ts`; `cardRevealResolve`/`confirmCardReveal` em `cards/draw.ts`; store em `store.ts`; modal em `ui/modals/activeModal.ts`+`ModalLayer.tsx`. Teste em `tests/game/cards/revelacao.test.ts`.

---

## Phase 2: Foundational

- [X] T001 Em `src/game/economy/types.ts`: `ResolutionSlice += { kind: 'card-reveal'; deckId: DeckId; cardId: string }`.
- [X] T002 Em `src/game/cards/draw.ts`: `cardRevealResolve(rctx)` — acaso/tesouro → PEEK `decks[deckId][0]`, seta `resolution = card-reveal` (sem mutar deck/mão), `{done:false, blocksFinalize:true}`; sem topo → `{done:true}`; outro kind → `null`. **`cardResolve` permanece inalterado.**
- [X] T003 Em `src/game/cards/draw.ts`: `confirmCardReveal(state, ports)` — se `resolution.kind==='card-reveal'`: clona, limpa a revelação, monta `rctx` (jogador da vez + `BOARD[pos]` + `lastRoll` + ports), chama `cardResolve(rctx)`; `done` → `aguardando-finalizacao`, senão segue pendente. No-op sem revelação.
- [X] T004 Em `src/game/store.ts`: `ctx.resolve` usa `cardRevealResolve` no lugar de `cardResolve`; comando `confirmCardReveal()`.

**Checkpoint**: motor da revelação pronto; saque pausa antes de processar.

---

## Phase 3: User Story 1 - Revelar antes de agir (Priority: P1) 🎯 MVP

### Tests for User Story 1 ⚠️

- [X] T005 [P] [US1] Em `tests/game/cards/revelacao.test.ts`: `cardRevealResolve` seta `card-reveal` com o `cardId` do topo, **sem** mutar deck/mão (SC-001); `confirmCardReveal` — imediata aplica efeito + finaliza; mão cabe → entra na mão; mão cheia → abre `card-discard`; Atalho → abre `card-shortcut`; sem revelação → no-op (SC-002/SC-003).
- [X] T006 [P] [US1] Em `tests/game/cards/revelacao.test.ts`: rodar a suíte de 006 (`decks`/`hand`) mentalmente coberta — adicionar asserção de que `cardResolve` direto ainda saca+aplica (regressão do refactor); `activeModal` retorna a variante `card-reveal` com rarity/effect/mode.

### Implementation for User Story 1

- [X] T007 [US1] Em `src/game/ui/modals/activeModal.ts`: `ModalView += card-reveal` e mapear `resolution.kind==='card-reveal'` → `{ kind, deckId, cardId, rarity, effect, mode }` (via `cardById`).
- [X] T008 [US1] Em `src/game/ui/modals/ModalLayer.tsx`: renderizar o cartão de **revelação** (nome de `cardId` + deck + cor de raridade + descrição curta do efeito via mapa de apresentação; "vai para sua mão" / "efeito aplicado agora"); botão "Continuar" → `confirmCardReveal`.

**Checkpoint**: cair em Acaso/Tesouro revela a carta; "Continuar" aplica.

---

## Phase 4: Polish

- [X] T009 [P] `bunx vitest run tests/game` (verde, inclui revelação + 006 intacto) + `bun run build` (exit 0).
- [ ] T010 Validação visual no `bun run dev`: revela antes de aplicar; imediata/mão/descarte/atalho; privacidade (carta de mão não exposta a terceiros).

---

## Dependencies & Execution Order

- T001 → T002 → T003 → T004 (motor) → T005/T006 (testes) → T007 → T008 (UI) → T009/T010 (polish).
- `draw.ts` tocado por T002/T003 (sequencial); `cardResolve` não muda. `activeModal`/`ModalLayer` por T007/T008.

### Parallel Opportunities

- Pouca paralelização (arquivos compartilhados). T005/T006 [P] em conteúdo (mesmo arquivo de teste).

---

## Notes

- **cardResolve INALTERADO**: a revelação apenas o antecede. T006 garante que o saque direto (006) segue idêntico.
- **Privacidade (VI)**: revelação do jogador da vez; carta de mão não exposta a outros.
- **GameDriver/animação**: `card-reveal` é `resolution` → driver espera; combina com a coordenação de animação do token (024.1).
- **`/speckit-implement` autorizado** para esta feature, **exceto** o acabamento visual (T010), que você valida no `bun run dev`.
