# Implementation Plan: Sistema de Cartas

**Branch**: `main` (feature dir `006-sistema-cartas`) | **Date**: 2026-05-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/006-sistema-cartas/spec.md`

## Summary

Construir o **sistema de cartas** sobre a economia existente: 2 decks (`acaso`/`tesouro`) embaralhados, saque ao parar na casa (preenche a porta `drawCard` do 002), cartas imediatas que aplicam e voltam ao fundo, cartas de mão (limite 3, privada, não-negociável, descarte forçado na 4ª), janelas de timing, contador de Bus Ticket, e um **registry carta→handler** com o catálogo como dado. Os efeitos **autocontidos** são implementados; os que exigem subsistemas novos (ofensivas com alvo, reação, temporários de N voltas) entram como **handlers stub** (no-op seguro). Inclui a propagação **docs** do D-018 (Surpresa→Acaso no SRS/CARTAS).

Tecnicamente: nova camada `src/game/cards/` (decks, catálogo, efeitos, mão, saque). Estende `GameState` com `decks` e o `Player` com `hand`/`busTickets`/`nextPurchaseDiscount`; `ResolutionSlice` ganha variantes de carta (descarte forçado; escolha de movimento). O **card resolver** é composto com o `economyResolve` no `ctx.resolve` do store (cada um trata seus `kind`). RNG injetável (embaralhar) reusa o do 002. Patrimônio líquido (clarificação): caixa + preços + construções, hipotecada pela metade.

## Technical Context

**Language/Version**: TypeScript ~6.0 (React 19 + Vite 8)

**Primary Dependencies**: as do 002–005 — React, Vite, Tailwind, **Zustand**, **Vitest**. Nenhuma nova.

**Storage**: runtime/Zustand. Estende: `GameState.decks`; `Player.hand`/`busTickets`/`nextPurchaseDiscount`; novas variantes em `ResolutionSlice`. Serializável (decks = arrays de ids; mão = ids).

**Testing**: Vitest. Saque/efeitos/mão são puros com RNG injetável → determinístico.

**Target Platform**: Web (desktop-first).

**Project Type**: SPA frontend único.

**Performance Goals**: saque/efeito O(1)–O(jogadores); embaralhar O(16). Sem I/O.

**Constraints**: lógica **pura** (efeito só no store); estado **serializável** (decks/mão são ids; sem refs). Embaralhar usa o **RNG injetável** (ctx.rng) — determinístico nos testes. Não reabre 002–005; integra por composição de `ctx.resolve` e por chamadas às funções puras já existentes (movimento, deshipoteca, compra-desconto).

**Scale/Scope**: 2×16 cartas. Escopo: nova pasta `cards/` (~6 arquivos) + extensões em `turn/types.ts`, `store.ts` e (desconto) `economy/purchase.ts`; docs (D-018).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Avaliação | Status |
|---|---|---|
| **I. SRS é verdade absoluta** | Operacionaliza §10 + a clarificação (patrimônio). Catálogo = dado do SRS. | ✅ |
| **II. Discovery antes de código** | Plan é design; usuário autorizou o pipeline completo. | ✅ |
| **III. Tesouro precisa impactar** | **Central:** o framework trata os 2 decks igualmente; a diferença é temática, não de magnitude. Efeitos de Tesouro implementados (Boom, Erro, Aniversário, Refinanciamento, Passagem) têm peso real. | ✅ |
| **IV. Catch-up é discreto** | Cartas não expõem rótulo de catch-up. | ✅ |
| **V. Sem dependência obrigatória de cooperação** | Cartas são individuais. | ✅ |
| **VI. Privacidade estratégica de cartas** | **Central:** mão privada (outros veem só o contador), limite 3, não-negociável, Bus Ticket em contador separado — exatamente o princípio VI / D-011 / D-012. | ✅ |
| **VII. Resiliência de sessão** | Decks/mão/contadores são ids/números serializáveis; embaralhar com RNG injetável (semente reconstruível). | ✅ |

**Resultado:** sem violações. Complexity Tracking vazio.

## Project Structure

### Documentation (this feature)

```text
specs/006-sistema-cartas/
├── plan.md · research.md · data-model.md · quickstart.md
├── contracts/cards.md
├── checklists/requirements.md
└── tasks.md   # /speckit-tasks (NÃO aqui)
```

### Source Code (repository root)

```text
src/game/cards/                # NOVO — sistema de cartas
├── types.ts                   # Card, DeckId, Rarity, CardMode, Timing, EffectId
├── catalog.ts                 # catálogo das 32 cartas (dado) + raridade/modo/timing/efeito + status
├── decks.ts                   # shuffle(rng), drawTop, returnToBottom
├── hand.ts                    # addToHand / discard / contagem (privacidade) / limite 3
├── effects.ts                 # handlers autocontidos + netWorth + stubs (deferidos)
└── draw.ts                    # drawCard(state, deckId, ctx) — impl da porta do 002
src/game/turn/types.ts         # MODIFICADO — GameState.decks; Player.hand/busTickets/nextPurchaseDiscount; ResolutionSlice += card variants
src/game/economy/purchase.ts   # MODIFICADO — aplica nextPurchaseDiscount (Investidor Anjo) na compra
src/game/store.ts              # MODIFICADO — seed decks/mão; compõe card resolver; comandos (playHandCard, discardCard, chooseCardShortcut)

tests/game/cards/
├── decks.test.ts              # SC-001/006 — saque, volta ao fundo, nunca esgota
├── hand.test.ts               # SC-002/003 — limite 3, descarte, privacidade, bus ticket
└── effects.test.ts            # SC-004/005/007 — efeitos autocontidos; deferidos no-op; Saia da Prisão
```

**Structure Decision**: nova camada `cards/` paralela a `economy/`, integrada por **composição** no `ctx.resolve` do store (card resolver trata `acaso`/`tesouro`; economy trata `property`/`airport`/`utility`). Efeitos chamam as funções puras já existentes (movimento do 002, deshipoteca do 005, compra/desconto do 003, construções do 004) — sem reabrir essas specs. O catálogo é **dado** num único arquivo; a complexidade fica no registry, não em `switch`es espalhados.

## Complexity Tracking

> Sem violações de constituição. Seção intencionalmente vazia.
