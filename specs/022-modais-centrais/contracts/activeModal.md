# Contrato — `activeModal(game)` e os comandos dos modais

## `activeModal(game: GameState): ModalView | null`

Função **pura** (sem efeito, sem mutação). Único contrato testável da feature.

### Mapeamento `resolution.kind` → `ModalView`

| `game.resolution` | retorno |
|---|---|
| `{ kind: 'purchase', pos }` | `{ kind: 'purchase', pos, square: BOARD[pos], price, playerId: <vez> }` |
| `{ kind: 'auction', auction }` | `{ kind: 'auction', pos: auction.pos, square: BOARD[auction.pos], currentBid, highBidder, deadline }` |
| `{ kind: 'house-auction', auction }` | `{ kind: 'house-auction', housesAvailable, currentBid, highBidder, deadline }` |
| `{ kind: 'card-discard' }` | `{ kind: 'card-discard', playerId: <vez>, cards: hand.map(cardById→{id,rarity,effect}) }` |
| `{ kind: 'card-shortcut' }` | `{ kind: 'card-shortcut' }` |
| `{ kind: 'debt' \| 'reaction-diplomacia' \| 'reaction-bunker' }` | `null` |
| `null` | ver `turn.awaitingChoice` abaixo |

### Sem resolução: escolhas do Speed Die (`turn.awaitingChoice`, 022.1)

Quando `resolution === null`, o seletor ainda checa a escolha pendente do Speed Die:

| `turn.awaitingChoice` | retorno |
|---|---|
| `'onibus'` (com `lastRoll`) | `{ kind: 'bus-move', pos: <vez>, white: lastRoll.white, playerId: <vez> }` |
| `'triple'` | `{ kind: 'triple-dest', pos: <vez>, playerId: <vez> }` |
| `null` | `null` |

### Invariantes

- **Determinística**: mesmo `game` ⇒ mesmo `ModalView`. Não lê relógio nem aleatório.
- **Não-mutante**: `activeModal` não altera `game` (sem `structuredClone` necessário; só lê).
- **Privacidade (VI)**: em `card-discard`, `cards` é **exclusivamente** a mão de `playerId` (jogador da vez). Nunca expõe mão de adversário.
- **Jogador da vez**: `playerId = game.players[game.turnOrder[game.activeSeat]].id`.
- **Total**: cobre todos os `kind` de `ResolutionSlice`; o `default` retorna `null` (à prova de novos kinds futuros).

## Comandos disparados pelo `ModalLayer` (já existentes no store)

O `ModalLayer` **não** implementa regra; cada ação chama um comando do store:

| Modal | Ação | Comando |
|---|---|---|
| `purchase` | Comprar | `buyProperty()` |
| `purchase` | Recusar → leilão | `declineProperty()` |
| `auction` | Lance | `placeBid(activeId, valor)` (default `currentBid + 50`) |
| `auction` | Passar | `passBid(activeId)` |
| `house-auction` | Lance | `placeBid(activeId, valor)` (sem "Passar") |
| `card-discard` | Descartar carta X | `discardCard(id)` |
| `card-shortcut` | Frente / Trás | `chooseCardShortcut('frente' \| 'tras')` |

> O fechamento automático do leilão pelo prazo continua a cargo do store (timer). O `ModalLayer` apenas exibe `deadline`.

## Contrato com o `GameHUD`

- O `GameHUD` **não** renderiza os ramos cujos `kind` são cobertos por `activeModal` (`purchase`, `auction`, `house-auction`, `card-discard`, `card-shortcut`) — delega ao `ModalLayer` (FR-009).
- Ramos **mantidos** no HUD: `debt`, `reaction-diplomacia`, `reaction-bunker`, e os estados de turno (`prisao-decisao`, `aguardando-rolagem`/Bus Ticket/empréstimo, `casa-a-resolver`, `aguardando-finalizacao`, fim de jogo).

## Cobertura de teste (Vitest, `tests/game/ui/activeModal.test.ts`)

1. `purchase` → descritor com `pos`/`square`/`price`/`playerId` corretos.
2. `auction` → `currentBid`/`highBidder`/`deadline`/`square` da propriedade.
3. `house-auction` → `housesAvailable` e sem campo de propriedade.
4. `card-discard` → `cards` = mão do jogador da vez (ids/rarity/effect), e **não** a de outro jogador.
5. `card-shortcut` → `{ kind: 'card-shortcut' }`.
6. `debt`, `reaction-*` e `resolution === null` → `null` (caso "nenhum modal").
