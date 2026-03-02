# Data Model: Tax Man (Fiscal)

## Entidades

### GameState (estendido — `turn/types.ts`)

| Campo | Tipo | Regra |
|---|---|---|
| `taxManPos` | number | **novo** — posição do Fiscal no tabuleiro (0–47). Seed **0** (GO). Movido 1×/turno. |

### TurnPorts (estendido — `turn/resolution.ts`)

| Porta | Assinatura | Papel |
|---|---|---|
| `taxMan?` | `(state, rng) => void` | Opcional. Chamada em `advanceSeat`. Wired no **store** (não no `defaultPorts`) para `rollTaxMan`. Default ausente = no-op. |

## Fluxo (rollTaxMan — fim de cada turno)

```text
advanceSeat(s, ctx):
  ctx.ports.taxMan?.(s, ctx.rng)   ← Fiscal move 1×/turno (antes de calcular o próximo assento)
  ... calcula próximo assento; startTurn ...

rollTaxMan(state, rng):
  se phase != 'playing' ou ≤1 não-eliminado → no-op
  r = roll(rng, {speedDie:false})            // 2 dados brancos
  taxManPos = (taxManPos + r.move) % 48       // movimento PURO (sem GO/prisão/carta)
  sq = BOARD[taxManPos]
  se sq não é property/airport/utility → fim (sem efeito)
  owner = ownerOf(sq); se owner == null ou hipotecada → fim
  amount = aluguel da casa (cidade/aeroporto×Hangar/utilidade×dadosDoFiscal)
  ownerP.cash -= min(ownerP.cash, amount)     // banco (removido); paga o que houver
```

## Aluguel cobrado (reuso 003/011)

| Casa | Valor |
|---|---|
| Cidade | `rentCity(rent, groupOwned, size, {houses,hotel,hotel2,skyscraper}, groupHasSkyscraper)` |
| Aeroporto | `rentAirport(countOwned) × (hangar ? 2 : 1)` |
| Utilidade | `rentUtility(countOwned, diceValue(rollDoFiscal))` |
| Hipotecada / sem dono / não-propriedade | 0 (sem efeito) |

## Invariantes

- `taxManPos ∈ [0, 47]`.
- O Fiscal move **exatamente 1×** por turno (só via `advanceSeat`; re-rolagem de dupla não dispara).
- O Fiscal nunca credita GO, nunca vai preso, nunca saca carta/compra.
- A cobrança é **removida da economia** (nenhum jogador/pote é creditado).
- Dono nunca fica com caixa negativo (debita o que houver).
- Não opera com `phase==='ended'` nem com ≤1 jogador ativo.
- `taxManPos` é JSON puro/serializável (princípio VII); `rollTaxMan` determinístico sob RNG injetável.
