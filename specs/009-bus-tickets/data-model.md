# Data Model: Uso de Bus Tickets & espaço Bus Ticket

Esta feature **não adiciona campos** ao `GameState`. Documenta o campo reusado e as regras/transições.

## Entidades

### Player.busTickets (reusado — 006)

| Campo | Tipo | Regra |
|---|---|---|
| `busTickets` | `number` (inteiro ≥ 0) | Contador privado de Bus Tickets. **Sem limite** de acúmulo. **Separado** do limite de 3 cartas. **Não-negociável** (D-012). |

**Mutações introduzidas por esta feature:**

- **Crédito (+1)**: ao **parar** no espaço Bus Ticket (kind `bus-ticket`). (Já existia o crédito via carta "Passagem de Ônibus", 006.)
- **Débito (−1)**: ao **usar** o ticket com destino válido.

### Lado do tabuleiro (conceito, derivado de `pos`)

Função pura `sideOf(pos)`:

| pos | Lado |
|---|---|
| 1–11 | 0 |
| 13–23 | 1 |
| 25–35 | 2 |
| 37–47 | 3 |
| 0, 12, 24, 36 (cantos) | `null` |

Destino válido de um ticket a partir de `pos`: `sideOf(dest) === sideOf(pos)` ∧ `sideOf(pos) !== null` ∧ `dest !== pos`.

## Estado do turno (reusado — 002)

Nenhum campo novo. O uso do ticket opera dentro do estado `aguardando-rolagem` e produz as mesmas transições de um movimento normal:

```text
aguardando-rolagem --useBusTicket(dest válido)--> casa-a-resolver (pendingResolve=true, mayRollAgain=false)
casa-a-resolver --resolvePending--> aguardando-finalizacao  (resolução do destino, fluxo existente)
aguardando-finalizacao --finalizeTurn--> (próximo jogador; sem re-rolagem)
```

Casos sem transição (comando **rejeitado**, estado inalterado):

- `paused === true`
- `turn.state !== 'aguardando-rolagem'` (preso, já moveu, resolvendo, encerrado)
- jogador **não** é o da vez
- `player.busTickets < 1`
- `sideOf(player.pos) === null` (sobre um canto)
- `dest` inválido (canto, outro lado, ou `=== player.pos`)

## Resolução de casa (reusado — 002)

`resolutionRegistry['bus-ticket']` deixa de ser `stub` ({done:true} no-op) e passa a creditar +1 ticket ao jogador que parou, retornando `{ done: true }` (não bloqueia finalizar). Demais kinds de destino (property/airport/utility/acaso/tesouro/tax/cantos) resolvem pelo caminho existente; utilidade alcançada sem rolagem cobra $0 (ver research R6).

## Invariantes

- `busTickets` nunca fica negativo (débito só ocorre após o guard `busTickets ≥ 1`).
- Usar o ticket **nunca** concede nova rolagem (`mayRollAgain` permanece `false`).
- O token só vai parar numa casa do **mesmo lado** da origem (ou além do GO, se o caminho horário cruzar o 0 ao escolher casa "atrás" no lado 37–47).
- Estado permanece JSON puro/serializável (princípio VII).
