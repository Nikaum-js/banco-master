# Quickstart: Simulação Automatizada de Partidas

## Rodar o lote padrão (parte da suíte normal — FR-011)

```
bun run test
```

Roda toda a suíte Vitest, incluindo `tests/sim/headless/{2p,3p,6p}.test.ts` (100 partidas por
contagem, seeds distintas, teto de 300 rodadas). Deve completar em menos de 2 minutos (SC-002).
Qualquer falha imprime seed + rodada + ação + violação (ver `contracts/relatorio-simulacao.md`).

## Reproduzir uma falha reportada

```
bun run sim:replay -- --seed=482913 --players=3
```

Reexecuta exatamente aquela partida (SC-003) com saída verbosa — usar para depurar passo a passo.

## Rodar um lote maior (ex.: antes de um release, execução noturna)

```
bun run sim:batch -- --games=1000 --counts=2,3,6
```

## Rodar o smoke E2E (US3)

```
bunx playwright test
```

Requer `bun run dev` rodando (ou o Playwright sobe o preview automaticamente — configurar
`webServer` em `playwright.config.ts`). Roda 3 partidas (2/3/6 jogadores) por 10 rodadas mínimas via
UI real, com o roteiro fixo determinístico (`e2e/script.ts` — mesma política por tipo de modal em
toda execução; ver `research.md` D10). Deve completar em menos de 5 minutos (SC-005).

## Injetar um bug para validar a detecção (uso pontual, não fica no repo)

Para validar SC-004 manualmente: comentar temporariamente uma guarda de invariante no motor (ex.:
permitir `houses` negativo em `construction.ts`) e rodar `bun run test` — o lote headless deve
falhar apontando o invariante `c` violado. Reverter a alteração depois.
