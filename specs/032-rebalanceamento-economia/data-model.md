# Data Model — Rebalanceamento de economia (032)

Sem novo estado serializável. Mudam: **constantes do tema** (`theme.ts`), **dados do board** (`boardData.ts`) e o **cálculo** (`rent.ts`/`construction.ts`).

## Tema (`src/game/theme.ts`)

**Remover:** `BUILD_COST_RATIO`, `HOUSE_RENT_MULT`, `HOTEL_RENT_MULT`, `HOTEL2_RENT_MULT`, `SKYSCRAPER_RENT_MULT`.

**Adicionar:**

```ts
HOUSE_COST: Record<GroupKey, number>            // tier de custo de casa por grupo
RENT_MULT: Record<GroupKey, {
  houses: [number, number, number, number]       // ×base p/ 1..4 casas
  hotel: number; hotel2: number; skyscraper: number
}>
```

### Tiers de custo de casa (`HOUSE_COST`)

| Grupo | $ |
|---|---|
| brown | 40 |
| skyblue | 60 |
| pink | 90 |
| purple | 110 |
| orange | 110 |
| red | 130 |
| yellow | 160 |
| green | 200 |
| navy | 240 |

### Multiplicadores de aluguel (`RENT_MULT`) — draft

`[1🏠, 2🏠, 3🏠, 4🏠, 🏨, 2º🏨, 🌆]` (×aluguel-base da cidade):

| Grupo | 1🏠 | 2🏠 | 3🏠 | 4🏠 | 🏨 | 2º🏨 | 🌆 |
|---|---|---|---|---|---|---|---|
| brown | 7 | 18 | 41 | 51 | 60 | 78 | 96 |
| skyblue | 6 | 16 | 35 | 44 | 52 | 68 | 83 |
| pink | 5 | 13 | 30 | 37 | 44 | 57 | 70 |
| purple | 5 | 13 | 30 | 37 | 44 | 57 | 70 |
| orange | 5 | 13 | 30 | 37 | 44 | 57 | 70 |
| red | 5 | 13 | 29 | 36 | 42 | 55 | 67 |
| yellow | 5 | 14 | 31 | 38 | 45 | 59 | 72 |
| green | 5 | 12 | 28 | 35 | 41 | 53 | 66 |
| navy | 4 | 11 | 24 | 31 | 36 | 47 | 58 |

> Forma comum (frações do hotel): grupos baratos têm hotel-mult grande (brown ×60), caros pequeno (navy ×36). Diferenças finas entre cidades do mesmo grupo vêm do aluguel-base. Valores **tunáveis** no implement.

**Mantidos:** `INITIAL_CASH 2000`, `PARKING_SEED 500`, `GO_PASS 200`, `AIRPORT_RENT [25,50,100,200]`, `UTILITY_MULT [4,10,20]`, `HANGAR_COST 100`, `MORTGAGE_RATIO 0.5`, `JAIL_FINE 50`, `TAX`, `SPEED_DIE_ENABLED`, `LAND_AUCTION_*`.

## Board final (`src/lib/boardData.ts`)

Composição: **8 grupos de 3 + verde de 4 = 28**. Preço/base por **posição** (inalterados); nomes/grupos realocados no lado superior.

| Grupo (país) | Cidades (pos · preço · base) | 🏠 | 🏨 topo |
|---|---|---|---|
| brown · Itália | Roma 1·60·2 · Veneza 3·80·4 · Pisa 5·100·6 | 40 | 360 |
| skyblue · Egito | Cairo 7·115·8 · Gizé 9·120·8 · Luxor 11·140·10 | 60 | 520 |
| pink · Japão | Tóquio 13·160·12 · Kyoto 15·180·14 · Osaka 16·190·16 | 90 | 704 |
| purple · Espanha | Madri 19·200·18 · Ibiza 21·220·20 · Sevilha 22·225·20 | 110 | 880 |
| **orange · Alemanha** | Berlim 25·240·22 · Munique 26·260·24 · **Hamburgo 27·265·24** | 110 | ~1.056 🎯 |
| **red · China** | Pequim 28·270·24 · Xangai 29·280·26 · **Hong Kong 31·285·28** | 130 | ~1.176 🎯 |
| yellow · Brasil | **Rio 33·300·28** · **São Paulo 34·305·28** · Brasília 35·320·30 | 160 | 1.350 |
| green · EUA | Nova York 37·325·30 · LA 38·340·34 · Chicago 40·345·34 · Miami 41·360·38 | 200 | ~1.558 |
| navy · França | Cannes 44·380·35 · Lyon 46·395·45 · Paris 47·400·50 | 240 | 1.800 |

**Mudanças vs hoje:** pos27 (Hong Kong→**Hamburgo**, red→orange); pos31 (Rio→**Hong Kong**, yellow→red); pos33 (SP→**Rio**); pos34 (**Salvador removido**→São Paulo). Aeroportos (6/18/30/42), utilidades (14/32/43), impostos (4/45), cantos (0/12/24/36) **inalterados**.

## ROI (validação do sweet spot — SC-004)

`ROI = aluguel-hotel-topo ÷ custo-casa`:

| Grupo | 🏨 | 🏠 | ROI |
|---|---|---|---|
| **orange** | 1.056 | 110 | **9,6** 🎯 |
| **red** | 1.176 | 130 | **9,0** 🎯 |
| yellow | 1.350 | 160 | 8,4 |
| purple | 880 | 110 | 8,0 |
| green | 1.558 | 200 | 7,8 |
| navy | 1.800 | 240 | 7,5 |

→ orange/red têm o **maior** ROI (sweet spot confirmado).

## Cálculo (`rent.ts` / `construction.ts`)

- `rentLadder(group, base)` → `{ house: [4], hotel, hotel2, skyscraper }` (aplica `RENT_MULT[group]` ao `base`). **Fonte única**.
- `rentCity(...)` usa `rentLadder` em vez dos multiplicadores globais (mantém a regra de grupo parcial 70% / completo 100% / ×3 com arranha).
- `buildCost(sq)` → `HOUSE_COST[sq.group]` (property); 0 p/ aeroporto/utilidade.
