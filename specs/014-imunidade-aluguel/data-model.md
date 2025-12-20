# Data Model: Imunidade de aluguel

## Entidades

### Immunity (novo — `economy/types.ts`)

```ts
export interface Immunity {
  beneficiaryId: string      // quem não paga
  pos: number                // propriedade isenta
  lapsRemaining: number | null // voltas restantes; null = permanente
}
```

### GameState (modificado — `turn/types.ts`)

| Campo | Tipo | Regra |
|---|---|---|
| `immunities` | `Immunity[]` | Imunidades ativas. Seed `[]`. Serializável. |

### Trade (estendido — `economy/trade.ts`, 013)

| Campo | Tipo | Regra |
|---|---|---|
| `fromImmunities?` | `ImmunityGrant[]` | concedidas por `from` → beneficiário `to`, sobre props de `from` |
| `toImmunities?` | `ImmunityGrant[]` | espelho |

`ImmunityGrant = { pos: number; laps: number | null }` (`null` = permanente).

## Transições

### Conceder (dentro de `executeTrade`)

```text
valida (junto com o resto da troca):
  ∀ grant em fromImmunities: ownerOf(pos)===fromId ∧ pos ∉ fromProps ∧ (laps===null ∨ laps>0)
  ∀ grant em toImmunities:   ownerOf(pos)===toId   ∧ pos ∉ toProps   ∧ (laps===null ∨ laps>0)
aplica (atômico, após o swap):
  fromImmunities → push { beneficiaryId: toId, pos, lapsRemaining: laps }
  toImmunities   → push { beneficiaryId: fromId, pos, lapsRemaining: laps }
```

### Isenção (resolveRentable)

```text
ao parar em propriedade com dono ≠ você e não hipotecada:
  se hasImmunity(state, você, pos) → { done: true }  (sem aluguel)
```

### Expiração (afterPassGo do beneficiário)

```text
tickImmunities(state, beneficiaryId):
  ∀ imunidade do beneficiário com lapsRemaining número: lapsRemaining -= 1
  remove as que ficaram ≤ 0; permanentes (null) intactas
```

## Invariantes

- Imunidade isenta **apenas** o `beneficiaryId` (pessoal); o dono cobra dos outros.
- A propriedade **não** é cancelada pela imunidade.
- N voltas decrementa só no GO do **beneficiário**; permanente nunca expira.
- Persiste mesmo se a propriedade mudar de dono (tied a beneficiário+pos).
- Tax Man (012) não consulta imunidade (cobra o dono).
- Estado JSON puro/serializável (princípio VII).
