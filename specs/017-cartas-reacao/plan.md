# Implementation Plan: Cartas de reação — Diplomacia e Bunker Fiscal

**Branch**: `main` (feature dir `017-cartas-reacao`) | **Date**: 2026-05-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/017-cartas-reacao/spec.md`

## Summary

Subsistema de **interrupção/reação** + as 2 últimas cartas no-op (Diplomacia, Bunker Fiscal), **fechando o sistema de cartas**. Duas variantes de `ResolutionSlice` (`reaction-diplomacia`, `reaction-bunker`) que reusam o gating de `resolution` (bloqueia finalizar). Novo `cards/reacao.ts`: `reactorFor` (alvo válido → reator), `findReactionCard`, `taxBunkerResolve` (intercepta imposto), `applyOffensive` (aplica na recusa) e `respondReaction(state, use, ports)`. `playHandCard` (015/016) passa a abrir a reação quando o alvo possui Diplomacia (em vez de aplicar). O store compõe `taxBunkerResolve` no `ctx.resolve` e expõe `respondReaction(use)`. As 2 cartas saem de `deferido` → `implementado` (**0 no-op restante**). O **timer de 10s** e o **Bunker sobre Auditoria recebida** ficam deferidos (documentado).

## Technical Context

**Language/Version**: TypeScript ~6.0 (React 19 + Vite 8)

**Primary Dependencies**: as de 002–016 — React, Vite, Tailwind, **Zustand**, **Vitest**. Nenhuma nova.

**Storage**: runtime/Zustand. **Sem campos novos** no `GameState` — 2 variantes em `ResolutionSlice` (a carta ofensiva "em voo" vive na variante). Serializável.

**Testing**: Vitest. `respondReaction`/`reactorFor`/`taxBunkerResolve` puros/determinísticos.

**Target Platform**: Web (desktop-first).

**Project Type**: SPA frontend único.

**Performance Goals**: O(mão) por checagem de reação; trivial.

**Constraints**: lógica **pura** (efeito só no store); serializável; reação bloqueia finalizar (reusa `resolution`); sem timers no motor (10s é UI).

**Scale/Scope**: 2 variantes em `economy/types.ts` + novo `cards/reacao.ts` + interceptação em `cards/draw.ts` (`playHandCard`) + composição/`respondReaction` no `store.ts` + predicados `canAcquire`/`canEvict`/`canAudit` em `cards/ofensivas.ts` + catálogo + HUD. Testes.

## Constitution Check

| Princípio | Avaliação | Status |
|---|---|---|
| **I. SRS é verdade absoluta** | Operacionaliza §10.6/§12.4 (Diplomacia/Bunker). Bunker-sobre-Auditoria e timer 10s deferidos com justificativa. | ✅ |
| **II. Discovery antes de código** | Spec aprovada; usuário autorizou o pipeline e o escopo (ambas em 017). | ✅ |
| **III. Tesouro precisa impactar** | Diplomacia/Bunker (Tesouro) são defensivas de alto impacto (cancelam ofensiva/imposto). | ✅ |
| **IV. Catch-up é discreto** | N/A. | ✅ |
| **V. Sem dependência de cooperação** | N/A. | ✅ |
| **VI. Privacidade de cartas** | **Central**: o atacante **não sabe** se o alvo tem Diplomacia (o bluff do §12.4); a reação só se revela ao ser usada. | ✅ |
| **VII. Resiliência de sessão** | Reação é variante de `resolution` (JSON puro, inclui a carta em voo); sem timers no motor. | ✅ |

**Resultado:** sem violações. Complexity Tracking documenta os deferimentos.

## Project Structure

### Documentation (this feature)

```text
specs/017-cartas-reacao/
├── plan.md · research.md · data-model.md · quickstart.md
├── contracts/reacao.md
├── checklists/requirements.md
└── tasks.md   # /speckit-tasks (NÃO aqui)
```

### Source Code (repository root)

```text
src/game/economy/types.ts   # MOD — ResolutionSlice += reaction-diplomacia, reaction-bunker
src/game/cards/ofensivas.ts  # MOD — exporta canAcquire/canEvict/canAudit (acquire/evict/audit os reusam)
src/game/cards/reacao.ts     # NOVO — reactorFor, findReactionCard, taxBunkerResolve, applyOffensive, respondReaction
src/game/cards/draw.ts       # MOD — playHandCard: ofensiva contra alvo com Diplomacia → abre reação
src/game/cards/catalog.ts    # MOD — status 'implementado' p/ diplomacia, bunker-fiscal
src/game/store.ts            # MOD — ctx.resolve += taxBunkerResolve; comando respondReaction(use)
src/game/ui/GameHUD.tsx       # MOD — reação pendente (Usar / Recusar)

tests/game/cards/
└── reacao.test.ts           # SC-001..005 — Diplomacia (abre/usa/recusa/sem), Bunker (imposto usa/recusa/sem)
```

**Structure Decision**: a reação reusa o slot `resolution` (gating de bloqueio já existe) com 2 variantes — a carta ofensiva fica "em voo" na variante `reaction-diplomacia`. A interceptação de ofensivas vive no `playHandCard` (onde elas já são despachadas, 015/016); a de imposto entra por um resolver `taxBunkerResolve` composto no `ctx.resolve` **antes** do handler default de `tax`. Predicados `canX` em `ofensivas.ts` evitam duplicar gates entre a interceptação e a aplicação. Sem estado novo; sem timer no motor (UI/M2).

## Complexity Tracking

> Sem violações de constituição. Deferimentos registrados:

| Item | Decisão | Motivo |
|---|---|---|
| Bunker sobre "Auditoria Fiscal recebida" | Deferido (Bunker só em casas de imposto) | A Auditoria já é cancelável inteira pela Diplomacia; reação dupla (Diplomacia+Bunker) na mesma ação é complexidade desproporcional |
| Timer de 10s (auto-recusa) | Deferido à UI/store | §12.4 é janela de UI; o motor modela a decisão explícita (`respondReaction`); pending bloqueia até responder |
