# Data Model: Propostas de negociação simultâneas

## `TradeProposal`

```ts
interface TradeProposal {
  id: number
  trade: Trade
}
```

- `id`: inteiro positivo, único durante a partida e nunca reutilizado.
- `trade`: composição já existente, com `fromId` e `toId` como rota autoritativa.

## `GameState`

```ts
tradeProposals: TradeProposal[]
nextTradeProposalId: number
tradeHistory: Trade[]
```

### Invariantes

- ids ativos não se repetem;
- `nextTradeProposalId` é maior que todo id já emitido;
- aceitar ou recusar remove exatamente um id;
- a coleção não bloqueia turno, compositor ou outra proposta;
- itens continuam pertencendo aos jogadores até uma aceitação válida;
- o histórico recebe somente a `Trade` aceita.

## Transições

### `proposeTrade(state, trade)`

1. recusa em pausa ou quando `validateTrade` falha;
2. cria `{ id: nextTradeProposalId, trade }`;
3. acrescenta à coleção;
4. incrementa o contador.

### `acceptTrade(state, proposalId)`

1. encontra o envelope pelo id;
2. revalida a troca no estado atual;
3. executa atomicamente quando válida;
4. registra a troca no histórico e log;
5. remove somente o id aceito.

Se a proposta estiver obsoleta, retorna no-op e a mantém disponível para recusa.

### `rejectTrade(state, proposalId)`

Remove somente o envelope correspondente. Id desconhecido retorna no-op.

### Eliminação

Remove propostas cujo `fromId` ou `toId` seja o jogador eliminado.

## Migração de leitura

- snapshot com `tradeProposals`: preserva a coleção e normaliza o próximo id para ao menos `max(id) + 1`;
- snapshot com apenas `pendingTrade`: cria `[{ id: 1, trade: pendingTrade }]` e próximo id 2;
- snapshot sem os dois: cria `[]` e próximo id 1;
- `pendingTrade` não é reemitido no estado normalizado.
