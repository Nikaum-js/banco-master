# Contract: Admissão pública

## `join_public_room(listing_id uuid, name text, color text, avatar text, skin text) -> jsonb`

Toda chamada autenticada conta como tentativa, inclusive listagem inexistente, cheia ou
expirada. O limite é 10 tentativas por uid em qualquer janela de 1 minuto.

Sucesso:

```json
{ "ok": true, "roomId": "credencial-privada" }
```

Recusas:

```json
{ "ok": false, "reason": "unavailable" }
{ "ok": false, "reason": "rate-limited", "retryAfterMs": 32000 }
{ "ok": false, "reason": "invalid-name" }
{ "ok": false, "reason": "invalid-color" }
{ "ok": false, "reason": "color-taken" }
{ "ok": false, "reason": "invalid-appearance" }
```

Somente o sucesso pode conter `roomId`.

## Decisão transacional

1. adquirir lock lógico do uid para o limite;
2. registrar a tentativa;
3. travar `rooms` e a publicação selecionada;
4. revalidar publicação, lobby, heartbeat e capacidade;
5. validar nome com 1–16 caracteres após trim;
6. validar cor contra `SEAT_COLORS` e unicidade;
7. validar Avatar/Skin contra os catálogos fechados;
8. se o uid já possui assento, marcar `connected` e devolver sucesso idempotente;
9. acrescentar um único assento com credenciais geradas no servidor;
10. enviar aviso Realtime para o host recarregar e reconciliar a sala;
11. devolver `roomId`.

O lock da linha garante que duas chamadas pela última vaga produzam um sucesso e uma recusa.

## Fronteira privada

`request_seat(room_id, ...)`, `room_preview(room_id)`, reentrada e convite continuam com as
assinaturas e contadores existentes. Nenhuma função pública é chamada por esse caminho.
