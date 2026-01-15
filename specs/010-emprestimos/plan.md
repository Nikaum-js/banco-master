# Implementation Plan: Empréstimos entre jogadores

**Branch**: `main` (feature dir `010-emprestimos`) | **Date**: 2026-05-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/010-emprestimos/spec.md`

## Summary

Sistema de empréstimos (SRS §15) integrado à **dívida pendente** do 008. Três blocos:

1. **Conceder/quitar** (§15.2/§15.3): novo módulo `src/game/emprestimos/emprestimos.ts` + tipo `Loan` (`{ debtorId, creditorId, principal, ratePct }`) e campo `GameState.loans: Loan[]`. Comando `grantLoan(debtorId, creditorId, principal, ratePct)` valida (devedor é o ativo e está em `resolution.kind==='debt'`; devedor sem empréstimo ativo; `ratePct∈[10,50]`; `principal ≥ déficit` e `≤ caixa do credor`), transfere o principal credor→devedor e registra o empréstimo. `payOffLoan(debtorId)` paga **só o principal** ao credor e remove o empréstimo. Recusa = ausência de `grantLoan` (no-op).

2. **Juros no GO** (§15.3/§15.4): juros **simples** (`round(principal·ratePct/100)`) cobrados a cada passagem pelo GO. Hook por nova porta opcional `afterPassGo?(state, playerId)` chamada em `advance` **após** creditar o bônus de GO; a porta (wired no store para `chargeLoanInterest`) debita o devedor e credita o credor. Se o caixa (já com o bônus) não cobrir, debita até zerar e o restante **abre `resolution.kind==='debt'`** ao credor (reuso 008).

3. **Falência §9.3/§15.5**: `declareBankruptcy` (008) ganha um ramo — se o falido é **devedor** de um empréstimo ativo, o **credor do empréstimo** herda as propriedades (construções→banco), assume hipotecas (permanecem sob o credor), recebe o caixa restante, e o empréstimo é **removido**. Precede o §9.2 (mesmo que a dívida-gatilho fosse a um terceiro).

HUD: na resolução `debt`, além de Pagar/Falir, expõe **Pedir empréstimo** (escolhe credor/valor/taxa no demo local); controle de **quitar** quando o ativo tem empréstimo; e status de empréstimos ativos (visível, §12.3).

## Technical Context

**Language/Version**: TypeScript ~6.0 (React 19 + Vite 8)

**Primary Dependencies**: as de 002–009 — React, Vite, Tailwind, **Zustand**, **Vitest**. Nenhuma nova.

**Storage**: runtime/Zustand. **Campo novo** `GameState.loans: Loan[]` (serializável; ids + números). Reusa a variante `debt` de `ResolutionSlice` (008). `Loan` em `economy/types.ts`.

**Testing**: Vitest. `grantLoan`/`payOffLoan`/`chargeLoanInterest`/ramo §9.3 são puros → determinístico (sem RNG).

**Target Platform**: Web (desktop-first).

**Project Type**: SPA frontend único.

**Performance Goals**: O(loans) por passagem de GO e por falência; trivial (≤ 8 jogadores, ≤ 8 empréstimos).

**Constraints**: lógica **pura** (efeito só no store); estado **serializável**. Empréstimo só na janela `debt`. Juros via porta opcional (002 não importa 010). Comandos bloqueados sob `paused`.

**Scale/Scope**: novo `emprestimos/` (1 arquivo) + `Loan` em `economy/types.ts` + `loans` em `turn/types.ts` + porta `afterPassGo` em `resolution.ts`/`advance` + ramo §9.3 em `falencia/falencia.ts` + comandos no store + HUD + testes.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Avaliação | Status |
|---|---|---|
| **I. SRS é verdade absoluta** | Operacionaliza §15 e §9.3/§15.5. Contradições §15.3×§15.4 e precedência §9.2×§9.3 resolvidas em clarify a favor do texto literal do §15.3/§9.3. | ✅ |
| **II. Discovery antes de código** | Spec aprovada + clarificada (4 questões); usuário autorizou o pipeline completo. | ✅ |
| **III. Tesouro precisa impactar** | N/A. | ✅ |
| **IV. Catch-up é discreto** | Empréstimo não é catch-up; é alavanca social/risco. Sem rótulo de UI especial. | ✅ |
| **V. Sem dependência obrigatória de cooperação** | Empréstimo é **opcional** — alternativa a liquidar/falir, nunca pré-requisito. Devedor sem empréstimo segue pelo §9.2. | ✅ |
| **VI. Privacidade de cartas** | N/A para cartas; empréstimos são **públicos** por design (§12.3 "status de empréstimos ativos"). | ✅ |
| **VII. Resiliência de sessão** | `loans` é JSON puro (ids+números); juros recalculáveis do principal; sem timers/closures. Comandos respeitam `paused`. | ✅ |

**Resultado:** sem violações. Complexity Tracking documenta a simplificação da sobreposição rara (juro-insuficiente + aluguel no mesmo GO).

## Project Structure

### Documentation (this feature)

```text
specs/010-emprestimos/
├── plan.md · research.md · data-model.md · quickstart.md
├── contracts/emprestimos.md
├── checklists/requirements.md
└── tasks.md   # /speckit-tasks (NÃO aqui)
```

### Source Code (repository root)

```text
src/game/emprestimos/
└── emprestimos.ts            # NOVO — activeLoanFor, grantLoan, payOffLoan, chargeLoanInterest (puras)
src/game/economy/types.ts     # MODIFICADO — + interface Loan
src/game/turn/types.ts        # MODIFICADO — GameState.loans: Loan[]
src/game/turn/resolution.ts   # MODIFICADO — TurnPorts += afterPassGo?(state, playerId)
src/game/turn/turnMachine.ts  # MODIFICADO — advance chama ports.afterPassGo após o bônus de GO
src/game/falencia/falencia.ts # MODIFICADO — declareBankruptcy: ramo §9.3 (credor do empréstimo herda)
src/game/store.ts             # MODIFICADO — loans:[] no seed; porta afterPassGo; comandos grantLoan/payOffLoan
src/game/ui/GameHUD.tsx        # MODIFICADO — pedir empréstimo (na dívida), quitar, status de empréstimos

tests/game/emprestimos/
└── emprestimos.test.ts       # SC-001..005 — conceder/validar, juros no GO, quitar, falência §9.3, limite 1
```

**Structure Decision**: empréstimo é uma entidade econômica nova → módulo próprio `emprestimos/` (como `falencia/`), com `Loan` em `economy/types.ts` (padrão: `turn/types` importa de `economy/types`, nunca o contrário). A cobrança no GO entra por **porta opcional** (`afterPassGo`), mantendo o 002 desacoplado (mesmo padrão de `onInsolvency?`). O ramo §9.3 vive no `falencia.ts` (já dono de `declareBankruptcy`), lendo `state.loans` direto — sem novo acoplamento de import. A janela de solicitação é a resolução `debt` existente; o HUD acrescenta "Pedir empréstimo" ao lado de Pagar/Falir.

## Complexity Tracking

> Sem violações de constituição. Única simplificação registrada (research R5):

| Item | Decisão | Simpler/Alternativa rejeitada |
|---|---|---|
| Juro-insuficiente no GO **e** aluguel impagável no **mesmo** GO-pass (dois credores, um slot de `resolution`) | O juro insuficiente abre o `debt` (slot único); nesse overlap raro a casa de pouso **não** é re-resolvida naquele turno | Pilha de resoluções / múltiplos slots — complexidade desproporcional para um caso raríssimo |
