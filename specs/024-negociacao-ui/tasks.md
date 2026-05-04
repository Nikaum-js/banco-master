---
description: "Task list — Negociação entre jogadores na UI (M2)"
---

# Tasks: Negociação entre jogadores na UI (M2)

**Input**: Design documents from `/specs/024-negociacao-ui/`

**Prerequisites**: plan.md, spec.md, data-model.md, contracts/negotiation.md, quickstart.md

**Tests**: `validateTrade` + reducers + `tradableProps` cobertos por Vitest; o refactor de `validateTrade` é validado pela suíte de troca de 013 (não pode quebrar). Modais validados por build + `bun run dev`.

## Format: `[ID] [P?] [Story] Description`

## Path Conventions

Tipos em `src/game/economy/types.ts`; predicado/reducers em `src/game/economy/trade.ts`; `pendingTrade` em `src/game/turn/types.ts`; comandos em `src/game/store.ts`; `TradeLayer` em `src/game/ui/trade/TradeLayer.tsx`; botão em `src/boards/shared.tsx`; montagem em `src/App.tsx`. Teste em `tests/game/economy/negociacao-ui.test.ts`.

---

## Phase 1: Setup

- [X] T001 Criar a pasta `src/game/ui/trade/`.

---

## Phase 2: Foundational

- [X] T002 Mover `Trade`/`ImmunityGrant` de `src/game/economy/trade.ts` para `src/game/economy/types.ts` (forma idêntica) e fazer `trade.ts` re-importar de `./types` (quebra o ciclo p/ o `GameState`).
- [X] T003 Em `src/game/economy/trade.ts`: extrair `validateTrade(state, trade): boolean` (guardas atuais do `executeTrade`) e fazer `executeTrade` delegar (`if (!validateTrade) return state`) — sem mudança de comportamento. Adicionar `tradableProps(state, ownerId): number[]` (props do dono sem construção).
- [X] T004 Em `src/game/turn/types.ts`: `GameState += pendingTrade: Trade | null` (import de `economy/types`). Em `src/game/store.ts`: seed `pendingTrade: null`.
- [X] T005 Em `src/game/economy/trade.ts`: reducers puros `proposeTrade(state, trade)` / `acceptTrade(state)` / `rejectTrade(state)` (transições do contrato). Em `src/game/store.ts`: comandos `proposeTrade(trade)` / `acceptTrade()` / `rejectTrade()`.
- [X] T006 Rodar `bunx vitest run tests/game/economy` para confirmar que a suíte de troca de 013 (`negociacao.test.ts`) segue **verde** após o refactor (gate).

**Checkpoint**: motor da negociação pronto (validação + proposta pendente + comandos), refactor provado.

---

## Phase 3: User Story 1 + 2 - Propor / receber / responder (Priority: P1) 🎯 MVP

### Tests for User Story 1+2 ⚠️

- [X] T007 [P] [US1] Em `tests/game/economy/negociacao-ui.test.ts`: `validateTrade` (válida; inválida por dono/construção/caixa/taxa-hipoteca); `tradableProps` (exclui construção e props de terceiro); `proposeTrade` grava/no-op (já pendente/inválida) (SC-002/SC-004/SC-006).
- [X] T008 [P] [US2] No mesmo arquivo: `acceptTrade` aplica a troca (donos/saldos == `executeTrade`) e limpa; no-op se obsoleta/sem pendente; `rejectTrade` limpa sem mover nada (SC-002/SC-003).

### Implementation for User Story 1+2

- [X] T009 [US1] Em `src/game/ui/trade/TradeLayer.tsx`: **compositor** (estado local `open`) — `<select>` de destinatário (não-eliminados); listas de propriedades via `tradableProps(game, eu)` e `tradableProps(game, destinatário)` (oferecer/pedir); campos de dinheiro a dar/receber; "Propor" habilitado sse `validateTrade` e não-vazia → `proposeTrade`.
- [X] T010 [US2] Em `src/game/ui/trade/TradeLayer.tsx`: **modal recebido** — visível quando `game.pendingTrade !== null`; lista oferta/pedido (propriedades por nome + dinheiro); "Aceitar" → `acceptTrade`; "Recusar" → `rejectTrade`.
- [X] T011 [US1] Em `src/boards/shared.tsx`: botão **"Negociar"** no `PlayersPanel` que abre o compositor (via estado/handler exposto pelo `TradeLayer` ou store de UI). Em `src/App.tsx`: montar `<TradeLayer/>`.

**Checkpoint**: propor → receber → aceitar/recusar funcionando (propriedades + dinheiro).

---

## Phase 4: User Story 3 - Imunidades na troca (Priority: P2)

### Tests for User Story 3 ⚠️

- [X] T012 [P] [US3] Em `tests/game/economy/negociacao-ui.test.ts`: `validateTrade` com imunidade válida (própria mantida, voltas>0/permanente) → true; sobre prop cedida ou de terceiro, ou laps inválido → false; `acceptTrade` cria a imunidade para o beneficiário (SC-006).

### Implementation for User Story 3

- [X] T013 [US3] Em `src/game/ui/trade/TradeLayer.tsx`: no compositor, seção de **imunidades** — escolher propriedade própria **mantida** (não nas oferecidas) + voltas (N ou permanente), nos dois sentidos; incluídas no `Trade`. No modal recebido, listar as imunidades oferecidas/pedidas.

**Checkpoint**: negociação completa (propriedades + dinheiro + imunidades §8.4).

---

## Phase 5: Polish

- [X] T014 [P] `bunx vitest run tests/game` (verde, inclui negociação + 013 intacto) + `bun run build` (exit 0).
- [ ] T015 Validação visual no `bun run dev` (roteiro do quickstart): propor/receber/aceitar/recusar, imunidades, e ausência de cartas/Bus Tickets como itens.

---

## Dependencies & Execution Order

- T001 → T002 → T003 → T004 → T005 → T006 (gate) → US1+2 (T007–T011) → US3 (T012–T013) → Polish (T014–T015).
- Motor (T002–T005) é sequencial (mesmos arquivos `trade.ts`/`types.ts`/`store.ts`). `TradeLayer.tsx` tocado por T009/T010/T013 (sequencial). Testes T007/T008/T012 acumulam no mesmo arquivo.

### Parallel Opportunities

- Pouca paralelização (arquivos compartilhados). Independência por user story: US1+2 (propriedades+dinheiro) é MVP completo; US3 (imunidades) adiciona em cima.

---

## Notes

- **Regra numa fonte só**: `validateTrade` extraído do `executeTrade`; ambos usam o mesmo predicado. T006 é o gate que prova o refactor (013 verde).
- **Privacidade (VI)**: o payload `Trade` não tem cartas/Bus Tickets; o compositor nunca os oferece.
- **Persistível (VII)**: `pendingTrade` no `GameState`.
- **Diferido**: contraproposta automática, timer, fila de propostas, painel Trades ao vivo.
- **`/speckit-implement` autorizado** para esta feature, **exceto** o acabamento visual (T015), que aguarda referência/validação do usuário.
