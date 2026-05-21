# Data Model — Transferência de imunidade (028)

Estende `Trade` (024) com dois campos; reusa `Immunity` (014). Sem entidade nova.

## `Trade` += transferências

```ts
// economy/types.ts (na interface Trade)
fromImmunityTransfers?: number[] // posições de imunidades de que `from` é beneficiário, transferidas a `to`
toImmunityTransfers?: number[]   // imunidades de que `to` é beneficiário, transferidas a `from`
```

- Distinto de `fromImmunities`/`toImmunities` (que **concedem novas**). Estas **transferem existentes**.
- Cada item é a `pos` de uma imunidade ativa cujo beneficiário é o ofertante daquele lado.

## Validação e aplicação (economy/trade.ts)

```ts
// validação (reusa hasImmunity de 014)
function validImmunityTransfers(state, transfers: number[] | undefined, beneficiaryId: string): boolean {
  return (transfers ?? []).every((pos) => hasImmunity(state, beneficiaryId, pos))
}
```

- **validateTrade** += `validImmunityTransfers(state, trade.fromImmunityTransfers, fromId)` e `(…, trade.toImmunityTransfers, toId)`; se algum falhar → proposta inválida.
- **executeTrade** (antes de empurrar concessões novas): para cada `pos` em `fromImmunityTransfers`, achar `immunities.find(i => i.beneficiaryId === fromId && i.pos === pos)` e setar `beneficiaryId = toId` (preserva `lapsRemaining` + `granterId`); idem `toImmunityTransfers` (to→from). Concessão de novas segue igual.

### Invariantes

- Transferência válida ⇒ ofertante era beneficiário ativo (`hasImmunity`).
- Após aplicar: `hasImmunity(novo estado, recebedor, pos)` verdadeiro; `hasImmunity(novo estado, ofertante, pos)` falso (a menos que houvesse outra imunidade própria na mesma pos).
- `lapsRemaining` e `granterId` da imunidade transferida **inalterados**.
- Resto da troca (propriedades/dinheiro/taxas/concessões) idêntico → suíte 013/014/024 verde.

## Entidades existentes

- **`Immunity`** (014): `{ beneficiaryId, pos, lapsRemaining, granterId? }` — a transferência muda só `beneficiaryId`.
- **`hasImmunity(state, beneficiaryId, pos)`** (014): reusado para validar.
- **`Trade`** (024): ganha os dois campos; `acceptTrade` continua registrando/logando (027).
