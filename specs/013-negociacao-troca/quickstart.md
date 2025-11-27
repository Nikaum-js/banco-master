# Quickstart: Negociação — troca de propriedades e caixa

## Verificar

```bash
bunx vitest run tests/game/economy   # testes de economia (inclui negociação)
bunx vitest run tests/game           # suíte completa do motor (não pode regredir)
bun run build                        # tsc -b + vite, exit 0
```

## Fluxo (motor)

```ts
// troca acordada: A dá pos 1 + $100; B dá pos 3
const g2 = executeTrade(g, { fromId: 'p1', toId: 'p2', fromProps: [1], fromCash: 100, toProps: [3], toCash: 0 })
// → titles[1].ownerId='p2', titles[3].ownerId='p1', p1.cash-100, p2.cash+100
```

## Cenários-chave (SC-001..005)

- **Troca válida**: propriedades trocam de dono; caixa transferido. (SC-001)
- **Unilateral**: um lado só dinheiro / só propriedade → processa. (SC-001)
- **Inválidas (no-op)**: não possui; cidade com construção; oferece mais caixa do que tem; mesmo jogador; eliminado; pausado. (SC-002)
- **Hipotecada**: chega `mortgaged=true`; recebedor paga 10% (`transferKeepFee`) ao banco; sem caixa p/ a taxa → rejeita. (SC-003)
- **Aeroporto com Hangar**: Hangar acompanha na troca. (SC-004)
- **Não-negociáveis**: cartas/Bus Tickets/empréstimos não entram (não há campo). (SC-005)

## Arquivos tocados

- `src/game/economy/trade.ts` (novo) · `src/game/store.ts`
- `tests/game/economy/negociacao.test.ts`
