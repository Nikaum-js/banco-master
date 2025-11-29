# Quickstart — Rebalanceamento de economia (032)

## Rodar / validar

```bash
bunx vitest run tests/game   # motor — asserts de valor atualizados
bun run build                # tsc + vite (exit 0)
bun run dev                  # conferir deeds/popovers/pregão com os novos números
```

> Projeto usa **bun**, nunca npm/npx.

## Checks principais (mapeiam os Success Criteria)

| Check | Como | SC |
|---|---|---|
| Hotel mais caro ≤ ~$1.800 | `rentLadder('navy', 50).hotel ≈ 1800` | SC-001 |
| Spread ~5–8× | hotel navy ÷ hotel brown (1800/360 = 5×) | SC-002 |
| Custo de casa fixo por grupo | `buildCost` de 2 cidades do mesmo grupo = igual; ≠ proporcional ao preço | SC-003 |
| Sweet spot | ROI(orange/red) > ROI(green) | SC-004 |
| Composição | 8 grupos com 3 + verde com 4; laranja=3; 28 cidades / 48 casas | SC-005 |
| Sem regressão | aeroportos/utilidades/impostos/caixa/GO iguais | SC-006 |
| Fonte única | engine `rentCity` e UI mostram o **mesmo** aluguel (sem divergência) | FR-002 |

## Validação visual (`bun run dev`)

- Abrir o deed/popover de uma cidade → tabela de aluguel reflete os novos valores (e bate com o que o motor cobra).
- Leilão comum (recusar compra) e pregão de escassez (031) → cards mostram o ladder novo (mesma fonte).
- Construir até hotel numa cidade cara (Paris) → aluguel ~$1.800 (não $5.000); custo de casa = tier do grupo.

## Definition of Done

- `rentLadder` é a única fonte; `computeRents` removido; engine e UIs batem.
- Suíte `tests/game` verde (asserts de valor atualizados); `bun run build` exit 0.
- Board rebalanceado (8×3 + verde×4; laranja=3; Hamburgo entra, Salvador sai).
- SRS §2.3/§5.1 + DECISIONS (D-017 + ADR novo) atualizados.
- Sem `bank`/`BankStock` reintroduzido (D-022).
