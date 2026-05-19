# Implementation Plan: Revelação de carta sacada (M2)

**Branch**: `main` | **Date**: 2026-05-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/025-revelacao-carta/spec.md`

**Depende de**: 006 (sistema de cartas / `cardResolve`) · 022 (ModalLayer / `activeModal` / `resolution`) · 021 (log)

## Summary

Inserir um passo de **revelação** antes do processamento do saque, sem tocar na lógica de carta. Novo `ResolutionSlice` `card-reveal { deckId, cardId }`. O handler `cardRevealResolve(rctx)` substitui `cardResolve` na composição `ctx.resolve` do store: ao cair em acaso/tesouro, faz **peek** do topo (`decks[deckId][0]`, sem `shift`) e seta `card-reveal` (bloqueia finalização). O comando `confirmCardReveal(state, ports)` limpa a revelação e chama o **`cardResolve` existente** (que então saca de verdade e processa — imediata aplica, mão guarda, abre discard/atalho quando preciso), finalizando se concluir. UI: `activeModal`/`ModalLayer` ganham a variante `card-reveal` (cartão mostrando nome/deck/raridade/descrição + "Continuar"). `cardResolve` **não muda** → testes de 006 verdes.

## Technical Context

**Language/Version**: TypeScript ~6.0, React 19

**Primary Dependencies**: Zustand, Tailwind, Vite 8, Vitest, `motion/react`. Sem novas deps.

**Storage**: N/A — `card-reveal` é `ResolutionSlice` no `GameState` serializável (VII).

**Testing**: Vitest sobre `cardRevealResolve` + `confirmCardReveal` + `activeModal(card-reveal)`. `cardResolve` inalterado (suíte 006 verde).

**Target Platform**: Web (SPA), desktop.

**Project Type**: Single project (web SPA).

**Performance Goals**: 60 fps; peek/confirm O(1).

**Constraints**: Não alterar `cardResolve` nem efeitos de carta. Reusar o ModalLayer (022). Texto pt-BR.

**Scale/Scope**: 1 slice novo + 1 handler (peek) + 1 reducer/comando (confirm) + 1 variante de modal.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. SRS é fonte de verdade**: ✅ operacionaliza §12.2 (revelação); efeitos de carta (§10) inalterados.
- **II. Discovery antes de código**: ✅ spec 025 aprovada antes do plano.
- **III. Tesouro impacta**: ✅ n/a (não muda cartas; só revela).
- **IV. Catch-up discreto**: ✅ n/a.
- **V. Sem cooperação obrigatória**: ✅ n/a.
- **VI. Privacidade de cartas**: ✅ **relevante** — a revelação é do jogador da vez (quem sacou); carta de mão não é exposta a outros (FR-006). Imediata é pública (§12.2).
- **VII. Resiliência de sessão**: ✅ `card-reveal` é estado serializável; reabrir reabre a revelação. Peek não muta deck/mão até o confirm.

**Resultado**: PASS. `cardResolve` intacto (testes 006). Sem Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/025-revelacao-carta/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── card-reveal.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── game/
│   ├── economy/types.ts           # ResolutionSlice += card-reveal
│   ├── cards/draw.ts              # +cardRevealResolve (peek+set) +confirmCardReveal (confirma→cardResolve). cardResolve INALTERADO
│   ├── store.ts                   # ctx.resolve usa cardRevealResolve no lugar de cardResolve; comando confirmCardReveal
│   └── ui/modals/
│       ├── activeModal.ts         # ModalView += card-reveal (nome/deck/raridade/descrição)
│       └── ModalLayer.tsx         # render do cartão de revelação + "Continuar"
tests/
└── game/cards/
    └── revelacao.test.ts          # cardRevealResolve + confirmCardReveal + activeModal
```

**Structure Decision**: Single project. A revelação vive em `cards/draw.ts` (junto do saque) + `ui/modals/` (junto dos outros modais). `cardResolve` permanece a função de processamento (chamada pelo confirm) — fonte única do efeito, sem duplicação.

## Notas de design (resolvidas na Fase 0)

- **Peek vs shift**: `cardRevealResolve` lê `decks[deckId][0]` **sem** remover; o `shift` real acontece em `cardResolve` no confirm. Como o topo é determinístico, o id revelado == o id sacado.
- **Confirm reusa cardResolve**: `confirmCardReveal` monta o `ResolveCtx` (jogador da vez + `BOARD[pos]` + `lastRoll` + ports), limpa `card-reveal`, chama `cardResolve(rctx)` e: se `done` → finaliza (aguardando-finalizacao); se não (abriu `card-discard`/`card-shortcut`) → segue pendente (o ModalLayer assume).
- **Log no confirm**: a linha "sacou …"/"Acaso: Nome" (021) continua em `cardResolve`, então é emitida no momento do saque real (confirm). A revelação não loga (só mostra).
- **GameDriver**: já segura quando `resolution` está setada — `card-reveal` (como `purchase`) faz o driver esperar; combina com a coordenação de animação (peão chega → resolvePending → cardRevealResolve → modal).
- **Descrição do efeito**: mapa de apresentação `effect → texto curto` no ModalLayer (não no motor), com fallback no nome.

## Complexity Tracking

> Sem violações de constitution — seção vazia.
