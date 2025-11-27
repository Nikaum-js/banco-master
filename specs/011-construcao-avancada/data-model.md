# Data Model: Construção avançada

## Entidades

### Title (estendido — `economy/types.ts`)

| Campo | Tipo | Regra |
|---|---|---|
| `houses` | number | 0–4 (existente) |
| `hotel` | boolean | hotel construído; **permanece true** nos níveis 2º hotel/Skyscraper (existente) |
| `hotel2` | boolean | **novo** — 2º hotel (nível 6). Requer `hotel` |
| `skyscraper` | boolean | **novo** — Skyscraper (nível 7). Requer `hotel2` + grupo completo |
| `hangar` | boolean | **novo** — só relevante em aeroportos; dobra o aluguel daquele aeroporto |
| `mortgaged` | boolean | existente |
| `ownerId` | string\|null | existente |

**Ladder de cidade** `cityLevel(title)`: `skyscraper→7`, `hotel2→6`, `hotel→5`, senão `houses` (0–4).

### BankStock (estendido — `economy/types.ts`)

| Campo | Tipo | Regra |
|---|---|---|
| `houses` | number | de 40 (existente) |
| `hotels` | number | de 16 (existente; 2º hotel consome do mesmo estoque) |
| `skyscrapers` | number | **novo** — limite global provisório (seed **4**) |

## Constantes (provisórias de tema)

| Constante | Valor | Onde |
|---|---|---|
| `HANGAR_COST` | 100 | `construction.ts` (§13.6) |
| Skyscraper custo | `buildCost(sq)` | `construction.ts` (≥ 2º hotel) |
| `SKYSCRAPER_RENT_MULT` | 250 | `rent.ts` (aluguel fixo = base×250) |
| `bank.skyscrapers` (seed) | 4 | `store.ts` |

## Transições

### Cidade (buildHouse sobe / sellBuilding desce — uniformidade do 004)

```text
0..3 --casa-->    +1 casa        (bank.houses -1)
4    --hotel-->   hotel          (bank.houses +4, bank.hotels -1)
5    --2º hotel-->hotel2=true     (bank.hotels -1)            [todas as do grupo ≥ hotel]
6    --skyscraper>skyscraper=true (bank.skyscrapers -1)       [GRUPO COMPLETO + todas no 6]
```

Venda (nível máximo do grupo, metade do custo):

```text
7 --vende--> 6   skyscraper=false  (bank.skyscrapers +1)   [não mexe em hotels/houses]
6 --vende--> 5   hotel2=false      (bank.hotels +1)
5 --vende--> 4   hotel→4 casas     (ou desmonte forçado §5.5, 004)
1..4 --vende--> -1 casa            (bank.houses +1)
```

### Aeroporto (Hangar — fora do ladder)

```text
sem Hangar --buildHangar--> hangar=true   (cash -100)
com Hangar --sellHangar-->  hangar=false  (cash +50)
```

## Aluguel

| Caso | Valor |
|---|---|
| Cidade com Skyscraper | fixo = `base × SKYSCRAPER_RENT_MULT` |
| Cidade sem Skyscraper, grupo **tem** Skyscraper | aluguel normal **× 3** |
| Cidade com 2º hotel | = aluguel de hotel (inalterado) |
| Aeroporto com Hangar | `rentAirport(count) × 2` |
| Hipotecado | sem aluguel (existente) |

## Invariantes

- `cityLevel` monotônico por uniformidade (constrói no mín, vende do máx do grupo).
- Skyscraper só existe com grupo completo e todas no nível 6.
- Estoques nunca negativos (`bank.houses/hotels/skyscrapers ≥ 0`).
- Erguer/vender Skyscraper **não** altera `bank.hotels`/`bank.houses` (só `bank.skyscrapers`).
- Falência devolve 2º hotel/Skyscraper aos estoques; `netWorth`/`liquidationValue` contam os novos níveis.
- Estado JSON puro/serializável (princípio VII).
