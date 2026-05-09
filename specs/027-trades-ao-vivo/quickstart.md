# Quickstart — Painel Trades ao vivo (027)

## O que entrega

O painel "Trades" deixa de ser mock: mostra a proposta pendente (ativo) + o histórico das trocas aceitas; aceitar registra no histórico e no log de eventos.

## Validação automatizada

```bash
bunx vitest run tests/game    # tradesView.test.ts + negociacao-ui.test.ts (registro no acceptTrade)
bun run build                 # type-check + build (exit 0)
```

- `tradesView` + registro no `acceptTrade` cobertos (SC-005). `executeTrade` intacto (013/024 verdes).

## Validação visual (manual — sem RTL)

```bash
bun run dev
```

1. Abra o painel: sem trocas → "Nenhuma proposta no momento", 0 ativos.
2. **Negociar** → monte e proponha: o painel mostra 1 ativo (de→para + resumo).
3. **Aceitar** no modal recebido: a linha sai dos ativos, entra no histórico (concluída), e aparece no Histórico de eventos.
4. **Recusar**: some dos ativos, **não** entra no histórico.
5. "+ Nova proposta" abre o compositor.

## Critério de pronto

- Testes verdes; build limpo.
- Painel reflete o estado real (0 mock); aceitar registra+loga; recusar não.
- Acabamento aprovado no `bun run dev`.
