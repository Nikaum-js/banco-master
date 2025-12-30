# Implementation Plan: Distrito Super-Luxo "Alta Roda"

**Branch**: `main` | **Date**: 2026-05-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/033-distrito-super-luxo/spec.md`

## Summary

Adicionar um **10º grupo "Alta Roda" (super-luxo)** — 2 cidades (Mônaco, Dubai) no clímax do tabuleiro, ultra-premium, como **armadilha de prestígio**. Reusa o modelo 032/D-024 (`HOUSE_COST` + `RENT_MULT` por grupo, fonte única `rentLadder`): só **adiciona uma entrada de grupo**, uma **cor nova** e **reestrutura o lado direito** do board (verde 4→3 remove Chicago; navy 3→2 remove Lyon; +Mônaco/Dubai). Sem mecânica nova.

**Ponto técnico principal:** a cor do grupo vive em **3 fontes** que precisam ganhar a entrada `platinum` juntas — `GROUPS` (`boardData.ts`), `GROUP_COLOR` (`shared.tsx`) e `--color-group-platinum` no `index.css` (Tailwind v4 `@theme` → gera `bg-group-platinum`). Esquecer uma quebra a faixa/o deed.

## Technical Context

**Language/Version**: TypeScript 5 (strict), React 18, Tailwind v4 (`@theme` em `index.css`).

**Primary Dependencies**: React + Vite + Tailwind + Zustand. Sem libs novas.

**Storage**: N/A — valores/constantes (tema) + dados do board + 1 token de cor. `GameState` inalterado.

**Testing**: Vitest (`bunx vitest run tests/game`). Atualizar `board.test` (composição 10 grupos) + `rebalance.test` (Alta Roda como topo/armadilha, ROI < sweet spots).

**Target Platform**: Web (SPA), single-client.

**Project Type**: Single project — board (`src/lib/boardData.ts`), tema (`src/game/theme.ts`), cor (`src/index.css` + `src/boards/shared.tsx`), motor de aluguel/construção reusado (`rent.ts`/`construction.ts`).

**Performance Goals**: O(1); sem impacto.

**Constraints**: reusar `rentLadder`/`RENT_MULT`/`HOUSE_COST` (D-024, fonte única); **não** reintroduzir `bank` (D-022); manter aeroportos/utilidades/impostos/caixa $2.000/GO; pt-BR; valores no tema.

**Scale/Scope**: +1 grupo (10 total), +2 cidades −2 cidades (28 mantido), +1 cor. ~4 arquivos de código + 3 docs + 2 testes.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Avaliação |
|---|---|
| **I. SRS é verdade** | Atualiza SRS §2.3 (10 grupos) + §5.1 + ADR (D-025/D-017). ✅ |
| **II. Discovery antes de código** | Spec 033 aprovada; plano agora; implement só com aprovação. ✅ |
| **III. Tesouro impacta** | N/A. ✅ |
| **IV. Catch-up discreto** | Super-luxo é **ralo de caixa/flex do líder** (risco), não rótulo de catch-up; a curva-armadilha não pune o atrasado de graça (raro de cair). Sem violação. ✅ |
| **V. Sem cooperação obrigatória** | Grupo de 2 exige as duas (maioria=2), mas é **propriedade própria** (compra/troca), não cooperação; o caminho de progresso sem grupo completo segue via grupo parcial 3-4 (D-004). Sem violação. ✅ |
| **VI. Privacidade de cartas** | N/A. ✅ |
| **VII. Resiliência de sessão** | Sem estado serializável novo. ✅ |

**Resultado:** sem violações. `Complexity Tracking` vazio.

## Project Structure

### Documentation (this feature)

```text
specs/033-distrito-super-luxo/
├── plan.md
├── research.md          # cor (3 fontes), economia do grupo, layout do lado direito
├── data-model.md        # grupo platinum + board final + RENT_MULT/HOUSE_COST + ROI
├── contracts/
│   └── super-luxo.md    # entradas a adicionar (GroupKey, GROUPS, GROUP_COLOR, CSS, theme)
├── quickstart.md
└── tasks.md             # /speckit-tasks (NÃO aqui)
```

### Source Code (repository root)

```text
src/lib/boardData.ts   # GroupKey += 'platinum'; GROUPS += platinum; rebalance lado direito
                       #   (40 Miami, 41 Cannes, 44 Paris, 46 Mônaco, 47 Dubai; Chicago/Lyon saem)
src/index.css          # @theme: + --color-group-platinum (ônix/dourado) → gera bg-group-platinum
src/boards/shared.tsx  # GROUP_COLOR += platinum (hex p/ stripes/tints/deeds)
src/game/theme.ts      # HOUSE_COST.platinum=300 + RENT_MULT.platinum (Dubai hotel ~2.300, sky ~3.600)

tests/game/board.test.ts        # composição: 10 grupos, navy 2, platinum 2 (Mônaco/Dubai); Chicago/Lyon fora
tests/game/economy/rebalance.test.ts  # Alta Roda = preço/hotel mais alto; ROI < orange/red; grupo de 2

docs/SRS.md            # §2.3 (10 grupos) + §5.1 (nota super-luxo)
docs/DECISIONS.md      # D-025 (novo) + atualizar D-017
```

**Structure Decision**: Single project; **aditivo** sobre o modelo 032 (mais um grupo + cor + remanejo do board). Nenhuma regra/estado novo — a economia já é por grupo via `rentLadder` (fonte única).

## Complexity Tracking

> Sem violações de constituição — seção vazia.
