# Quickstart — Leilão de escassez de terrenos (031)

## Rodar / validar

```bash
bunx vitest run tests/game        # reducers (motor) — incl. tests/game/economy/landAuction.test.ts
bun run build                     # tsc + vite (exit 0)
bun run dev                       # demo local — validar o modal do pregão
```

> Projeto usa **bun**, nunca npm/npx.

## Como provocar o pregão no `bun run dev`

1. Jogar até restarem ≤3 terrenos sem dono (ou, em dev, ajustar o estado via `DebugLogger`/console para deixar 3 livres) — com ≥2 jogadores vivos.
2. Fazer um evento que tire terreno de circulação (comprar/leiloar) → o **pregão abre sozinho** (modal `LandAuctionLayer`).
3. No modal: escolher "lance por: [jogador]", dar lances em lotes distintos, observar o cronômetro reiniciar a cada lance.
4. Parar de dar lances → ao expirar, cada lote com licitante muda de dono (paga ao banco); lotes sem lance ficam livres; o modal some.

## Cenários de teste (mapa para os reducers)

| Teste | Foco | SC |
|---|---|---|
| abre com ≤3 livres e ≥2 vivos | `maybeOpenLandAuction` | SC-001 |
| não abre com 1 vivo | gatilho | SC-001 (negativo) |
| lance válido atualiza lote + reinicia deadline | `placeLandBid` | SC-002 |
| lance ≤ atual / < mínimo → no-op | validação | SC-002 |
| solvência: lidera A, lance em B excede caixa → rejeitado; coberto em A libera | `committedCash` | SC-002/003 |
| fechar: cada líder paga e vira dono; soma ≤ caixa; sem lance fica livre | `closeLandAuction` | SC-003/004 |
| abrir/fechar não altera o turno | autonomia | SC-005 |
| trava de episódio: dispara 1×; re-arma só após freeLots subir | gatilho/episódio | SC-006 |
| round-trip JSON do estado com `landAuction` | serializável (VII) | — |

## Definition of Done

- Reducers puros + ≥ os cenários acima verdes; suíte `tests/game` toda verde; `bun run build` exit 0.
- `LandAuctionLayer` montado no `App`, validado no `bun run dev`.
- **SRS §7** atualizado (gatilho + subseção do pregão) e **ADR D-023** registrado em DECISIONS.
- Sem reintrodução de `bank`/`houseAuction` (D-022).
