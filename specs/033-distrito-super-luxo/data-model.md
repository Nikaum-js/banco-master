# Data Model — Distrito Super-Luxo "Alta Roda" (033)

Sem estado serializável novo. Mudam: **board** (`boardData.ts`), **tema** (`theme.ts`) e **cor** (3 fontes).

## Novo grupo `platinum`

### `GroupKey` (`boardData.ts`)
Adicionar `'platinum'` à union (10 grupos no total).

### `GROUPS` (`boardData.ts`)
```ts
platinum: { name: 'Alta Roda', bg: 'bg-group-platinum', token: 'group-platinum' }
```

### Cor (3 fontes — sincronizar)
| Fonte | Entrada |
|---|---|
| `src/index.css` (`@theme`) | `--color-group-platinum: #26233a;` (ônix; gera `bg-group-platinum`) |
| `src/boards/shared.tsx` `GROUP_COLOR` | `platinum: '#26233a'` |
| `src/lib/boardData.ts` `GROUPS` | `bg: 'bg-group-platinum'`, `token: 'group-platinum'` |

> Hex `#26233a` (ônix arroxeado) é candidato — confirmar no `bun run dev`.

## Tema (`theme.ts`)

```ts
HOUSE_COST.platinum = 300        // tier mais caro (> navy 240)
RENT_MULT.platinum = { houses: [4, 10, 22, 27], hotel: 32, hotel2: 42, skyscraper: 50 }
```

Aluguel resultante (via `rentLadder`, fonte única — sem mudança no motor):

| Cidade | base | 1🏠 | 3🏠 | 🏨 | 2º🏨 | 🌆 |
|---|---|---|---|---|---|---|
| Mônaco | 60 | 240 | 1.320 | 1.920 | 2.520 | 3.000 |
| **Dubai** | 72 | 288 | 1.584 | **2.304** | 3.024 | **3.600** |

## Board final (28 cidades, 10 grupos, 48 casas)

| Grupo | Nº | Cidades |
|---|---|---|
| brown · Itália | 3 | Roma, Veneza, Pisa |
| skyblue · Egito | 3 | Cairo, Gizé, Luxor |
| pink · Japão | 3 | Tóquio, Kyoto, Osaka |
| purple · Espanha | 3 | Madri, Ibiza, Sevilha |
| orange · Alemanha | 3 | Berlim, Munique, Hamburgo |
| red · China | 3 | Pequim, Xangai, Hong Kong |
| yellow · Brasil | 3 | Rio, São Paulo, Brasília |
| green · EUA | 3 | Nova York, Los Angeles, Miami |
| navy · França | **2** | Cannes, Paris |
| **platinum · Alta Roda** | **2** | Mônaco, Dubai |

Total: 8×3 + 2 + 2 = **28**. Removidos: **Chicago** (green), **Lyon** (navy). Adicionados: **Mônaco**, **Dubai**.

Lado direito (posições/preços — ver research R3): 37 NY, 38 LA, 40 Miami (green); 41 Cannes, 44 Paris (navy); 46 Mônaco, 47 Dubai (platinum). Aeroportos/utilidades/cantos inalterados.

## Invariantes / validação

- 10 grupos; 8 com 3 cidades, navy e platinum com 2; total 28 cidades / 48 casas.
- Mônaco/Dubai são os preços mais altos (> Paris).
- Dubai hotel (2.304) é o maior aluguel-hotel do jogo (> navy 1.800).
- ROI platinum (2.304/300 ≈ 7,7) < orange (~9,6) e red (~8,4) — não é sweet spot.
- Grupo de 2: maioria = 2 (exige ambas; sem grupo parcial).
- `rentLadder`/`buildCost` inalterados (só ganham a entrada `platinum` no tema).
