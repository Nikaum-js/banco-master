# Implementation Plan: Balanceamento — GO Progressivo & Free Parking

**Branch**: `main` (feature dir `007-balanceamento-catchup`) | **Date**: 2026-05-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/007-balanceamento-catchup/spec.md`

## Summary

Completar duas mecânicas de catch-up que estavam como **portas no-op**: **GO Progressivo** (bônus por ranking de patrimônio, **creditado** ao caixa) e **Free Parking** (pote central que acumula imposto/multa-de-carta/multa-de-prisão e é coletado em Férias). Também **fecha o fluxo de dinheiro**: imposto e a multa de $50 da prisão passam a **debitar** o jogador.

Tecnicamente: adiciona `GameState.centerPot` (semente $500); cria `src/game/balancing/` com `goBonus(state, playerId)` (ranking por `netWorth` do 006, escala linear $100→$400). As **portas** do 002 (`onPassGo`/`onPayToCenter`/`onCollectCenter`) ganham `state` como 1º argumento e passam a **mutar o estado** (creditar bônus, somar/coletar pote) — o store injeta as implementações de balanceamento; o 002 **não** importa o 007 (mantém a fronteira). O `advance` (002) ganha `state` para creditar o GO; imposto (resolution) e multa de prisão (turnMachine) passam a debitar + alimentar o pote.

## Technical Context

**Language/Version**: TypeScript ~6.0 (React 19 + Vite 8)

**Primary Dependencies**: as do 002–006 — React, Vite, Tailwind, **Zustand**, **Vitest**. Nenhuma nova.

**Storage**: runtime/Zustand. Estende `GameState` com **`centerPot: number`**. Serializável (número).

**Testing**: Vitest. `goBonus`/pote são puros → determinístico. Atualiza testes de 002 (jail)/006 (efeitos) afetados pela nova assinatura das portas (ganham `state`).

**Target Platform**: Web (desktop-first).

**Project Type**: SPA frontend único.

**Performance Goals**: `goBonus` O(jogadores·propriedades) só ao passar pelo GO; trivial.

**Constraints**: lógica **pura** (efeito só no store); estado **serializável**. **Fronteira:** o 002 não importa o 007 — o balanceamento entra pelas **implementações das portas** injetadas no store (`onPassGo` → `goBonus`; `onPayToCenter`/`onCollectCenter` → pote). As portas ganham `state` como 1º arg e mutam o clone.

**Scale/Scope**: pequeno-médio. Novo `balancing/` (1–2 arquivos) + ajuste de assinatura de 3 portas e seus call-sites (advance, tax, jail, corner-parking, cards) + seed do pote.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Avaliação | Status |
|---|---|---|
| **I. SRS é verdade absoluta** | Operacionaliza §13.4/§13.5/§4.5/§4.10. Curva do GO é tunável (assumption documentada). | ✅ |
| **II. Discovery antes de código** | Plan é design; usuário autorizou o pipeline completo. | ✅ |
| **III. Tesouro precisa impactar** | N/A. | ✅ |
| **IV. Catch-up é discreto** | **Central:** GO Progressivo e Free Parking são exatamente os catch-ups do princípio IV; a UI mostra só o **valor** (sem rótulo de "perdendo"). | ✅ |
| **V. Sem dependência obrigatória de cooperação** | N/A. | ✅ |
| **VI. Privacidade de cartas** | N/A. | ✅ |
| **VII. Resiliência de sessão** | `centerPot` é número serializável; `goBonus` é puro/determinístico (ranking estável por assento). | ✅ |

**Resultado:** sem violações. Complexity Tracking vazio.

## Project Structure

### Documentation (this feature)

```text
specs/007-balanceamento-catchup/
├── plan.md · research.md · data-model.md · quickstart.md
├── contracts/balancing.md
├── checklists/requirements.md
└── tasks.md   # /speckit-tasks (NÃO aqui)
```

### Source Code (repository root)

```text
src/game/balancing/
└── balancing.ts          # NOVO — goBonus(state, playerId) (ranking) + payToCenter/collectCenter helpers
src/game/turn/types.ts    # MODIFICADO — GameState += centerPot
src/game/turn/resolution.ts # MODIFICADO — portas ganham `state`; handler de tax (debita+pote) e corner-parking (coleta)
src/game/turn/turnMachine.ts # MODIFICADO — advance(state, …) credita GO; jailDecision debita a multa
src/game/economy/resolveRentable.ts # (sem mudança de regra; já usa ctx.ports)
src/game/cards/effects.ts / draw.ts  # MODIFICADO — chamadas de advance/onPassGo/onPayToCenter com `state`
src/game/store.ts         # MODIFICADO — seed centerPot; portas reais (goBonus/pote); ctx

tests/game/balancing/
└── balancing.test.ts     # SC-001/005 — goBonus por ranking; SC-002/003/004 — pote (imposto/multa/Férias)
+ ajustes em tests/game/turn/jail.test.ts e tests/game/cards/effects.test.ts (nova assinatura das portas)
```

**Structure Decision**: o balanceamento entra **pelas portas** que o 002 já chama — só muda a **assinatura** (ganham `state`) e a **implementação** (injetada pelo store). Assim o 002 credita/roteia sem conhecer a fórmula (mantém a fronteira; nada de 002→007). `goBonus` reusa `netWorth` do 006. Custo previsto: atualizar os mocks de porta de 2 suítes (jail/efeitos) que passaram a receber `state`.

## Complexity Tracking

> Sem violações de constituição. Seção intencionalmente vazia.
