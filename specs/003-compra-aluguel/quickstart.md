# Quickstart — Verificar Compra & Aluguel

Verificação primária por testes unitários (Vitest), RNG/timers controlados.

## Rodar

```bash
npx vitest run tests/game
```

## Mapa Success Criteria → teste

| SC | Verifica | Arquivo / caso |
|---|---|---|
| **SC-001** | compra transfere título e debita o preço; recusa não cobra; sem caixa → não compra | `purchase.test.ts` |
| **SC-002** | recusa abre leilão; lances; fecho por tempo paga o lance; sem lance → banco | `auction.test.ts` (fake timers) |
| **SC-003** | aluguel cidade base / 150% (maioria 2-de-3, 3-de-4) / 200% (completo) | `rent.test.ts › cidade` |
| **SC-004** | aeroporto $25/$50/$100/$200 por 1/2/3/4 | `rent.test.ts › aeroporto` |
| **SC-005** | utilidade 4×/10×/20× o valor dos dados por 1/2/3 | `rent.test.ts › utilidade` |
| **SC-006** | hipotecada ou própria → aluguel 0 | `rent.test.ts › isenções` |
| **SC-007** | turno não finaliza enquanto `resolution !== null` | `purchase.test.ts › bloqueia finalizar` |

## Roteiro manual (smoke, via store)

1. Parar token numa cidade livre → `resolution.kind === 'purchase'`. `finalizeTurn` é no-op (bloqueado).
2. `buyProperty()` com caixa suficiente → título do jogador, caixa −preço, `resolution = null`, turno libera finalizar.
3. Repetir e `declineProperty()` → `resolution.kind === 'auction'`. `placeBid('p2', 50)`; deixar o cronômetro estourar (`vi.advanceTimersByTime`) → `closeAuction` paga 50 e dá o título a p2.
4. Atribuir um grupo a um dono e parar outro jogador → conferir aluguel (base / 150% / 200%).
5. Hipotecar (flag) uma propriedade e parar nela → aluguel 0.

## Definition of Done (esta feature)

- `plan/research/data-model/contracts` coerentes com a spec e entre si.
- Toda invariante do `data-model.md` tem teste.
- Stubs de `property`/`airport`/`utility` do 002 substituídos; os testes do 002 continuam verdes.
- Nada de construção/hipoteca-mutação/negociação/falência implementado (só sinalização de insolvência por porta).
