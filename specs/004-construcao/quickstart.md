# Quickstart — Verificar Construção

Verificação por testes unitários (Vitest); leilão de casas com fake timers.

## Rodar

```bash
npx vitest run tests/game
```

## Mapa Success Criteria → teste

| SC | Verifica | Arquivo / caso |
|---|---|---|
| **SC-001** | sequência 0→4→hotel + uniformidade (não quebra) | `construction.test.ts › build/uniformidade` |
| **SC-002** | exige maioria, sem hipoteca, caixa e estoque; debita e consome | `construction.test.ts › pré-requisitos` |
| **SC-003** | aluguel com construção = tabela × 70%/100%, substitui posse | `rent.test.ts › aluguel com construção` |
| **SC-004** | vender = metade; volta ao estoque; desmonte forçado | `construction.test.ts › venda` |
| **SC-005** | hotel substitui 4 casas (↔ estoque) e consome 1 hotel | `construction.test.ts › hotel` |
| **SC-006** | escassez → leilão de casas; vencedor paga | `houseAuction.test.ts` (fake timers) |

## Roteiro manual (via store)

1. Dar a maioria de um grupo a um jogador; `buildHouse(pos)` na de menor contagem → casa +1, caixa −custo, `bank.houses` −1.
2. Tentar `buildHouse` na cidade com mais casas → no-op (uniformidade).
3. Levar uma cidade a 4 casas e `buildHouse` de novo → vira hotel; `bank.houses` +4, `bank.hotels` −1.
4. Parar outro jogador na cidade construída → aluguel pela tabela (×0.7 parcial, ×1.0 completo), não pelo escalonamento de posse.
5. `sellBuilding` no hotel com `bank.houses < 4` → desmonte forçado do grupo (§5.5).
6. Zerar `bank.houses`, pedir build com 2+ interessados → `house-auction`; avançar o cronômetro → `closeHouseAuction` paga o lance.

## Definition of Done

- `plan/research/data-model/contracts` coerentes com a spec.
- Toda invariante do `data-model.md` tem teste.
- Suítes do 002 e 003 continuam verdes (sem regressão; `rent.ts` estendido sem quebrar o aluguel sem-construção).
- Fora de escopo (2º hotel/Skyscraper/Hangar/hipoteca/negociação) não implementado.
