# Contract: Cartas de reação

## `economy/types.ts` (ResolutionSlice +=)

```ts
| { kind: 'reaction-diplomacia'; reactorId: string; attackerId: string; effect: string; cardId: string; deck: DeckId; targetPos: number | null; targetPlayer: string | null }
| { kind: 'reaction-bunker'; reactorId: string; amount: number }
```

## `cards/ofensivas.ts` (extrair predicados; aplicação os reusa)

```ts
export function canAcquire(state, attackerId, pos): boolean
export function canEvict(state, attackerId, pos): boolean
export function canAudit(state, attackerId, targetId): boolean
// acquire/evict/audit começam com `if (!canX(...)) return false`
```

## `cards/reacao.ts` (novo)

```ts
export function findReactionCard(state, playerId, effect: 'diplomacia' | 'bunkerFiscal'): string | undefined
export function reactorFor(state, effect, attackerId, targetPos: number|null, targetPlayer: string|null): string | null
export function applyOffensive(state, effect, attackerId, targetPos: number|null, targetPlayer: string|null, ports): void
export function taxBunkerResolve(rctx: ResolveCtx): ResolutionOutcome | null
export function respondReaction(state, use: boolean, ports): GameState
```

- `reactorFor`: boicote/aquisicaoHostil/despejo → `ownerOf(targetPos)` se válido (canX); auditoriaFiscal → `targetPlayer` se `canAudit`. Senão `null`.
- `taxBunkerResolve`: `square.kind==='tax'` e `findReactionCard(playerId,'bunkerFiscal')` → set `resolution = reaction-bunker{reactorId: playerId, amount: square.amount}`, retorna `{done:false, blocksFinalize:true}`; senão `null`.
- `respondReaction`: ver data-model (recicla cartas; aplica/cancela; `completeResolution`; Bunker recusado pode abrir `debt`).

## `cards/draw.ts` — `playHandCard` (ofensivas)

Para `effect ∈ {boicote, aquisicaoHostil, despejo, auditoriaFiscal}`:

```ts
const reactor = reactorFor(state, effect, playerId, target ?? null, targetPlayer ?? null)
if (reactor && findReactionCard(state, reactor, 'diplomacia')) {
  const s = clone; remove a ofensiva da mão de playerId
  s.resolution = { kind:'reaction-diplomacia', reactorId: reactor, attackerId: playerId, effect, cardId, deck: card.deck, targetPos: target ?? null, targetPlayer: targetPlayer ?? null }
  return s
}
// senão: aplica via applyOffensive/discardPlayed (comportamento 015/016)
```

## `store.ts`

- `ctx.resolve = (r) => economyResolve(r) ?? cardResolve(r) ?? taxBunkerResolve(r)`.
- comando `respondReaction(use: boolean)` → `respondReaction(st.game, use, st.ctx.ports)`.

## `cards/catalog.ts`

`status: 'implementado'` para `diplomacia`, `bunker-fiscal` (0 cartas deferidas).

## `ui/GameHUD.tsx`

Ramo de `resolution` `reaction-diplomacia`/`reaction-bunker`: mostra **Usar** / **Recusar** → `respondReaction(true/false)`.
