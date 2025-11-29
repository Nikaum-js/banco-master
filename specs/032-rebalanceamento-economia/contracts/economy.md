# Contract — Economia recalibrada (032)

## Tema (`src/game/theme.ts`)

```ts
HOUSE_COST: Record<GroupKey, number>            // tier de custo de casa por grupo
RENT_MULT: Record<GroupKey, {
  houses: readonly [number, number, number, number] // ×base p/ 1..4 casas
  hotel: number; hotel2: number; skyscraper: number
}>
// REMOVIDOS: BUILD_COST_RATIO, HOUSE_RENT_MULT, HOTEL_RENT_MULT, HOTEL2_RENT_MULT, SKYSCRAPER_RENT_MULT
```

## Cálculo de aluguel (`src/game/economy/rent.ts`)

```ts
// FONTE ÚNICA do ladder de construção. Aplica RENT_MULT[group] ao aluguel-base.
export function rentLadder(group: GroupKey, base: number): {
  house: [number, number, number, number] // 1..4 casas
  hotel: number
  hotel2: number
  skyscraper: number
}

// rentCity passa a derivar a tabela de construção de rentLadder(group, base),
// preservando: grupo parcial (×0,7) / completo (×1,0) e ×3 quando há arranha-céu no grupo.
export function rentCity(/* assinatura atual + group já disponível via square */): number
```

Regras preservadas (não mudam):
- Sem construção: base / 150% (maioria) / 200% (grupo completo).
- Com construção: valor da `rentLadder` × (0,7 parcial | 1,0 completo).
- Arranha-céu: valor fixo do próprio nível; demais cidades do grupo ×3 enquanto houver arranha-céu.

## Custo de construção (`src/game/economy/construction.ts`)

```ts
// property → tier do grupo; aeroporto/utilidade → 0 (não constroem)
export function buildCost(sq: PropertySquare): number   // retorna THEME.HOUSE_COST[sq.group]
```

Usado por: construir (debita), vender (metade), e o deed (Casa/Hotel) — todos via tier.

## UI (consumir a fonte única)

- `src/boards/shared.tsx`: **remover `computeRents(base)`**; callers usam `rentLadder(group, base)`.
- `src/game/ui/modals/ModalLayer.tsx` (`deedRows`): usa `rentLadder(sq.group, sq.rent)`.
- `src/game/ui/landAuction/LandAuctionLayer.tsx` (`rentRows`): usa `rentLadder` (substitui o cálculo via `THEME.*_RENT_MULT` removidos).

## Board (`src/lib/boardData.ts`)

Realocações (preço/base por posição inalterados): pos27 `Hamburgo`/orange · pos31 `Hong Kong`/red · pos33 `Rio`/yellow · pos34 `São Paulo`/yellow (Salvador removido). Composição 8×3 + green×4.

## NÃO fazer

- Não reintroduzir `bank`/`BankStock`/estoque (D-022 — construção ilimitada).
- Não mexer em aeroportos, utilidades, impostos, caixa inicial, GO, Hangar.
