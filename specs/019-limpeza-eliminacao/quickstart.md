# Quickstart: Limpeza na eliminação (§9.4)

## Verificar

```bash
bunx vitest run tests/game/falencia   # inclui limpeza-eliminacao.test.ts
bunx vitest run tests/game            # suíte completa (não pode regredir)
bun run build                         # exit 0
```

## O que muda

- `Immunity` ganha `granterId?` (setado no `executeTrade`).
- `declareBankruptcy` remove, na eliminação: imunidades concedidas/recebidas pelo eliminado + `tempEffects` originados por ele.

## Arquivos tocados

- `src/game/economy/types.ts` · `economy/trade.ts` · `falencia/falencia.ts`
- `tests/game/falencia/limpeza-eliminacao.test.ts` (novo) · `tests/game/economy/imunidade.test.ts` (1 asserção)
