---
description: "Task list — Empréstimos entre jogadores"
---

# Tasks: Empréstimos entre jogadores

**Input**: Design documents from `/specs/010-emprestimos/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/emprestimos.md, quickstart.md

**Tests**: INCLUÍDOS — Vitest; funções puras (sem RNG). SC-001…005 como asserções.

**Organization**: por user story (P1 conceder / P2 juros & quitar / P3 falência §9.3) + polish. Reusa a resolução `debt` (008) e a porta de GO (002/007).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: paralelizável · **[Story]**: US1/US2/US3 (foundational/polish sem label)

## Path Conventions

Novo `src/game/emprestimos/emprestimos.ts`; `Loan` em `economy/types.ts`; `loans` em `turn/types.ts`; porta `afterPassGo` em `turn/resolution.ts` + `turn/turnMachine.ts`; ramo §9.3 em `falencia/falencia.ts`; comandos no `store.ts`; controles no `ui/GameHUD.tsx`. Testes em `tests/game/emprestimos/`.

---

## Phase 2: Foundational (Blocking Prerequisites)

- [X] T001 [P] Em `src/game/economy/types.ts`: `export interface Loan { debtorId: string; creditorId: string; principal: number; ratePct: number }`
- [X] T002 [P] Em `src/game/turn/types.ts`: `GameState += loans: Loan[]` (import type `Loan` de `economy/types`)
- [X] T003 Em `src/game/store.ts`: `loans: []` no `createSeedState`
- [X] T004 Em `src/game/emprestimos/emprestimos.ts`: `activeLoanFor(state, debtorId)`, `grantLoan(state, debtorId, creditorId, principal, ratePct)` (valida: `debt` ativo + devedor ativo; sem loan ativo; `ratePct∈[10,50]` inteiro; credor≠devedor e não eliminado; `principal ≥ amount−cash` e `≤ creditor.cash`; transfere e registra), `payOffLoan(state, debtorId)` (cash≥principal → paga principal, remove), `chargeLoanInterest(state, debtorId)` (juros simples; insuficiente → abre `debt` ao credor) — todas puras

**Checkpoint**: tipo, estado e a lógica pura de empréstimo prontos.

---

## Phase 3: User Story 1 - Pedir e receber um empréstimo (Priority: P1) 🎯 MVP

**Goal**: na resolução `debt`, o devedor obtém um empréstimo (credor define taxa) e usa o caixa para pagar a dívida; máx. 1 ativo por devedor.

**Independent Test**: pôr devedor em `debt` sem caixa; conceder com taxa válida; verificar transferência + registro; `payDebt` quita; segundo pedido é rejeitado.

### Tests for User Story 1 ⚠️

- [X] T005 [P] [US1] Vitest em `tests/game/emprestimos/emprestimos.test.ts`: `grantLoan` válido (principal credor→devedor, loan registrado); rejeições (sem `debt`, taxa fora de 10–50, credor sem caixa, `principal < déficit`, devedor já com loan, pausado); após conceder, `payDebt` (008) quita (SC-001/SC-005)

### Implementation for User Story 1

- [X] T006 [US1] Em `src/game/store.ts`: comando `grantLoan(creditorId, principal, ratePct)` (devedor = ativo) — interface `GameStore` + impl
- [X] T007 [US1] Em `src/game/ui/GameHUD.tsx`: na resolução `debt`, botão **Pedir empréstimo** (escolhe credor entre não-eliminados; principal default = déficit; taxa default 20%) → `grantLoan`; linha de **status de empréstimos ativos** (§12.3)

**Checkpoint**: empréstimo cobre a dívida como alternativa a liquidar/falir.

---

## Phase 4: User Story 2 - Juros no GO e quitação (Priority: P2)

**Goal**: juros simples debitados ao passar pelo GO (credor recebe); devedor quita pagando só o principal; credor não cancela.

**Independent Test**: com loan $500@20%, passar pelo GO → −$100 devedor/+$100 credor; quitar → remove loan; caixa insuficiente no GO → abre `debt` ao credor.

### Tests for User Story 2 ⚠️

- [X] T008 [P] [US2] Vitest em `tests/game/emprestimos/emprestimos.test.ts`: `chargeLoanInterest` cobra `round(principal·ratePct/100)` (devedor−/credor+); insuficiente pós-bônus → `resolution.kind==='debt'` ao credor; `advance` cruzando o GO dispara a cobrança via porta `afterPassGo`; `payOffLoan` paga só o principal e remove (SC-002/SC-003)

### Implementation for User Story 2

- [X] T009 [US2] Em `src/game/turn/resolution.ts`: `TurnPorts += afterPassGo?(state, playerId): void`
- [X] T010 [US2] Em `src/game/turn/turnMachine.ts`: em `advance`, após creditar `onPassGo` e marcar `completouPrimeiraVolta`, chamar `ports.afterPassGo?.(state, player.id)`
- [X] T011 [US2] Em `src/game/store.ts`: wire `afterPassGo: (state, id) => chargeLoanInterest(state, id)` em `defaultPorts`; comando `payOffLoan()` (devedor = ativo)
- [X] T012 [US2] Em `src/game/ui/GameHUD.tsx`: botão **Quitar empréstimo** quando o ativo é devedor e `cash ≥ principal` → `payOffLoan`

**Checkpoint**: o empréstimo tem custo por volta e pode ser encerrado.

---

## Phase 5: User Story 3 - Falência com empréstimo ativo §9.3 (Priority: P3)

**Goal**: devedor com loan ativo fale → credor do empréstimo herda propriedades (construções→banco) + caixa; loan liquidado. Sem loan → §9.2 inalterado.

**Independent Test**: criar loan ativo, levar devedor à falência → credor do empréstimo herda; verificar que sem loan o §9.2 não muda.

### Tests for User Story 3 ⚠️

- [X] T013 [P] [US3] Vitest em `tests/game/emprestimos/emprestimos.test.ts`: `declareBankruptcy` com loan ativo → propriedades+caixa ao **credor do empréstimo** (mesmo que a dívida fosse a um terceiro), hipotecas preservadas, loan removido, devedor eliminado; sem loan → §9.2 (008) inalterado; loan some quando o **credor** é eliminado (R8) (SC-004)

### Implementation for User Story 3

- [X] T014 [US3] Em `src/game/falencia/falencia.ts`: em `declareBankruptcy`, antes do destino dos ativos, `const loan = activeLoanFor(s, debtor.id)` → ramo §9.3 (destino = `loan.creditorId`, hipotecas preservadas, caixa ao credor, remove o loan) vs §9.2 atual; em ambos, remover `loans` onde o devedor era **credor** antes de `checkEndGame`/`advanceSeat`

**Checkpoint**: a falência §9.3 (deferida no 008) está fechada.

---

## Phase 6: Integração & Polish

- [X] T015 [P] Rodar `npx vitest run tests/game`: SC-001…005 verdes **e** zero regressão em 002–009 (atenção ao novo `loans` no seed e à porta `afterPassGo`); round-trip JSON com `loans`
- [X] T016 [P] `npm run build` verde (tsc -b + vite)

---

## Dependencies & Execution Order

- **Foundational (T001–T004)** bloqueia tudo (tipo `Loan`, `loans`, lógica pura).
- **US1 (P3)**: conceder + HUD. **US2 (P4)**: juros/quitar (depende de `loans`/lógica; porta + advance + store). **US3 (P5)**: falência §9.3 (depende de `activeLoanFor`).
- **Polish (P6)**: suíte + build.

### Parallel Opportunities

- T001/T002 [P] (arquivos distintos). T005/T008/T013 (testes por story) podem ser escritos em paralelo.
- ⚠️ Sequenciais por arquivo: `store.ts` (T003/T006/T011), `turnMachine.ts` (T010), `resolution.ts` (T009), `falencia.ts` (T014), `GameHUD.tsx` (T007/T012).

---

## Implementation Strategy

### MVP First (US1)

1. Foundational → US1 (conceder + pagar dívida com o empréstimo) → **VALIDAR** (SC-001/SC-005).

### Incremental Delivery

1. Fundação → 2. US1 (conceder) → 3. US2 (juros/quitar) → 4. US3 (falência §9.3) → 5. suíte + build.

---

## Notes

- Empréstimo só é solicitável na resolução `debt` (008). Déficit de leilão/construção fora de escopo (não gera `debt` hoje).
- Quitação = **só principal** (juros cobrados por volta); estado guarda apenas `{principal, ratePct}`.
- Simplificação (research R5): juro-insuficiente + aluguel impagável no mesmo GO-pass → slot único fica com a dívida de juros; casa de pouso não re-resolvida (raro).
- Credor eliminado antes da quitação → empréstimo liquidado/perdoado (R8).
- **`/speckit-implement` autorizado** para o pipeline desta feature.
