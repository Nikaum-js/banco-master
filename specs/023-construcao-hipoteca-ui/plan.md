# Implementation Plan: UI de construção e hipoteca (M2)

**Branch**: `main` | **Date**: 2026-05-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/023-construcao-hipoteca-ui/spec.md`

**Depende de**: 004 (construção) · 005 (hipoteca) · 011 (construção avançada) · 020 (seletor puro + store na UI) · popovers de `boards/shared.tsx`

## Summary

Ligar os popovers de propriedade (`PropertyPopover`/`AirportPopover`/`UtilityPopover`) ao estado real e dar-lhes **ações de gestão** (construir/vender casa, hangar, hipotecar/deshipotecar) quando a propriedade clicada é do **jogador da vez**. O coração testável é `deedView(game, pos) → DeedView`: dados reais do título + **flags de habilitação** de cada ação, derivadas de **predicados puros do motor**. Para não duplicar regra na UI, extraímos esses predicados (`canBuildHouse`/`canSellBuilding`/`canBuildHangar`/`canSellHangar`/`canMortgage`/`canUnmortgage`) em `economy/construction.ts` e `economy/mortgage.ts`, e os **comandos passam a delegar a eles** (refactor sem mudança de comportamento — os testes 004/005/011 continuam verdes). As marcas do tabuleiro (`BuildingMark`/`MortgageMark`) trocam o MOCK por `game.titles`.

## Technical Context

**Language/Version**: TypeScript ~6.0, React 19

**Primary Dependencies**: Zustand (store), Tailwind, Vite 8, Vitest, `motion/react` (já no popover). Sem novas deps.

**Storage**: N/A (estado em memória; `GameState` serializável).

**Testing**: Vitest sobre `deedView` + os novos predicados puros. Render dos popovers validado no `bun run dev` (sem RTL).

**Target Platform**: Web (SPA), desktop.

**Project Type**: Single project (web SPA).

**Performance Goals**: 60 fps; `deedView` é O(grupo) trivial.

**Constraints**: Não mudar **regras** do motor — só extrair guardas existentes em predicados (comportamento idêntico). Reusar o visual dos popovers. Texto pt-BR.

**Scale/Scope**: 1 seletor (`deedView`) + 6 predicados extraídos + ações em 3 popovers + 2 marcas do tabuleiro ligadas ao estado real.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. SRS é fonte de verdade**: ✅ regras de §6/§13/§14 já no motor; a feature só as expõe. Extrair predicados **mantém** a regra numa fonte só (reduz risco de divergência UI↔motor).
- **II. Discovery antes de código**: ✅ spec 023 aprovada (acesso decidido com o usuário) antes do plano.
- **III. Tesouro impacta**: ✅ n/a.
- **IV. Catch-up discreto**: ✅ n/a (gestão de propriedade não é catch-up).
- **V. Sem cooperação obrigatória**: ✅ construção em **grupo parcial** (maioria) é respeitada pelo motor (`canBuild` usa maioria) — exceto arranha-céu (§13.7, regra existente). A UI não introduz gate de cooperação.
- **VI. Privacidade de cartas**: ✅ n/a (títulos são públicos).
- **VII. Resiliência de sessão**: ✅ `deedView` é derivado do estado serializável; nada efêmero. Reabrir reconstrói a mesma visão.

**Resultado**: PASS. O refactor de extração de predicados não altera comportamento (coberto pelos testes existentes); sem entradas em Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/023-construcao-hipoteca-ui/
├── plan.md
├── research.md          # Fase 0
├── data-model.md        # Fase 1 (DeedView)
├── quickstart.md        # Fase 1
├── contracts/
│   └── deedView.md      # Contrato do seletor + predicados
├── checklists/requirements.md
└── tasks.md             # (/speckit-tasks)
```

### Source Code (repository root)

```text
src/
├── game/
│   ├── economy/
│   │   ├── construction.ts   # +canBuildHouse/canSellBuilding/canBuildHangar/canSellHangar (extrai guardas; comandos delegam)
│   │   └── mortgage.ts       # +canMortgage/canUnmortgage (extrai guardas; comandos delegam)
│   └── ui/
│       └── deed/
│           └── deedView.ts   # NOVO — deedView(game, pos): DeedView (puro)
├── boards/
│   └── shared.tsx            # popovers consomem deedView + disparam comandos; BuildingMark/MortgageMark → game.titles
└── (App.tsx / store.ts inalterados)

tests/
└── game/
    └── ui/
        └── deedView.test.ts  # NOVO — flags por cenário (SC-005)
```

**Structure Decision**: Single project. `deedView` em `src/game/ui/deed/` (camada de apresentação, fora do motor puro), testado como `playersView` (020)/`activeModal` (022). Os predicados ficam **no motor** (`economy/`), junto da regra que encapsulam, e são reusados pelos comandos e pelo `deedView` — fonte única.

## Notas de design (resolvidas na Fase 0)

- **Predicados puros = fonte única**: `buildHouse`/`sellBuilding`/`buildHangar`/`sellHangar`/`mortgageProperty`/`unmortgageProperty` passam a começar com `if (!canX(state,pos)) return state`, e `deedView` chama os mesmos `canX`. Comportamento idêntico → testes 004/005/011 seguem verdes (validação do refactor).
- **Uniformidade**: `canBuildHouse(pos)` exige que `pos` seja a cidade de **menor nível** do grupo (além de `canBuild` + caixa + estoque + gate de nível). `deedView` expõe o **motivo** de bloqueio (uniformidade/estoque/grupo/caixa) para o popover mostrar a dica.
- **Ações só do jogador da vez**: como os comandos gateiam por `activePlayer`, `deedView` só liga flags quando `owner === jogadorDaVez`. Para terceiros/livre, todas as flags são `false` (popover informativo).
- **Marcas do tabuleiro**: `BuildingMark`/`MortgageMark` passam a ler `useGameStore(s => s.game.titles[pos])` (casas/hotel/2º hotel/arranha-céu/hipoteca) em vez de `MOCK_BUILDINGS`/`MOCK_MORTGAGED`.
- **Popover informativo (mock → real)**: o conteúdo do deed (dono, nível, hipotecada, aluguéis) passa a vir de `deedView`; os MOCKs de propriedade saem do caminho do popover.

## Complexity Tracking

> Sem violações de constitution — seção vazia.
