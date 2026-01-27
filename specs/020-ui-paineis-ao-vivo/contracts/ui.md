# Contract: UI painéis ao vivo

## `boards/shared.tsx`

```ts
export const PLAYER_COLORS: string[] // 8 cores por assento (disjuntas das cores de grupo)

export function playersView(game: GameState): Player[] // puro — mapeia jogadores reais → view-model
function useLivePlayers(): Player[] // = playersView(useGameStore(s => s.game))
```

### `PlayersPanel` (rewire)

- `const players = useLivePlayers()`.
- contador "N / 8" usa `players.filter(p => !p.bankrupt).length`.
- `players.map(PlayerRow)` (componente inalterado).
- Histórico: segue `MOCK_LOG` (fatia futura).

### `ActionsPanel` (rewire da seção "Turno")

- `const game = useGameStore(s => s.game)`; `const players = playersView(game)`; `const active = players.find(p => p.active) ?? players[0]`.
- "Próx. GO" = `goBonus(game, activeId)` (em vez de `ACTIVE_GO_VALUE`).
- "Pote da Loteria" = `game.centerPot` (em vez de `MOCK_PARKING_POT`).
- "Cartas"/"Bus Tickets" = `active.cardsInHand`/`active.busTickets`.
- Seção "Trades": segue MOCK (fatia futura).

## `tests/game/ui/playersView.test.ts`

- mapeia caixa/mão/Bus Tickets/pos corretos; `active` segue o jogador da vez; `bankrupt` reflete `eliminated`; `loanActive`/`immune` derivados; cor por assento.
