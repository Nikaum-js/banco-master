# Data Model — Leilão de casas em escassez (026)

Move o leilão de casas para um **campo próprio** do estado; remove o `house-auction` da resolução de turno.

## `GameState.houseAuction` (novo campo)

```ts
// turn/types.ts
houseAuction: HouseAuction | null // leilão de casas em andamento (026); null = nenhum
```

- Reusa o tipo `HouseAuction` (já em `economy/types.ts`): `housesAvailable`, `currentBid`, `highBidder`, `activeBidders`, `deadline`.
- `deadline` fica setado mas **ignorado** (sem timer; fecho manual). Pode ser `0`.
- Serializável (VII); seed `null` em `createSeedState`.
- **Independente** de `turn`/`resolution`.

## `ResolutionSlice` — remoção

```ts
// economy/types.ts — REMOVER:
// | { kind: 'house-auction'; auction: HouseAuction }
```

Era código não acionado; o tipo `HouseAuction` permanece (agora usado pelo campo).

## Reducers (economy/houseAuction.ts — refatorados p/ o campo)

```ts
export function openHouseAuction(state, housesAvailable: number, bidders: string[]): GameState
export function placeHouseBid(state, playerId: string, amount: number): GameState
export function closeHouseAuction(state): GameState
// declareBuildInterest — REMOVIDO (abre já com todos os licitantes)
```

### Regras

- **openHouseAuction**: se já há `houseAuction` → no-op; senão clona e seta `houseAuction = { housesAvailable, currentBid: 0, highBidder: null, activeBidders: bidders, deadline: 0 }`. (A UI só chama com `housesAvailable = bank.houses ≥ 1` e `bidders` = não-eliminados; ≥ 2.)
- **placeHouseBid**: se não há `houseAuction` → no-op; rejeita se `playerId` não é participante, `amount ≤ currentBid`, ou `amount > caixa(playerId)`; senão atualiza `currentBid`/`highBidder`.
- **closeHouseAuction**: se não há `houseAuction` → no-op; havendo `highBidder`, debita o lance do vencedor e `bank.houses = max(0, bank.houses − housesAvailable)`; sem `highBidder`, nada transfere. Em ambos os casos, `houseAuction = null`. **Não** altera `turn`/`resolution`.
- Todos **puros**; só o campo `houseAuction` (e, no fecho com vencedor, `bank.houses`/`player.cash`) muda.

## UI (sem alterar regra)

- **Botão "Leilão de casas"** (PlayersPanel): habilitado quando `bank.houses ≥ 1`, `≥ 2` não-eliminados e `houseAuction === null`. Aciona `openHouseAuction(bank.houses, [ids não-eliminados])`.
- **`HouseAuctionLayer`** (lê `game.houseAuction`): exibe casas/lance/maior licitante; `<select>` de licitante + valor + "Dar lance" (`placeHouseBid`) + "Encerrar" (`closeHouseAuction`).

## Entidades existentes (consumidas)

- **`bank.houses`** (004): decrementado no fecho com vencedor.
- **`Player.cash`**: o vencedor paga o lance.
