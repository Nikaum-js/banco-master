# Implementation Plan: Cartas ofensivas com alvo

**Branch**: `main` (feature dir `016-cartas-ofensivas`) | **Date**: 2026-05-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/016-cartas-ofensivas/spec.md`

## Summary

As 3 cartas ofensivas com alvo (hoje no-op no 006): **Aquisição Hostil**, **Despejo**, **Auditoria Fiscal**. Novo módulo puro `src/game/cards/ofensivas.ts` com `acquire`/`evict`/`audit` (mutam o clone; validam e aplicam). `playHandCard` (006) ganha `targetPlayer?` (além do `target?` do 015) e despacha as 3 por efeito. **Sem estado novo** (mutam posse/caixa/casas/estoque/pote). Reusa `ownerOf`/`isMortgaged` (003), `cityLevel` (011), `transferKeepFee` (005, hipotecada), `isTempImmune` (015, bloqueia Aquisição/Despejo) e `netWorth` (006, Auditoria). Reação (Diplomacia/Bunker) deferida ao 017 — até lá "não pode recusar". As 3 saem de `deferido` → `implementado`.

## Technical Context

**Language/Version**: TypeScript ~6.0 (React 19 + Vite 8)

**Primary Dependencies**: as de 002–015 — React, Vite, Tailwind, **Zustand**, **Vitest**. Nenhuma nova.

**Storage**: runtime/Zustand. **Sem campos novos** no `GameState` — mutam `Title.ownerId`/`Title.houses`/`Player.cash`/`bank.houses`/`centerPot`.

**Testing**: Vitest. `acquire`/`evict`/`audit` puros/determinísticos.

**Target Platform**: Web (desktop-first).

**Project Type**: SPA frontend único.

**Performance Goals**: O(propriedades) por carta; trivial.

**Constraints**: lógica **pura** (efeito só no store); serializável; jogadas no próprio turno via `playHandCard` (bloqueado sob `paused`).

**Scale/Scope**: novo `cards/ofensivas.ts` + despacho em `cards/draw.ts` (`playHandCard` += `targetPlayer?`) + catálogo (status) + store (`playHandCard` repassa alvos). Sem UI.

## Constitution Check

| Princípio | Avaliação | Status |
|---|---|---|
| **I. SRS é verdade absoluta** | Operacionaliza §10.6 (Aquisição/Despejo/Auditoria). "Preço original" = preço de tabela (motor não rastreia preço pago) — documentado. Reação (017) deferida. | ✅ |
| **II. Discovery antes de código** | Spec aprovada; usuário autorizou o pipeline e o escopo (ofensivas como 016). | ✅ |
| **III. Tesouro precisa impactar** | N/A (ofensivas são Acaso). | ✅ |
| **IV. Catch-up é discreto** | Auditoria alimenta o pote (catch-up) sem rótulo; pune o líder. | ✅ |
| **V. Sem dependência de cooperação** | Aquisição Hostil **destrava** monopólios contra birra de negociação (D-010/§16). | ✅ |
| **VI. Privacidade de cartas** | Mantida (mão privada). O alvo descobre só ao sofrer o efeito. | ✅ |
| **VII. Resiliência de sessão** | Sem estado novo; mutações puras serializáveis. | ✅ |

**Resultado:** sem violações. Complexity Tracking documenta a simplificação ("preço original" + Auditoria sem caixa).

## Project Structure

### Documentation (this feature)

```text
specs/016-cartas-ofensivas/
├── plan.md · research.md · data-model.md · quickstart.md
├── contracts/ofensivas.md
├── checklists/requirements.md
└── tasks.md   # /speckit-tasks (NÃO aqui)
```

### Source Code (repository root)

```text
src/game/cards/ofensivas.ts   # NOVO — acquire, evict, audit (puras; validam+aplicam)
src/game/cards/draw.ts        # MOD — playHandCard += targetPlayer?; despacho aquisicaoHostil/despejo/auditoriaFiscal
src/game/cards/catalog.ts     # MOD — status 'implementado' p/ aquisicao-hostil, despejo, auditoria-fiscal
src/game/store.ts             # MOD — playHandCard(cardId, target?, targetPlayer?)

tests/game/cards/
└── ofensivas.test.ts         # SC-001..005 — Aquisição (preço/1,5×/hipoteca/gates), Despejo, Auditoria, Imunidade Temporária
```

**Structure Decision**: as ofensivas têm validação rica e mutam várias entidades → módulo próprio `cards/ofensivas.ts` (puro), despachado por `playHandCard` (como o 015 fez com boicote/imunidade). `playHandCard` ganha `targetPlayer?` para a Auditoria (alvo = jogador, não propriedade). Sem estado novo; reusa helpers de economia/cartas. Sem UI (modais §12.2 são M2).

## Complexity Tracking

> Sem violações de constituição. Simplificações registradas:

| Item | Decisão | Alternativa rejeitada |
|---|---|---|
| "Preço original" da Aquisição | Preço de **tabela** da propriedade | Rastrear preço pago por dono (compra/leilão) — exigiria novo estado por título; baixo retorno |
| Auditoria com alvo sem caixa | Debita o que houver (sem falir) | Falência cross-player — fora do modelo do 008 (centrado no ativo) |
