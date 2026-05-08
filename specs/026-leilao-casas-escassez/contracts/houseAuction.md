# Contrato — Leilão de casas (evento autônomo, 026)

## Reducers (economy/houseAuction.ts — operam em `state.houseAuction`)

```ts
export function openHouseAuction(state: GameState, housesAvailable: number, bidders: string[]): GameState
export function placeHouseBid(state: GameState, playerId: string, amount: number): GameState
export function closeHouseAuction(state: GameState): GameState
```

| Reducer | Pré | Efeito |
|---|---|---|
| `openHouseAuction(s, n, bidders)` | `s.houseAuction === null` | `houseAuction = { housesAvailable:n, currentBid:0, highBidder:null, activeBidders:bidders, deadline:0 }` |
| `openHouseAuction` | já há leilão | no-op (`=== s`) |
| `placeHouseBid(s, id, amt)` | leilão aberto, `id ∈ activeBidders`, `amt > currentBid`, `amt ≤ caixa(id)` | `currentBid = amt`, `highBidder = id` |
| `placeHouseBid` | qualquer condição falha | no-op |
| `closeHouseAuction(s)` | leilão com `highBidder` | vencedor paga `currentBid`; `bank.houses -= housesAvailable` (mín. 0); `houseAuction = null` |
| `closeHouseAuction(s)` | leilão sem `highBidder` | `houseAuction = null` (nada transferido) |
| `closeHouseAuction(s)` | sem leilão | no-op |

**Invariante**: nenhum reducer altera `state.turn` nem `state.resolution`. Só `houseAuction` (e, no fecho com vencedor, `bank.houses` + `player.cash`).

## Store

- Comandos `openHouseAuction(housesAvailable, bidders)` / `placeHouseBid(playerId, amount)` / `closeHouseAuction()` (assinaturas sem `now`).
- `declareBuildInterest` removido. `rearmAuction` deixa de tratar `house-auction` (só `auction` de propriedade).

## UI

- **Botão "Leilão de casas"** (PlayersPanel): habilitado sse `bank.houses ≥ 1` ∧ `(não-eliminados) ≥ 2` ∧ `houseAuction === null` → `openHouseAuction(bank.houses, ids)`.
- **HouseAuctionLayer** (lê `game.houseAuction`, null → não renderiza): casas em jogo, lance atual, maior licitante; `<select>` licitante (não-eliminados) + valor (default `currentBid+50`) + "Dar lance" + "Encerrar".

## Remoções (código morto)

- `ResolutionSlice`: tirar `house-auction`.
- `activeModal.ts`: tirar a variante `house-auction`; `ModalLayer` `AuctionCard` vira só `auction`.
- `tests/game/ui/activeModal.test.ts`: remover o caso `house-auction`.

## Cobertura de teste (`tests/game/economy/houseAuction.test.ts`, reescrito) — SC-005

1. `openHouseAuction` seta o campo (casas/bidders/lance 0); já aberto → no-op.
2. `placeHouseBid` válido atualiza lance/licitante; rejeita ≤ atual, > caixa, não-participante.
3. `closeHouseAuction` com vencedor: paga + `bank.houses` cai + campo limpo.
4. `closeHouseAuction` sem lance: campo limpo, banco intacto.
5. abrir/fechar **não** mudam `turn`/`resolution` (turno intacto).
