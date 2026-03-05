# Data Model — Modais centrais (022)

Nenhuma entidade do **motor** muda. Esta fatia introduz **um tipo de apresentação** (somente-leitura, derivado do estado).

## `ModalView` (novo — camada de UI)

Descritor do modal central ativo. Discriminado por `kind`. `activeModal(game)` retorna `ModalView | null` (`null` = nenhum modal central).

```ts
// src/game/ui/modals/activeModal.ts
import type { Square } from '@/lib/boardData'
import type { Rarity } from '@/game/cards/types'

export interface HandCardView {
  id: string        // id da carta na mão (para o comando discardCard)
  rarity: Rarity    // laranja/azul/verde — cor no descarte (SRS §10.2)
  effect: string    // EffectId — base para o rótulo legível (mapa de apresentação no ModalLayer)
}

export type ModalView =
  | { kind: 'purchase'; pos: number; square: Square; price: number; playerId: string }
  | { kind: 'auction'; pos: number; square: Square; currentBid: number; highBidder: string | null; deadline: number }
  | { kind: 'house-auction'; housesAvailable: number; currentBid: number; highBidder: string | null; deadline: number }
  | { kind: 'card-discard'; playerId: string; cards: HandCardView[] }
  | { kind: 'card-shortcut' }
```

### Campos por variante

| `kind` | Campos | Origem |
|---|---|---|
| `purchase` | `pos`, `square`, `price`, `playerId` | `resolution.pos` → `BOARD[pos]`, `'price' in square`, jogador da vez |
| `auction` | `pos`, `square`, `currentBid`, `highBidder`, `deadline` | `resolution.auction` (003) |
| `house-auction` | `housesAvailable`, `currentBid`, `highBidder`, `deadline` | `resolution.auction` (HouseAuction, 004) |
| `card-discard` | `playerId`, `cards[]` | jogador da vez + `player.hand.map(cardById)` |
| `card-shortcut` | — | `resolution.kind === 'card-shortcut'` (sem dados extras: só Frente/Trás) |

### Regras de derivação (validação)

- `activeModal(game)` consulta `game.resolution`:
  - `kind === 'purchase'` → `purchase` (jogador da vez = `players[turnOrder[activeSeat]]`).
  - `kind === 'auction'` → `auction`.
  - `kind === 'house-auction'` → `house-auction`.
  - `kind === 'card-discard'` → `card-discard` com a mão do **jogador da vez** (princípio VI — nunca a mão de outro).
  - `kind === 'card-shortcut'` → `card-shortcut`.
  - qualquer outro `kind` (`debt`, `reaction-*`) **ou** `resolution === null` → `null`.
- O descritor é **puro e somente-leitura**: não muta `game`, não guarda estado próprio. Reconstruível do estado serializável (princípio VII).
- O valor de lance digitado e o foco do input são **estado local** do `ModalLayer`, fora do `ModalView` e do `GameState`.

## Entidades existentes (apenas consumidas)

- **`GameState.resolution`** (`ResolutionSlice`, 002/003/006) — origem do modal; não modificada.
- **`Player.hand`** (006) — ids das cartas; lidos via `cardById` para `HandCardView`.
- **`Square` / `BOARD`** (`@/lib/boardData`) — nome, grupo, preço, aluguéis da propriedade.
