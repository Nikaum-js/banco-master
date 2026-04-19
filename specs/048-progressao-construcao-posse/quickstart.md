# Quickstart: Progressão de construção por posse

## Cenário principal — China dividida

1. Crie uma partida com dois jogadores e caixa suficiente.
2. Dê Pequim ao Jogador 1 e Xangai ao Jogador 2.
3. Cada jogador constrói uma casa na própria cidade.
4. Verifique que ambos ficam bloqueados para a segunda casa e recebem a indicação de ampliar a posse do país.
5. Dê Hong Kong ao Jogador 1.
6. O Jogador 1 constrói uniformemente até duas casas em Pequim e Hong Kong.
7. Verifique que a terceira casa continua bloqueada enquanto Xangai pertence ao Jogador 2.

## País completo

1. Dê as três cidades chinesas ao mesmo jogador.
2. Construa uniformemente em todas.
3. Verifique a progressão até quatro casas, primeiro hotel, segundo hotel e Skyscraper.

## País de duas cidades

1. Dê Cannes a um jogador e mantenha Paris fora da posse.
2. Verifique que a primeira casa é aceita e a segunda é bloqueada.
3. Complete a França e verifique que a escada integral fica disponível, preservando uniformidade.

## Regressão e gates

```bash
bunx vitest run tests/game/economy/construction.test.ts tests/game/economy/construcao-avancada.test.ts tests/game/ui/deedView.test.ts --maxWorkers=1 --testTimeout=30000
bun run lint
bun run typecheck
bunx vitest run
bun run build
```
