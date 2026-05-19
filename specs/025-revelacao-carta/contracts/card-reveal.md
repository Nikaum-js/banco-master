# Contrato — Revelação de carta (025)

## Motor (cards/draw.ts)

```ts
export function cardRevealResolve(rctx: ResolveCtx): ResolutionOutcome | null
export function confirmCardReveal(state: GameState, ports: TurnPorts): GameState
// cardResolve(rctx) — INALTERADO
```

### `cardRevealResolve(rctx)`

| Entrada | Efeito | Retorno |
|---|---|---|
| `square.kind` ∈ {acaso, tesouro}, deck com topo | seta `resolution = { card-reveal, deckId, cardId: decks[deckId][0] }`; **não** muta deck/mão/caixa | `{ done:false, blocksFinalize:true }` |
| deck sem topo | nada | `{ done:true }` |
| outro `kind` | nada | `null` (cai no resolver default) |

### `confirmCardReveal(state, ports)`

| Pré | Efeito |
|---|---|
| `resolution.kind === 'card-reveal'` | limpa a revelação; `cardResolve(rctx)` saca+processa; se `done` → `aguardando-finalizacao`; senão segue pendente (discard/atalho) |
| outro / sem revelação | no-op (`=== state`) |

**Invariante**: peek não muta; o saque/efeito só ocorre no confirm, via `cardResolve` (inalterado) → resultado idêntico ao fluxo atual; suíte 006 verde.

## Store

- `ctx.resolve = (r) => economyResolve(r) ?? cardRevealResolve(r) ?? taxBunkerResolve(r)` (troca `cardResolve` por `cardRevealResolve`).
- Comando `confirmCardReveal()` → `confirmCardReveal(game, ctx.ports)`.

## activeModal / ModalLayer (022)

- `activeModal(game)`: `resolution.kind === 'card-reveal'` → `{ kind:'card-reveal', deckId, cardId, rarity, effect, mode }` (via `cardById`).
- `ModalLayer`: cartão central com nome/deck/raridade/descrição + "Continuar" (`confirmCardReveal`). Indica "vai para sua mão" (mode mao) ou "efeito aplicado agora" (imediato).

## Cobertura de teste (`tests/game/cards/revelacao.test.ts`) — SC-005

1. `cardRevealResolve` em acaso/tesouro → seta `card-reveal` com o `cardId` do topo; deck/mão **inalterados**; `{done:false}`.
2. `confirmCardReveal` carta **imediata** (ex.: erro-banco/boom) → aplica o efeito (caixa muda), limpa revelação, finaliza.
3. `confirmCardReveal` carta de **mão** que cabe → entra na mão; finaliza.
4. `confirmCardReveal` carta de mão que estoura (mão=3) → abre `card-discard`.
5. `confirmCardReveal` **Atalho** → abre `card-shortcut`.
6. `confirmCardReveal` sem revelação → no-op.
7. `activeModal` → variante `card-reveal` com rarity/effect/mode corretos.
8. `cardResolve` inalterado: suíte de 006 (`decks.test`/`hand.test`) verde.
