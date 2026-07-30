# Contrato: persistência 0007

## Leituras

`room_preview(room_id)` e `read_snapshot(room_id)` incluem:

```json
{ "matchHistory": [] }
```

Ausência no backend legado normaliza para `[]`.

## Escritas

Novas sobrecargas:

```sql
write_room(room_id, status, seats, match_generation, opening_mode, opening_auction, match_history)
write_snapshot(room_id, seq, game, secrets, status, seats, match_generation, opening_mode, opening_auction, match_history)
```

As duas:

- atestam `auth.uid()` como host atual;
- preservam códigos de reentrada pela função existente;
- gravam `match_history`;
- rejeitam array acima de 10 pela coluna/constraint;
- não aceitam convidado.

## Compatibilidade

1. frontend tenta assinatura 0007;
2. em `PGRST202`, tenta 0006 sem `match_history`;
3. somente em geração 0, se 0006 também faltar, tenta 0005 sem `match_generation`;
4. erro real nunca aciona fallback.

`reopen_room` da 0006 permanece e conserva a coluna `match_history`, pois não a inclui no `UPDATE`.
