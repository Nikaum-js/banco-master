# Contract: Propostas identificadas

## Comandos

```ts
{ kind: 'propose-trade'; trade: Trade }
{ kind: 'accept-trade'; proposalId: number }
{ kind: 'reject-trade'; proposalId: number }
```

| Comando | Ator | Resultado válido |
|---|---|---|
| `propose-trade` | `trade.fromId` | acrescenta proposta com novo id |
| `accept-trade` | `proposal.trade.toId` | executa e remove a proposta alvo |
| `reject-trade` | `proposal.trade.toId` | remove a proposta alvo |

Id inexistente ou remetente diferente do ator produz no-op/descarta comando conforme a fronteira que o recebe.

## Projeção do painel

Para cada proposta:

```ts
{
  id: number
  fromId: string
  toId: string
}
```

O painel não projeta `fromCash`, `toCash`, propriedades, Bus Tickets, imunidades ou contagens.

## Seleção de detalhe

`selectedProposalId: number | null` é estado local de UI. Abrir uma linha seta o id; fechar limpa. Se o id deixar de existir no estado recebido, o modal fecha sem resposta automática.

## Compatibilidade

A normalização de snapshot aceita o campo legado:

```ts
pendingTrade: Trade | null
```

Ele é consumido uma vez na leitura e convertido para a coleção atual.
