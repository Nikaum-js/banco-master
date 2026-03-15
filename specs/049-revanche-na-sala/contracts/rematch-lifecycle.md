# Contract — Ciclo de revanche

## Operação autoritativa

```ts
Host.reopenRoom():
  Promise<
    | { ok: true }
    | { ok: false; reason: 'not-ended' | 'not-host' | 'persistence' }
  >
```

Pré-condições:

- chamador é o host atual;
- existe `GameState` com `phase === 'ended'`, ou a sala já está no lobby da geração seguinte.

Pós-condições de sucesso:

- `Room.status === 'lobby'`;
- `matchGeneration` aumenta exatamente uma vez;
- `revision` não regride;
- snapshot e segredos anteriores deixam de ser legíveis;
- identidade dos assentos permanece;
- publicação do lobby ocorre somente depois da RPC aceitar a transição.

Idempotência:

- chamada repetida depois do sucesso devolve `{ ok: true }` sem aumentar novamente a geração.

## Sessão

```ts
RoomSession.returnToLobby(): Promise<void>
```

- convidado: muda apenas sua `SessionPhase` para `lobby`;
- host: chama `Host.reopenRoom()` e só então muda para `lobby`;
- erro de persistência: conserva a classificação e expõe erro acionável;
- uma sala em `bidding` ou `rolling` sempre prevalece sobre um resumo antigo;
- o primeiro snapshot da nova geração leva a sessão a `reveal`/`playing` pelo fluxo existente.

## Ordenação

Comparação de `PublicRoom`:

1. maior `matchGeneration` vence;
2. na mesma geração, maior `revision` vence;
3. empate aceita a mensagem como atualização idempotente.

Comparação de `PersistedSnapshot`:

1. snapshot de geração menor é ignorado;
2. na mesma geração, `seq <= seq local` é duplicata/obsoleta;
3. snapshot de geração maior substitui integralmente o jogo anterior;
4. o `seq` global nunca diminui, inclusive no primeiro snapshot da revanche.

## Privacidade

- `reopen_room` só pode ser executada pelo uid do assento `isHost`.
- `reentryCode` continua protegido por `preserve_seat_codes`.
- visitante sem assento não recebe o resumo final.
- a operação não altera a divisão `publicGame`/`secrets`.
