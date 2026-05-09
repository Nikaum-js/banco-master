# Implementation Plan: Painel Trades ao vivo (M2)

**Branch**: `main` | **Date**: 2026-05-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/027-trades-ao-vivo/spec.md`

**Depende de**: 024 (pendingTrade / executeTrade / acceptTrade / useTradeUI) · 021 (log) · 020 (estado na UI)

## Summary

Tornar o painel "Trades" (em `PlayersPanel`) real: mostrar a **proposta pendente** (`game.pendingTrade`, 024) como ativo + um **histórico** das trocas aceitas. Engine: novo campo `GameState.tradeHistory: Trade[]` (bounded ~12, mais recentes ao fim); `acceptTrade` (em `economy/trade.ts`), ao concluir, faz push da troca aceita no histórico e emite `logEvent(... "fromId ↔ toId: troca aceita")` (021). `executeTrade` inalterado. Camada testável: `tradesView(game)` → `{ pending, history }` (puro). UI: o painel passa a consumir `tradesView`; remove `MOCK_TRADES` e o tipo `Trade`/`TradeStatus` mock; `TradeRow` reescrito para o shape real; "+ Nova proposta" → `useTradeUI.show()`.

## Technical Context

**Language/Version**: TypeScript ~6.0, React 19

**Primary Dependencies**: Zustand, Tailwind, Vite 8, Vitest. Sem novas deps.

**Storage**: N/A — `tradeHistory` no `GameState` serializável (VII), bounded.

**Testing**: Vitest sobre `tradesView` + o registro em `acceptTrade` (push + log). Painel validado no `bun run dev`.

**Target Platform**: Web (SPA), desktop.

**Project Type**: Single project (web SPA).

**Performance Goals**: 60 fps; `tradesView` O(histórico).

**Constraints**: Não mudar `executeTrade`/validação de troca; histórico bounded. Texto pt-BR.

**Scale/Scope**: 1 campo + registro no `acceptTrade` + 1 seletor + reescrita do painel (remoção de mock).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. SRS é fonte de verdade**: ✅ §11 (acompanhar trades). Só registro/exibição; regra de troca intacta.
- **II. Discovery antes de código**: ✅ spec 027 aprovada.
- **III. Tesouro impacta**: ✅ n/a.
- **IV. Catch-up discreto**: ✅ n/a.
- **V. Sem cooperação obrigatória**: ✅ n/a.
- **VI. Privacidade de cartas**: ✅ trade não tem cartas; o painel mostra propriedades/dinheiro/imunidades (públicos).
- **VII. Resiliência de sessão**: ✅ `tradeHistory` no estado serializável, **bounded** (não cresce sem limite).

**Resultado**: PASS. `executeTrade` inalterado (suíte 013/024 verde). Sem Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/027-trades-ao-vivo/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── tradesView.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── game/
│   ├── turn/types.ts          # GameState += tradeHistory: Trade[]
│   ├── economy/trade.ts       # acceptTrade: push no histórico (bounded) + logEvent; executeTrade inalterado
│   ├── store.ts               # seed tradeHistory: []
│   └── ui/trade/tradesView.ts # NOVO — tradesView(game): { pending, history } (puro)
└── boards/shared.tsx          # painel Trades consome tradesView; remove MOCK_TRADES + tipo mock; TradeRow real

tests/
└── game/
    ├── ui/tradesView.test.ts          # NOVO — pending/history + ordem
    └── economy/negociacao-ui.test.ts  # +asserção: acceptTrade registra no histórico e loga
```

**Structure Decision**: Single project. `tradesView` em `src/game/ui/trade/` (junto do `TradeLayer`). O registro vive no `acceptTrade` (motor), fonte única; o painel só lê.

## Notas de design (resolvidas na Fase 0)

- **Registro no `acceptTrade`**: após `executeTrade` (que clona), no resultado: `s.tradeHistory.push(trade)` (cap: manter os ~12 últimos via `slice(-12)`), `logEvent(s, fromId, "${fromId} ↔ ${toId}: troca aceita")`, e `s.pendingTrade = null`. `executeTrade` não muda.
- **`tradeHistory` bounded**: empurra ao fim; corta para os 12 mais recentes (princípio VII — não cresce indefinidamente).
- **`tradesView(game)`**: `{ pending: game.pendingTrade, history: [...game.tradeHistory].reverse() }` (mais recentes primeiro). Resumo por linha (contagens + dinheiro) é derivado na UI a partir do `Trade`.
- **Remoção de mock**: `MOCK_TRADES`, o tipo `Trade`/`TradeStatus` mock e o `playerByName` (se ficar órfão) saem do caminho do painel; `TradeRow` passa a receber um `Trade` real + um flag de status (pendente/concluída) e mostra ids + resumo.
- **Cor do jogador**: por assento (`PLAYER_COLORS`), como no resto da UI ao vivo (020).

## Complexity Tracking

> Sem violações de constitution — seção vazia.
