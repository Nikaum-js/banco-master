# Implementation Plan: Transferência de imunidade existente (§8.4)

**Branch**: `main` | **Date**: 2026-05-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/028-transferir-imunidade/spec.md`

**Depende de**: 014 (imunidades / `hasImmunity` / `Immunity`) · 024 (Trade / validateTrade / executeTrade / compositor) · 019 (`granterId` / §9.4)

## Summary

Acrescentar **transferência** de imunidades existentes à negociação (§8.4), além da concessão de novas. `Trade` ganha `fromImmunityTransfers?: number[]` e `toImmunityTransfers?: number[]` (posições de imunidades das quais o ofertante é beneficiário). `validateTrade`: cada pos transferida deve ter `hasImmunity(state, ofertante, pos)` verdadeiro. `executeTrade`: para cada transferência, re-atribui o `beneficiaryId` da imunidade (ofertante → recebedor) preservando `lapsRemaining` e `granterId`. Concessão de novas (`fromImmunities`/`toImmunities`) inalterada; `acceptTrade` segue registrando/logando (027). UI: o compositor (TradeLayer) ganha, por lado, uma seção "Transferir imunidade" listando as imunidades que o jogador possui.

## Technical Context

**Language/Version**: TypeScript ~6.0, React 19

**Primary Dependencies**: Zustand, Tailwind, Vite 8, Vitest. Sem novas deps.

**Storage**: N/A — usa `GameState.immunities` (014) e `Trade` (024), serializáveis.

**Testing**: Vitest sobre `validateTrade` (transferência válida/inválida) + `executeTrade` (re-atribuição com voltas preservadas). Compositor validado no `bun run dev`.

**Target Platform**: Web (SPA), desktop.

**Project Type**: Single project (web SPA).

**Performance Goals**: 60 fps; validação O(transferências).

**Constraints**: Não mudar concessão de novas imunidades nem o resto da troca. Texto pt-BR.

**Scale/Scope**: 2 campos no `Trade` + 1 validação + re-atribuição no `executeTrade` + seção no compositor.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. SRS é fonte de verdade**: ✅ §8.4 ("imunidades são transferíveis"). Fecha o gap.
- **II. Discovery antes de código**: ✅ spec 028 aprovada.
- **III. Tesouro impacta**: ✅ n/a.
- **IV. Catch-up discreto**: ✅ n/a.
- **V. Sem cooperação obrigatória**: ✅ n/a (negociação é opcional).
- **VI. Privacidade de cartas**: ✅ imunidades são públicas; trade não tem cartas.
- **VII. Resiliência de sessão**: ✅ só re-atribui um campo de `Immunity` (serializável); nada efêmero.

**Resultado**: PASS. Concessão de novas + resto da troca intactos (suíte 013/014/024 verde). Sem Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/028-transferir-imunidade/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── transferencia.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── game/
│   ├── economy/types.ts    # Trade += fromImmunityTransfers? / toImmunityTransfers?
│   └── economy/trade.ts    # validImmunityTransfers (via hasImmunity); validateTrade chama; executeTrade re-atribui
└── game/ui/trade/TradeLayer.tsx  # compositor: seção "Transferir imunidade" por lado (US2) + resumo no recebido

tests/
└── game/economy/negociacao-ui.test.ts  # +casos de transferência (válida/inválida, re-atribuição, voltas)
```

**Structure Decision**: Single project. A regra fica em `economy/trade.ts` (junto da validação/execução de troca), reusando `hasImmunity` (014). A UI no compositor existente (024).

## Notas de design (resolvidas na Fase 0)

- **Identificação por pos**: a imunidade transferida é a do ofertante naquela propriedade — `validImmunityTransfers(state, transfers, ofertanteId)` = `transfers.every((p) => hasImmunity(state, ofertanteId, p))`.
- **Re-atribuição preservando**: em `executeTrade`, `const im = s.immunities.find(i => i.beneficiaryId === ofertante && i.pos === p)` → `im.beneficiaryId = recebedor` (mantém `lapsRemaining` + `granterId`). Aplicar `fromImmunityTransfers` (from→to) e `toImmunityTransfers` (to→from) **antes** de empurrar as concessões novas (evita casar uma recém-criada).
- **Coexistência**: concessão de novas (`fromImmunities`/`toImmunities`) inalterada; transferência é um conjunto separado.
- **UI (US2)**: no `Side` do compositor, além da seção de conceder (própria mantida), uma seção "Transferir imunidade" listando `game.immunities` onde `beneficiaryId === <lado>`; marcar inclui a pos em `fromImmunityTransfers`/`toImmunityTransfers`. O modal recebido lista as transferências (🛡️ "transfere X").
- **§9.4 (019)**: `granterId` preservado na transferência — a limpeza por eliminação continua removendo por granter/beneficiário; após transferir, o novo beneficiário é o recebedor (coerente).

## Complexity Tracking

> Sem violações de constitution — seção vazia.
