# Quickstart — Verificar Hipoteca

Verificação por testes unitários (Vitest), funções puras.

## Rodar

```bash
npx vitest run tests/game
```

## Mapa Success Criteria → teste

| SC | Verifica | Arquivo / caso |
|---|---|---|
| **SC-001** | hipotecar credita metade e marca; bloqueia com construção no grupo | `mortgage.test.ts › hipotecar` |
| **SC-002** | deshipotecar debita metade × 1,10 e desmarca; sem caixa → no-op | `mortgage.test.ts › deshipotecar` |
| **SC-003** | hipotecada não cobra aluguel (003) e bloqueia construir (004) — sem regressão | suítes 003/004 verdes |
| **SC-004** | transferência: manter = metade × 0,10; deshipotecar = metade × 1,10 | `mortgage.test.ts › transferência` |

## Roteiro manual (via store)

1. Dar uma propriedade a um jogador; `mortgageProperty(pos)` → `cash += price/2`, `mortgaged = true`.
2. Outro jogador para nela → aluguel 0 (003).
3. Construir no grupo → bloqueado (004).
4. `unmortgageProperty(pos)` com caixa → `cash -= round(price/2 × 1,10)`, `mortgaged = false`.
5. Construir uma casa no grupo e tentar `mortgageProperty` → no-op (§6.1).
6. Conferir `transferKeepFee`/`unmortgageCost` para a regra de transferência.

## Definition of Done

- `plan/research/data-model/contracts` coerentes com a spec.
- Toda invariante do `data-model.md` tem teste.
- Suítes 002/003/004 continuam verdes (a flag passa a ser **escrita**, sem mudar os efeitos).
- Trade/falência (gatilho da transferência) não implementados — só os helpers de regra.
