---
description: "Task list — Fluxo de Turno"
---

# Tasks: Fluxo de Turno

**Input**: Design documents from `/specs/002-fluxo-de-turno/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/turn-machine.md, quickstart.md

**Tests**: INCLUÍDOS — o plan (research D4) e o quickstart pedem Vitest, com SC-001…007 escritos como asserções. Escrever os testes **antes** da implementação e garantir que falhem.

**Organization**: tarefas agrupadas por user story (P1→P3). Cada story é um incremento independente e testável.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência pendente)
- **[Story]**: US1/US2/US3 (setup/foundational/polish não têm label)
- Caminhos de arquivo exatos em cada descrição

## Path Conventions

SPA única (plan §Project Structure): código em `src/game/`, testes em `tests/game/turn/`. O board (001) só é **lido** (`src/lib/boardData.ts`).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: dependências e esqueleto da camada de jogo (1ª feature de lógica).

- [X] T001 Instalar dependências: `npm i zustand` (estado) e `npm i -D vitest` (testes); adicionar script `"test": "vitest"` em `package.json` (plan: Zustand+Vitest, research D3/D4)
- [X] T002 [P] Configurar Vitest em `vitest.config.ts` (ambiente `node`, sem DOM — lógica pura) e criar diretório `tests/game/turn/`
- [X] T003 [P] Criar esqueleto da camada de jogo: diretórios `src/game/` e `src/game/turn/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: tipos, store e portas que TODAS as stories usam.

**⚠️ CRITICAL**: nenhuma user story começa antes desta fase terminar.

- [X] T004 [P] Definir os tipos de domínio do turno em `src/game/turn/types.ts` (`TurnState`, `Turn`, `Roll`, `SpeedFace`, `JailState`, slice de `Player` com `pos`/`completouPrimeiraVolta`/`jail`/`eliminated`, e `GameState` raiz com `players`/`turnOrder`/`activeSeat`/`turn`/`paused`/`phase`) conforme `data-model.md`
- [X] T005 [P] Implementar rolagem-base em `src/game/turn/dice.ts`: `roll(rng, opts)` → 2 dados brancos + `move`(soma) + `isDouble` (só brancos, FR-014); parâmetro `speedDie` presente mas faces deferidas à US3 (retorna `speed: null` quando `false`)
- [X] T006 Definir portas e registry-stub de resolução em `src/game/turn/resolution.ts`: tipos `TurnPorts`/`ResolveCtx`/`ResolutionHandler` e mapa `SquareKind → handler`. **Stubs no-op** (`{ done: true }`) só para os kinds de *mecânica de spec irmã* (`property`/`airport`/`utility`/`acaso`/`tesouro`/`bus-ticket`); `tax`, `corner-parking` e `corner-go` são **roteados pelo turno** (ver T013/T013b), não no-op. Conforme `contracts/turn-machine.md` §3
- [X] T007 Implementar o scaffold do store Zustand em `src/game/store.ts`: `GameState` raiz, factory de estado-semente de N jogadores em `pos 0`, flag `paused`, seletor do jogador ativo; **sem** transições de turno ainda
- [X] T008 Implementar o despachante puro da FSM em `src/game/turn/turnMachine.ts`: `applyEvent(state, event)` (switchboard) + guardas auxiliares (`isActive`, `notPaused`, `canFinalize`); corpo das transições preenchido nas stories

**Checkpoint**: fundação pronta — as user stories podem começar.

---

## Phase 3: User Story 1 - Ciclo de turno (Priority: P1) 🎯 MVP

**Goal**: laço básico `rolar → mover → resolver → finalizar` + passagem pelo GO + rotação da vez (com resolução por stub).

**Independent Test**: numa partida de ≥3 jogadores, executar um turno completo de cada um; token anda a soma, casa é resolvida (stub) antes de finalizar, vez passa ao próximo (pulando eliminados), e cruzar o GO credita o bônus uma vez.

### Tests for User Story 1 ⚠️ (escrever primeiro, devem FALHAR)

