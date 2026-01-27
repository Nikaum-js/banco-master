# Contract: Log de eventos

## `economy/types.ts`

`export interface LogEntry { who: string; what: string }`

## `turn/types.ts`

`GameState += log: LogEntry[]` (seed `[]`).

## `src/game/log.ts` (novo, leaf)

```ts
import type { GameState } from './turn/types'
const LOG_MAX = 50
export function logEvent(state: GameState, who: string, what: string): void {
  state.log.push({ who, what })
  if (state.log.length > LOG_MAX) state.log.shift()
}
```

## Emissões

- `turnMachine.rollDice`: `logEvent(s, activePlayer(s).id, \`rolou ${a}+${b}${speed?...}\`)`.
- `turnMachine.advance` (passou GO): `logEvent(state, player.id, \`passou pelo GO (+$${bonus})\`)`.
- `economy/purchase.buyProperty`: `logEvent(s, player.id, \`comprou ${BOARD[pos].name} por $${price}\`)`.
- `economy/resolveRentable` (aluguel pago): `logEvent(state, playerId, \`pagou $${amount} de aluguel a ${owner}\`)`.
- `turn/resolution` (tax pago): `logEvent(state, playerId, \`pagou $${square.amount} de imposto\`)`.
- `falencia.payDebt`: `logEvent(s, activePlayer(s).id, \`pagou dívida $${amount}\`)`; `declareBankruptcy`: `logEvent(s, debtor.id, 'faliu')`.
- `cards/draw.cardResolve`: `logEvent(state, playerId, \`sacou ${deckId === 'acaso' ? 'Acaso' : 'Tesouro'}\`)`.

## `store.ts`

`createSeedState`: `log: []`.

## `boards/shared.tsx` (PlayersPanel Histórico)

`const game = useGameStore(s => s.game)`; renderiza `[...game.log].reverse()` (newest-first), `who`/`what` (sem coluna "when"). Substitui `MOCK_LOG`.

## `tests/game/log.test.ts`

Cada emissão produz a entrada esperada; `log` nunca > 50; saque mostra só o deck.
