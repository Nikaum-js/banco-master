# Contract — Distrito Super-Luxo (033)

Mudança **aditiva** sobre o modelo 032/D-024. Entradas a adicionar:

## 1. `GroupKey` + `GROUPS` (`src/lib/boardData.ts`)
- `GroupKey` union ganha `'platinum'`.
- `GROUPS.platinum = { name: 'Alta Roda', bg: 'bg-group-platinum', token: 'group-platinum' }`.

## 2. Cor (3 fontes — todas obrigatórias)
- `src/index.css` `@theme`: `--color-group-platinum: #26233a;`
- `src/boards/shared.tsx` `GROUP_COLOR`: `platinum: '#26233a'`
- (a `bg-group-platinum` é gerada automaticamente pelo Tailwind v4 a partir da CSS var)

## 3. Tema (`src/game/theme.ts`)
- `HOUSE_COST.platinum = 300`
- `RENT_MULT.platinum = { houses: [4, 10, 22, 27], hotel: 32, hotel2: 42, skyscraper: 50 }`

## 4. Board (`src/lib/boardData.ts`) — lado direito
- Remover Chicago (green) e Lyon (navy).
- pos 40 → Miami (green, 360/38); 41 → Cannes (navy, 380/40); 44 → Paris (navy, 430/52); 46 → Mônaco (platinum, 550/60, uf MC); 47 → Dubai (platinum, 650/72, uf AE).
- green = 3 (NY/LA/Miami), navy = 2 (Cannes/Paris), platinum = 2 (Mônaco/Dubai).

## Reuso (NÃO recriar)
- Cálculo de aluguel: `rentLadder(group, base)` (fonte única) — só lê a nova entrada de `RENT_MULT`. `rentCity`/`buildCost`/`computeRents` inalterados.
- `majority` inalterado (grupo de 2 → 2).

## NÃO fazer
- Não reintroduzir `bank`/`BankStock`/estoque (D-022).
- Não mexer em aeroportos/utilidades/impostos/caixa/GO.
- Não esquecer nenhuma das 3 fontes de cor (faixa/deed quebra).
