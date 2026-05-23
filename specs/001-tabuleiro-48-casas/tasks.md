---
description: "Task list — Tabuleiro de 48 Casas"
---

# Tasks: Tabuleiro de 48 Casas

**Input**: Design documents from `specs/001-tabuleiro-48-casas/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/board-layout.md

**Tests**: O projeto não usa framework de teste nem TDD (verificação é visual via `quickstart.md`). Nenhuma tarefa de teste automatizado é gerada — as checagens estruturais são asserções simples e a validação final é o quickstart.

**Organization**: Tarefas agrupadas por user story (spec.md). Observação importante: esta feature é **dado + geometria**, concentrada em 3 arquivos (`boardData.ts`, `Board01Classic.tsx`, `shared.tsx`). Tarefas que tocam o mesmo arquivo **não** são paralelas entre si.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivo diferente, sem dependência pendente)
- **[Story]**: a qual user story pertence (US1/US2/US3)

## Path Conventions

Single-page web app (frontend único). Caminhos a partir da raiz do repo: `src/lib/`, `src/boards/`, `src/index.css`.

---

## Phase 1: Setup

**Purpose**: estabelecer linha de base antes de mexer na estrutura.

- [x] T001 Subir `bun run dev` e confirmar que o tabuleiro de 40 casas atual renderiza sem erro; capturar screenshot de referência para comparação de regressão (base do `quickstart.md`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: extensões de schema que TODAS as stories dependem (o array `BOARD` só compila com os novos tipos).

**⚠️ CRITICAL**: nenhuma user story começa antes desta fase.

- [x] T002 Estender `SquareKind` com `'bus-ticket'` e adicionar o tipo `BusTicketSquare` (`{ kind: 'bus-ticket'; name: string }`) em `src/lib/boardData.ts` (data-model.md)
- [x] T003 Estender `UtilitySquare.icon` de `'fuel' | 'bolt'` para `'fuel' | 'bolt' | 'gas'` em `src/lib/boardData.ts`

**Checkpoint**: schema pronto — autoria do `BOARD` de 48 e novos kinds liberada.

---

## Phase 3: User Story 1 - Percorrer o tabuleiro expandido de 48 casas (Priority: P1) 🎯 MVP

**Goal**: tabuleiro de 48 casas navegável, quadrado, cantos em 0/12/24/36, grade 13×13.

**Independent Test**: montar a partida, percorrer uma volta completa, verificar 48 casas indexadas 0–47, cantos nas 4 quinas e que cruzar 47→0 conta como passagem pelo GO.

- [x] T004 [P] [US1] Reescrever o array `BOARD` em `src/lib/boardData.ts` para 48 entradas seguindo a sequência canônica de [research.md §Decisão 3](./research.md) (pos 0–47, cantos 0/12/24/36, cada `kind` na posição correta; cidades podem usar os nomes de research.md)
- [x] T005 [US1] Atualizar `gridArea(pos)` em `src/boards/Board01Classic.tsx` para a grade 13×13 conforme o mapa de [contracts/board-layout.md](./contracts/board-layout.md) (bottom 0–12, left 13–24, top 25–36, right 37–47)
- [x] T006 [US1] Atualizar `gridTemplateColumns`/`gridTemplateRows` para 13 faixas (cantos + repeat(11)) e o centro para `gridRow: 2 / 13, gridColumn: 2 / 13` em `src/boards/Board01Classic.tsx` (depende de T005)
- [x] T007 [P] [US1] Atualizar `sideOf(pos)` em `src/boards/shared.tsx`: cantos `{0,12,24,36}`, bottom 1–11, left 13–23, top 25–35, right 37–47
- [x] T008 [US1] Verificar invariantes estruturais (data-model §Invariantes 1–3,6): `BOARD.length===48`, cantos corretos, contagem por kind, `pos` únicos e contíguos (depende de T004, T005, T006, T007)

**Checkpoint**: board de 48 casas navegável e geometricamente correto — MVP demonstrável.

---

## Phase 4: User Story 2 - Disputar 28 propriedades de cidade em grupos de 3-4 (Priority: P2)

**Goal**: conteúdo das propriedades correto — 28 cidades, grupos premium com 4, escada de preços.

**Independent Test**: contar 28 propriedades distribuídas 3/3/3/4/4/4/4/3; confirmar que grupo premium exige 4 (3 para parcial) e regular exige 3 (2 para parcial).

- [x] T009 [US2] Adicionar as 6 cidades novas (Florença/IT, Calcutá/IN, Shenzhen/CN, Brasília/BR, Miami/US, Manchester/GB) às entradas property de `BOARD` nos respectivos grupos, em `src/lib/boardData.ts` (depende de T004)
- [x] T010 [US2] Ajustar a escada de preços/aluguéis das 28 cidades (faixa ~$60–$400, monotônica ao longo do percurso) em `src/lib/boardData.ts` conforme [research.md §Decisão 5](./research.md) (depende de T009)
- [x] ~~T011 [US2] Garantir exatamente 2 coringas — `pos 11` (Egito·Luxor) e `pos 35` (Brasil·Brasília)~~ — **revogada (2026-05-23): Coringa removida do produto** ([D-005](../../docs/DECISIONS.md) revogada); a flag `coringa` foi removida de `boardData.ts`.
- [x] T012 [US2] Verificar distribuição por grupo (data-model §Invariante 4: brown/skyblue/pink/navy=3; orange/red/yellow/green=4) e que o limiar de monopólio parcial bate com o tamanho do grupo (depende de T009, T010, T011)

**Checkpoint**: economia de propriedades correta e auditável.

---

## Phase 5: User Story 3 - Casas de variedade: 3ª utilidade e espaço Bus Ticket (Priority: P3)

**Goal**: os dois tipos novos renderizam com glifo/label próprios e se comportam corretamente.

**Independent Test**: parar no espaço Bus Ticket → recebe carta no contador separado (sem afetar limite de 3); utilidade com 1/2/3 possuídas → aluguel 4×/10×/20× dos dados.

- [x] T013 [P] [US3] Confirmar/posicionar o espaço Bus Ticket em `pos 10` e a 3ª utilidade `icon: 'gas'` em `pos 43` no `BOARD` em `src/lib/boardData.ts` (depende de T002, T003, T004)
- [x] T014 [US3] Adicionar glifo do Bus Ticket (ônibus/ticket) ao `SquareIcon` e o branch de render em `ClassicSquare` (label "Bus Ticket", casa **não-clicável** para compra) em `src/boards/shared.tsx`
- [x] T015 [US3] Adicionar glifo da 3ª utilidade (`gas`) ao `SquareIcon` em `src/boards/shared.tsx` (depende de T014 — mesmo arquivo)
- [x] T016 [US3] Refletir o aluguel de utilidade 4×/10×/20× (1/2/3 possuídas) no popover/modal de utilidade, se existir em `src/boards/shared.tsx` (spec FR-007)

**Checkpoint**: todas as casas — incluindo as novas — renderizam e se comportam corretamente.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: consistência, remapeamento de mocks e validação final.

- [x] T017 **Remapear os dados mockados** em `src/boards/shared.tsx` (`MOCK_OWNERSHIP`, `MOCK_BUILDINGS`, `MOCK_MORTGAGED`, posições em `MOCK_PLAYERS`) para os novos índices 0–47 — os valores atuais apontam para cidades do tabuleiro de 40 (ex: pos 31 não é mais Nova York; pos 10 não é mais propriedade, virou canto-prisão→12) (depende de T004)
- [x] T018 [P] Atualizar o cabeçalho/comentários de `src/lib/boardData.ts` (de "40 casas" para 48) e qualquer constante de contagem
- [x] T019 Verificar não-regressão visual no browser (quickstart §3): bandeiras-avatar ancoradas nos 4 lados, stripe/tint de dono + header de aluguel, tokens de jogador, tarja de hipoteca e construções posicionando corretamente nos novos ranges de lado
- [x] T020 Rodar a validação completa do [quickstart.md](./quickstart.md) (checks estruturais §2 + visuais §3 + jogabilidade §4) e confirmar Success Criteria SC-001..SC-005

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências.
- **Foundational (Phase 2)**: depende do Setup. **Bloqueia todas as stories** (BOARD precisa dos novos tipos).
- **US1 (Phase 3)**: depende da Foundational. É a base navegável.
- **US2 (Phase 4)**: depende de US1 (precisa do `BOARD` de 48 existir) — refina o conteúdo das cidades.
- **US3 (Phase 5)**: depende da Foundational + T004; adiciona render/comportamento dos tipos novos.
- **Polish (Phase 6)**: depende das stories desejadas estarem completas.

### User Story Dependencies

- **US1 (P1)**: independente — entrega o tabuleiro navegável (MVP).
- **US2 (P2)**: usa o `BOARD` da US1; testável de forma independente (auditoria de contagem/grupos).
- **US3 (P3)**: usa o schema da Foundational e o `BOARD` da US1; testável de forma independente (render + comportamento dos tipos novos).

> Nota de realidade: por ser dado+geometria em poucos arquivos, US2 e US3 editam o mesmo `boardData.ts`/`shared.tsx` da US1. A independência aqui é de **concern testável**, não de arquivo isolado.

### Within Each Story

- Models/dado (`boardData.ts`) antes da geometria de render quando há dependência.
- Mesmo arquivo ⇒ sequencial (T005→T006; T014→T015).
- Verificação por último dentro da story.

### Parallel Opportunities

- **US1**: T004 (`boardData.ts`) ∥ T007 (`shared.tsx`) — arquivos diferentes. T005→T006 (mesmo arquivo `Board01Classic.tsx`) sequenciais.
- **US3**: T013 (`boardData.ts`) ∥ T014 (`shared.tsx`).
- **Polish**: T018 (`boardData.ts`) ∥ T019 (browser).

---

## Parallel Example: User Story 1

```bash
# Em paralelo (arquivos diferentes):
Task T004: "Reescrever BOARD para 48 entradas em src/lib/boardData.ts"
Task T007: "Atualizar sideOf() em src/boards/shared.tsx"

# Sequencial depois (mesmo arquivo Board01Classic.tsx):
Task T005 → Task T006

# Por último, depende de todos:
Task T008: "Verificar invariantes estruturais"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 (Setup) → 2. Phase 2 (Foundational) → 3. Phase 3 (US1).
4. **PARAR e VALIDAR**: tabuleiro de 48 navegável, cantos corretos. Demonstrável.

### Incremental Delivery

1. Setup + Foundational → schema pronto.
2. US1 → board de 48 navegável (MVP).
3. US2 → conteúdo das 28 cidades correto.
4. US3 → tipos novos (3ª utilidade + Bus Ticket).
5. Polish → remapeamento de mocks + validação do quickstart.

---

## Notes

- **Sem código de produção sem OK explícito** (Constituição II) — este `tasks.md` é planejamento; `/speckit-implement` exige nova confirmação.
- T017 (remapear mocks) é fácil de esquecer e quebra o visual silenciosamente — os índices mudaram de cidade na renumeração 40→48.
- `[P]` = arquivos diferentes, sem dependência pendente.
- Commit após cada task ou grupo lógico.
- Validação final = `quickstart.md` (não há suíte de testes automatizada).
