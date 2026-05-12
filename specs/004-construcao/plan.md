# Implementation Plan: Construção

**Branch**: `main` (feature dir `004-construcao`) | **Date**: 2026-05-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/004-construcao/spec.md`

## Summary

Adicionar **construção** (casas 0→4 → hotel) sobre a economia da 003: validar pré-requisitos (maioria do grupo, nada hipotecado, caixa, estoque), aplicar **uniformidade**, consumir/devolver o **estoque do banco** (40 casas / 16 hotéis), **vender** construções (metade; hotel→4 casas ou desmonte forçado), e fazer a **construção determinar o aluguel** (tabela × 70% parcial / 100% completo), preenchendo o ponto de extensão deixado em `rent.ts` pela 003. Em escassez, abre **leilão de casas** entre interessados (clarificação aprovada).

Tecnicamente: estende `Title` (003) com `houses`/`hotel`, adiciona `bank` (estoque) ao `GameState`, e cria `economy/construction.ts` com funções **puras** de build/sell/uniformidade. `rent.ts` passa a checar construção antes do escalonamento por posse. Os **valores** de custo e da tabela de aluguel por nível são **dado de tema** — entram como **multiplicadores provisórios** no código (como a escada de preços $60–$400 da 001), claramente marcados. O leilão de casas reusa o padrão de leilão da 003 (timer + deadline serializável), via um novo `ResolutionSlice` `house-auction`.

## Technical Context

**Language/Version**: TypeScript ~6.0 (React 19 + Vite 8)

**Primary Dependencies**: as do 002/003 — React, Vite, Tailwind, **Zustand**, **Vitest**. Nenhuma nova.

**Storage**: runtime/Zustand. Estende `GameState`: `Title.houses`/`Title.hotel` e `GameState.bank` (estoque). Tudo serializável.

**Testing**: Vitest. Build/sell/uniformidade/rent são puros → testes determinísticos. O leilão de casas reusa fake timers (como a 003).

**Target Platform**: Web (desktop-first).

**Project Type**: SPA frontend único.

**Performance Goals**: build/sell/rent O(tamanho do grupo) ≤ 4; sem I/O.

**Constraints**: estado **serializável** (estoque e construção são números/booleans; leilão de casas guarda `deadline`). Lógica **pura** (efeito só no store). Construção **não** reabre 002/003 — estende `Title` e `rent.ts` aditivamente.

**Scale/Scope**: 28 cidades construíveis; estoque 40/16. Escopo de código: novo `economy/construction.ts` + extensões em `economy/types.ts`, `economy/rent.ts`, `store.ts`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Avaliação | Status |
|---|---|---|
| **I. SRS é verdade absoluta** | Operacionaliza §5.1–5.5 e §13.3 + a clarificação do leilão de casas. Não inventa regra; valores concretos ficam como tema. | ✅ |
| **II. Discovery antes de código** | Plan é design; usuário autorizou o pipeline completo desta feature. | ✅ |
| **III. Tesouro precisa impactar** | Não toca cartas. | ✅ N/A |
| **IV. Catch-up é discreto** | Construção não expõe rótulo de catch-up. | ✅ |
| **V. Sem dependência obrigatória de cooperação** | **Reforça V:** grupo parcial (maioria) constrói a 70% — caminho de progresso sem grupo completo, sem gate de cooperação. | ✅ |
| **VI. Privacidade de cartas** | N/A. | ✅ |
| **VII. Resiliência de sessão** | `houses`/`hotel`/`bank` e o leilão de casas (`deadline`) são serializáveis; o timer do leilão de casas reusa o padrão store-level da 003 (reconstruível). | ✅ |

**Resultado:** sem violações. Complexity Tracking vazio.

## Project Structure

### Documentation (this feature)

```text
specs/004-construcao/
├── plan.md              # Este arquivo
├── research.md          # Fase 0 — decisões (construção em Title, multiplicadores provisórios, leilão de casas)
├── data-model.md        # Fase 1 — Title += houses/hotel; GameState += bank; HouseAuction
├── quickstart.md        # Fase 1 — verificação (SC-001..006 → testes)
├── contracts/
│   └── construction.md  # Fase 1 — comandos (build/sell + leilão de casas) + cálculo de aluguel com construção
├── checklists/
│   └── requirements.md  # Criado pelo /speckit-specify
└── tasks.md             # Fase 2 — /speckit-tasks (NÃO aqui)
```

### Source Code (repository root)

```text
src/game/economy/
├── construction.ts      # NOVO — buildHouse/sellBuilding/uniformidade/estoque (puras)
├── houseAuction.ts      # NOVO — leilão de casas em escassez (reusa padrão da 003)
├── types.ts             # MODIFICADO — Title += houses/hotel; BankStock; HouseAuction; ResolutionSlice += 'house-auction'
├── rent.ts              # MODIFICADO — rentCity considera construção (tabela 70%/100%) antes do escalonamento por posse
└── resolveRentable.ts   # MODIFICADO — usa o novo rentCity (aluguel com construção)
src/game/turn/types.ts   # MODIFICADO — GameState += bank (estoque)
src/game/store.ts        # MODIFICADO — seed do estoque; comandos buildHouse/sellBuilding/leilão de casas

tests/game/economy/
├── construction.test.ts # SC-001/002/004/005 — build, uniformidade, pré-requisitos, venda, desmonte
├── rent.test.ts         # MODIFICADO — SC-003 (aluguel com construção 70%/100% substitui posse)
└── houseAuction.test.ts # SC-006 — escassez → leilão de casas
```

**Structure Decision**: a feature **estende** a camada de economia (003) de forma aditiva: `Title` ganha `houses`/`hotel`, o `GameState` ganha o `bank` (estoque), e `rent.ts` ganha o ramo de construção **antes** do escalonamento por posse. Nada do 002 (FSM) é alterado; do 003, só `rent.ts`/`resolveRentable.ts`/`types.ts` recebem adições. Os valores de custo/aluguel por nível são **provisórios no código** (marcados como tema), espelhando a escada de preços provisória da 001.

## Complexity Tracking

> Sem violações de constituição. Seção intencionalmente vazia.
