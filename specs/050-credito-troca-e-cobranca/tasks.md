# Tasks: Prazo do crédito, contrapartida na troca e faixa de cobrança

**Input**: documentos em `/specs/050-credito-troca-e-cobranca/`

**Prerequisites**: `spec.md`, `plan.md`, `research.md`, `data-model.md`

**Tests**: obrigatórios por FR-027 e SC-008; escrever e observar falha antes da implementação.

## Phase 1: Setup

- [x] T001 Confirmar D-054/D-055/D-056 e SRS v1.21 em `docs/adr/` e `docs/SRS.md`
- [x] T002 Apontar a feature ativa para `specs/050-credito-troca-e-cobranca` em `.specify/feature.json`

---

## Phase 2: User Story 1 — Empréstimo com prazo real (Priority: P1)

**Goal**: o empréstimo nasce com três voltas e vence sozinho na terceira passagem pelo GO.

**Independent Test**: três passagens pelo GO com caixa sobrando.

### Tests

- [x] T003 [US1] Casos vermelhos de prazo, vencimento e quitação sem juros em `tests/game/emprestimos/emprestimos.test.ts`

### Implementation

- [x] T004 [US1] Adicionar `lapsElapsed` ao `Loan` em `src/game/economy/types.ts`
- [x] T005 [US1] Declarar `LOAN_TERM_LAPS`, iniciar o contador em `grantLoan` e expor `lapsRemaining` em `src/game/emprestimos/emprestimos.ts`
- [x] T006 [US1] Cobrar juros + principal no vencimento e encerrar o empréstimo em `chargeLoanInterest` (`src/game/emprestimos/emprestimos.ts`)
- [x] T007 [US1] Tolerar snapshot legado sem contador na leitura do empréstimo

**Checkpoint**: prazo corre no GO do devedor e vence encerrando o contrato.

---

## Phase 3: User Story 2 — Vencimento sem caixa vira dívida (Priority: P1)

**Goal**: o vencimento sem caixa cai na cobrança de dívida existente, com liquidação e falência disponíveis.

**Independent Test**: vencimento com caixa menor que juros + principal.

### Tests

- [x] T008 [US2] Casos vermelhos de vencimento parcial, dívida ao credor e falência subsequente em `tests/game/emprestimos/emprestimos.test.ts`

### Implementation

- [x] T009 [US2] Emitir dívida pendente ao credor com `origin` correta no vencimento parcial
- [x] T010 [US2] Registrar os fatos novos no log tipado em `src/game/economy/types.ts` e narrá-los em `src/game/ui/log/describeLog.ts`

**Checkpoint**: nenhum vencimento termina em perdão ou caixa negativo.

---

## Phase 4: User Story 3 — Trava contra proposta de abandono (Priority: P1)

**Goal**: proposta que entrega ativos sem contrapartida de metade do valor não passa.

**Independent Test**: matriz de quatro propostas (doação, doação com trocado, pagamento caro, propriedade por imunidade).

### Tests

- [x] T011 [US3] Casos vermelhos da matriz de contrapartida em `tests/game/economy/negociacao.test.ts`
- [x] T012 [P] [US3] Caso vermelho de proposta que perde validade antes da aceitação em `tests/game/economy/negociacao.test.ts`

### Implementation

- [x] T013 [US3] Criar `src/game/economy/appraisal.ts` com constantes, `appraiseSide`, `tradeBalance` e `meetsCounterpart`
- [x] T014 [US3] Aplicar o piso em `validateTrade` sem substituir a proteção de credor em `src/game/economy/trade.ts`
- [x] T015 [US3] Explicar a recusa com o valor que falta em `src/game/ui/trade/TradeLayer.tsx`
- [x] T016 [P] [US3] Cobrir a explicação na interface em `tests/ui/tradePresentation.test.tsx`

**Checkpoint**: doação bloqueada, negociação legítima intacta.

---

## Phase 5: User Story 4 — Faixa de cobrança (Priority: P1)

**Goal**: a cobrança sai do centro e o tabuleiro fica inteiro visível.

**Independent Test**: cobrança aberta em 1280×800 e 740×360.

### Tests

- [x] T017 [US4] Casos vermelhos de conteúdo, capacidade de levantar e ausência de backdrop em `tests/ui/debtDock.test.tsx`

### Implementation

- [x] T018 [US4] Criar `src/game/ui/debt/DebtDock.tsx` com os cinco números e as três ações
- [x] T019 [US4] Mover a escolha de credor para dentro da faixa, sem um botão por adversário
- [x] T020 [US4] Remover o clima de dívida do `GameHUD` e montar a faixa em `src/game/ui/GameHUD.tsx`
- [x] T021 [US4] Reservar a altura da faixa no palco em `src/index.css`, incluindo a forma compacta em paisagem estreita
- [x] T022 [P] [US4] Registrar o caso da faixa no laboratório visual em `src/game/ui/lab/cases.ts` — `debt-short` e `debt-payable` já existiam e passaram a renderizar a faixa; nenhum caso novo foi necessário

**Checkpoint**: nenhuma casa coberta, tabuleiro operável, Esc sem efeito.

---

## Phase 6: Polish & Cross-Cutting

- [x] T023 Atualizar comentários de cabeçalho que descreviam a dívida como cartão centralizado
- [x] T024 Atualizar `CONTEXT.md` com Vencimento, Contrapartida mínima e Faixa de cobrança
- [x] T025 Rodar os testes focados de `quickstart.md`
- [x] T026 Rodar `bun run typecheck`, `bun run lint` e `bun run build`
- [x] T027 Rodar `bunx vitest run --maxWorkers=1`
- [x] T028 Rodar o gate exato `bunx vitest run tests/game`

## Dependencies & Execution Order

- US1 bloqueia US2 (o vencimento precisa existir antes de falhar por caixa).
- US3 e US4 são independentes de US1/US2 e entre si.
- Testes de cada história são escritos e observados falhando antes da implementação correspondente.

## Implementation Strategy

1. Fechar o prazo no motor e provar o vencimento feliz.
2. Provar o vencimento sem caixa reusando a dívida existente.
3. Entregar a avaliação e o piso da troca.
4. Refazer a cobrança como faixa.
5. Rodar os gates completos.
