# Contract: Limpeza na eliminação (§9.4)

## `economy/types.ts`

`Immunity += granterId?: string`.

## `economy/trade.ts` (executeTrade)

Ao aplicar as concessões de imunidade:

```ts
for (const g of trade.fromImmunities ?? []) s.immunities.push({ beneficiaryId: toId, pos: g.pos, lapsRemaining: g.laps, granterId: fromId })
for (const g of trade.toImmunities ?? [])   s.immunities.push({ beneficiaryId: fromId, pos: g.pos, lapsRemaining: g.laps, granterId: toId })
```

## `falencia/falencia.ts` (declareBankruptcy)

Após `debtor.eliminated = true` (e antes/junto da remoção de loans):

```ts
s.immunities = s.immunities.filter((i) => i.granterId !== debtor.id && i.beneficiaryId !== debtor.id) // §9.4
s.tempEffects = s.tempEffects.filter((e) => e.ownerId !== debtor.id) // efeitos órfãos do eliminado
```

## Testes

- `tests/game/falencia/limpeza-eliminacao.test.ts`: imunidade concedida/recebida pelo eliminado removida; tempEffect dele removido; de terceiros intactos.
- `tests/game/economy/imunidade.test.ts`: a asserção do registro pós-troca inclui `granterId`.
