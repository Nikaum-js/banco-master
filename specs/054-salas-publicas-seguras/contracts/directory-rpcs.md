# Contract: Diretório e publicação

Todas as RPCs exigem role `authenticated`, derivam identidade de `auth.uid()` e usam
`security definer` com `search_path = ''`. `anon` e `public` não recebem `EXECUTE`.

## `list_public_rooms() -> jsonb`

Sucesso:

```json
{
  "ok": true,
  "listings": [
    {
      "listingId": "uuid",
      "label": "Mesa 7Q2M",
      "availableSeats": 5,
      "capacity": 8,
      "openingMode": "sealed-bid",
      "createdMinutesAgo": 3
    }
  ]
}
```

Limite:

```json
{ "ok": false, "reason": "rate-limited", "retryAfterMs": 4120 }
```

Regras:

- máximo uma decisão nova por uid em qualquer janela de 5 segundos;
- resposta limitada à allowlist acima e ordenada por `rooms.created_at DESC`;
- filtros são aplicados no cliente apenas sobre esse conjunto já autorizado;
- erro não faz fallback para `rooms`.

## `public_room_publication(room_id text) -> jsonb`

Somente host atual. Retorna:

```json
{
  "published": true,
  "visible": true,
  "listingId": "uuid",
  "hiddenReason": null
}
```

`hiddenReason` pertence ao conjunto `full | host-absent | not-lobby | null`. Não retorna
assentos ou outros campos de sala.

## `publish_public_room(room_id text) -> jsonb`

Somente host atual. Rotaciona `listingId` na transição privada→publicada, registra heartbeat
e recusa:

- quarta sala distinta em 10 minutos;
- segundo lobby ainda publicado pela mesma identidade;
- sala inexistente ou fora do lobby;
- identidade diferente do host atual.

Republicar a mesma sala em nova revanche é permitido e não conta como sala distinta dentro
da janela.

## `unpublish_public_room(room_id text) -> jsonb`

Somente host atual. Define `is_published = false`; é idempotente para sala privada.

## `heartbeat_public_room(room_id text) -> jsonb`

Somente host atual e apenas para publicação vigente. Atualiza `last_host_seen_at`. Não
publica e não escreve `rooms`. Se a reentrada mudou o uid do host, transfere o controle da
publicação; uma publicação concorrente do novo uid é encerrada para preservar o teto de um
lobby sem impedir ou reverter a reentrada.
