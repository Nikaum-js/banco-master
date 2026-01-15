# Contract: Cartas — efeitos temporários

## `economy/types.ts`

```ts
export interface TempEffect {
  kind: 'apagao' | 'greve' | 'boicote' | 'imunidade-temp'
  ownerId: string
  pos: number | null
  lapsRemaining: number
}
```

## `turn/types.ts`

`GameState += tempEffects: TempEffect[]` (seed `[]`).

## `economy/tempEffects.ts` (novo)

```ts
export function apagaoActive(state): boolean
export function greveActive(state): boolean
export function isBoycotted(state, pos: number): boolean
export function isTempImmune(state, pos: number): boolean
export function addTempEffect(state, e: TempEffect): void   // muta (push)
export function tickTempEffects(state, ownerId: string): void // decrementa do ownerId; remove ≤0
```

## `cards/effects.ts` (handlers novos)

```ts
apagao: (s, id) => addTempEffect(s, { kind: 'apagao', ownerId: id, pos: null, lapsRemaining: 1 }),
greveUtilidades: (s, id) => addTempEffect(s, { kind: 'greve', ownerId: id, pos: null, lapsRemaining: 1 }),
```

## `cards/draw.ts` — `playHandCard(state, playerId, cardId, ports, target?: number)`

Antes do `applyEffect` genérico, caso especial:

```ts
if (card.effect === 'boicote') {
  if (target == null) return state
  if (ownerOf(s, target) === null || ownerOf(s, target) === playerId) return state // outro jogador
  if (isTempImmune(s, target)) return state // alvo protegido
  addTempEffect(s, { kind: 'boicote', ownerId: playerId, pos: target, lapsRemaining: 2 })
  // remove carta + recicla
} else if (card.effect === 'imunidade') {
  if (target == null || ownerOf(s, target) !== playerId) return state // própria
  addTempEffect(s, { kind: 'imunidade-temp', ownerId: playerId, pos: target, lapsRemaining: 2 })
  // remove carta + recicla
}
```

## `economy/resolveRentable.ts`

Após `owner !== playerId`, `!isMortgaged`, `!hasImmunity` (014):

```ts
if (isBoycotted(state, pos)) return { done: true } // boicote: ninguém paga
// airport: rentAirport(count) * (title.hangar && !apagaoActive(state) ? 2 : 1)
// utility: greveActive(state) ? 0 : rentUtility(...)
```

## `balancing/taxMan.ts`

Mesmas checagens antes/dentro do cálculo: `isBoycotted(pos)` → não cobra; aeroporto `apagaoActive` → sem dobra; utilidade `greveActive` → $0.

## `store.ts`

- seed `tempEffects: []`.
- `afterPassGo: (s, id) => { chargeLoanInterest(s, id); tickImmunities(s, id); tickTempEffects(s, id) }`.
- `playHandCard(cardId: string, target?: number)` → `playHandCard(st.game, active, cardId, ports, target)`.

## `cards/catalog.ts`

`status: 'implementado'` para `apagao`, `greve-utilidades`, `boicote`, `imunidade`.

## `ui/GameHUD.tsx`

Linha de status dos efeitos ativos (`kind`[@pos]·voltas), visível a todos (§12.3).
