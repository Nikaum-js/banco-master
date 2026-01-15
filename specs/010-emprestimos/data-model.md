# Data Model: Empréstimos entre jogadores

## Entidades

### Loan (novo — `economy/types.ts`)

```ts
export interface Loan {
  debtorId: string
  creditorId: string
  principal: number   // > 0
  ratePct: number     // 10..50 (inteiro) — juros simples sobre o principal
}
```

Invariantes:

- `ratePct ∈ [10, 50]`.
- `principal ≥ shortfall` (déficit da dívida que originou) e `≤ caixa do credor` no momento da concessão.
- **No máximo 1 Loan com um dado `debtorId`** (§15.3). Sem limite para `creditorId`.
- **Sem** campo de juros acumulados — juros são cobrados e quitados por volta (R1).

### GameState (modificado — `turn/types.ts`)

| Campo | Tipo | Regra |
|---|---|---|
| `loans` | `Loan[]` | Empréstimos ativos da partida. Seed `[]`. Serializável. |

### TurnPorts (modificado — `turn/resolution.ts`)

| Porta | Assinatura | Papel |
|---|---|---|
| `afterPassGo?` | `(state, playerId) => void` | Opcional. Chamada em `advance` após creditar o bônus de GO. Wired no store para `chargeLoanInterest`. Default ausente = no-op. |

## Transições / fluxos

### Conceder (na janela `debt`)

```text
resolution.kind==='debt' (devedor ativo, caixa < amount)
  --grantLoan(devedor, credor, principal, ratePct)-->  [valida]
     credor.cash -= principal; devedor.cash += principal; loans.push(loan)
  --payDebt (008)--> dívida quitada; turno segue
```

Rejeições (no-op): não há resolução `debt`; solicitante ≠ devedor ativo; devedor já tem empréstimo; `ratePct∉[10,50]`; `principal < shortfall`; `principal > credor.cash`; pausado.

### Juros no GO

```text
advance cruza o GO → player.cash += bônus (onPassGo) → afterPassGo(state, player.id):
  para o loan onde player é devedor:
    interest = round(principal * ratePct / 100)
    se cash >= interest:  devedor -= interest; credor += interest
    senão:                credor += cash; resto = interest - cash; devedor = 0;
                          resolution = { kind:'debt', amount: resto, creditorId }
```

### Quitar

```text
payOffLoan(devedor)  [cash >= principal, não pausado]
  devedor.cash -= principal; credor.cash += principal; remove loan
```

### Falência (declareBankruptcy, 008 estendido)

```text
se activeLoanFor(devedor):  RAMO §9.3
  para cada propriedade do devedor: hotéis/casas → banco; ownerId = creditorId; mortgaged preservado
  creditor.cash += devedor.cash; devedor.cash = 0; remove o loan
senão:                       §9.2 inalterado (008)
em ambos: devedor.eliminated = true; remover loans onde o devedor é credor (R8); checkEndGame; advanceSeat
```

## Invariantes globais

- `loans` nunca tem 2 entradas com o mesmo `debtorId`.
- Juros sempre `round(principal·ratePct/100)`, sobre o principal **original** (simples).
- Quitação = principal (juros já cobrados por volta).
- Estado permanece JSON puro/serializável (princípio VII); juros são funções do principal, não armazenados.
