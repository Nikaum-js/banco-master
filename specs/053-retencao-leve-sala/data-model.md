# Modelo de dados: retenção da sala

## `Seat.historyId`

`string` público, não credencial, único por assento na sala. Persiste em reordenação, revanche e reentrada.

## `RoomMatchHistoryEntry`

| Campo | Tipo | Regra |
|---|---|---|
| `generation` | `number` | inteiro ≥ 0; chave idempotente |
| `endedAt` | `number \| null` | instante do estado final |
| `durationMs` | `number \| null` | de `matchSummary` |
| `rounds` | `number` | inteiro ≥ 0 |
| `standings` | `RoomHistoryStanding[]` | 1–8, rank crescente |

## `RoomHistoryStanding`

| Campo | Tipo |
|---|---|
| `historyId` | `string` |
| `playerId` | `string` |
| `name` | `string` |
| `color` | `string` |
| `avatar` | `AvatarId` |
| `skin` | `SkinId` |
| `rank` | `number` |
| `netWorth` | `number` |
| `properties` | `number` |
| `eliminatedAtRound` | `number \| null` |

Allowlist explícita: nenhum outro campo do assento ou jogo é espalhado para a entrada.

## `Room.matchHistory`

`RoomMatchHistoryEntry[]`, normalizado para:

- gerações únicas;
- ordem crescente;
- últimas 10;
- entrada/standing inválido descartado;
- ausente = `[]`.

## Estatísticas derivadas

```ts
interface PlayerRoomStats {
  historyId: string
  name: string
  color: string
  avatar: AvatarId
  skin: SkinId
  matches: number
  wins: number
  winRate: number
  averageRank: number
  bestNetWorth: number
}

interface RoomStats {
  players: PlayerRoomStats[]
  averageDurationMs: number | null
  averageRounds: number
}
```

Identidade visual vem da participação mais recente; números usam todas.

## `RoomPreset`

```ts
interface RoomPreset {
  id: OpeningMode
  label: string
  detail: string
  settings: { openingMode: OpeningMode }
}
```

Não há coluna de preset: `openingMode` permanece a fonte persistida.

## Banco

```sql
match_history jsonb not null default '[]'::jsonb
```

Constraint: tipo array e `jsonb_array_length(match_history) <= 10`.
