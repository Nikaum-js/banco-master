# Implementation Plan: Tax Man (Fiscal)

**Branch**: `main` (feature dir `012-tax-man`) | **Date**: 2026-05-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/012-tax-man/spec.md`

## Summary

Token **Fiscal** do banco que se move **uma vez por turno** (no fim de cada turno) e, se parar em propriedade com dono não hipotecada, **debita do dono** o aluguel daquela propriedade — valor **removido da economia** (banco), catch-up deflacionário e discreto (§13.8, princípio IV).

Tecnicamente é **automático** (sem decisão/UI): entra por uma **porta opcional** `taxMan?(state, rng)` chamada em `advanceSeat` (002) — o único choke point de "turno terminou". Novo `GameState.taxManPos` (inicia em GO=0). Novo módulo puro `src/game/balancing/taxMan.ts` (`rollTaxMan`) que rola 2 dados brancos, move o token (movimento **puro** — sem GO/prisão/carta) e cobra o dono reusando `rentCity`/`rentAirport`/`rentUtility` (003/011). O `defaultPorts` (usado pelos testes) **não** recebe o Fiscal — só o `ctx` do store o injeta — garantindo **zero regressão** nos testes existentes que chamam `advanceSeat` com `defaultPorts`.

## Technical Context

**Language/Version**: TypeScript ~6.0 (React 19 + Vite 8)

**Primary Dependencies**: as de 002–011 — React, Vite, Tailwind, **Zustand**, **Vitest**. Nenhuma nova.

**Storage**: runtime/Zustand. **Campo novo** `GameState.taxManPos: number` (seed 0). Serializável.

**Testing**: Vitest. `rollTaxMan` é puro e determinístico sob RNG injetável.

**Target Platform**: Web (desktop-first).

**Project Type**: SPA frontend único.

**Performance Goals**: O(1) por turno; trivial.

**Constraints**: lógica **pura** (efeito só no store); estado **serializável**; automático (sem nova fase de FSM); não opera com partida encerrada. 002 não importa balanceamento — o Fiscal entra pela porta `taxMan`.

**Scale/Scope**: novo `balancing/taxMan.ts` + `taxManPos` em `turn/types.ts` + porta `taxMan` em `turn/resolution.ts` + chamada em `advanceSeat` (`turn/turnMachine.ts`) + seed/wiring no `store.ts`. Sem UI.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Avaliação | Status |
|---|---|---|
| **I. SRS é verdade absoluta** | Operacionaliza §13.8. Destino do dinheiro (banco/removido) resolvido em clarify a favor do literal + framing de catch-up. | ✅ |
| **II. Discovery antes de código** | Spec aprovada + clarificada; usuário autorizou o pipeline e o escopo (Tax Man como 012). | ✅ |
| **III. Tesouro precisa impactar** | N/A. | ✅ |
| **IV. Catch-up é discreto** | **Central aqui**: o Fiscal pune o líder sem rótulo de catch-up na UI; automático e silencioso. Dinheiro removido (não premia ninguém diretamente → "beneficia indiretamente"). | ✅ |
| **V. Sem dependência de cooperação** | N/A (não é gate de progresso). | ✅ |
| **VI. Privacidade de cartas** | N/A. | ✅ |
| **VII. Resiliência de sessão** | Só `taxManPos` (número, JSON puro); `rollTaxMan` puro/determinístico sob RNG; sem timers/closures. Não opera pausado/encerrado. | ✅ |

**Resultado:** sem violações. Complexity Tracking documenta a simplificação (Fiscal não falir jogador não-ativo).

## Project Structure

### Documentation (this feature)

```text
specs/012-tax-man/
├── plan.md · research.md · data-model.md · quickstart.md
├── contracts/tax-man.md
├── checklists/requirements.md
└── tasks.md   # /speckit-tasks (NÃO aqui)
```

### Source Code (repository root)

```text
src/game/balancing/taxMan.ts   # NOVO — rollTaxMan(state, rng): move o Fiscal e cobra o dono (puro/mutável)
src/game/turn/types.ts         # MOD — GameState.taxManPos: number
src/game/turn/resolution.ts    # MOD — TurnPorts += taxMan?(state, rng): void
src/game/turn/turnMachine.ts   # MOD — advanceSeat chama ctx.ports.taxMan?.(s, ctx.rng)
src/game/store.ts              # MOD — seed taxManPos:0; ctx injeta taxMan (defaultPorts NÃO)

tests/game/balancing/
└── taxMan.test.ts             # SC-001..005 — move/cobra, isenções, 1×/turno, própria propriedade, determinismo
```

**Structure Decision**: o Fiscal é mecânica de balanceamento → módulo em `balancing/` (como `balancing.ts`). Por ser automático e disparar no fim de **qualquer** turno, o gancho é `advanceSeat` (choke point único de transição de turno) via **porta opcional** — sem nova fase de FSM e sem acoplar 002 ao balanceamento. `defaultPorts` permanece sem o Fiscal (testes existentes que chamam `advanceSeat` não disparam cobrança → zero regressão); o store injeta o Fiscal no `ctx` do jogo real. Sem UI (efeito discreto/log; token visual fica para M2).

## Complexity Tracking

> Sem violações de constituição. Única simplificação registrada:

| Item | Decisão | Alternativa rejeitada |
|---|---|---|
| Dono sem caixa para a cobrança do Fiscal | Debita o que houver (até zerar); **não** falir o jogador (que pode ser não-ativo) | Abrir resolução `debt`/falência para um jogador não-ativo — a infra do 008 é centrada no jogador ativo; complexidade desproporcional para esta versão |
