# Contract: Tema — `theme.ts` e derivações

## `src/game/theme.ts` (novo, folha)

```ts
export const THEME = {
  INITIAL_CASH: 2000,
  BANK: { houses: 40, hotels: 16, skyscrapers: 4 },
  PARKING_SEED: 500,
  GO_BONUS: { min: 100, max: 400 },
  HOUSE_RENT_MULT: [5, 15, 45, 80] as const,
  HOTEL_RENT_MULT: 100,
  SKYSCRAPER_RENT_MULT: 250,
  AIRPORT_RENT: [25, 50, 100, 200] as const,
  UTILITY_MULT: [4, 10, 20] as const,
  HANGAR_COST: 100,
  BUILD_COST_RATIO: 0.5,
  MORTGAGE_RATIO: 0.5,
  UNMORTGAGE_SURCHARGE: 0.1,
  TRANSFER_FEE_RATIO: 0.1,
  JAIL_FINE: 50,
  TAX: { renda: 200, luxo: 100 }, // referência (fonte ativa = boardData.amount)
} as const
```

## Derivações (exports preservados)

| Módulo | Antes | Depois |
|---|---|---|
| `construction.ts` | `HANGAR_COST = 100`; `buildCost = round(price/2)` | `= THEME.HANGAR_COST`; `round(price * THEME.BUILD_COST_RATIO)` |
| `balancing.ts` | `PARKING_SEED = 500`; `goBonus` 100..400 | `= THEME.PARKING_SEED`; usa `THEME.GO_BONUS.min/max` |
| `turnMachine.ts` | `JAIL_FINE = 50` | `= THEME.JAIL_FINE` |
| `rent.ts` | consts locais `[5,15,45,80]`/100/250/`[25,50,100,200]`/`[4,10,20]` | `= THEME.*` |
| `mortgage.ts` | `/2`, `*1.1`, `*0.1` | `THEME.MORTGAGE_RATIO`, `(1+SURCHARGE)`, `TRANSFER_FEE_RATIO` |
| `store.ts` | `cash:2000`, `bank:{40,16,4}`, `centerPot:500` | `THEME.INITIAL_CASH`, `THEME.BANK`, `THEME.PARKING_SEED` |

**Invariante:** valores idênticos → suíte 002–017 verde sem edição.

## `boardData.ts`

- Aeroportos `name`: pos 6 → "Aeroporto JFK", pos 18 → "Aeroporto Heathrow", pos 30 → "Aeroporto Narita", pos 42 → "Aeroporto de Sydney" (IATA preservado).
- Comentário do cabeçalho: relabelar "escada PROVISÓRIA" → valores oficiais do tema (tunáveis em `theme.ts`).

## `tests/game/theme.test.ts`

- Todos os `BOARD[].name` são **únicos**.
- (Sanity) `createSeedState` reflete `THEME` (cash/bank/centerPot).
