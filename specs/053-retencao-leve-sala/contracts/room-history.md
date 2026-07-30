# Contrato: histórico e estatísticas

```ts
function recordFinishedMatch(room: Room, game: GameState): Room
function normalizeMatchHistory(value: unknown): RoomMatchHistoryEntry[]
function deriveRoomStats(history: readonly RoomMatchHistoryEntry[]): RoomStats
```

## Invariantes

- Fase diferente de `ended` → mesma sala.
- Geração já presente → mesma sala e entrada imutável.
- Entrada nova → array normalizado, ordenado, máximo 10.
- `prepareRematch(recorded).matchHistory === recorded.matchHistory` por valor.
- Entrada usa allowlist; serialização não contém `uid`, `reentryCode`, `hands`, `cards`, `trade`, `log`, `secrets`.
- Estatísticas não mutam o histórico.
- Uma vitória é `rank === 1`.
- `winRate = wins / matches`; `averageRank = Σrank / matches`.
- Duração média ignora `null`; se todas desconhecidas, `null`.
