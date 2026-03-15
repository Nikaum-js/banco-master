# Quickstart — Validar revanche na mesma sala

## Automatizado

```bash
bunx vitest run tests/net/rematch.test.ts tests/net/boot.test.ts tests/net/conformance.test.ts tests/ui/endGame/endGameScreen.test.tsx --maxWorkers=1
bun run typecheck
bun run lint
bun run build
bunx vitest run --maxWorkers=1
```

O hook de encerramento também exige:

```bash
bunx vitest run tests/game
```

## Roteiro manual

1. Abrir host e convidado em dois contextos de navegador.
2. Iniciar uma partida e levá-la ao estado `ended`.
3. Confirmar que ambos veem a mesma classificação.
4. No convidado, clicar “Voltar à sala”; confirmar espera sem controles de host.
5. Confirmar que a classificação do host continua aberta.
6. No host, clicar “Voltar à sala”; confirmar lobby com mesmos assentos e identidades.
7. Recarregar o convidado; confirmar que continua no lobby e não volta ao resumo.
8. Escolher o Ritual de Largada e iniciar.
9. Confirmar caixa inicial, propriedades livres, Loteria inicial, mãos vazias, empréstimos/efeitos/negociações ausentes e log novo.
10. Recarregar os dois clientes; confirmar que recebem apenas a revanche.

## Verificação visual

- Desktop: vencedor e classificação cabem sem disputar hierarquia.
- 768 px em paisagem: nenhuma rolagem horizontal; linhas viram cartões legíveis.
- CTA online: “Voltar à sala”.
- CTA local: “Novo jogo”.
- Foco visível no CTA e ordem de leitura coerente.
