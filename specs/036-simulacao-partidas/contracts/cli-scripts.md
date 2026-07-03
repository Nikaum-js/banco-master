# Contract: Scripts de CLI (dev-only)

Dois scripts bun, sem servidor/rede — rodam localmente contra o motor puro. Nenhum é importado por
`src/` (FR-012). Reexportam as mesmas funções de `tests/sim/engine/*` usadas pelos testes.

## `bun run sim:replay -- --seed=<n> --players=<2|3|6>`

- **Entrada**: `seed` (obrigatório), `players` (obrigatório, um de `2|3|6`; harness não impede
  outros valores — Assumption "o harness não as impede" — mas o script valida o enum por
  simplicidade de uso).
- **Saída**: `SimResult` completo (ver `relatorio-simulacao.md`) impresso no stdout; em caso de
  falha, o `SimFailure` detalhado.
- **Exit code**: `0` se `outcome === 'ok'`; `1` se `'fail'`.
- **Uso**: depurar uma seed reportada por uma falha do lote padrão ou de `sim:batch`.

## `bun run sim:batch -- --games=<n> [--counts=2,3,6]`

- **Entrada**: `games` (partidas por contagem; default do lote padrão é 100 mas este script existe
  justamente para lotes MAIORES — Assumption "execuções noturnas"), `counts` (default `2,3,6`).
- **Saída**: `SimReport` (ver `relatorio-simulacao.md`) impresso no stdout ao final.
- **Exit code**: `0` se `report.failed === 0`; `1` caso contrário.
- **Seeds**: geradas deterministicamente a partir de um seed-base (`--base-seed`, default fixo) +
  índice sequencial — permite repetir o MESMO lote inteiro se preciso, sem depender de
  `Date.now()`/`Math.random()` em nenhum ponto do script.

## Fora de escopo destes scripts

- Não substituem o lote padrão da suíte (FR-011) — esse roda sempre via `bun run test`/Vitest,
  independentemente destes scripts existirem.
- Não tocam no smoke E2E (US3) — esse é `bunx playwright test`, contrato separado (ver
  `quickstart.md`).
