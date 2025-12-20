# Implementation Plan: Imunidade de aluguel (negociável)

**Branch**: `main` (feature dir `014-imunidade-aluguel`) | **Date**: 2026-05-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/014-imunidade-aluguel/spec.md`

## Summary

Imunidade de aluguel (§8.4 / D-010): concedida **dentro de uma troca** (estende a `Trade` do 013 com `fromImmunities`/`toImmunities` opcionais); registrada em `GameState.immunities` (`{ beneficiaryId, pos, lapsRemaining }`, `null`=permanente). O beneficiário é **isento** de aluguel ao parar na propriedade (`resolveRentable` checa `hasImmunity` antes de cobrar). Imunidade por N voltas **decrementa** a cada passagem do beneficiário pelo GO (porta `afterPassGo` do 010, já existente) e expira em 0; permanente não decrementa. **Pessoal** (não isenta outros, não cancela a propriedade); **visível** no HUD. Transferência de imunidade existente: **deferida** (FR-009).

## Technical Context

**Language/Version**: TypeScript ~6.0 (React 19 + Vite 8)

**Primary Dependencies**: as de 002–013 — React, Vite, Tailwind, **Zustand**, **Vitest**. Nenhuma nova.

**Storage**: runtime/Zustand. **Campo novo** `GameState.immunities: Immunity[]` (seed `[]`). Serializável.

**Testing**: Vitest. Concessão (via `executeTrade`), `hasImmunity` e `tickImmunities` puros/determinísticos.

**Target Platform**: Web (desktop-first).

**Project Type**: SPA frontend único.

**Performance Goals**: O(imunidades) por aluguel/GO; trivial.

**Constraints**: lógica **pura** (efeito só no store); estado **serializável**; concessão atômica com a troca (013); bloqueada sob `paused` (via `executeTrade`).

**Scale/Scope**: `Immunity` em `economy/types.ts` + `immunities` em `turn/types.ts` + novo `economy/imunidade.ts` (`hasImmunity`/`tickImmunities`) + extensão de `economy/trade.ts` (`ImmunityGrant` + validação/aplicação) + skip em `economy/resolveRentable.ts` + tick no `afterPassGo` do `store.ts` + HUD (status). Testes.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Avaliação | Status |
|---|---|---|
| **I. SRS é verdade absoluta** | Operacionaliza §8.4 / D-010. Transferência de imunidade existente deferida com justificativa (caso avançado). | ✅ |
| **II. Discovery antes de código** | Spec aprovada; usuário autorizou o pipeline e o escopo (imunidade como 014). | ✅ |
| **III. Tesouro precisa impactar** | N/A. | ✅ |
| **IV. Catch-up é discreto** | N/A. | ✅ |
| **V. Sem dependência de cooperação** | Imunidade é alavanca de barganha opcional, não gate de progresso. | ✅ |
| **VI. Privacidade de cartas** | Imunidades são **públicas** por design (§8.4 "exibidas a todos") — não confundir com cartas (privadas). | ✅ |
| **VII. Resiliência de sessão** | `immunities` é JSON puro (ids/números); concessão/expiração puras; reusa `afterPassGo`; sem timers. | ✅ |

**Resultado:** sem violações. Complexity Tracking vazio.

## Project Structure

### Documentation (this feature)

```text
specs/014-imunidade-aluguel/
├── plan.md · research.md · data-model.md · quickstart.md
├── contracts/imunidade.md
├── checklists/requirements.md
└── tasks.md   # /speckit-tasks (NÃO aqui)
```

### Source Code (repository root)

```text
src/game/economy/types.ts          # MOD — interface Immunity
src/game/turn/types.ts             # MOD — GameState.immunities: Immunity[]
src/game/economy/imunidade.ts      # NOVO — hasImmunity(state, benef, pos); tickImmunities(state, benef)
src/game/economy/trade.ts          # MOD — Trade += from/toImmunities?; valida (própria + mantida) e aplica
src/game/economy/resolveRentable.ts# MOD — beneficiário com imunidade no destino → { done:true } (sem aluguel)
src/game/store.ts                  # MOD — seed immunities:[]; afterPassGo também chama tickImmunities
src/game/ui/GameHUD.tsx             # MOD — status de imunidades ativas

tests/game/economy/
└── imunidade.test.ts              # SC-001..005 — concessão, isenção, pessoalidade, expiração, permanente, Tax Man
```

**Structure Decision**: a imunidade entra pela **troca** (013) — estender a `Trade` mantém "como parte da troca" (§8.4) e reusa a atomicidade do `executeTrade`. A expiração reusa o gancho `afterPassGo` (010) — `tickImmunities` roda no mesmo ponto dos juros de empréstimo. A isenção vive no `resolveRentable` (003) com um helper `hasImmunity`. Estado novo mínimo (`immunities`). Sem UI de proposta (HUD só **exibe**; montar a proposta é M2).

## Complexity Tracking

> Sem violações de constituição. Seção intencionalmente vazia.
