# Contract: transporte do lance lacrado

## Porta

```ts
interface OpeningBidMessage {
  amount: number
}

interface Transport {
  submitOpeningBid(amount: number): void
  onOpeningBid(cb: (message: OpeningBidMessage, fromUid: string) => void): Unsubscribe
  submitOpeningRoll(): void
  onOpeningRoll(cb: (fromUid: string) => void): Unsubscribe
}
```

## Semântica

- O remetente chama `submitOpeningBid` no próprio tópico `room:<id>:s:<uid>`.
- O payload não contém `uid`, `playerId`, nome ou qualquer identidade.
- `fromUid` é derivado do tópico que entregou o evento.
- O host recebe eventos apenas dos assentos que `watchSeat` já assinou.
- Um convidado não recebe eventos de outro assento.
- Fire-and-forget: confirmação de verdade é a próxima `PublicRoom` com `bidLocked: true`.
- `submitOpeningRoll` envia payload vazio no mesmo tópico privado; identidade vem somente de `fromUid`.
- Confirmação da rolagem é a próxima `PublicRoom` com `openingRollResolvesAt` no assento da vez; o resultado chega numa publicação posterior.

## Publicação da sala

Em qualquer fase:

```ts
PublicRoom.openingMode = 'sealed-bid' | 'dice-roll'
```

Somente a autoridade altera o valor persistido, pelo mesmo caminho de `saveRoom`/`publishRoom`.

Durante `bidding`:

```ts
PublicSeat = {
  ...identityAndPresence,
  bidLocked: boolean,
  openingBid: null,
}
```

Durante `playing`:

```ts
PublicSeat.openingBid = number
```

`reentryCode` nunca entra em `PublicRoom`, independentemente da fase.

Durante `rolling`, `openingRoll`, `openingRollStartedAt` e `openingRollResolvesAt` são públicos. A autoridade aceita no máximo um pedido por vez e apenas do primeiro assento sem resultado.

## Persistência

`saveRoom` e `saveSnapshot` incluem `openingMode` e `openingAuction`. `room_preview`:

- autoridade: sala íntegra;
- dono: próprio `reentryCode` e próprio `openingBid`;
- demais assentos: sem `reentryCode` e, durante `bidding`, sem `openingBid`.

## Casos obrigatórios de conformidade

1. adapter local e Supabase entregam o mesmo `amount/fromUid`;
2. não-autoridade não publica sala/revelação;
3. `watchSeat` controla quais lances a autoridade observa;
4. valor alheio não existe em `PublicRoom` durante coleta;
5. valor se torna público depois do fechamento.
6. `openingMode` faz round-trip idêntico nos adapters local e Supabase.
7. adapter local e Supabase entregam o mesmo `fromUid` no pedido de rolagem, sem identidade ou faces no payload.
8. `watchSeat` controla quais pedidos de rolagem a autoridade observa.
