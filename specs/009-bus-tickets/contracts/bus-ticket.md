# Contract: Uso de Bus Ticket & espaço Bus Ticket

Funções puras e comando de store introduzidos/alterados. Assinaturas e comportamento observável.

## `turn/turnMachine.ts`

### `sideOf(pos: number): 0 | 1 | 2 | 3 | null`

Índice do lado do tabuleiro de `pos`, ou `null` se `pos` é um canto (0/12/24/36).

| Entrada | Saída |
|---|---|
| 1–11 | `0` |
| 13–23 | `1` |
| 25–35 | `2` |
| 37–47 | `3` |
| 0 / 12 / 24 / 36 | `null` |

### `useBusTicket(state: GameState, dest: number, ctx: TurnCtx): GameState`

Move o jogador da vez para `dest` gastando 1 Bus Ticket, em vez de rolar.

**Pré-condições (todas verdadeiras, senão retorna `state` inalterado):**

- `state.paused === false`
- `state.turn.state === 'aguardando-rolagem'`
- `activePlayer(state).busTickets >= 1`
- `sideOf(activePlayer(state).pos) !== null` (não está sobre canto)
- `dest` válido: `sideOf(dest) === sideOf(activePlayer(state).pos)` e `dest !== activePlayer(state).pos`

**Efeitos (clone; nunca muta o argumento):**

1. `player.busTickets -= 1`
2. `advance(s, player, (dest - pos + 48) % 48, ctx.ports)` — move horário; credita `onPassGo` se cruzar o GO; marca `completouPrimeiraVolta` ao cruzar.
3. `land(turn, player, null)` — `state='casa-a-resolver'`, `pendingResolve=true`, `mayRollAgain=false`.
4. `finishIfEnded(s, ctx)` — (destino nunca é `corner-gotojail`, então segue para resolução).

**Pós-condição:** `player.pos === dest`; turno em `casa-a-resolver` pronto para `resolvePending`; sem direito a re-rolagem.

## `turn/resolution.ts`

### `resolutionRegistry['bus-ticket']`

De `stub` (`() => ({ done: true })`) para:

```ts
'bus-ticket': ({ state, playerId }) => {
  const p = state.players.find((x) => x.id === playerId)
  if (p) p.busTickets += 1
  return { done: true }
}
```

**Comportamento:** parar no espaço → +1 ticket, casa resolvida (não bloqueia finalizar). Passar (sem parar) não dispara a resolução, logo não credita.

## `store.ts`

### `useBusTicket(dest: number): void`

Adicionado à interface `GameStore` e à implementação:

```ts
useBusTicket: (dest) => set((st) => ({ game: useBusTicket(st.game, dest, st.ctx) })),
```

Sem timer, sem efeito além do `set` (segue o padrão de `chooseTripleDest`).

## `ui/GameHUD.tsx`

Controle "Usar Bus Ticket (N)" — habilitado ⇔ jogador da vez em `aguardando-rolagem`, `sideOf(pos) !== null` e `busTickets ≥ 1`. Ao ativar, lista as casas válidas do lado (pos + nome) como botões; clique → `useBusTicket(dest)`. Sem novo estado global (estado local do componente para "armar" o seletor).
