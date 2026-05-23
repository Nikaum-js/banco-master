# Contract — Balanceamento: GO Progressivo & Free Parking (Fase 1)

Funções puras de balanceamento + as portas (assinatura nova) e os call-sites.

---

## 1. `balancing.ts` (puro)

```ts
// Ranking por netWorth (006), desempate por assento. Linear $100→$400.
goBonus(state: GameState, playerId: string): number

// Free Parking: rotear ao pote / coletar.
payToCenter(state: GameState, amount: number): void        // state.centerPot += amount
collectCenter(state: GameState, playerId: string): void     // cash += centerPot; centerPot = 500
```

`goBonus` usa `netWorth(state, id)` (importado de `cards/effects.ts`, 006).

## 2. Portas (assinatura atualizada — recebem `state`, mutam o clone)

```ts
interface TurnPorts {
  onPassGo(state, playerId): number      // → goBonus; advance credita o retorno
  onPayToCenter(state, amount): void     // → payToCenter
  onCollectCenter(state, playerId): void // → collectCenter
  isEliminated(playerId): boolean        // (inalterada)
  onInsolvency?(playerId, amount, creditorId): void // (inalterada)
}
```

O **store** injeta: `onPassGo: (s, id) => goBonus(s, id)`, `onPayToCenter: (s, a) => payToCenter(s, a)`, `onCollectCenter: (s, id) => collectCenter(s, id)`.

## 3. Call-sites (mutações de dinheiro)

| Local | Mudança |
|---|---|
| `advance` (turnMachine) | recebe `state`; ao cruzar/parar no GO: `player.cash += ports.onPassGo(state, player.id)` |
| handler `tax` (resolution) | `payer.cash -= square.amount` **e** `ports.onPayToCenter(state, amount)` (antes: não debitava) |
| handler `corner-parking` (resolution) | `ports.onCollectCenter(state, playerId)` |
| `jailDecision` pay / 3ª tentativa (turnMachine) | `player.cash -= 50` **e** `ports.onPayToCenter(s, 50)` (antes: não debitava) |
| cartas Honorários/Crise/Conserto (effects) | `ports.onPayToCenter(s, amount)` (débito do jogador já existia no 006) |
| cartas de movimento / `chooseCardShortcut` | `advance(s, …)` passa a receber `state` |

## 4. Conformidade

- **Determinismo:** `goBonus` é puro (ranking estável por assento); pote é aritmética simples.
- **Serialização:** só `centerPot: number` é adicionado.
- **Fronteira:** o 002 **não** importa o 007 — o balanceamento entra pelas implementações de porta injetadas no store. A fórmula vive em `balancing.ts`.
- **Catch-up discreto (princípio IV):** a porta retorna só um número; nenhum rótulo de ranking vaza para a UI.
- **Fora de escopo:** Tax Man, Hangar, Skyscraper, 2º hotel.
