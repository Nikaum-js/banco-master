# Data model — Revanche na mesma sala

## Room

```ts
interface Room {
  id: string
  status: RoomStatus
  seats: Seat[]
  openingMode?: OpeningMode
  openingAuction?: OpeningAuction | null
  matchGeneration?: number
  revision?: number
}
```

- `matchGeneration`: começa em `0` e aumenta uma vez quando o host reabre a sala depois de uma partida encerrada.
- `revision`: espelho de `public.rooms.seq`; começa em `-1` e aumenta a cada snapshot. Não reinicia entre partidas.
- Ambos são normalizados para defaults seguros em salas legadas.
- `revision` é metadado de ordenação; o `GameState` continua sem conhecer sala ou revanche.

## PersistedSnapshot

Continua com o shape atual:

```ts
interface PersistedSnapshot {
  seq: number
  game: GameState
  secrets: Secrets
  room: Room
}
```

Invariantes:

1. `snapshot.seq === snapshot.room.revision`.
2. `snapshot.room.matchGeneration` é a geração em que o jogo foi criado.
3. Escrita de geração menor é obsoleta, independentemente de `seq`.
4. Dentro da mesma geração, `seq` menor é obsoleta.

## Lobby de revanche

Estado persistido depois de `reopen_room`:

- `room.status = 'lobby'`
- `room.matchGeneration = anterior + 1`
- `room.revision = último seq da partida encerrada`
- `game = null`
- `secrets = {}`
- `opening_auction = null`
- em cada assento: `openingBid = null`, `bidLocked = false`, `openingRoll = null`, prazos de rolagem `null`

Preservados:

- `id`
- `seats[].uid`
- `seats[].playerId`
- `seats[].name`
- `seats[].color`
- `seats[].avatar`
- `seats[].skin`
- `seats[].isHost`
- `seats[].connected`
- `seats[].reentryCode`
- `openingMode`

## Transições

```text
playing/paused
      |
      | motor encerra
      v
    ended  -- participante fecha localmente --> waiting-in-room
      |
      | host reopenRoom (atômico)
      v
 lobby[g+1] -- Ritual de Largada --> bidding | rolling
      |                                  |
      +------------ snapshot seq+1 <-----+
                         |
                         v
                      playing
```

## Banco

Nova coluna:

```sql
match_generation integer not null default 0
```

Novas/atualizadas funções:

- `room_preview`: inclui `matchGeneration` e `revision`.
- `read_snapshot`: inclui `matchGeneration` e `revision`.
- `write_room`: recebe e grava `match_generation`.
- `write_snapshot`: recebe e grava `match_generation`.
- `reopen_room`: limpa atomicamente o snapshot e avança a geração.
- `reject_stale_snapshot`: rejeita geração anterior; dentro da mesma geração, rejeita `seq` menor.
