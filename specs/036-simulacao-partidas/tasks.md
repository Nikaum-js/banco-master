---
description: "Task list — Simulação Automatizada de Partidas (Test Harness)"
---

# Tasks: Simulação Automatizada de Partidas (Test Harness)

**Input**: Design documents from `/specs/036-simulacao-partidas/`

**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓, quickstart.md ✓

**Tests**: esta feature **é** infraestrutura de teste — os "testes" da US1/US2 são a própria
entrega (lote headless, determinismo) e por isso vêm junto da implementação, não como suíte
separada opcional. Unit tests do próprio harness (`actions`/`invariants`/`invalidProbe`) são
incluídos para garantir que o fuzzer não minta sobre o que valida.

**Organization**: por user story (US1=P1 🎯 MVP, US2=P2, US3=P3). Gerenciador: **bun**.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: paralelizável (arquivo diferente, sem dependência pendente)
- Caminhos de arquivo são exatos.

---

## Phase 1: Setup (infraestrutura compartilhada)

**Purpose**: dependência e scripts novos do repositório.

- [ ] T001 Adicionar `@playwright/test` como devDependency (`bun add -d @playwright/test`) e criar `playwright.config.ts` na raiz (browsers: chromium; `testDir: 'e2e'`; `webServer` apontando para `bun run dev`).
- [ ] T002 [P] Adicionar scripts `"sim:replay": "bun run scripts/sim-replay.ts"`, `"sim:batch": "bun run scripts/sim-batch.ts"` e `"test:e2e": "playwright test"` ao `package.json`.

---

## Phase 2: Foundational (pré-requisito bloqueante)

**Purpose**: RNG seedada, tipos e driver sobre os reducers puros — necessários por US1 e US2 (US3 é independente, não usa nada desta fase).

**⚠️ CRITICAL**: nenhuma user story headless (US1/US2) começa antes desta fase.

- [ ] T003 [P] Criar `tests/sim/engine/types.ts`: `SimAction` (união discriminada cobrindo todas as famílias da tabela de `data-model.md` — turno, casa/compra, leilão, pregão de terrenos, construção, hipoteca, cartas, dívida/falência, empréstimo, troca), `DecisionPoint`, `SimResult`, `SimFailure`, `SimReport`.
- [ ] T004 [P] Implementar `tests/sim/engine/rng.ts`: `mulberry32(seed: number): RNG`, compatível com o tipo `RNG = () => number` de `src/game/turn/dice.ts` (research.md D3).
- [ ] T005 Implementar `tests/sim/engine/driver.ts`: `createSimSession(seed, playerIds): SimSession` usando `createSeedState`+`weightedShuffle` de `src/game/store.ts` com a RNG da seed (NUNCA `freshGame`, que usa `Math.random()`); `ctx: TurnCtx` com `now()` lógico controlável pelo próprio session (contador, não `Date.now()`); wrappers para TODOS os comandos que `src/game/store.ts` expõe, chamando os MESMOS reducers puros (research.md D1).
- [ ] T006 Em `tests/sim/engine/driver.ts`, adicionar `closeExpiredAuctions(session)`: quando não resta lance válido no leilão de propriedade ou em algum lote do pregão de terrenos, avança o relógio lógico até o `deadline` e chama `closeAuction`/`closeExpiredLandLots` diretamente (research.md D2).

**Checkpoint**: driver consegue rodar `rollDice`→`resolvePending`→`finalizeTurn` de ponta a ponta sobre uma seed fixa, sem timers reais.

---

## Phase 3: User Story 1 - Simulação headless massiva com invariantes (Priority: P1) 🎯 MVP

**Goal**: centenas de partidas completas (2/3/6 jogadores) rodam headless, todo turno é validado contra os invariantes de FR-004, e nenhuma ação inválida sondada é aceita.

**Independent Test**: rodar só `tests/sim/headless/*.test.ts` — todas as partidas completam sem violação; injetar um bug de invariante no motor e confirmar detecção.

