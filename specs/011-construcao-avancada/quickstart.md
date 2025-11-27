# Quickstart: Construção avançada (2º hotel, Hangar, Skyscraper)

## Verificar

```bash
bunx vitest run tests/game/economy   # testes de economia (inclui o novo arquivo)
bunx vitest run tests/game           # suíte completa do motor (não pode regredir)
bun run build                        # tsc -b + vite, exit 0
```

## Fluxo (motor)

```ts
// 2º hotel: grupo com hotéis → buildHouse sobe ao nível 6
g = buildHouse(g, pos)        // 5→6 (hotel2), consome 1 hotel do banco; aluguel não muda

// Skyscraper: grupo COMPLETO todo no 2º hotel → buildHouse sobe ao 7
g = buildHouse(g, pos)        // 6→7 (skyscraper), consome 1 do bank.skyscrapers

// Hangar (aeroporto):
g = buildHangar(g, aeroportoPos)  // cash -100; dobra o aluguel daquele aeroporto
g = sellHangar(g, aeroportoPos)   // cash +50
```

## Cenários-chave (SC-001..005)

- **2º hotel**: nível 5→6, debita custo do hotel, `bank.hotels-1`, aluguel **igual** ao hotel; sem estoque → rejeitado; venda devolve metade + 1 hotel. (SC-001/SC-004)
- **Hangar**: build $100 → aeroporto cobra **2×** a base; venda $50 → base; máx. 1; hipotecado não cobra. (SC-002/SC-004)
- **Skyscraper**: exige grupo completo + todas no 6 + estoque; cidade com Skyscraper cobra o **fixo**; demais do grupo **×3**; só maioria → rejeitado; venda reverte ao 6 e devolve 1 Skyscraper (não mexe em hotels). (SC-003/SC-004)
- **Estoques** nunca negativos; uniformidade respeitada. (SC-005)
- **Falência/netWorth** contam 2º hotel/Skyscraper/Hangar (sem regressão em 006/008).

## Arquivos tocados

- `src/game/economy/types.ts` · `construction.ts` · `rent.ts` · `resolveRentable.ts` · `titles.ts`
- `src/game/falencia/falencia.ts` · `src/game/cards/effects.ts` · `src/game/store.ts`
- `tests/game/economy/construcao-avancada.test.ts`
