# Quickstart: Imunidade de aluguel

## Verificar

```bash
bunx vitest run tests/game/economy   # testes de economia (inclui imunidade)
bunx vitest run tests/game           # suíte completa do motor (não pode regredir)
bun run build                        # tsc -b + vite, exit 0
```

## Fluxo (motor)

```ts
// A concede a B imunidade em sua propriedade pos=1 por 3 voltas, em troca de $200
const g2 = executeTrade(g, {
  fromId: 'A', toId: 'B', fromProps: [], fromCash: 0, toProps: [], toCash: 200,
  fromImmunities: [{ pos: 1, laps: 3 }],
})
// → immunities: [{ beneficiaryId:'B', pos:1, lapsRemaining:3 }]; B paga $200 a A
// B para em pos 1 → resolveRentable vê hasImmunity → sem aluguel
// B passa pelo GO → tickImmunities → lapsRemaining 2 → 1 → 0 (removida)
```

## Cenários-chave (SC-001..005)

- **Concessão**: imunidade registrada após troca válida; concessão sobre propriedade não-própria/cedida → troca rejeitada. (SC-001)
- **Isenção pessoal**: beneficiário não paga; outro jogador paga normal. (SC-002)
- **Expiração**: N voltas decrementa no GO do beneficiário, expira em 0; permanente (`laps:null`) nunca. (SC-003)
- **Tax Man**: cobra o dono independentemente de imunidade. (SC-004)
- **Determinístico** + round-trip JSON de `immunities`. (SC-005)

## Arquivos tocados

- `src/game/economy/types.ts` · `turn/types.ts` · `economy/imunidade.ts` (novo) · `economy/trade.ts` · `economy/resolveRentable.ts` · `store.ts` · `ui/GameHUD.tsx`
- `tests/game/economy/imunidade.test.ts`
