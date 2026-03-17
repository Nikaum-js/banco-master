# Data Model: Diretório opt-in de salas públicas anônimas

## Relações com entidades existentes

- `Room` continua em `src/net/room.ts` e `public.rooms`; a feature só acrescenta
  `created_at`, cuja única finalidade pública é idade aproximada/ordenação.
- `Seat`, `SessionIdentity` e `RoomPreview` não são duplicados.
- `PublicParticipationIdentity` é `auth.uid()` no contexto das RPCs públicas.

## PublicRoomListing

Persistência interna em `public.public_room_listings`.

| Campo | Tipo | Regra |
|---|---|---|
| `room_id` | `text`, PK/FK | Referência privada; nunca sai na listagem |
| `listing_id` | `uuid`, unique | Rotaciona ao publicar depois de estado privado |
| `publisher_uid` | `uuid` | Identidade atestada que publicou; sem leitura client-side |
| `is_published` | `boolean` | Intenção vigente do host |
| `published_at` | `timestamptz` | Auditoria técnica e ciclo de publicação |
| `last_host_seen_at` | `timestamptz` | Heartbeat; não altera a sala |
| `updated_at` | `timestamptz` | Manutenção interna |

### Projeção enumerável

`PublicRoomListing` no TypeScript:

```text
listingId
label
availableSeats
capacity
openingMode
createdMinutesAgo
```

Não há outros campos opcionais. Campos desconhecidos invalidam o item no parser.

## PublicRoomStatus

Estado derivado, não uma máquina concorrente da sala:

```text
private
  └─ publish(host) ──> published-visible
                         ├─ full/host stale ──> published-hidden
                         │                        └─ eligible ──> published-visible
                         ├─ unpublish(host) ──> private
                         └─ Room.status != lobby ──> private
```

`published-hidden` preserva `is_published = true`. Início muda para `false`; revanche não
tem transição automática de volta.

## ListingEligibility

Conjunção calculada no servidor:

1. linha de publicação com `is_published = true`;
2. `Room.status = 'lobby'`;
3. `jsonb_array_length(Room.seats) < 8`;
4. `last_host_seen_at >= statement_timestamp() - 60 seconds`.

Elegibilidade só controla resposta/admissão. Nunca executa `DELETE`, altera `Room.status`,
marca assento desconectado ou toca snapshot.

## PublicParticipationIdentity

Não tem tabela própria. É o `auth.uid()` de uma sessão anônima válida:

- host atual: pode publicar, despublicar e confirmar heartbeat da própria sala;
- qualquer sessão: pode consultar com limite e tentar admissão;
- não há nome, perfil, relação global ou recuperação de conta.

## PublicAdmission

Não é persistida como entidade duradoura. `join_public_room()`:

1. conta tentativa;
2. trava a linha da sala;
3. revalida `ListingEligibility`;
4. valida nome, cor, Avatar e Skin;
5. cria um `Seat` compatível com o contrato atual;
6. devolve `roomId` somente no sucesso.

O `Seat` recebe `reentryCode` de seis caracteres do alfabeto vigente e `historyId` aleatório
de 16 caracteres. Esses valores nunca aparecem na listagem.

## RateLimitDecision

Resultado JSON de uma decisão:

```text
allowed: boolean
reason?: rate-limited | active-public-room | unavailable | invalid-identity
retryAfterMs?: integer
```

`public.public_room_rate_events`:

| Campo | Tipo | Regra |
|---|---|---|
| `id` | `bigint identity` | Chave interna |
| `actor_uid` | `uuid` | `auth.uid()` |
| `action` | `text` | `publish`, `join` ou `directory` |
| `room_id` | `text nullable` | Só para contagem distinta de publicação |
| `created_at` | `timestamptz` | Relógio server-side |

RLS fica habilitada sem policies. Funções removem eventos com mais de 10 minutos de forma
oportunista; nenhuma UI os lê e nenhum identificador vira perfil ou telemetria.

## Invariantes

1. Ausência de listing equivale a sala privada.
2. `listing_id` nunca é derivado de `room_id`.
3. Uma resposta recusada de entrada nunca contém `room_id`.
4. Duas admissões concorrentes não podem produzir mais de 8 assentos.
5. Publicação e heartbeat só aceitam o host atual.
6. Estado não-lobby encerra publicação; lobby futuro não a restaura.
7. Falha de qualquer RPC pública não altera o contrato privado.
8. Nenhuma tabela nova concede `SELECT`, `INSERT`, `UPDATE` ou `DELETE` direto ao frontend.
9. Se reentrada trocar o uid do host, a próxima presença transfere o controle da publicação
   sem bloquear a reentrada; para manter o teto de um lobby, outra publicação daquele novo
   uid é encerrada sem tocar sua sala.
