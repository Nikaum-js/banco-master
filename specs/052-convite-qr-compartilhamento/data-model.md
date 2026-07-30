# Modelo de dados: convite da sala

Nenhum estado de domínio ou persistência é adicionado.

## `RoomShareData`

| Campo | Tipo | Origem | Invariante |
|---|---|---|---|
| `title` | `string` | constante de produto | curto e independente da sala |
| `text` | `string` | constante de produto | não contém dado privado além do convite |
| `url` | `string` | `roomLink(room.id)` | URL canônica exata |

## `RoomQr`

| Campo | Tipo | Invariante |
|---|---|---|
| `payload` | `string` | igual a `RoomShareData.url` |
| `matrix` | `boolean[][]` | matriz quadrada produzida localmente |
| `size` | `number` | igual às dimensões da matriz |

## Estado efêmero da interface

- `open`: diálogo montado ou não.
- `feedback`: sucesso/erro de cópia ou share; nunca persiste.
- `sharing`: impede repetição enquanto a Promise nativa está pendente.

Nenhum desses campos entra em `Room`, snapshot, Supabase ou telemetria.
