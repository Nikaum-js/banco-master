# Contrato — Trades ao vivo (027)

## `tradesView(game: GameState): TradesView`

Função **pura**. `TradesView = { pending: Trade | null, history: Trade[] }`.

| Campo | Origem |
|---|---|
| `pending` | `game.pendingTrade` (024) |
| `history` | `[...game.tradeHistory].reverse()` (mais recentes primeiro) |

- Determinística, não-mutante.

## Registro em `acceptTrade` (economy/trade.ts)

`acceptTrade(state)`:
- pré inalterada (pendente + `validateTrade`); processa via `executeTrade` (inalterado).
- **novo**: no resultado, `tradeHistory = [...tradeHistory, trade].slice(-12)` e `logEvent(s, fromId, "fromId ↔ toId: troca aceita")`; depois `pendingTrade = null`.
- `rejectTrade` **não** mexe no histórico nem loga.

**Invariante**: `executeTrade` idêntico (suíte 013/024 verde); só o registro é novo.

## Store

- Seed `tradeHistory: []`. Sem comandos novos (o registro acontece dentro de `acceptTrade`, já exposto).

## UI

- Painel "Trades" (PlayersPanel) consome `tradesView`: `pending` como linha ativa (de→para + resumo: nº props / $ / nº imunidades nos 2 sentidos); `history` como linhas concluídas (opacas, mais recentes primeiro); contador "N ativos" = `pending ? 1 : 0`; "+ Nova proposta" → `useTradeUI.show()`.
- Remove `MOCK_TRADES` + tipo `Trade`/`TradeStatus` mock.

## Cobertura de teste — SC-005

`tests/game/ui/tradesView.test.ts`:
1. Sem pendente e sem histórico → `{ pending: null, history: [] }`.
2. Com `pendingTrade` → `pending` é ele; `history` reflete `tradeHistory` em ordem reversa.

`tests/game/economy/negociacao-ui.test.ts` (+casos):
3. `acceptTrade` válido → troca entra em `tradeHistory` (1 item) + 1 entrada no `log` com os dois ids; `pendingTrade` nulo.
4. `rejectTrade` → `tradeHistory` permanece vazio; `log` sem entrada de troca.
5. histórico bounded: após >12 aceitas, mantém só as 12 últimas.
