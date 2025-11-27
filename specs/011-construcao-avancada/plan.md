# Implementation Plan: Construção avançada — 2º hotel, Hangar e Skyscraper

**Branch**: `main` (feature dir `011-construcao-avancada`) | **Date**: 2026-05-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/011-construcao-avancada/spec.md`

## Summary

Estender o ladder de construção do 004 (casas→hotel→**2º hotel**→**Skyscraper**) e adicionar o **Hangar** de aeroporto. Três mecânicas:

1. **2º hotel** (§14): novo nível 6. `buildHouse`/`sellBuilding` (004) passam a subir/descer até o 2º hotel; custo = custo do hotel; consome/devolve 1 de `bank.hotels`; **não muda o aluguel**.
2. **Hangar** (§13.6): flag `hangar` em `Title` de aeroporto; comandos `buildHangar`/`sellHangar` ($100/$50 provisórios); `resolveRentable` dobra o aluguel daquele aeroporto quando tem Hangar.
3. **Skyscraper** (§13.7): novo nível 7, **exige grupo completo** + todas as cidades no 2º hotel + `bank.skyscrapers ≥ 1`; consome só 1 Skyscraper do estoque (nada de hotéis volta — clarify); aluguel **fixo** alto; **triplica** o aluguel das demais cidades do grupo sem Skyscraper.

Modelo: `Title += hotel2, skyscraper, hangar`; `BankStock += skyscrapers`; `cityLevel` 0–7. `rentCity` (004/003) ganha o caso Skyscraper (fixo) e o multiplicador ×3 de grupo; `resolveRentable` passa os novos flags + `groupHasSkyscraper` e dobra aeroporto com Hangar. `falencia`/`netWorth` passam a contar 2º hotel/Skyscraper/Hangar. **Sem UI** (construção nunca esteve no HUD mínimo; fica para M2).

## Technical Context

**Language/Version**: TypeScript ~6.0 (React 19 + Vite 8)

**Primary Dependencies**: as de 002–010 — React, Vite, Tailwind, **Zustand**, **Vitest**. Nenhuma nova.

**Storage**: runtime/Zustand. **Campos novos**: `Title.hotel2/skyscraper/hangar` (bool) e `BankStock.skyscrapers` (number). Serializável.

**Testing**: Vitest. Construção/venda/aluguel são puros → determinístico.

**Target Platform**: Web (desktop-first).

**Project Type**: SPA frontend único.

**Performance Goals**: O(grupo) por construção/aluguel; trivial.

**Constraints**: lógica **pura** (efeito só no store); estado **serializável**; reusa o gating/uniformidade do 004; bloqueado sob `paused`.

**Scale/Scope**: estende `economy/construction.ts` e `economy/rent.ts`; ajusta `economy/resolveRentable.ts`, `economy/titles.ts`, `economy/types.ts`, `falencia/falencia.ts`, `cards/effects.ts` (netWorth), `store.ts` (seed + comandos de Hangar). Sem UI.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Avaliação | Status |
|---|---|---|
| **I. SRS é verdade absoluta** | Operacionaliza §14, §13.6 e §13.7. Ambiguidade do Skyscraper×estoque resolvida em clarify; valores de tema provisórios (padrão do 004). | ✅ |
| **II. Discovery antes de código** | Spec aprovada + clarificada; usuário autorizou o pipeline e o escopo (trio; Tax Man → 012). | ✅ |
| **III. Tesouro precisa impactar** | N/A. | ✅ |
| **IV. Catch-up é discreto** | N/A (estas 3 não são catch-up; o Tax Man, que é, ficou no 012). | ✅ |
| **V. Sem dependência de cooperação** | 2º hotel funciona em grupo parcial (como casas a 70%). **Skyscraper exige grupo completo**, mas é **luxo de topo**, não o caminho-base de progresso — o caminho sem cooperação (grupo parcial) segue intacto. | ✅ |
| **VI. Privacidade de cartas** | N/A. | ✅ |
| **VII. Resiliência de sessão** | Só flags/contadores em `Title`/`bank` (JSON puro); reuso de funções puras. | ✅ |

**Resultado:** sem violações. Complexity Tracking vazio.

## Project Structure

### Documentation (this feature)

```text
specs/011-construcao-avancada/
├── plan.md · research.md · data-model.md · quickstart.md
├── contracts/construcao-avancada.md
├── checklists/requirements.md
└── tasks.md   # /speckit-tasks (NÃO aqui)
```

### Source Code (repository root)

```text
src/game/economy/types.ts          # MOD — Title += hotel2/skyscraper/hangar; BankStock += skyscrapers
src/game/economy/construction.ts   # MOD — cityLevel 0..7; buildHouse/sellBuilding sobem ao 2º hotel/Skyscraper; buildHangar/sellHangar; gate de grupo completo p/ Skyscraper; constantes
src/game/economy/rent.ts           # MOD — rentCity: Skyscraper (fixo) + ×3 de grupo; SKYSCRAPER_RENT_MULT
src/game/economy/resolveRentable.ts# MOD — passa hotel2/skyscraper + groupHasSkyscraper; aeroporto ×2 com Hangar
src/game/economy/titles.ts         # MOD — groupHasSkyscraper(state, group)
src/game/falencia/falencia.ts      # MOD — devolve 2º hotel/Skyscraper ao estoque; liquidationValue conta os novos níveis
src/game/cards/effects.ts          # MOD — netWorth conta 2º hotel/Skyscraper/Hangar
src/game/store.ts                  # MOD — seed (flags + bank.skyscrapers); comandos buildHangar/sellHangar

tests/game/economy/
└── construcao-avancada.test.ts    # SC-001..005 — 2º hotel, Hangar, Skyscraper (build/sell/aluguel/uniformidade/estoque)
```

**Structure Decision**: o trio é uma **extensão do 004**, então mora nos mesmos módulos (`construction.ts`/`rent.ts`) reusando uniformidade, estoque e venda-a-metade. `buildHouse`/`sellBuilding` sobem/descem o ladder inteiro (casas→hotel→2º hotel→Skyscraper) — a superfície de comando do store não cresce para cidades. O Hangar, por viver em aeroportos (fora do ladder de cidade), ganha comandos próprios. Sem UI: construção não está no HUD mínimo (M2).

## Complexity Tracking

> Sem violações de constituição. Seção intencionalmente vazia.
