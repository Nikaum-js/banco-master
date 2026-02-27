---
description: "Task list — Leilão de escassez de terrenos (031)"
---

# Tasks: Leilão de escassez de terrenos (pregão simultâneo)

**Input**: Design documents from `/specs/031-leilao-escassez-terrenos/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/landAuction.md, quickstart.md

**Tests**: INCLUÍDOS — o motor (`src/game/`) é de reducers puros testados com Vitest; o padrão do projeto é teste antes/junto da implementação. UI não tem teste automatizado (validação no `bun run dev`).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência pendente)
- **[Story]**: US1 / US2 / US3
- Caminhos de arquivo são exatos.

⚠️ **Não reintroduzir** `bank` / `houseAuction` / `BankStock` (removidos na D-022). Este é leilão de **terrenos**, evento **autônomo** (`GameState.landAuction`), **fora** de `state.resolution`.

---

## Phase 1: Setup

**Purpose**: garantir baseline verde antes de mexer.

- [x] T001 Confirmar baseline: `bunx vitest run tests/game` (243 verdes) e `bun run build` (exit 0) antes de iniciar.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: forma do estado + knobs que TODAS as stories precisam. Sem isto nada compila.

**⚠️ CRITICAL**: nenhuma user story começa antes desta fase.

- [x] T002 Adicionar interfaces `LandLot` e `LandAuction` em `src/game/economy/types.ts` (conforme data-model.md; serializáveis, sem funções/handles).
- [x] T003 Adicionar ao `GameState` em `src/game/turn/types.ts`: `landAuction: LandAuction | null` e `landAuctionArmed: boolean` (importar os tipos de `economy/types`).
- [x] T004 Inicializar no seed (`createSeedState`) em `src/game/store.ts`: `landAuction: null`, `landAuctionArmed: true`.
- [x] T005 Adicionar knob `LAND_AUCTION_THRESHOLD: 3` em `src/game/theme.ts` (janela do cronômetro reusa `AUCTION_WINDOW` de `economy/purchase.ts`; documentar no comentário).
- [x] T006 Criar o módulo `src/game/economy/landAuction.ts` com os stubs das funções do contrato (`freeLots`, `maybeOpenLandAuction`, `placeLandBid`, `closeLandAuction`, `committedCash`) e o arquivo de teste `tests/game/economy/landAuction.test.ts` (esqueleto/imports) — para compilar.

**Checkpoint**: estado e módulos existem; reducers/testes compilam.

---

## Phase 3: User Story 1 — Pregão automático dos últimos terrenos (Priority: P1) 🎯 MVP

**Goal**: gatilho automático (≤3 livres + ≥2 vivos), pregão simultâneo, fechamento por cronômetro, transferência ao maior lance — tudo sem tocar no turno; com trava de episódio.

**Independent Test**: estado com ≤3 terrenos livres e ≥2 vivos → pregão abre sozinho; lances válidos atualizam lotes e reiniciam o prazo; ao expirar, cada líder paga ao banco e vira dono, lotes sem lance ficam livres; turno inalterado; dispara 1×/episódio.

### Tests for User Story 1 ⚠️ (escrever primeiro, devem FALHAR)

- [x] T007 [US1] Escrever testes US1 em `tests/game/economy/landAuction.test.ts`: abre com ≤3 livres + ≥2 vivos (SC-001); **não** abre com 1 vivo; lance básico atualiza lote (currentBid/highBidder) e reinicia `deadline` (SC-002); lance ≤ atual ou < mínimo → no-op; `closeLandAuction` transfere cada lote com líder (paga banco, vira dono) e deixa lote sem lance livre (SC-004); abrir/fechar **não** alteram o turno (SC-005); trava de episódio dispara 1×, re-arma só quando `freeLots > THRESHOLD` (SC-006); round-trip JSON do estado com `landAuction` (VII).

### Implementation for User Story 1

- [x] T008 [US1] Implementar `freeLots(state)` e `maybeOpenLandAuction(state, now)` em `src/game/economy/landAuction.ts`: abre se `freeLots ≤ THRESHOLD && vivos ≥ 2 && landAuction==null && armed`; ao abrir, monta `lots` dos livres, `bidders` = vivos, `deadline = now + AUCTION_WINDOW`, `armed=false`; re-arma (`armed=true`) se `freeLots > THRESHOLD`.
- [x] T009 [US1] Implementar `placeLandBid(state, playerId, pos, amount, now)` (regras 1–3: participante; `amount ≥ minBid` e `> lot.currentBid`; sem solvência ainda) e `closeLandAuction(state)` (cada líder paga ao banco + vira dono; sem lance fica livre; `landAuction=null`; **não** chama `completeResolution`) em `src/game/economy/landAuction.ts` (depende de T008).
- [x] T010 [US1] No `src/game/store.ts`: comandos `placeLandBid(playerId,pos,amount)` (injeta `now()`) e `closeLandAuction()`; após `buy`, `closeAuction` (003) e `finalizeTurn`, chamar `maybeOpenLandAuction(game, now())`; (re)agendar `setTimeout` → `closeLandAuction` pelo `deadline` (mesmo mecanismo do leilão 003; handle fora do estado).
- [x] T011 [US1] Rodar `bunx vitest run tests/game` — casos de US1 verdes; ajustar até passar.

**Checkpoint**: pregão abre/disputa/fecha pelos reducers (sem UI), turno intacto. MVP funcional.

---

## Phase 4: User Story 2 — Arrematar vários com trava de caixa (Priority: P2)

**Goal**: um jogador pode liderar/arrematar vários lotes, limitado pelo caixa (trava de solvência), nunca ficando negativo no fechamento.

**Independent Test**: lidera A; lance em B com `A+B > caixa` → rejeitado; com `A+B ≤ caixa` → aceito; coberto em A libera caixa; ao fechar arrematando 2, paga a soma e caixa ≥ 0.

### Tests for User Story 2 ⚠️

- [x] T012 [US2] Escrever testes de solvência em `tests/game/economy/landAuction.test.ts`: `committedCash` correto; lance que viola `committed + amount ≤ caixa` → no-op; ser coberto reduz comprometido; fechar com 2 lotes arrematados debita a soma e mantém caixa ≥ 0 (SC-003).

### Implementation for User Story 2

- [x] T013 [US2] Implementar `committedCash(state, playerId, exceptPos)` e adicionar a **regra 4 (solvência)** ao `placeLandBid` em `src/game/economy/landAuction.ts` (depende de T009).
- [x] T014 [US2] Rodar `bunx vitest run tests/game` — casos de US2 verdes.

**Checkpoint**: US1 + US2 verdes; pregão coerente e à prova de arremate impagável.

---

## Phase 5: User Story 3 — Pregão na tela (modal) (Priority: P3)

**Goal**: modal autônomo do pregão com os lotes, lance/maior-licitante, cronômetro e seletor de licitante (single-client).

**Independent Test**: no `bun run dev`, ao atingir o gatilho o modal aparece sozinho, mostra os lotes + tempo, permite escolher licitante e dar lance em cada lote, e some ao fechar.

### Implementation for User Story 3

- [x] T015 [P] [US3] Criar `src/game/ui/landAuction/LandAuctionLayer.tsx`: lê `game.landAuction`; renderiza cada lote (nome/grupo via `BOARD[pos]`, `currentBid`, nome do maior licitante), tempo restante (de `deadline`), lance por lote (chama `placeLandBid`, desabilita com motivo: abaixo do mínimo / ≤ atual / caixa insuficiente via `committedCash`), seletor "lance por: [jogador vivo]"; some quando `landAuction==null`. Texto pt-BR; reusa estilos dos modais/popovers.
- [x] T016 [US3] Montar `<LandAuctionLayer/>` em `src/App.tsx` (junto de `TradeLayer`/`NoticeLayer`).
- [ ] T017 [US3] Validar no `bun run dev` o cenário do `quickstart.md` (abre sozinho, lances, cronômetro reinicia, fecha e some).

**Checkpoint**: feature jogável fim-a-fim no single-client.

---

## Phase 6: Polish & Cross-Cutting (docs + verificação)

**Purpose**: fonte de verdade e fechamento.

- [x] T018 [P] Atualizar `docs/SRS.md` §7: em "7.1 Quando ocorre" adicionar "escassez de terrenos"; nova subseção "7.x Leilão de escassez de terrenos (pregão simultâneo)" com gatilho (≤3 + ≥2 vivos), formato simultâneo, cronômetro soft-close, trava de solvência, sem-lance-fica-livre.
- [x] T019 [P] Registrar **ADR D-023** em `docs/DECISIONS.md` (decisão/por quê/como aplicar; referenciar [D-022] para contrastar com o leilão de casas removido) + linha no índice.
- [x] T020 [P] Atualizar `HANDOVER.md` e `docs/MILESTONES.md`: 031 entregue (motor + UI), apontar feature ativa.
- [x] T021 Verificação final: `bunx vitest run tests/game` (toda a suíte verde, incl. `landAuction.test.ts`) + `bun run build` (exit 0) + grep garantindo zero `bank`/`houseAuction` reintroduzidos.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (1)**: sem dependências.
- **Foundational (2)**: depende de Setup; **bloqueia** todas as stories. (T002→T003→T004; T005, T006 podem seguir.)
- **US1 (3)**: depende de Foundational. É o MVP.
- **US2 (4)**: depende de US1 (estende `placeLandBid`).
- **US3 (5)**: depende de US1 (lê o estado/aciona reducers); usa `committedCash` da US2 para desabilitar lances (idealmente após US2, mas a UI pode degradar sem isso).
- **Polish (6)**: depende das stories desejadas concluídas.

### Within Each User Story

- Testes escritos e **falhando** antes da implementação (US1, US2).
- `maybeOpenLandAuction`/`freeLots` (T008) antes de `placeLandBid`/`closeLandAuction` (T009).
- Reducers antes do wiring no store (T010).
- `committedCash` antes da regra de solvência no `placeLandBid` (T013).

### Parallel Opportunities

- Foundational: T005 e T006 em paralelo após T002–T004.
- Polish: T018, T019, T020 em paralelo (arquivos diferentes); T021 por último.
- US3 (T015) é em arquivo novo — paralelizável com a documentação da fase 6 se o motor (US1/US2) já estiver verde.

---

## Implementation Strategy

### MVP (só US1)

1. Setup → Foundational → US1 → **validar** (reducers verdes: abre/disputa/fecha, turno intacto). Já é demonstrável pelo estado/console.

### Incremental

1. + US2 (trava de solvência) → testar → robusto contra arremate impagável.
2. + US3 (modal) → validar no `bun run dev` → jogável.
3. Polish: SRS §7 + ADR D-023 + handover + verificação final.

---

## Notes

- `[P]` = arquivos diferentes, sem dependência pendente. Tarefas no mesmo arquivo (ex.: `landAuction.ts`, `landAuction.test.ts`) são sequenciais.
- Reducers **puros** (clonam via `structuredClone`); o **único efeito** (timer/`now`) vive no store — igual ao leilão 003.
- `GameState` permanece serializável (Princípio VII); `deadline` reconstrói o timer.
- Commitar por tarefa/grupo lógico. O `/micro-commits` (datas aleatórias, sem push) fecha ao final, quando o usuário pedir.
