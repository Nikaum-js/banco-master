# Contrato — Negociação (024)

## Motor (puro)

```ts
// economy/trade.ts
export function validateTrade(state: GameState, trade: Trade): boolean
export function tradableProps(state: GameState, ownerId: string): number[]
export function proposeTrade(state: GameState, trade: Trade): GameState
export function acceptTrade(state: GameState): GameState
export function rejectTrade(state: GameState): GameState
// executeTrade(state, trade) — inalterado em comportamento; agora delega a validateTrade
```

### `validateTrade` — guardas (espelho de executeTrade)

`true` somente se: `fromId !== toId`; `from`/`to` existem e **não-eliminados**; `fromCash`/`toCash` inteiros `≥ 0`; `from` possui todas as `fromProps` e `to` todas as `toProps`, **todas sem construção** (cidade nível 0); `from.cash ≥ fromCash` e `to.cash ≥ toCash`; imunidades válidas (§8.4 — própria, mantida, `laps` null ou inteiro > 0); saldos finais (após dinheiro + taxa 10% das hipotecadas recebidas) `≥ 0` dos dois lados.

**Invariante (testável):** `executeTrade(state, t) !== state` ⇔ `validateTrade(state, t)` (a menos de `paused`). Suíte de 013 (`negociacao.test.ts`) segue verde após o refactor.

### Transições

| Reducer | Pré | Efeito |
|---|---|---|
| `proposeTrade(s, t)` | `s.pendingTrade === null` e `validateTrade(s, t)` | `pendingTrade = t` |
| `proposeTrade(s, t)` | já há pendente, ou inválida | no-op (`=== s`) |
| `acceptTrade(s)` | `pendingTrade` e `validateTrade(s, pendingTrade)` | aplica `executeTrade`; `pendingTrade = null` |
| `acceptTrade(s)` | `pendingTrade` inválida agora | no-op (mantém pendente) |
| `acceptTrade(s)` | sem pendente | no-op |
| `rejectTrade(s)` | há pendente | `pendingTrade = null` |
| `rejectTrade(s)` | sem pendente | no-op |

## Comandos do store (novos)

| Comando | Reducer |
|---|---|
| `proposeTrade(trade)` | `proposeTrade(game, trade)` |
| `acceptTrade()` | `acceptTrade(game)` |
| `rejectTrade()` | `rejectTrade(game)` |

> `executeTrade(trade)` (comando existente) permanece, mas a UI usa o ciclo propor/aceitar.

## UI

- **Botão "Negociar"** (PlayersPanel) → abre o **compositor** (estado local). O compositor usa `tradableProps(game, eu)` e `tradableProps(game, destinatário)` para listar propriedades; campos de dinheiro; imunidades (própria mantida + voltas). "Propor" habilitado sse `validateTrade(game, montada)` e proposta não-vazia → `proposeTrade`.
- **Modal recebido**: visível quando `game.pendingTrade !== null`; lista oferta/pedido (props por nome, dinheiro, imunidades); "Aceitar" → `acceptTrade`; "Recusar" → `rejectTrade`.

## Cobertura de teste (Vitest, `tests/game/economy/negociacao-ui.test.ts`) — SC-006

1. `validateTrade` true para troca bem-formada (props sem construção, caixa ok).
2. false: peço prop que o outro não tem / com construção / caixa insuficiente / imunidade sobre prop cedida ou de terceiro / taxa de hipoteca deixa saldo negativo.
3. `proposeTrade` grava pendente quando válida; no-op se já há pendente ou inválida.
4. `acceptTrade` aplica a troca (donos/saldos conforme `executeTrade`) e limpa; no-op se obsoleta/sem pendente.
5. `rejectTrade` limpa sem mover nada.
6. `tradableProps` exclui cidades com construção e props de outros donos.
7. Refactor: `executeTrade` segue idêntico (suíte 013 verde).
