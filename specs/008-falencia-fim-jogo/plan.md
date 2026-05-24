# Implementation Plan: Falência & Fim de jogo

**Branch**: `main` (feature dir `008-falencia-fim-jogo`) | **Date**: 2026-05-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/008-falencia-fim-jogo/spec.md`

## Summary

Fechar o ciclo econômico: cobrança obrigatória (aluguel/imposto) que excede o caixa cria uma **pendência de dívida** (`resolution` `debt`) que bloqueia o turno; o jogador **liquida** (vender construção/hipotecar, comandos de 004/005) e **paga** (`payDebt`), ou **declara falência** (`declareBankruptcy`). A falência destina os ativos sem empréstimo (§9.2: banco → propriedades livres/leilão; jogador → propriedades + caixa ao credor), **elimina** o jogador, e checa o **fim de jogo** (§9.5: 1 sobrevivente vence).

Tecnicamente: nova variante `ResolutionSlice` `{ kind:'debt'; amount; creditorId }`; novo `src/game/falencia/falencia.ts` (`liquidationValue`, `isBankrupt`, `resolveBankruptcy`, `payDebt`, `checkEndGame`). `resolveRentable` (003) e o handler de `tax` (002/007) passam a abrir a pendência quando o caixa não cobre. Reusa `buildCost` (004), `mortgageValue` (005), `advanceSeat`/`eliminated` (002). O leilão dos bens da dívida-ao-banco é **simplificado** para "propriedades voltam ao banco (livres)" nesta versão (regra-alvo = leilão, §9.2).

## Technical Context

**Language/Version**: TypeScript ~6.0 (React 19 + Vite 8)

**Primary Dependencies**: as do 002–007 — React, Vite, Tailwind, **Zustand**, **Vitest**. Nenhuma nova.

**Storage**: runtime/Zustand. Estende `ResolutionSlice` (variante `debt`). `phase` (já existe) passa a `'ended'`. Sem outros campos novos. Serializável.

**Testing**: Vitest. `liquidationValue`/`resolveBankruptcy`/`checkEndGame` puros → determinístico.

**Target Platform**: Web (desktop-first).

**Project Type**: SPA frontend único.

**Performance Goals**: O(propriedades) por falência; trivial.

**Constraints**: lógica **pura** (efeito só no store); estado **serializável**. A pendência de dívida **bloqueia** finalizar (reusa o gating de `pendingResolve`/`resolution`). `declareBankruptcy` elimina e avança a vez (reusa `advanceSeat`).

**Scale/Scope**: novo `falencia/` (1 arquivo) + variante `debt` em `economy/types.ts` + ajuste de `resolveRentable`/handler `tax` para abrir a dívida + comandos no store + checagem de fim de jogo.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Avaliação | Status |
|---|---|---|
| **I. SRS é verdade absoluta** | Operacionaliza §9.1/§9.2/§9.4/§9.5. §9.3 (empréstimo) e imunidades deferidos com justificativa. | ✅ |
| **II. Discovery antes de código** | Plan é design; usuário autorizou o pipeline completo. | ✅ |
| **III. Tesouro precisa impactar** | N/A. | ✅ |
| **IV. Catch-up é discreto** | N/A (falência não é catch-up). | ✅ |
| **V. Sem dependência obrigatória de cooperação** | N/A. | ✅ |
| **VI. Privacidade de cartas** | N/A. | ✅ |
| **VII. Resiliência de sessão** | Só variante `debt` (serializável) e `phase='ended'`; tudo puro/determinístico. | ✅ |

**Resultado:** sem violações. Complexity Tracking vazio.

## Project Structure

### Documentation (this feature)

```text
specs/008-falencia-fim-jogo/
├── plan.md · research.md · data-model.md · quickstart.md
├── contracts/falencia.md
├── checklists/requirements.md
└── tasks.md   # /speckit-tasks (NÃO aqui)
```

### Source Code (repository root)

```text
src/game/falencia/
└── falencia.ts            # NOVO — liquidationValue, isBankrupt, resolveBankruptcy, payDebt, checkEndGame (puras)
src/game/economy/types.ts  # MODIFICADO — ResolutionSlice += { kind:'debt'; amount; creditorId }
src/game/economy/resolveRentable.ts # MODIFICADO — aluguel sem caixa → abre dívida (em vez de onInsolvency)
src/game/turn/resolution.ts # MODIFICADO — handler tax sem caixa → abre dívida
src/game/store.ts          # MODIFICADO — comandos payDebt / declareBankruptcy
src/game/ui/GameHUD.tsx     # MODIFICADO — estado de dívida (Pagar / Falir) + fim de jogo

tests/game/falencia/
└── falencia.test.ts       # SC-001..004 — insolvência, destino dos ativos, eliminação, fim de jogo
```

**Structure Decision**: a dívida é uma **resolução pendente** (como compra/leilão), reusando o gating do turno. `falencia.ts` concentra a lógica pura; `resolveRentable`/`tax` só **abrem** a dívida quando o caixa não cobre. `declareBankruptcy` reusa `advanceSeat` (002) e checa o fim de jogo. O HUD ganha os botões Pagar/Falir e a tela de vencedor — completa o demo (dá pra perder/ganhar).

## Complexity Tracking

> Sem violações de constituição. Seção intencionalmente vazia.
