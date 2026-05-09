# Data Model — Painel Trades ao vivo (027)

Acrescenta **um campo** ao `GameState` e **um seletor** de apresentação. `Trade` (024) é reusado.

## `GameState.tradeHistory` (novo campo)

```ts
// turn/types.ts
tradeHistory: Trade[] // trocas ACEITAS (024); mais recentes ao fim; bounded (~12)
```

- Reusa `Trade` (de `economy/types.ts`).
- Seed `[]` em `createSeedState`.
- Bounded: ao registrar, manter só os ~12 últimos (`slice(-12)`).
- Serializável (VII).

## Registro em `acceptTrade` (economy/trade.ts — sem mudar a regra)

`acceptTrade(state)` (024), ao concluir com sucesso:
1. `const s = executeTrade(state, trade)` (inalterado).
2. `s.tradeHistory = [...s.tradeHistory, trade].slice(-12)`.
3. `logEvent(s, trade.fromId, "${trade.fromId} ↔ ${trade.toId}: troca aceita")` (021).
4. `s.pendingTrade = null`.

`rejectTrade` **não** registra (só aceitas). `executeTrade` permanece idêntico.

## `tradesView` (novo — UI)

```ts
// src/game/ui/trade/tradesView.ts
import type { Trade } from '@/game/economy/types'
export interface TradesView {
  pending: Trade | null   // proposta ativa (024)
  history: Trade[]         // aceitas, mais recentes primeiro
}
export function tradesView(game: GameState): TradesView
```

- `pending = game.pendingTrade`; `history = [...game.tradeHistory].reverse()`.
- Puro, somente-leitura.
- O **resumo por linha** (nº propriedades / dinheiro / nº imunidades, em cada sentido) é derivado na UI a partir de cada `Trade` (campos `fromProps`/`fromCash`/`fromImmunities`/`toProps`/`toCash`/`toImmunities`).

## UI (sem alterar regra)

- Painel "Trades" (PlayersPanel): consome `tradesView`. Item ativo = `pending` (de→para + resumo); itens concluídos = `history` (opacos). Contador "N ativos" = `pending ? 1 : 0`.
- "+ Nova proposta" → `useTradeUI.show()` (024).
- Remover `MOCK_TRADES` + tipo `Trade`/`TradeStatus` mock; `TradeRow` reescrito para `Trade` real (ids + resumo, cor por assento).

## Entidades existentes (consumidas)

- **`pendingTrade`** (024): a proposta ativa.
- **`Trade`** (024): shape das trocas (pendente e histórico).
- **`log`** (021): ganha uma linha por troca aceita.
