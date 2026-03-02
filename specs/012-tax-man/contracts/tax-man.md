# Contract: Tax Man (Fiscal)

## `turn/types.ts`

`GameState += taxManPos: number` (seed 0 = GO).

## `turn/resolution.ts` (TurnPorts)

```ts
taxMan?(state: GameState, rng: RNG): void   // import type { RNG } from './dice'
```

## `turn/turnMachine.ts` (advanceSeat)

No início de `advanceSeat(s, ctx)`, antes do loop de assento:

```ts
ctx.ports.taxMan?.(s, ctx.rng)   // Fiscal move 1×/turno (012)
```

## `balancing/taxMan.ts` (novo)

### `rollTaxMan(state: GameState, rng: RNG): void`

Muta `state`. Move o Fiscal e cobra o dono. No-op se `state.phase !== 'playing'` ou ≤1 jogador não-eliminado.

```ts
const r = roll(rng, { speedDie: false })
state.taxManPos = (state.taxManPos + r.move) % BOARD.length
const sq = BOARD[state.taxManPos]
if (sq.kind !== 'property' && sq.kind !== 'airport' && sq.kind !== 'utility') return
const owner = ownerOf(state, sq.pos)
if (owner === null || isMortgaged(state, sq.pos)) return
let amount = 0
if (sq.kind === 'airport') amount = rentAirport(countOwned(state, 'airport', owner)) * (state.titles[sq.pos].hangar ? 2 : 1)
else if (sq.kind === 'utility') amount = rentUtility(countOwned(state, 'utility', owner), diceValue(r))
else {
  const t = state.titles[sq.pos]
  amount = rentCity(sq.rent, groupOwnedCount(state, sq.group, owner), groupSize(sq.group),
    { houses: t.houses, hotel: t.hotel, hotel2: t.hotel2, skyscraper: t.skyscraper },
    groupHasSkyscraper(state, sq.group))
}
const ownerP = state.players.find((p) => p.id === owner)
if (ownerP) ownerP.cash -= Math.min(ownerP.cash, amount) // banco (removido); paga o que houver
```

**Pós:** `taxManPos` atualizado; se cobrou, `ownerP.cash` reduzido (≥ 0); nenhum crédito a jogador/pote.

## `store.ts`

- `createSeedState`: `taxManPos: 0`.
- `ctx`: `ports: { ...defaultPorts, taxMan: (s, rng) => rollTaxMan(s, rng) }` — **defaultPorts permanece sem o Fiscal** (zero regressão nos testes).
