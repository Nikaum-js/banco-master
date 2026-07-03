# Contract: Relatório de Simulação

Formato de saída consumido por humanos (falha de teste/CI) e por `scripts/sim-*.ts` (texto). O
shape TypeScript vive em `tests/sim/engine/types.ts` (`SimResult`/`SimFailure`/`SimReport`, ver
`data-model.md`) — este documento fixa o **contrato de conteúdo mínimo**, não a serialização.

## Falha de uma partida (FR-007)

Toda falha — exceção, invariante violado, ação inválida aceita, teto de rodadas estourado — MUST
imprimir, no mínimo:

```
seed: <number>
playerCount: <2|3|6>
round: <number>
reason: exception | invariant | invalid-action-accepted | round-cap-exceeded
action: <última ação em execução, se aplicável>
detail: <descrição da violação / mensagem de exceção>
```

O texto de `detail` MUST ser suficiente para localizar a regra violada sem reabrir o harness (ex.:
para `reason: invariant`, incluir o código FR-004a–g e o valor observado).

## Resumo do lote (FR-008)

Toda execução do lote padrão (headless, parte da suíte — FR-011) ou de `sim:batch` MUST reportar:

```
total: <number>           # partidas executadas
ok: <number>
failed: <number>
durationMs: <number>
roundsHistogram: { [rounds: number]: count }   # distribuição de rodadas-até-o-fim, só partidas ok
failures: [ ...falhas no formato acima ]
```

- `failed > 0` MUST fazer o `test()` correspondente falhar (assert `report.failed === 0`), incluindo
  ao menos a primeira `SimFailure` na mensagem de falha do Vitest (não só o número).
- `bun run sim:batch` (execução manual/nightly) MUST imprimir o resumo e terminar com exit code
  `1` se `failed > 0`, `0` caso contrário.

## Reexecução por seed (FR-009)

`bun run sim:replay -- --seed=<n> --players=<2|3|6>` MUST:

- Rodar exatamente 1 partida com aquela seed/contagem.
- Reproduzir bit-a-bit o mesmo resultado (`SimResult`) de quando a seed apareceu num `SimFailure`
  do lote (SC-003) — mesma sequência de estados, mesma falha (se houver) no mesmo `round`/`action`.
- Ao final, imprimir o `SimResult` completo; se `outcome === 'fail'`, exit code `1`.
