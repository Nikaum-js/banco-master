# Data Model: UI painéis ao vivo

**Sem estado novo.** A UI deriva do `GameState` (read-only).

## Mapeamento `playersView(game): Player[]`

| `Player` (view-model, shared.tsx) | Origem no `GameState` |
|---|---|
| `name` | `player.id` (Lobby trará nome real — M3) |
| `color` | `PLAYER_COLORS[seat % 8]` (paleta por assento) |
| `money` | `player.cash` |
| `pos` | `player.pos` |
| `cardsInHand` | `player.hand.length` (só contador — privacidade) |
| `busTickets` | `player.busTickets` |
| `speedDieReady` | `player.completouPrimeiraVolta` |
| `active` | `player.id === players[turnOrder[activeSeat]].id` |
| `bankrupt` | `player.eliminated` |
| `loanActive` | `loans.some(l => l.debtorId === id)` |
| `immune` | `immunities.some(i => i.beneficiaryId === id)` |

## Seção "Turno" (ActionsPanel)

| UI | Origem |
|---|---|
| nome/cor/cartas/Bus Tickets | `playersView` do ativo |
| Próx. GO | `goBonus(game, activeId)` |
| Pote da Loteria | `game.centerPot` |

## Invariantes

- Read-only: nenhuma escrita no estado pela UI nesta fatia.
- Reuso visual: `PlayerRow`/`PlayerFace`/blocos inalterados (só a fonte de dados muda).
- Log/Trades: MOCK (fora de escopo).
