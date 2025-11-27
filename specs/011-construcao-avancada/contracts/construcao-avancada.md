# Contract: Construção avançada

## `economy/types.ts`

```ts
interface Title { /* ... */ hotel2: boolean; skyscraper: boolean; hangar: boolean }
interface BankStock { houses: number; hotels: number; skyscrapers: number }
```

## `economy/construction.ts`

### `cityLevel(title): number` (substitui `levelNum`)

`skyscraper→7`, `hotel2→6`, `hotel→5`, senão `houses` (0–4).

### `buildHouse(state, pos): GameState` (estendido)

Sobe 1 nível na cidade de **menor** nível do grupo (uniformidade). Por nível alvo:

- 0–3 → casa: `bank.houses ≥ 1`; `houses+=1`, `bank.houses-=1`.
- 4 → hotel: `bank.hotels ≥ 1`; `houses=0; hotel=true`, `bank.houses+=4`, `bank.hotels-=1`.
- 5 → 2º hotel: `bank.hotels ≥ 1`; `hotel2=true`, `bank.hotels-=1`.
- 6 → Skyscraper: **grupo completo** (`groupOwnedCount==groupSize`) + `bank.skyscrapers ≥ 1`; `skyscraper=true`, `bank.skyscrapers-=1`.

Em todos: dono ativo, não hipotecado, maioria (canBuild), `cur==min`, caixa ≥ custo (`buildCost`). No-op se inválido ou pausado.

### `sellBuilding(state, pos): GameState` (estendido)

Desce 1 nível na cidade de **maior** nível do grupo. Reembolso = metade do custo. 7→6 (`skyscraper=false`, `bank.skyscrapers+=1`), 6→5 (`hotel2=false`, `bank.hotels+=1`), 5→4 (hotel→4 casas ou desmonte forçado §5.5), 1–4 casa. Skyscraper→2º hotel **não** mexe em hotels/houses.

### `buildHangar(state, pos): GameState`

Aeroporto do jogador ativo, não hipotecado, sem Hangar, caixa ≥ `HANGAR_COST` (100), não pausado → `hangar=true`, `cash-=100`. No-op senão.

### `sellHangar(state, pos): GameState`

Aeroporto do jogador ativo com Hangar, não pausado → `hangar=false`, `cash+=50`. No-op senão.

## `economy/rent.ts`

### `rentCity(base, ownedInGroup, size, build?, groupHasSkyscraper?)` (params novos opcionais)

- `build?.skyscraper` → `base * SKYSCRAPER_RENT_MULT` (250 provisório).
- senão: cálculo atual (`build.hotel` cobre hotel **e** 2º hotel); se `groupHasSkyscraper && !build?.skyscraper` → resultado `× 3`.

`build` aceita `{ houses, hotel, hotel2?, skyscraper? }`.

## `economy/titles.ts`

### `groupHasSkyscraper(state, group): boolean`

`true` se alguma cidade do grupo tem `skyscraper`.

## `economy/resolveRentable.ts`

- Cidade: `rentCity(square.rent, groupOwnedCount, groupSize, { houses, hotel, hotel2, skyscraper }, groupHasSkyscraper(state, square.group))`.
- Aeroporto: `rentAirport(countOwned) * (title.hangar ? 2 : 1)`.

## `falencia/falencia.ts`

- `declareBankruptcy`: ao limpar a propriedade, além de hotel/casas, `if (t.hotel2) bank.hotels+=1; if (t.skyscraper) bank.skyscrapers+=1` e zerar flags. (Hangar de aeroporto não tem estoque.)
- `liquidationValue`: somar venda do 2º hotel/Skyscraper (metade do custo) e do Hangar ($50) às propriedades do jogador.

## `cards/effects.ts`

- `netWorth`: incluir o valor das construções extras (2º hotel/Skyscraper/Hangar) ao patrimônio.

## `store.ts`

- `seedTitles`: `hotel2:false, skyscraper:false, hangar:false`.
- seed `bank.skyscrapers: 4`.
- Comandos novos: `buildHangar(pos)`, `sellHangar(pos)` (dono = jogador ativo). 2º hotel/Skyscraper usam o `buildHouse(pos)`/`sellBuilding(pos)` existentes.
