# Contract: Leilão da Largada

## Constantes

```ts
OPENING_MODE_DEFAULT = 'sealed-bid'
OPENING_BID_MIN = 0
OPENING_BID_MAX = 500
OPENING_BID_STEP = 50
OPENING_AUCTION_MS = 15_000
OPENING_REVEAL_MS <= 5_000
```

## Reducers puros

```ts
selectOpeningMode(
  room: Room,
  mode: 'sealed-bid' | 'dice-roll',
): { ok: true; room: Room } | { ok: false; reason: 'not-in-lobby' }

openOpeningAuction(
  room: Room,
  closesAt: number,
): { ok: true; room: Room } | { ok: false; reason: 'too-few' | 'already-started' }

lockOpeningBid(
  room: Room,
  uid: string,
  amount: number,
): { ok: true; room: Room } | {
  ok: false
  reason: 'not-bidding' | 'unknown-uid' | 'invalid-bid' | 'already-locked'
}

allOpeningBidsLocked(room: Room): boolean

finalizeOpeningAuction(
  room: Room,
  rng: () => number,
): { ok: true; room: Room } | { ok: false; reason: 'not-bidding' }

rollOpeningOrder(
  room: Room,
  rng: () => number,
): { ok: true; room: Room } | {
  ok: false
  reason: 'too-few' | 'already-started' | 'wrong-mode'
}
```

## Aplicação econômica

```ts
applyOpeningAuction(game: GameState, room: Room): GameState
```

Pós-condições:

- `game.players` e `room.seats` usam os mesmos `playerId`;
- cada caixa é `2000 - openingBid`;
- `centerPot` é `500 + soma`;
- soma de caixa + Loteria é igual à soma de caixa inicial + semente: transferência, não criação/destruição.

## Autoridade

- `Host.setOpeningMode()` muda e persiste apenas no lobby.
- `Host.startMatch()` abre o leilão em `sealed-bid`; em `dice-roll`, gera a ordem e cria imediatamente o jogo.
- `Host.tick()` fecha quando `now() >= closesAt`.
- último lance aceito pode fechar cedo.
- apenas uma promise de fechamento pode estar em voo.
- telemetria `match_started` ocorre depois do primeiro snapshot, uma vez.

## Maior dado

- cada assento recebe exatamente dois valores inteiros de 1 a 6;
- a soma maior aparece antes;
- grupos com a mesma soma são embaralhados pelo RNG da autoridade;
- `openingBid` permanece `null`, nenhum caixa é debitado e a Loteria permanece em $500;
- rolagens, soma e ordem tornam-se públicas juntas no snapshot inicial.
