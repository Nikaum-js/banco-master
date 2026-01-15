# Implementation Plan: Cartas — efeitos temporários de N voltas

**Branch**: `main` (feature dir `015-cartas-efeitos-temporarios`) | **Date**: 2026-05-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/015-cartas-efeitos-temporarios/spec.md`

## Summary

Subsistema de **efeitos temporários de N voltas** + as 4 cartas que o usam (Apagão, Greve, Boicote, Imunidade Temporária). Novo `GameState.tempEffects: TempEffect[]` (`{ kind, ownerId, pos|null, lapsRemaining }`) e módulo puro `economy/tempEffects.ts` (consultas + registro + `tickTempEffects`). Expiração reusa o gancho `afterPassGo` (010/014): decrementa por passagem do **originador** pelo GO. **Apagão/Greve** são imediatos (handlers no `cards/effects.ts`, aplicados no saque); **Boicote/Imunidade** são de mão jogados no próprio turno com **alvo** (parâmetro em `playHandCard`). As consultas entram no `resolveRentable` (003) e no `taxMan` (012): boicote → sem aluguel; greve → utilidade $0; apagão → aeroporto sem dobra; imunidade-temp → bloqueia Boicote. HUD exibe os efeitos ativos. As 4 cartas saem de `deferido` → `implementado`.

## Technical Context

**Language/Version**: TypeScript ~6.0 (React 19 + Vite 8)

**Primary Dependencies**: as de 002–014 — React, Vite, Tailwind, **Zustand**, **Vitest**. Nenhuma nova.

**Storage**: runtime/Zustand. **Campo novo** `GameState.tempEffects: TempEffect[]` (seed `[]`). Serializável.

**Testing**: Vitest. Registro/consulta/expiração e os handlers puros/determinísticos.

**Target Platform**: Web (desktop-first).

**Project Type**: SPA frontend único.

**Performance Goals**: O(efeitos) por aluguel/GO; trivial.

**Constraints**: lógica **pura** (efeito só no store); serializável; expiração por GO do originador; Boicote/Imunidade bloqueados sob `paused` (via `playHandCard`).

**Scale/Scope**: `TempEffect` em `economy/types.ts` + `tempEffects` em `turn/types.ts` + novo `economy/tempEffects.ts` + handlers Apagão/Greve em `cards/effects.ts` + alvo em `cards/draw.ts` (Boicote/Imunidade) + checagens em `economy/resolveRentable.ts` e `balancing/taxMan.ts` + seed/`afterPassGo`/`playHandCard` no `store.ts` + catálogo (status) + HUD. Testes.

## Constitution Check

| Princípio | Avaliação | Status |
|---|---|---|
| **I. SRS é verdade absoluta** | Operacionaliza §10.6 (Apagão/Greve/Boicote/Imunidade Temporária). Ofensivas (016)/reação (017) fora de escopo. | ✅ |
| **II. Discovery antes de código** | Spec aprovada; usuário autorizou o pipeline e o escopo (bloco A). | ✅ |
| **III. Tesouro precisa impactar** | Imunidade Temporária (Tesouro) é defensiva e muda decisões (proteção de alvo). | ✅ |
| **IV. Catch-up é discreto** | N/A. | ✅ |
| **V. Sem dependência de cooperação** | N/A. | ✅ |
| **VI. Privacidade de cartas** | Mantida (cartas na mão privadas); os **efeitos ativos** no tabuleiro são públicos (§12.3) — correto. | ✅ |
| **VII. Resiliência de sessão** | `tempEffects` é JSON puro; registro/expiração puros; reusa `afterPassGo`; sem timers. | ✅ |

**Resultado:** sem violações. Complexity Tracking vazio.

## Project Structure

### Documentation (this feature)

```text
specs/015-cartas-efeitos-temporarios/
├── plan.md · research.md · data-model.md · quickstart.md
├── contracts/efeitos-temporarios.md
├── checklists/requirements.md
└── tasks.md   # /speckit-tasks (NÃO aqui)
```

### Source Code (repository root)

```text
src/game/economy/types.ts          # MOD — interface TempEffect
src/game/turn/types.ts             # MOD — GameState.tempEffects: TempEffect[]
src/game/economy/tempEffects.ts    # NOVO — apagaoActive/greveActive/isBoycotted/isTempImmune/addTempEffect/tickTempEffects
src/game/cards/effects.ts          # MOD — handlers apagao, greveUtilidades (registram efeito)
src/game/cards/draw.ts             # MOD — playHandCard ganha target?; Boicote/Imunidade registram efeito
src/game/economy/resolveRentable.ts# MOD — boicote (sem aluguel), greve (utilidade $0), apagão (aeroporto sem dobra)
src/game/balancing/taxMan.ts       # MOD — mesmas checagens (consistência)
src/game/cards/catalog.ts          # MOD — status 'implementado' p/ apagao, greve-utilidades, boicote, imunidade
src/game/store.ts                  # MOD — seed tempEffects:[]; afterPassGo += tickTempEffects; playHandCard(target?)
src/game/ui/GameHUD.tsx             # MOD — status dos efeitos ativos

tests/game/cards/
└── tempEffects.test.ts            # SC-001..005 — apagão, greve, boicote, imunidade-temp, expiração, Tax Man
```

**Structure Decision**: o subsistema temporário mora em `economy/tempEffects.ts` (consultas usadas por `resolveRentable`/`taxMan`, ambos economia/balanceamento; `cards/*` também importa para registrar — direção cards→economy já existente). Estado novo mínimo (`tempEffects`, separado de `immunities` do 014). Apagão/Greve reusam o registry de `applyEffect` (imediatas); Boicote/Imunidade reusam `playHandCard` com um `target?` (como o Atalho reusa um slice — aqui via parâmetro, mais simples). Expiração reusa `afterPassGo`. HUD só exibe (jogar carta com UI é M2).

## Complexity Tracking

> Sem violações de constituição. Seção intencionalmente vazia.
