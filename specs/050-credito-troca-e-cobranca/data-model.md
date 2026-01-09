# Data Model: Prazo do crédito, contrapartida na troca e faixa de cobrança

## Alterado — `Loan`

| Campo | Tipo | Observação |
|---|---|---|
| `debtorId` | `string` | inalterado |
| `creditorId` | `string` | inalterado |
| `principal` | `number` | inalterado |
| `ratePct` | `number` | inalterado — 10..50 |
| **`lapsElapsed`** | `number` | **novo** — passagens do devedor pelo GO desde a concessão; começa em `0`, vence em `LOAN_TERM_LAPS` |

Invariantes:

- `0 <= lapsElapsed < LOAN_TERM_LAPS` para todo empréstimo presente na lista. Ao atingir `LOAN_TERM_LAPS` o empréstimo é removido no mesmo passo, então o valor de vencimento nunca é observável no estado.
- `lapsElapsed` só é incrementado pela cobrança do GO do próprio devedor.
- Snapshot antigo sem o campo é lido como `0`. Isso pode dar até três voltas a mais a um empréstimo que atravessou a atualização; é o comportamento conservador, e não há como recuperar o histórico de GO já ocorrido.

## Nova constante — `LOAN_TERM_LAPS`

`3`. Vive junto do motor de empréstimos e é a única fonte do prazo — interface e testes leem daí em vez de escrever o número.

## Novo módulo — avaliação de proposta

| Símbolo | Papel |
|---|---|
| `BUS_TICKET_APPRAISAL` | `100` |
| `IMMUNITY_LAP_RATE` | `0.1` do preço da propriedade protegida, por volta |
| `IMMUNITY_MAX_RATE` | `0.5` do preço — teto do escalonado e valor da permanente |
| `MIN_COUNTERPART_RATIO` | `0.5` |
| `appraiseSide(state, side)` | valor de ativos entregues por um lado |
| `tradeBalance(state, trade)` | por lado: ativos entregues, valor recebido e quanto falta para o piso |
| `meetsCounterpart(state, trade)` | predicado usado pelo `validateTrade` |

Nenhum destes valores é cobrado de ninguém — são medidas de verificação, como a §8.5 registra.

## Sem alteração de schema

O contador viaja dentro do `GameState` já serializado no snapshot da sala. Não há migration.

## Estado de interface

A faixa de cobrança não guarda estado de partida. O único estado local é se a escolha de credor está aberta, e ele morre com a faixa.