- [X] T009 [P] [US1] Vitest: ciclo completo passa ao próximo seat pulando eliminados (SC-001) em `tests/game/turn/turnMachine.test.ts`
- [X] T010 [P] [US1] Vitest: `finalizeTurn` é explícito (turno ocioso não avança); `paused` torna `rollDice`/`finalizeTurn` no-op preservando `activeSeat`; e `aguardando-rolagem` aceita comandos de ação facultativa antes da rolagem, sem ordem imposta (SC-005, SC-007, FR-006) em `tests/game/turn/turnMachine.test.ts`
- [X] T011 [P] [US1] Vitest: cruzar índice 47→0 dispara `onPassGo` exatamente 1×; ida à prisão não credita GO (SC-006) em `tests/game/turn/turnMachine.test.ts`

### Implementation for User Story 1

- [X] T012 [US1] Implementar transição `rollDice` (`aguardando-rolagem`→`casa-a-resolver`): gerar `Roll` base, avançar `pos` horário `mod 48`, gravar `lastRoll`/`pendingResolve` em `src/game/turn/turnMachine.ts` (FR-004)
- [X] T013 [US1] Implementar detecção de passagem pelo GO e chamada à porta `onPassGo` ao cruzar/parar no índice 0 em `src/game/turn/turnMachine.ts` (FR-008/FR-009)
- [X] T013b [US1] Implementar handlers de roteamento ao centro em `src/game/turn/resolution.ts`: `tax` → `onPayToCenter(square.amount)`; `corner-parking` → coleta do pote via porta (FR-011) — (`corner-go` → `onPassGo` já está em T013)
- [X] T014 [US1] Implementar `resolvePending`: invocar o registry de resolução para `square.kind` e limpar `pendingResolve` quando `done` em `src/game/turn/turnMachine.ts` (FR-007/FR-010)
- [X] T015 [US1] Implementar handler `corner-gotojail` + helper de envio à prisão (vai ao `pos 12`, sem GO, encerra movimento) em `src/game/turn/resolution.ts` e `turnMachine.ts` (FR-012)
- [X] T016 [US1] Implementar `finalizeTurn`: guarda `!pendingResolve`, avançar `activeSeat` para o próximo não-eliminado em `src/game/turn/turnMachine.ts` (FR-002/FR-021/FR-022)
- [X] T017 [US1] Expor os comandos no store (`rollDice`/`resolvePending`/`finalizeTurn`) com guarda de `paused` (no-op) e de jogador ativo em `src/game/store.ts` (FR-001/FR-028)

**Checkpoint**: laço de turno jogável de ponta a ponta (resolução por stub).

---

## Phase 4: User Story 2 - Duplas e Prisão (Priority: P2)

**Goal**: re-roll por dupla, 3ª dupla → prisão, e o turno especial de prisão (pagar/carta/tentar, 3ª tentativa força pagamento).

**Independent Test**: forçar duplas sucessivas (re-roll e ida à prisão na 3ª); colocar jogador preso e percorrer as três saídas + pagamento forçado na 3ª tentativa.

### Tests for User Story 2 ⚠️ (escrever primeiro, devem FALHAR)

- [X] T018 [P] [US2] Vitest: dupla = +1 rolagem; 3ª dupla consecutiva → prisão **sem** aplicar o 3º movimento (SC-002) em `tests/game/turn/turnMachine.test.ts`
- [X] T019 [P] [US2] Vitest: prisão resolve em ≤3 tentativas; 3ª sem dupla força $50 + move; sair por dupla **não** dá re-roll (SC-004) em `tests/game/turn/jail.test.ts`

### Implementation for User Story 2

