---
description: "Task list — Modais centrais (M2)"
---

# Tasks: Modais centrais (M2) — interações dirigidas por resolução

**Input**: Design documents from `/specs/022-modais-centrais/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/activeModal.md, quickstart.md

**Tests**: a função pura `activeModal` é coberta por Vitest; os modais e o HUD são validados por build + `bun run dev` (sem RTL no projeto).

## Format: `[ID] [P?] [Story] Description`

## Path Conventions

`activeModal.ts`/`ModalLayer.tsx` em `src/game/ui/modals/`; ajuste em `src/game/ui/GameHUD.tsx` e `src/App.tsx`; reúso visual de `src/boards/shared.tsx`. Teste em `tests/game/ui/activeModal.test.ts`.

---

## Phase 1: Setup

- [X] T001 Criar a pasta `src/game/ui/modals/` (camada de apresentação dos modais centrais).

---

## Phase 2: Foundational

- [X] T002 Em `src/game/ui/modals/activeModal.ts`: definir os tipos `HandCardView` e `ModalView` (discriminado por `kind`, conforme data-model.md) e a função pura `activeModal(game: GameState): ModalView | null` cobrindo `purchase`/`auction`/`house-auction`/`card-discard`/`card-shortcut` e retornando `null` para `debt`/`reaction-*`/`null`. Jogador da vez = `players[turnOrder[activeSeat]]`; mão via `cardById`.

**Checkpoint**: seletor puro pronto — base de todos os modais e do contrato com o HUD.

---

## Phase 3: User Story 1 - Compra de propriedade (Priority: P1) 🎯 MVP

### Tests for User Story 1 ⚠️

- [X] T003 [P] [US1] Em `tests/game/ui/activeModal.test.ts`: caso `purchase` → descritor com `pos`/`square`/`price`/`playerId` corretos; e caso "nenhum" (`debt`/`reaction-*`/`resolution null` → `null`) (SC-001/SC-004).

### Implementation for User Story 1

- [X] T004 [US1] Em `src/game/ui/modals/ModalLayer.tsx`: criar a camada de overlay central que consome `activeModal(useGameStore(...))`; renderizar o **cartão de compra** (nome/cor do grupo/preço/aluguéis, reusando o vocabulário visual de `PropertyPopover`/`AirportPopover`/`UtilityPopover`) com ações "Comprar" (`buyProperty`) e "Recusar → leilão" (`declineProperty`).
- [X] T005 [US1] Em `src/App.tsx`: montar `<ModalLayer/>` sobre o tabuleiro (acima do `Board01Classic`, junto do `GameHUD`).
- [X] T006 [US1] Em `src/game/ui/GameHUD.tsx`: remover o ramo `res?.kind === 'purchase'` (delegado ao `ModalLayer`) — não duplicar (FR-009).

**Checkpoint**: comprar/recusar funcionam pelo modal central; HUD não duplica.

---

## Phase 4: User Story 2 - Leilão (Priority: P2)

### Tests for User Story 2 ⚠️

- [X] T007 [P] [US2] Em `tests/game/ui/activeModal.test.ts`: casos `auction` (com `currentBid`/`highBidder`/`deadline`/`square`) e `house-auction` (com `housesAvailable`, sem propriedade) (SC-001).

### Implementation for User Story 2

- [X] T008 [US2] Em `src/game/ui/modals/ModalLayer.tsx`: renderizar o **cartão de leilão** (`auction` e `house-auction`): item em disputa, lance atual, maior licitante, indicação de fechamento por prazo; ações "Lance" (`placeBid(activeId, valor)`, default `currentBid+50`, campo de valor como estado local) e "Passar" (`passBid`, **só** em `auction`).
- [X] T009 [US2] Em `src/game/ui/GameHUD.tsx`: remover o ramo `res?.kind === 'auction' || res?.kind === 'house-auction'` (delegado ao `ModalLayer`).

**Checkpoint**: leilão de propriedade e de casas operam pelo modal; cronômetro do store inalterado.

---

## Phase 5: User Story 3 - Decisões de carta (descarte + Atalho) (Priority: P3)

### Tests for User Story 3 ⚠️

- [X] T010 [P] [US3] Em `tests/game/ui/activeModal.test.ts`: caso `card-discard` → `cards` = mão do jogador **da vez** (ids/rarity/effect) e **não** a de outro jogador (privacidade VI / SC-003); caso `card-shortcut` → `{ kind: 'card-shortcut' }`.

### Implementation for User Story 3

- [X] T011 [US3] Em `src/game/ui/modals/ModalLayer.tsx`: renderizar o **cartão de descarte** (as cartas da mão do jogador da vez — cor por raridade + rótulo via mapa de apresentação `effect → nome`, com fallback humanizado) com a ação `discardCard(id)`; e o **cartão de Atalho** com "Frente"/"Trás" (`chooseCardShortcut`).
- [X] T012 [US3] Em `src/game/ui/GameHUD.tsx`: remover os ramos `res?.kind === 'card-discard'` e `res?.kind === 'card-shortcut'` (delegados ao `ModalLayer`).

**Checkpoint**: todos os 5 estados dirigidos por resolução vivem no centro; HUD só trata o que sobrou.

---

## Phase 6: Polish

- [X] T013 [P] `bunx vitest run tests/game` (verde, inclui os 6 casos de `activeModal`) + `bun run build` (exit 0).
- [ ] T014 Validação visual no `bun run dev` (roteiro do quickstart) — **com referência visual do usuário** para o acabamento dos cartões antes de fechar a UI.

---

## Dependencies & Execution Order

- T001 → T002 (foundational) → US1 (T003–T006) → US2 (T007–T009) → US3 (T010–T012) → Polish (T013–T014).
- `ModalLayer.tsx` é tocado por T004/T008/T011 (mesmo arquivo → sequencial); `GameHUD.tsx` por T006/T009/T012 (sequencial).
- Os testes T003/T007/T010 são [P] entre si em conteúdo, mas vivem no mesmo arquivo de teste → na prática, acrescentar casos incrementalmente.

### Parallel Opportunities

- Pouca paralelização real (2 arquivos centrais compartilhados). A independência é **por user story**: cada uma adiciona um tipo de cartão + remove o ramo correspondente do HUD, e é testável isolada via `activeModal`.

---

## Notes

- **Motor inalterado**: nenhuma task toca `src/game/` fora de `src/game/ui/`. Só comandos já existentes do store são disparados.
- **Privacidade (VI)**: descarte mostra só a mão do jogador da vez (T010 garante).
- **Acabamento visual**: T014 depende de referência visual do usuário (preferência do projeto) — não fechar a UI sem ela.
- **Diferido** (fatias futuras): revelação de carta imediata (exige novo estado no motor), construção/hipoteca/negociação iniciadas pelo jogador, modais de dívida/reação/empréstimo no centro.
- **`/speckit-implement` autorizado** para o pipeline desta feature, **exceto** a parte de acabamento visual (T014), que aguarda referência.
