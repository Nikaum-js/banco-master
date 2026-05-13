# Contract — Layout do Tabuleiro 13×13 (48 casas)

Contrato da **UI interna** do board: como `pos` (0–47) mapeia para a grade CSS e para o "lado". Consumido por `Board01Classic.tsx` (render) e `boards/shared.tsx` (orientação das casas). É o contrato que `/speckit-implement` deve satisfazer.

## Grade

- CSS Grid de **13 colunas × 13 linhas**.
- Perímetro = 48 células; miolo (linhas 2–12, colunas 2–12) = arena central.
- Cantos maiores que casas comuns (proporção herdada do layout atual; valores de `fr` definidos na implementação).

```
gridTemplateColumns: <canto> repeat(11, <casa>) <canto>
gridTemplateRows:    <canto> repeat(11, <casa>) <canto>
centro: gridRow 2 / 13, gridColumn 2 / 13
```

## Contrato `gridArea(pos) → { gridRow, gridColumn }`

```
pos 0–12   (inferior): gridRow = 13,            gridColumn = 13 - pos
pos 13–24  (esquerdo): gridRow = 13 - (pos-12), gridColumn = 1
pos 25–36  (superior): gridRow = 1,             gridColumn = pos - 23
pos 37–47  (direito):  gridRow = pos - 35,      gridColumn = 13
```

**Casos de borda (cantos), devem bater exatamente:**

| pos | gridRow | gridColumn | esperado |
|---|---|---|---|
| 0 | 13 | 13 | inferior-direito (GO) |
| 12 | 13 | 1 | inferior-esquerdo (Prisão) |
| 24 | 1 | 1 | superior-esquerdo (Férias) |
| 36 | 1 | 13 | superior-direito (Vá-pra-Prisão) |

## Contrato `sideOf(pos) → Side`

```
pos ∈ {0,12,24,36}        → 'corner'
1 ≤ pos ≤ 11              → 'bottom'
13 ≤ pos ≤ 23             → 'left'
25 ≤ pos ≤ 35             → 'top'
37 ≤ pos ≤ 47             → 'right'
```

`Side` decide a orientação interna da casa (posição da stripe externa, da bandeira-avatar na borda interna, do header de aluguel) — a lógica já existente em `ClassicSquare` permanece, só passa a receber os novos ranges.

## Contrato de tipos por posição

A sequência canônica (pos → kind/grupo) está em [research.md](../research.md#decisão-3--sequência-canônica-das-48-casas). A implementação de `BOARD` em `boardData.ts` DEVE corresponder linha-a-linha àquela tabela, respeitando as invariantes de [data-model.md](../data-model.md#invariantes-validáveis).

## Render de novos kinds

- `kind: 'bus-ticket'` → novo glifo em `SquareIcon` (ônibus/ticket) + label "Bus Ticket". Casa não-clicável para compra.
- `utility.icon: 'gas'` → 3º glifo de utilidade em `SquareIcon`.

## Não-objetivos do contrato

- Não define valores monetários (dado de tema).
- Não define lógica de movimento/aluguel (já no estado de jogo; só passa a usar 0–47).
- Não altera o contrato externo (Supabase/realtime) — nenhuma superfície externa muda nesta feature.
