# Contract: Negociação — troca

## `economy/trade.ts` (novo)

```ts
export interface Trade {
  fromId: string
  toId: string
  fromProps: number[]
  fromCash: number
  toProps: number[]
  toCash: number
}

export function executeTrade(state: GameState, trade: Trade): GameState
```

### `executeTrade(state, trade): GameState`

Processa uma troca **acordada**. Retorna `state` **inalterado** se qualquer validação falhar (atômico).

**Pré-condições (todas):**

- `state.paused === false`
- `trade.fromId !== trade.toId`; ambos existem e `!eliminated`
- `Number.isInteger(fromCash) && fromCash ≥ 0`; idem `toCash`
- `∀ p ∈ fromProps: ownerOf(state, p) === fromId`; `∀ p ∈ toProps: ownerOf(state, p) === toId`
- `∀ p ∈ fromProps ∪ toProps` com `BOARD[p].kind === 'property'`: `cityLevel(titles[p]) === 0` (sem construção)
- `from.cash ≥ fromCash`; `to.cash ≥ toCash`
- `feesFrom = Σ transferKeepFee(BOARD[p]) ∀ p ∈ toProps com titles[p].mortgaged`
- `feesTo   = Σ transferKeepFee(BOARD[p]) ∀ p ∈ fromProps com titles[p].mortgaged`
- `from.cash − fromCash + toCash − feesFrom ≥ 0` e `to.cash − toCash + fromCash − feesTo ≥ 0`

**Efeitos (clone):**

1. `∀ p ∈ fromProps: titles[p].ownerId = toId`; `∀ p ∈ toProps: titles[p].ownerId = fromId` (`mortgaged`/`hangar` acompanham)
2. `from.cash = from.cash − fromCash + toCash − feesFrom`
3. `to.cash = to.cash − toCash + fromCash − feesTo`

Reusa: `ownerOf` (titles, 003), `cityLevel` (construction, 011), `transferKeepFee`/`mortgageValue` (mortgage, 005).

## `store.ts`

```ts
executeTrade(trade: Trade): void   // não gated por turno (qualquer par, a qualquer momento)
// impl: executeTrade: (trade) => set((st) => ({ game: executeTrade(st.game, trade) }))
```
