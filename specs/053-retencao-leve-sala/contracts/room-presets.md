# Contrato: presets da sala

```ts
const ROOM_PRESETS: readonly RoomPreset[]
function presetForOpeningMode(mode: OpeningMode | undefined): RoomPreset
function recallRoomPreset(storage?: Storage): RoomPreset
function rememberRoomPreset(id: RoomPresetId, storage?: Storage): void
```

## Mapeamento

| Preset | Configuração |
|---|---|
| `sealed-bid` / Leilão secreto | `{ openingMode: 'sealed-bid' }` |
| `dice-roll` / Maior dado | `{ openingMode: 'dice-roll' }` |

## Autoridade

- Catálogo não muda sala.
- Host chama o reducer existente `selectOpeningMode`.
- Convidado não possui `Host`; chamada não produz mutação.
- Fora de `lobby`, reducer retorna `not-in-lobby`.
- `create()` pode aplicar preferência a sala nova.
- `enter()` nunca aplica preferência.