- [X] T020 [US2] Implementar incremento de `consecutiveDoubles` + `mayRollAgain` após resolver, com volta a `aguardando-rolagem` (re-roll) em `src/game/turn/turnMachine.ts` (FR-013)
- [X] T021 [US2] Implementar curto-circuito da 3ª dupla → prisão (descarta o 3º movimento, sem resolver casa, encerra turno) em `src/game/turn/turnMachine.ts` (FR-015)
- [X] T022 [US2] Implementar início do turno preso: estado `prisao-decisao` quando o jogador ativo tem `jail.inJail` em `src/game/turn/turnMachine.ts` (FR-016)
- [X] T023 [US2] Implementar `jailDecision(pay|card|try)`: `pay` → `onPayToCenter($50)`; `card`; `try` com dupla sai e move **sem** re-roll (FR-019), senão `attempts++` (FR-017) em `src/game/turn/turnMachine.ts`
- [X] T024 [US2] Implementar 3ª tentativa: pagamento obrigatório de $50 + move, e reset de `JailState` ao sair em `src/game/turn/turnMachine.ts` (FR-018)
- [X] T025 [US2] Garantir que estar preso não bloqueia ganchos de receber aluguel/construir/hipotecar/negociar (sem flag de turno que trave essas portas) — guarda/comentário em `src/game/turn/turnMachine.ts` (FR-020)

**Checkpoint**: US1 + US2 funcionam independentemente.

---

## Phase 5: User Story 3 - Movimento com Speed Die (Priority: P3)

**Goal**: 3º dado após a 1ª volta — faces numéricas, Mr. Banco Master, Ônibus, Triple — integrado ao movimento.

**Independent Test**: antes da 1ª volta só 2 dados; depois, 3º dado em todas as rolagens, cada face com o efeito de movimento correto.

### Tests for User Story 3 ⚠️ (escrever primeiro, devem FALHAR)

- [X] T026 [P] [US3] Vitest: `speed === null` antes da 1ª volta e presente a partir da rolagem **seguinte** ao cruzamento do GO; `isDouble` ignora o Speed Die (SC-003, FR-005, FR-014, clarify Q2) em `tests/game/turn/dice.test.ts`
- [X] T027 [P] [US3] Vitest: faces 1/2/3 somam ao movimento; comportamentos de mr-banco/onibus/triple; triple encerra a rolagem sem re-roll; e o valor do Speed Die soma ao dos brancos no aluguel de utilidades (FR-023…027, clarify Q1/Q3) em `tests/game/turn/dice.test.ts`

### Implementation for User Story 3

- [X] T028 [US3] Estender `src/game/turn/dice.ts`: gerar `SpeedFace` (1,2,3,`mr-banco`,`onibus`), detectar `triple` (três dados iguais → `special`), faces numéricas somam ao `move` (FR-023)
- [X] T029 [US3] Implementar gating de `completouPrimeiraVolta`: setar a flag **após** computar o movimento da rolagem que cruza o GO; o store passa `speedDie = flag` ao `dice.roll` em `src/game/store.ts` e `turnMachine.ts` (FR-005, clarify Q2)
- [X] T030 [US3] Implementar movimento Mr. Banco Master: avança à próxima propriedade não comprada (gancho de compra) senão à próxima de adversário não-hipotecada (gancho de aluguel); dispara `onPassGo` se cruzar o GO em `src/game/turn/turnMachine.ts` (FR-024, U1)
- [X] T031 [US3] Implementar `chooseBusMove(die0|die1|sum)` sem alterar `isDouble` (FR-025, clarify Q3) em `src/game/turn/turnMachine.ts`
- [X] T032 [US3] Implementar `chooseTripleDest(pos)` encerrando o movimento sem re-roll, disparando `onPassGo` se cruzar o GO em `src/game/turn/turnMachine.ts` (FR-026, clarify Q1, U1)
- [X] T033 [US3] Passar o valor do Speed Die ao `ResolveCtx.roll` para o cálculo de aluguel de utilidades em `src/game/turn/resolution.ts` (FR-027)

