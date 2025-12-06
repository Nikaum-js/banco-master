# Implementation Plan: Tema "Cidades do Mundo" — valores oficiais

**Branch**: `main` (feature dir `018-tema-cidades-do-mundo`) | **Date**: 2026-05-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/018-tema-cidades-do-mundo/spec.md`

## Summary

**Calibração + oficialização** do tema (sem nova regra; modelo base×multiplicador mantido). Novo `src/game/theme.ts` = **fonte única** dos knobs econômicos (hoje espalhados em 6 módulos), com os **mesmos valores** (zero mudança de comportamento). Os módulos passam a **derivar** de `theme.ts` preservando seus exports atuais (`HANGAR_COST`, `JAIL_FINE`, `PARKING_SEED`, `buildCost`, mults de aluguel, etc.). Polimento: renomear os 4 aeroportos (corrige nomes duplicados "Nova York"/"Tóquio"). Relabelar o `boardData` ("provisório" → oficial/tunável) e adicionar `docs/TEMA.md` (ficha do tema). Prova de não-regressão: a suíte 002–017 fica **verde sem editar testes**.

## Technical Context

**Language/Version**: TypeScript ~6.0 (React 19 + Vite 8)

**Primary Dependencies**: as de 001–017. Nenhuma nova.

**Storage**: runtime/Zustand. **Sem estado novo** no `GameState`. `theme.ts` é constantes em tempo de compilação.

**Testing**: Vitest. Prova de não-regressão = suíte atual verde sem edição.

**Target Platform**: Web (desktop-first).

**Project Type**: SPA frontend único.

**Performance Goals**: N/A (constantes).

**Constraints**: **zero mudança de valor observável** (oficialização preserva os números); `theme.ts` é folha (sem ciclos); exports atuais preservados.

**Scale/Scope**: novo `theme.ts` + reescrita dos literais em `store.ts`/`rent.ts`/`construction.ts`/`balancing.ts`/`mortgage.ts`/`turn/turnMachine.ts` para derivar de `theme.ts`; renomear aeroportos + relabelar comentário em `boardData.ts`; `docs/TEMA.md`. Sem novos testes de motor (a suíte existente é a prova); 1 teste leve de "nomes únicos".

## Constitution Check

| Princípio | Avaliação | Status |
|---|---|---|
| **I. SRS é verdade absoluta** | §2/§3/§5/§13 dizem que os valores são dado de tema (tunável). Esta spec os oficializa num ponto único, sem inventar regra. | ✅ |
| **II. Discovery antes de código** | Spec aprovada; abordagem (calibrar+oficializar) escolhida pelo usuário. | ✅ |
| **III. Tesouro precisa impactar** | N/A (valores; sem mudança de efeito). | ✅ |
| **IV. Catch-up é discreto** | Mantém GO progressivo/Free Parking/Tax Man inalterados (só centraliza os números). | ✅ |
| **V. Sem dependência de cooperação** | N/A. | ✅ |
| **VI. Privacidade de cartas** | N/A. | ✅ |
| **VII. Resiliência de sessão** | `theme.ts` são constantes (não entram no estado serializável); nada muda no snapshot. | ✅ |

**Resultado:** sem violações. Complexity Tracking vazio.

## Project Structure

### Documentation (this feature)

```text
specs/018-tema-cidades-do-mundo/
├── plan.md · research.md · data-model.md · quickstart.md
├── contracts/theme.md
├── checklists/requirements.md
└── tasks.md   # /speckit-tasks (NÃO aqui)
```

### Source Code (repository root)

```text
src/game/theme.ts             # NOVO — fonte única dos knobs econômicos do tema (mesmos valores)
src/game/store.ts             # MOD — cash/bank/centerPot derivam de THEME
src/game/economy/rent.ts      # MOD — HOUSE/HOTEL/SKYSCRAPER mult, AIRPORT_RENT, UTILITY_MULT de THEME
src/game/economy/construction.ts # MOD — HANGAR_COST e razão de buildCost de THEME
src/game/economy/mortgage.ts  # MOD — razões 1/2, +10%, transfer 10% de THEME
src/game/balancing/balancing.ts # MOD — PARKING_SEED e faixa do GO de THEME
src/game/turn/turnMachine.ts  # MOD — JAIL_FINE de THEME
src/lib/boardData.ts          # MOD — renomear aeroportos (nomes únicos); relabelar comentário "provisório"
docs/TEMA.md                  # NOVO — ficha de referência do tema

tests/game/
└── theme.test.ts             # nomes de casa únicos + (sanity) THEME values batem com o seed
```

**Structure Decision**: `theme.ts` é a **fonte única** e folha (só primitivos). Cada módulo mantém seu **export atual** (ex.: `export const HANGAR_COST = THEME.hangarCost`) para não tocar nos importadores — a centralização é interna e os valores são idênticos, então a suíte 002–017 prova a não-regressão sem edição. O polimento de nomes e o doc completam a "oficialização". Sem novo estado/regra.

## Complexity Tracking

> Sem violações de constituição. Seção intencionalmente vazia.