### Tests for User Story 1 ⚠️

- [ ] T007 [P] [US1] Criar `tests/sim/engine/actions.test.ts`: casos onde `enumerateActions` inclui/exclui corretamente uma ação por **decisor** — ex. `place-bid`/`pass-bid` só para jogadores em `activeBidders`; `respond-loan` só para o credor de `pendingLoan`; `accept-trade`/`reject-trade` só para `pendingTrade.toId`; `respond-reaction` só para `reactorId` (que pode ≠ jogador ativo).
- [ ] T008 [P] [US1] Criar `tests/sim/engine/invariants.test.ts`: para cada código FR-004(a–g), um `GameState` de exemplo com a violação injetada é detectado, e o mesmo estado sem a violação não acusa falso positivo.
- [ ] T009 [P] [US1] Criar `tests/sim/engine/invalidProbe.test.ts`: cada uma das 12 entradas do catálogo (`data-model.md` § InvalidProbeCatalog) é recusada como no-op (sem exceção, estado idêntico antes/depois) quando aplicada num estado onde ela é inválida.

### Implementation for User Story 1

- [ ] T010 [US1] Implementar `tests/sim/engine/actions.ts`: `enumerateActions(session): DecisionPoint[]` seguindo a prioridade de `research.md` D4 (1. resolução bloqueante com decisor específico → 2. ações oportunistas fora-de-turno de outros jogadores → 3. ação do turno do jogador ativo). Depende de T003, T005.
- [ ] T011 [US1] Implementar `tests/sim/engine/agent.ts`: `pickAction(rng, decisionPoints): { actorId, action }` — escolhe 1 `DecisionPoint` (obrigatórios têm prioridade sobre oportunistas) e 1 `SimAction` dele, usando a RNG compartilhada da partida.
- [ ] T012 [US1] Implementar `tests/sim/engine/invalidProbe.ts`: catálogo fixo das 12 sondas (`data-model.md`), `pickProbe(rng): ProbeEntry` e `applyProbe(session, entry): boolean` (roda sobre `structuredClone` descartável; retorna `true` se o resultado foi no-op).
- [ ] T013 [US1] Implementar `tests/sim/engine/invariants.ts`: `checkInvariants(prev, next): Violation[]` cobrindo literalmente FR-004(a–g) (`research.md` D6).
- [ ] T014 [US1] Implementar `tests/sim/engine/runGame.ts`: `runGame(seed, playerCount, roundCap = 300): SimResult` — orquestra o loop completo (enumerar → `agent.pickAction` → aplicar via `driver` → 1x/turno `invalidProbe` → `checkInvariants` ao fechar o turno → checar `phase==='ended'`/teto de rodadas), produzindo `SimFailure` com seed/contagem/rodada/ação/detalhe na primeira violação (FR-007).
- [ ] T015 [US1] Criar `tests/sim/headless/2p.test.ts`: roda 100 seeds determinísticas (derivadas de um seed-base fixo) com 2 jogadores, monta um `SimReport` local e `expect(report.failed).toBe(0)` (mensagem de falha inclui a 1ª `SimFailure`) — shard de paralelismo (`research.md` D8).
- [ ] T016 [P] [US1] Criar `tests/sim/headless/3p.test.ts`: idem para 3 jogadores.
- [ ] T017 [P] [US1] Criar `tests/sim/headless/6p.test.ts`: idem para 6 jogadores.
- [ ] T018 [US1] Rodar `bun run test` e medir a duração do lote completo (SC-002, < 2 min). Se não couber, particionar mais os shards por contagem (ex. 2 arquivos por contagem) sem reduzir o tamanho do lote (100/contagem — FR-008/FR-011).

**Checkpoint**: `bun run test` roda o lote padrão como parte da suíte normal; 300 partidas ok, sob 2 min.

---

## Phase 4: User Story 2 - Reprodução determinística por seed (Priority: P2)

**Goal**: qualquer seed (de uma falha ou não) reproduz exatamente a mesma partida, e há um comando de reexecução para depuração.

