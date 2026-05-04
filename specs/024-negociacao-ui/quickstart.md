# Quickstart — Negociação na UI (024)

## O que entrega

Botão "Negociar" → compositor (destinatário + propriedades + dinheiro + imunidades nos dois sentidos) → "Propor" grava uma proposta pendente → o destinatário vê o modal recebido e **Aceita** (troca processa) ou **Recusa** (descarta). Motor de troca (013) reusado; só a camada de proposta é nova.

## Validação automatizada

```bash
bunx vitest run tests/game    # inclui negociacao-ui.test.ts + negociacao.test.ts (013, refactor não pode quebrar)
bun run build                 # type-check + build (exit 0)
```

- `validateTrade` + `proposeTrade`/`acceptTrade`/`rejectTrade` + `tradableProps` cobertos (SC-006).
- **Crucial:** a suíte de troca de 013 (`negociacao.test.ts`) deve seguir **verde** — prova de que extrair `validateTrade` não mudou o `executeTrade`.

## Validação visual (manual — sem RTL)

```bash
bun run dev
```

1. Dê propriedades a dois jogadores (compre algumas). Clique **Negociar**.
2. No compositor: escolha o destinatário; marque uma propriedade sua e/ou dinheiro a dar; marque uma propriedade dele e/ou dinheiro a pedir. "Propor" só habilita com proposta válida.
3. Envie → aparece o **modal recebido** com oferta/pedido.
4. **Aceitar** → donos e saldos mudam (confira nos painéis e no tabuleiro). **Recusar** → nada muda.
5. (US3) Adicione uma imunidade sobre uma propriedade sua **mantida** por N voltas; aceite; confira que o beneficiário fica imune.
6. Confirme que cartas/Bus Tickets **não** aparecem como itens negociáveis.

## Critério de pronto

- Testes verdes (incl. 013 intacto); build limpo.
- Propor/aceitar/recusar funcionam; aceitar = mesma transferência do motor.
- `pendingTrade` no estado (sobrevive a recarga).
- Acabamento dos modais aprovado no `bun run dev` (referência: fluxo Richup.io).
