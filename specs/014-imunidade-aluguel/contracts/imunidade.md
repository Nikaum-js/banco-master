# Contract: Imunidade de aluguel

## `economy/types.ts`

```ts
export interface Immunity { beneficiaryId: string; pos: number; lapsRemaining: number | null }
```

## `turn/types.ts`

`GameState += immunities: Immunity[]` (seed `[]`).

## `economy/imunidade.ts` (novo)

### `hasImmunity(state: GameState, beneficiaryId: string, pos: number): boolean`

`true` se existe imunidade com esse `beneficiaryId` e `pos`.

### `tickImmunities(state: GameState, beneficiaryId: string): void`

Muta `state`. Decrementa `lapsRemaining` (quando número) das imunidades do `beneficiaryId`; remove as `≤ 0`; `null` (permanente) intacto.

## `economy/trade.ts` (estendido — 013)

```ts
interface ImmunityGrant { pos: number; laps: number | null }
interface Trade { /* ...013... */ fromImmunities?: ImmunityGrant[]; toImmunities?: ImmunityGrant[] }
```

`executeTrade` (além do 013):
- **Valida** cada grant: `ownerOf(state, pos) === granterId` ∧ `pos ∉ granterProps` ∧ (`laps === null` ∨ inteiro `> 0`). Inválido → `state` inalterado.
- **Aplica** (após o swap): `push { beneficiaryId: <outro lado>, pos, lapsRemaining: laps }`.

## `economy/resolveRentable.ts` (modificado)

Após `owner !== playerId` e `!isMortgaged`, **antes** de calcular o aluguel:

```ts
if (hasImmunity(state, playerId, pos)) return { done: true } // beneficiário isento (§8.4)
```

## `store.ts`

- `createSeedState`: `immunities: []`.
- `afterPassGo`: `(s, id) => { chargeLoanInterest(s, id); tickImmunities(s, id) }`.

## `ui/GameHUD.tsx`

Linha de status: imunidades ativas `beneficiário→pos·voltas` (visível a todos, §8.4).
