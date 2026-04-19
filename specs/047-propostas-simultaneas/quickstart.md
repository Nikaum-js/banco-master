# Quickstart: Propostas de negociação simultâneas

## Cenário funcional

1. Inicie uma sala com pelo menos três jogadores.
2. Jogador 1 envia uma proposta ao Jogador 2.
3. Sem responder, abra “Nova negociação” e envie outra proposta ao Jogador 2.
4. Jogador 3 envia uma proposta ao Jogador 1.
5. Confirme três rotas independentes no painel, sem preview de itens.
6. Abra a segunda linha e confira sua composição no modal.
7. Aceite ou recuse e confirme que somente aquela linha desaparece.

## Cenário de concorrência

1. Envie duas propostas que oferecem a mesma propriedade.
2. Aceite a primeira.
3. Tente aceitar a segunda.
4. Confirme que a segunda não transfere novamente o ativo e continua recusável.

## Cenário visual

- Com uma proposta, o painel deve usar o espaço com uma linha de rota legível e CTA claro.
- Com oito propostas, somente a lista deve rolar; “Nova negociação” permanece visível.
- Nomes não devem truncar no layout normal da lateral.
- O modal deve abrir a linha exata e esconder aceitar/recusar para observadores.

## Gates

```bash
bun run lint
bun run typecheck
bunx vitest run
bun run build
```