**Checkpoint**: todas as user stories funcionam independentemente.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T034 [P] Rodar a validação do `quickstart.md` (`npx vitest run tests/game/turn`) e confirmar SC-001…007 todos verdes
- [ ] T035 [P] Concluir a propagação de [D-018](../../docs/DECISIONS.md#d-018--termo-canônico-acaso-antes-surpresa) (Acaso): find-replace "Surpresa" → "Acaso" em SRS §2.1/§4.6/§10/§13.4 e `docs/CARTAS.md` — fazer **junto da spec de Sistema de Cartas** (a decisão, o FR-010, o glossário e a constitution já foram alinhados) — **apenas docs**, sem mudar lógica
- [X] T036 [P] Adicionar teste de round-trip de serialização (`GameState` sobrevive a `JSON.parse(JSON.stringify(...))`) — invariante #9 do `data-model.md` — em `tests/game/turn/turnMachine.test.ts`
- [X] T037 Documentar no header de `src/game/turn/resolution.ts` quais handlers são stubs e o ponto de extensão, para os autores das specs irmãs (Compra & Aluguel, Cartas, Construção, Balanceamento, Sessão)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências.
- **Foundational (Phase 2)**: depende do Setup — **bloqueia** todas as stories.
- **User Stories (Phase 3+)**: dependem da Foundational. US1→US2→US3 por prioridade; US2/US3 são incrementos sobre a mesma FSM.
- **Polish (Phase 6)**: depende das stories desejadas.

### User Story Dependencies

- **US1 (P1)**: começa após Foundational. Independente — entrega o MVP (laço de turno com resolução stub).
- **US2 (P2)**: estende a FSM de US1 (duplas/prisão). Testável isoladamente, mas compartilha `turnMachine.ts` com US1 (sequenciar, não paralelizar no mesmo arquivo).
- **US3 (P3)**: estende `dice.ts` + movimento. Testável isoladamente; toca `turnMachine.ts` e `dice.ts`.

### Within Each User Story

- Testes escritos e **falhando** antes da implementação.
- Tipos → store/dice → transições da FSM → integração.

### Parallel Opportunities

- Setup: T002 e T003 em paralelo.
- Foundational: T004 e T005 em paralelo (arquivos distintos); T006/T007/T008 dependem de T004.
- Testes marcados [P] dentro de uma story rodam juntos.
- **Atenção**: US1/US2/US3 compartilham `turnMachine.ts` — paralelizar entre devs exige coordenação nesse arquivo (não marcado [P] entre stories).

---

## Parallel Example: User Story 1

```bash
# Testes de US1 juntos (devem falhar antes da implementação):
Task: "SC-001 ciclo passa ao próximo em tests/game/turn/turnMachine.test.ts"
Task: "SC-005/007 finalizar explícito + pausa em tests/game/turn/turnMachine.test.ts"
Task: "SC-006 gatilho de GO em tests/game/turn/turnMachine.test.ts"
```

---

## Implementation Strategy

### MVP First (US1)

1. Phase 1 (Setup) → 2. Phase 2 (Foundational) → 3. Phase 3 (US1).
4. **PARAR e VALIDAR**: laço de turno completo com resolução stub (SC-001/005/006/007 verdes).
5. Demo do ciclo jogável.

### Incremental Delivery

1. Setup + Foundational → fundação.
2. US1 → laço básico (MVP).
3. US2 → duplas e prisão.
4. US3 → Speed Die.
5. Polish → terminologia, serialização, docs de fronteira.

---

## Notes

- `[P]` = arquivos diferentes, sem dependência pendente.
- Resolução de casa é **stub** nesta feature (research D5) — as mecânicas reais (compra/aluguel, cartas, construção, balanceamento) chegam pelas specs irmãs via portas. T037 documenta essa fronteira.
- Toda a lógica (`turnMachine.ts`/`dice.ts`) é **pura** e serializável (princípio VII / FR-028); o único efeito é o setter do store.
- Verificar que os testes falham antes de implementar; commit após cada task ou grupo lógico.
- **Discovery/design:** este `tasks.md` é o checklist de implementação; `/speckit-implement` só com OK explícito do usuário (CLAUDE.md §2).
