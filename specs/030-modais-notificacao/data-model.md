# Data Model — Modais informativos (030)

Acrescenta **um** campo ao `GameState`. Sem entidade externa nova.

## `Notice` (novo, em `turn/types.ts`)

```ts
export type Notice =
  | { kind: 'free-parking'; playerId: string; amount: number }            // coletou o pote
  | { kind: 'hostile-takeover'; victimId: string; attackerId: string; pos: number } // perdeu propriedade

// em GameState:
notice: Notice | null  // evento informativo ativo; null = nenhum
```

- Serializável (princípio VII). Semeado `null` no `createSeedState`.
- **Não** participa de `resolution`/turno — não bloqueia finalizar.

## Registro (mínimo hook no motor)

- **`collectCenter(state, playerId)`** (balancing, 007): após coletar, `state.notice = { kind: 'free-parking', playerId, amount }` (amount = pote coletado). Coleta/reabastecimento inalterados.
- **`acquire(state, attackerId, pos)`** (ofensivas, 016): no sucesso, `state.notice = { kind: 'hostile-takeover', victimId: owner, attackerId, pos }`. Preço/transferência inalterados.

## Dispensa

- **`dismissNotice(state): GameState`** (turnMachine): clona e seta `notice = null`. Comando `dismissNotice` no store.

## Invariantes

- Registrar a notificação **não** muda caixa/títulos/pote além do que 007/016 já faziam → suíte 007/016 verde.
- `notice` ativo não impede `finalizeTurn` (informativo).
