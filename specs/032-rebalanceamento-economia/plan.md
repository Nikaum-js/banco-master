# Implementation Plan: Rebalanceamento de economia e tabuleiro

**Branch**: `main` | **Date**: 2026-05-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/032-rebalanceamento-economia/spec.md`

## Summary

Recalibrar a economia sem nova mecânica: (1) **custo de casa = tier por grupo** (substitui `preço × 0,5`); (2) **aluguel = multiplicadores por grupo** (substitui o multiplicador único), curva clássica suavizada (hotel-topo navy ~$1.800, sweet spot orange/red); (3) **rebalance do board** (laranja→3, verde premium 4); (4) reconciliar SRS §2.3/§5.1 + ADR. Tudo via `theme.ts` (fonte única) + `boardData.ts`, com `construction.ts` e `rent.ts` lendo as novas estruturas.

**Ponto técnico crítico:** hoje a ladder de aluguel é calculada em **dois lugares que divergem** — `rentCity` (motor, `rent.ts`, usa `THEME.*_RENT_MULT`) e `computeRents` (UI, `shared.tsx`, multiplicadores próprios desatualizados: rent×5/15/40/70/100/150). Vou unificar numa **única função pura `rentLadder(group, base)`** no motor, consumida por `rentCity` E pelas UIs (deed do leilão comum em `ModalLayer`, cards do pregão 031, popovers). Assim os valores nunca mais divergem.

## Technical Context

**Language/Version**: TypeScript 5 (strict), React 18

**Primary Dependencies**: React + Vite + Tailwind + Zustand. Sem libs novas.

**Storage**: N/A — mudança é de **valores/constantes** no tema + dados do board. `GameState` inalterado (sem novo campo serializável).

**Testing**: Vitest (`bunx vitest run tests/game`). Vários testes assertam valores antigos (construction, construcao-avancada, deedView, landAuction) → atualizar para os novos.

**Target Platform**: Web (SPA), single-client; multiplayer = M3 (sem impacto aqui).

**Project Type**: Single project — motor puro em `src/game/`, dados em `src/lib/boardData.ts`, valores em `src/game/theme.ts`, UI em `src/game/ui/` + `src/boards/shared.tsx`.

**Performance Goals**: cálculo O(1) por aluguel; sem impacto.

**Constraints**: valores no tema (fonte única, 018); reducers puros inalterados; **não** reintroduzir `bank`/`BankStock` (D-022); aeroportos/utilidades/impostos/caixa/GO inalterados; pt-BR.

**Scale/Scope**: 28 cidades, 9 grupos, 7 níveis de construção. Mudança concentrada em ~5 arquivos de código + 3 docs + testes.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Avaliação |
|---|---|
| **I. SRS é verdade** | A feature **corrige** o SRS §2.3 (que diverge do board real) e atualiza §5.1, + ADR — a regra passa a viver certa no SRS. ✅ |
| **II. Discovery antes de código** | Spec 032 aprovada; plano agora; implement só após aprovação. ✅ |
| **III. Tesouro impacta** | N/A. ✅ |
| **IV. Catch-up discreto** | A curva mais suave **ajuda quem está atrás a sobreviver** (sem falência num hotel), mas é regra global, **sem rótulo** de catch-up. Sweet spots = expressão de skill, neutra. Sem violação. ✅ |
| **V. Sem cooperação obrigatória** | Grupo parcial (§13.3) inalterado; maioria segue 2/3 ou 3/4. ✅ |
| **VI. Privacidade de cartas** | N/A. ✅ |
| **VII. Resiliência de sessão** | Sem mudança de estado serializável (só constantes/dados). ✅ |

**Resultado:** sem violações. `Complexity Tracking` vazio.

## Project Structure

### Documentation (this feature)

```text
specs/032-rebalanceamento-economia/
├── plan.md
├── research.md          # decisões técnicas (fonte única do ladder, modelo de tema)
├── data-model.md        # estruturas do tema + board final (cidades/preços/bases/grupos)
├── contracts/
│   └── economy.md       # contrato: theme (HOUSE_COST/RENT_MULT), rentLadder, buildCost
├── quickstart.md
└── tasks.md             # /speckit-tasks (NÃO aqui)
```

### Source Code (repository root)

```text
src/game/
├── theme.ts              # remove BUILD_COST_RATIO + *_RENT_MULT únicos; adiciona
│                         #   HOUSE_COST: Record<GroupKey, number> (tiers) e
│                         #   RENT_MULT: Record<GroupKey, { houses:[4], hotel, hotel2, skyscraper }>
├── economy/
│   ├── rent.ts           # NOVO `rentLadder(group, base)` (fonte única) + rentCity passa a usá-lo
│   └── construction.ts   # buildCost lê HOUSE_COST[group] (não mais price×ratio)
└── ui/
    ├── modals/ModalLayer.tsx        # deedRows usa rentLadder (não computeRents próprio)
    └── landAuction/LandAuctionLayer.tsx # rentRows usa rentLadder
src/boards/
└── shared.tsx            # computeRents → reescrito p/ delegar a rentLadder(group, base)
src/lib/
└── boardData.ts          # rebalance: pos27 Hamburgo(orange), pos31 Hong Kong(red),
                          #   pos33–35 Rio/SP/Brasília(yellow); preços por posição (ascendente)

tests/game/               # atualizar asserts de valor: economy/construction, economy/construcao-avancada,
                          #   ui/deedView, economy/landAuction

docs/
├── SRS.md                # §2.3 (9 grupos: 8×3 + verde×4) + §5.1 (modelo por grupo + tiers)
└── DECISIONS.md          # atualizar D-017 (composição/economia) + ADR novo (recalibração)
```

**Structure Decision**: Single project; mudança concentrada em tema + board + 2 módulos do motor, com **unificação do cálculo de aluguel** numa função pura (`rentLadder`) para eliminar a divergência engine↔UI. Sem mudança de estado/serialização.

## Complexity Tracking

> Sem violações de constituição — seção vazia.
