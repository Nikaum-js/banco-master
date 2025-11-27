# Implementation Plan: Negociação — troca de propriedades e caixa

**Branch**: `main` (feature dir `013-negociacao-troca`) | **Date**: 2026-05-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/013-negociacao-troca/spec.md`

## Summary

Núcleo da negociação (§8.1–§8.3): novo módulo puro `src/game/economy/trade.ts` com `executeTrade(state, trade)` que processa uma troca **acordada** entre dois jogadores — propriedades (incl. hipotecadas) + dinheiro de cada lado. Validação **atômica** (posse, sem construção, caixa+taxas) e aplicação (troca `ownerId`, transfere `cash`, taxa de 10% `transferKeepFee` do 005 ao recebedor de hipotecada, removida ao banco). Não depende de quem é o jogador da vez (§8.1). Hangar acompanha o aeroporto (§13.6). **Sem novo estado** no `GameState` (só muta `ownerId`/`cash`). **Sem UI** (trade UI é M2). Imunidade de aluguel (§8.4) deferida ao 014.

## Technical Context

**Language/Version**: TypeScript ~6.0 (React 19 + Vite 8)

**Primary Dependencies**: as de 002–012 — React, Vite, Tailwind, **Zustand**, **Vitest**. Nenhuma nova.

**Storage**: runtime/Zustand. **Sem campos novos** — a troca muta `Title.ownerId` e `Player.cash`. `Trade` é um param transitório (não persiste).

**Testing**: Vitest. `executeTrade` puro/determinístico (sem RNG).

**Target Platform**: Web (desktop-first).

**Project Type**: SPA frontend único.

**Performance Goals**: O(propriedades na proposta); trivial.

**Constraints**: lógica **pura** (efeito só no store); atômica; estado serializável; bloqueada sob `paused`; **não** gated por turno (qualquer par de jogadores, a qualquer momento).

**Scale/Scope**: novo `economy/trade.ts` + comando `executeTrade` no `store.ts` + testes. Reusa `ownerOf` (003), `cityLevel` (011), `transferKeepFee`/`mortgageValue` (005).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Avaliação | Status |
|---|---|---|
| **I. SRS é verdade absoluta** | Operacionaliza §8.1–§8.3 (+§6.3 na transferência de hipotecada). Imunidade §8.4 deferida ao 014 com justificativa (efeito temporal). | ✅ |
| **II. Discovery antes de código** | Spec aprovada; usuário autorizou o pipeline e o escopo (troca agora; imunidade → 014). | ✅ |
| **III. Tesouro precisa impactar** | N/A. | ✅ |
| **IV. Catch-up é discreto** | N/A. | ✅ |
| **V. Sem dependência de cooperação** | Troca é **opcional**; amplia a barganha sem ser gate de progresso. | ✅ |
| **VI. Privacidade de cartas** | **Reforça**: cartas e Bus Tickets **não** entram no payload da troca (D-011/D-012). | ✅ |
| **VII. Resiliência de sessão** | Só muta `ownerId`/`cash` (JSON puro); sem estado novo/timers. | ✅ |

**Resultado:** sem violações. Complexity Tracking vazio.

## Project Structure

### Documentation (this feature)

```text
specs/013-negociacao-troca/
├── plan.md · research.md · data-model.md · quickstart.md
├── contracts/trade.md
├── checklists/requirements.md
└── tasks.md   # /speckit-tasks (NÃO aqui)
```

### Source Code (repository root)

```text
src/game/economy/trade.ts   # NOVO — Trade (tipo) + executeTrade (puro, atômico)
src/game/store.ts           # MOD — comando executeTrade(trade) (não gated por turno)

tests/game/economy/
└── negociacao.test.ts       # SC-001..005 — troca válida, inválidas, hipoteca+taxa, Hangar, não-negociáveis
```

**Structure Decision**: a troca é economia pura → módulo `economy/trade.ts` (como `purchase.ts`/`mortgage.ts`). `executeTrade` representa o **acordo aceito** (a UX propor/aceitar/recusar é UI/multiplayer — M2/M3; recusar = não chamar), espelhando `grantLoan` (010). Reusa `transferKeepFee` (005) para a regra §6.3 sem reimplementar. Sem estado novo no `GameState`. Sem UI (M2).

## Complexity Tracking

> Sem violações de constituição. Seção intencionalmente vazia.