**Independent Test**: `runGame` com a mesma seed duas vezes produz `SimResult` idêntico; `sim:replay` com a seed de uma falha reproduz a mesma falha no mesmo ponto.

### Tests for User Story 2 ⚠️

- [ ] T019 [P] [US2] Criar `tests/sim/engine/determinism.test.ts`: `runGame(seed, N)` chamado duas vezes com a mesma seed produz resultados **deep-equal**, para ao menos 1 seed de cada contagem (2/3/6).

### Implementation for User Story 2

- [ ] T020 [US2] Implementar `scripts/sim-replay.ts`: `bun run scripts/sim-replay.ts -- --seed=<n> --players=<2|3|6>` chama `runGame`, imprime o `SimResult` completo (`contracts/relatorio-simulacao.md`), exit code `1` se `outcome==='fail'`.
- [ ] T021 [US2] Implementar `scripts/sim-batch.ts`: `bun run scripts/sim-batch.ts -- --games=<n> [--counts=2,3,6] [--base-seed=<n>]`, gera seeds determinísticas a partir de `base-seed` + índice, roda `runGame` para cada uma, monta e imprime `SimReport`, exit code `1` se `failed > 0`.
- [ ] T022 [US2] Revisar `runGame.ts`/`SimFailure` para confirmar que seed+playerCount+round+action+detail bastam, sozinhos, para reproduzir qualquer falha com `sim:replay` (FR-007/FR-009) — ajustar se faltar algum dado.

**Checkpoint**: uma seed reportada por qualquer falha do lote é reexecutável com 1 comando (`bun run sim:replay -- --seed=... --players=...`) e reproduz o mesmo resultado.

---

## Phase 5: User Story 3 - Smoke E2E no browser (Priority: P3)

**Goal**: 1 partida por contagem (2/3/6) roda pela UI real por ≥10 rodadas com um roteiro fixo determinístico, sem erro de runtime.

**Independent Test**: `bunx playwright test` cria e conduz as 3 partidas via UI; falha proposital de runtime derruba o smoke.

### Implementation for User Story 3

- [ ] T023 [US3] Confirmar/ajustar `playwright.config.ts` (de T001): `webServer` sobe `bun run dev` (ou preview do build), timeout coerente com SC-005.
- [ ] T024 [US3] Implementar `e2e/script.ts`: política fixa e determinística por tipo de modal (comprar se o caixa cobrir, senão recusar; nunca propor troca; sempre confirmar revelação de carta; encerrar o turno assim que possível) — `research.md` D10, reusada pelos 3 specs.
- [ ] T025 [P] [US3] Criar `e2e/2players.spec.ts`: cria partida com 2 jogadores pela UI, roda ≥10 rodadas via `script.ts`, assere ausência de erro de runtime e presença de tabuleiro/painéis/dados do início ao fim.
- [ ] T026 [P] [US3] Criar `e2e/3players.spec.ts`: idem para 3 jogadores.
- [ ] T027 [P] [US3] Criar `e2e/6players.spec.ts`: idem para 6 jogadores.
- [ ] T028 [US3] Rodar `bunx playwright test` e medir a duração total (SC-005, < 5 min).

**Checkpoint**: smoke E2E cobre as 3 contagens de jogadores via UI real, dentro do orçamento de tempo.

---

## Phase 6: Polish & Cross-Cutting

