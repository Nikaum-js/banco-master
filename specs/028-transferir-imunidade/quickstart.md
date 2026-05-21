# Quickstart — Transferência de imunidade (028)

## O que entrega

Numa negociação, além de conceder imunidades novas, um jogador pode **transferir** uma imunidade que já possui ao outro (re-atribui o beneficiário, mantém as voltas). Fecha o §8.4 — último gap de regra.

## Validação automatizada

```bash
bunx vitest run tests/game    # negociacao-ui.test.ts (+casos de transferência) + imunidade/troca existentes
bun run build                 # type-check + build (exit 0)
```

- `validateTrade`/`executeTrade` com transferência cobertos (SC-005); concessão de novas e o resto da troca seguem verdes (013/014/024).

## Validação visual (manual — sem RTL)

```bash
bun run dev
```

1. Dê a um jogador uma imunidade ativa (ex.: via troca anterior concedendo, ou estado).
2. **Negociar** → no compositor, na seção "Transferir imunidade", marque a imunidade que você possui para passar ao outro.
3. Proponha e **aceite**: confira que o outro jogador passa a não pagar aluguel naquela propriedade e você volta a pagar (as voltas continuam).
4. Confira que conceder imunidades novas continua funcionando junto.

## Critério de pronto

- Testes verdes (incl. troca/imunidade existentes); build limpo.
- Transferência válida re-atribui o beneficiário (voltas preservadas); inválida é rejeitada.
- Compositor permite marcar imunidades possuídas; recebido as lista.
- Acabamento aprovado no `bun run dev`.
