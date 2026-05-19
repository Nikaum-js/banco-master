# Data Model — Revelação de carta sacada (025)

Acrescenta **um `ResolutionSlice`**. Nenhuma entidade de carta muda.

## `ResolutionSlice += card-reveal`

```ts
// economy/types.ts
| { kind: 'card-reveal'; deckId: DeckId; cardId: string } // carta sacada aguardando confirmação (025)
```

- Bloqueia a finalização do turno (como `card-discard`/`card-shortcut`).
- `cardId` = topo do deck no momento do peek; **não** remove a carta do deck (só leitura).
- Uma por vez (é a `resolution` do turno).

## Funções (motor / cards)

```ts
// cards/draw.ts
export function cardRevealResolve(rctx: ResolveCtx): ResolutionOutcome | null
export function confirmCardReveal(state: GameState, ports: TurnPorts): GameState
// cardResolve(rctx) — INALTERADO (saca + processa); chamado por confirmCardReveal
```

### Regras

- **cardRevealResolve(rctx)**: se `square.kind` ∈ {acaso, tesouro} → `cardId = state.decks[deckId][0]`; se não houver topo → `{ done: true }` (sem revelação); senão seta `state.resolution = { kind:'card-reveal', deckId, cardId }` e retorna `{ done:false, blocksFinalize:true }`. Retorna `null` para outros kinds (cai no resolver default). **Não** muta deck/mão/caixa.
- **confirmCardReveal(state, ports)**: se `resolution.kind !== 'card-reveal'` → no-op. Senão clona, limpa a `resolution`, monta `rctx = { playerId: <vez>, square: BOARD[<pos da vez>], roll: turn.lastRoll, ports, state }`, chama `cardResolve(rctx)`:
  - se retornar `{ done:true }` → `turn.pendingResolve=false`, `turn.state='aguardando-finalizacao'`.
  - se `{ done:false }` (cardResolve abriu `card-discard`/`card-shortcut`) → mantém `casa-a-resolver` com a nova `resolution`.
- **Invariante**: o estado entre o peek (reveal) e o confirm permanece inalterado (deck/mão/caixa); só o confirm aciona `cardResolve` (que então saca e aplica). `cardResolve` continua idêntico → suíte 006 verde.

## `ModalView += card-reveal` (UI, 022)

```ts
// ui/modals/activeModal.ts
| { kind: 'card-reveal'; deckId: DeckId; cardId: string; rarity: Rarity; effect: string; mode: 'imediato' | 'mao' }
```

- Derivado de `resolution` quando `kind === 'card-reveal'`: lê `cardById(cardId)` para `rarity`/`effect`/`mode`.
- O `ModalLayer` mostra: nome (de `cardId`), deck, cor de raridade, descrição curta do efeito (mapa de apresentação), e se vai p/ mão ou aplica já; botão "Continuar" → `confirmCardReveal`.

## Entidades existentes (consumidas)

- **`Card`** (006): `id`, `deck`, `rarity`, `mode`, `effect` — lidos para exibir. Inalterado.
- **`cardResolve`** (006): saca + processa — inalterado; chamado no confirm.
