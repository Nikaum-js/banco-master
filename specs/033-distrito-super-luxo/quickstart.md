# Quickstart — Distrito Super-Luxo "Alta Roda" (033)

## Rodar / validar

```bash
bunx vitest run tests/game   # composição + economia do Alta Roda
bun run build                # tsc + vite (exit 0) — checa GroupKey/cor em todas as fontes
bun run dev                  # validar a cor nova + deeds de Mônaco/Dubai
```

## Checks (mapeiam os Success Criteria)

| Check | Como | SC |
|---|---|---|
| Mônaco/Dubai são as mais caras | preço > qualquer outra cidade | SC-001 |
| Dubai hotel ~$2.300, arranha ~$3.600 | `rentLadder('platinum', 72)` | SC-002 |
| Não é sweet spot | ROI(platinum) < ROI(orange) e ROI(red) | SC-003 |
| Composição | 10 grupos; 8×3 + navy 2 + platinum 2 = 28; 48 casas; Chicago/Lyon fora, Mônaco/Dubai dentro | SC-004 |
| Sem regressão | aeroportos/utilidades/impostos/caixa/GO iguais | SC-005 |
| Cor própria | `bg-group-platinum` existe (build não quebra); deed mostra a cor | SC-006 |

## Validação visual (`bun run dev`)

- Tabuleiro: faixa de Mônaco/Dubai no fim, cor ônix/dourado distinta.
- Deed/popover de Dubai: aluguel-topo ~$2.300, custo de casa $300, cor nova.
- Cair no hotel de Dubai com caixa baixo → aluguel alto mas pagável via hipoteca/venda (não morte automática).

## Definition of Done

- Grupo `platinum` nas 3 fontes de cor + tema (`HOUSE_COST`/`RENT_MULT`).
- Board rebalanceado (10 grupos, 28 cidades, 48 casas; Chicago/Lyon fora).
- Suíte `tests/game` verde (board + rebalance atualizados); `bun run build` exit 0.
- SRS §2.3/§5.1 + DECISIONS (D-017 + D-025) atualizados.
- Sem `bank`/`BankStock` (D-022); aeroportos/utilidades/caixa/GO intactos.