- [ ] T029 [P] Validar `quickstart.md` executando cada comando listado (`bun run test`, `bun run sim:replay -- ...`, `bun run sim:batch -- ...`, `bunx playwright test`).
- [ ] T030 Validação manual de SC-004: comentar temporariamente uma guarda de invariante no motor (ex. permitir `houses` negativo em `src/game/economy/construction.ts`), confirmar que o lote headless falha apontando o código FR-004 certo, reverter a alteração.
- [ ] T031 Rodar `bunx tsc --noEmit` + `bun run test` completo (suíte existente + lote headless) + `bun run build` — regressão zero na suíte pré-existente.
- [ ] T032 Atualizar `HANDOVER.md` registrando a feature 036 concluída (lote headless na suíte padrão, comandos `sim:replay`/`sim:batch`, smoke E2E).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências — pode rodar em paralelo com a Foundational (não compartilham arquivo).
- **Foundational (Phase 2)**: bloqueia US1 e US2. **Não bloqueia US3** (E2E não usa o engine headless).
- **US1 (Phase 3)**: depende só da Foundational. É o MVP.
- **US2 (Phase 4)**: depende da Foundational **e** reusa `runGame`/`SimFailure` de US1 (T014/T022) — na prática, começa depois de US1 estar minimamente funcional.
- **US3 (Phase 5)**: depende só do Setup (T001/T002) — totalmente independente de US1/US2.
- **Polish (Phase 6)**: depende de todas as stories desejadas estarem prontas.

### Within Each Story

- US1: testes de `actions`/`invariants`/`invalidProbe` (T007–T009) antes/junto da implementação correspondente (T010–T013); `runGame` (T014) depois de todos eles; os 3 shards (T015–T017) depois de `runGame`.
- US2: teste de determinismo (T019) antes dos scripts (T020/T021), que só reexportam `runGame` já validado por US1.
- US3: `script.ts` (T024) antes dos 3 specs (T025–T027), que dependem dele.

### Parallel Opportunities

- Setup: T001 e T002 podem ser feitos juntos (dependências vs. `package.json`, sem conflito real de arquivo além do `package.json` — aplicar em sequência rápida).
- Foundational: T003 e T004 em paralelo (arquivos diferentes); T005/T006 sequenciais (mesmo arquivo).
- US1: T007/T008/T009 em paralelo; T016/T017 em paralelo entre si (após T015 estabelecer o padrão do shard).
- US2: T019 pode começar assim que T014 (runGame) existir, em paralelo com T020/T021 sendo esboçados.
- US3: T025/T026/T027 em paralelo entre si, após T024.
- US1, US2 (parcialmente) e US3 podem ser feitas por pessoas diferentes em paralelo depois da Foundational + Setup.

---

## Parallel Example: User Story 1

```bash
# Testes do harness em paralelo:
Task: "actions.test.ts — enumeração por decisor"
Task: "invariants.test.ts — FR-004a–g"
Task: "invalidProbe.test.ts — catálogo de 12 sondas"

# Shards do lote, em paralelo, após runGame.ts existir:
Task: "headless/3p.test.ts — 100 seeds, 3 jogadores"
Task: "headless/6p.test.ts — 100 seeds, 6 jogadores"
```

---

## Implementation Strategy

### MVP First (US1)

1. Setup (Phase 1) + Foundational (Phase 2).
2. US1 (Phase 3) → **validar**: `bun run test` roda o lote headless, 300 partidas ok, < 2 min.
3. Bug injetado deliberadamente é detectado (SC-004, validação manual — T030 pode adiantar aqui).

### Incremental Delivery

4. US2 (reprodução por seed) → validar `sim:replay`/`sim:batch`.
5. US3 (smoke E2E) → validar `bunx playwright test`, pode ser feita em paralelo com US1/US2 (não compartilha código).
6. Polish: regressão completa, `HANDOVER.md` atualizado.

---

## Notes

- `[P]` = arquivos diferentes, sem dependência pendente.
- **Nada em `tests/`, `scripts/` ou `e2e/` é importado por `src/`** (FR-012) — verificado por construção (Vite bundla a partir de `src/main.tsx`).
- O harness só chama reducers já exportados por `src/game/**`; nenhuma regra de negócio nova é escrita para fazer o fuzzer passar — bug encontrado é corrigido na spec/motor dono da regra (princípio I).
- Commitar por task ou grupo lógico; mensagens em inglês (emoji + conventional commits).
- Rodar `bun run test` depois de cada task da Foundational/US1 para pegar regressão cedo.
