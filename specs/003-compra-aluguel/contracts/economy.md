# Contract — Economia (Compra & Aluguel) (Fase 1)

Comandos e funções puras que esta feature expõe, e como integra com a resolução do 002.

---

## 1. Resolução de propriedade (preenche o stub do 002)

`turn/resolution.ts` troca os handlers `property`/`airport`/`utility` por:

```ts
function resolveRentable(ctx: ResolveCtx, state): ResolutionOutcome {
  const title = state.titles[ctx.square.pos]
  if (title.ownerId === null)            // livre → abre interação de compra
    { open purchase(pos); return { done: false, blocksFinalize: true } }
  if (title.ownerId === ctx.playerId)    // própria
    return { done: true }
  if (title.mortgaged)                   // hipotecada → sem aluguel
    return { done: true }
  // dono diferente, não hipotecada → cobra aluguel
  const amount = rentFor(ctx.square, title.ownerId, ctx.roll, state)
  pay(ctx.playerId → title.ownerId, amount)   // ou onInsolvency se faltar caixa
  return { done: true }
}
```

> A resolução **não** muta direto pela porta do 002 (que é síncrona/`{done}`); a interação vive no slice `resolution` e os comandos abaixo completam o turno.

## 2. Comandos (API do store)

| Comando | Pré-condição | Efeito |
|---|---|---|
| `buyProperty()` | `resolution.kind === 'purchase'` e `cash ≥ price` | debita preço; `titles[pos].ownerId = ativo`; limpa `resolution`; completa a resolução (turn → `aguardando-finalizacao`) |
| `declineProperty()` | `resolution.kind === 'purchase'` | abre leilão: `resolution = { kind:'auction', auction:{ pos, currentBid:0, highBidder:null, activeBidders:[…todos ativos], deadline } }`; arma o timer |
| `placeBid(playerId, amount)` | `resolution.kind === 'auction'`, `amount > currentBid`, `amount ≤ cash(playerId)`, `playerId ∈ activeBidders` | atualiza `currentBid`/`highBidder`; **reinicia** `deadline`; rearma o timer |
| `passBid(playerId)` | leilão em curso | remove `playerId` de `activeBidders` (opcional — acelera; o fecho por tempo continua valendo) |
| `closeAuction()` | `resolution.kind === 'auction'` (timer disparou) | se `highBidder`: debita `currentBid`, atribui título; senão fica com o banco; limpa `resolution`; completa a resolução |

Comandos inválidos para o estado atual são **no-op** (como no 002). Sob `paused` (002), nada avança e o timer não dispara.

## 3. Funções puras de cálculo (`rent.ts` / `titles.ts`)

```ts
ownerOf(state, pos): string | null
groupOwnedCount(state, group, ownerId): number     // quantas do grupo o dono tem
countOwned(state, kind, ownerId): number            // aeroportos / utilidades

rentCity(base, ownedInGroup, groupSize): number      // base / ×1.5 (maioria) / ×2 (completo)
rentAirport(n: 1|2|3|4): number                      // 25/50/100/200
rentUtility(n: 1|2|3, diceValue: number): number     // (4/10/20) × diceValue
```

`rentCity` (sem construção): `ownedInGroup < maioria` → base; `maioria ≤ ownedInGroup < groupSize` → ×1.5; `=== groupSize` → ×2. Maioria = `2` (grupo de 3) / `3` (grupo de 4). **Ponto de extensão:** a spec de Construção envolverá `rentCity` para somar os multiplicadores de casas/hotéis.

## 4. Portas adicionais (injetadas no store)

```ts
interface EconomyPorts {
  onInsolvency(playerId: string, amount: number, creditorId: string | null): void // → Falência
}
```

`onPassGo`/`onPayToCenter`/`onCollectCenter` continuam as portas do 002 (Balanceamento); agora que `cash` existe, o store pode creditá-lo a partir do retorno de `onPassGo` — mas a **fórmula** do GO Progressivo segue sendo de Balanceamento.

## 5. Conformidade

- **Determinismo:** dado `(state, comando)` o resultado é único; o único não-determinismo (fim do leilão por tempo) é isolado no timer do store e testado com fake timers.
- **Serialização:** `titles`, `cash`, `resolution`/`auction.deadline` são JSON puro; nenhum handle de timer no estado.
- **Fronteira:** construção, hipoteca (mutação), negociação, falência e Hangar/Skyscraper **não** são implementados aqui.
