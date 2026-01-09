# Quickstart: Prazo do crédito, contrapartida na troca e faixa de cobrança

## Testes focados

```bash
bunx vitest run tests/game/emprestimos          # prazo, vencimento, quitação
bunx vitest run tests/game/economy/negociacao.test.ts   # piso de contrapartida
bunx vitest run tests/ui/debtDock.test.tsx      # conteúdo e forma da faixa
```

## Gates completos

```bash
bun run typecheck
bun run lint
bunx vitest run tests/game
bunx vitest run --maxWorkers=1
bun run build
```

## Verificação manual

1. `bun run dev` e abrir a partida local.
2. Levar um jogador a uma dívida maior que o caixa — a **faixa** aparece na base e o tabuleiro encolhe. Conferir que a linha de baixo do tabuleiro continua inteira e clicável.
3. Ler os cinco números da faixa: credor, valor, caixa, falta e capacidade de levantar.
4. Pedir empréstimo pela faixa: a escolha de credor abre sem empilhar botões.
5. Com o empréstimo ativo, passar pelo GO três vezes e conferir no painel lateral o prazo caindo de 3 → 2 → 1 e a cobrança final.
6. No modal de negociação, montar uma proposta doando propriedades sem contrapartida: o envio é recusado com o valor que falta.
