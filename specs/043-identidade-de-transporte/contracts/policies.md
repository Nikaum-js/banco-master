# Contrato — o lado de fora: tópicos, políticas e funções do servidor

**Spec**: [../spec.md](../spec.md) · **Plan**: [../plan.md](../plan.md) · **Migration**: `supabase/migrations/0003_attested_identity.sql`

> Este arquivo é o contrato que **nenhum teste headless prova**. Política de banco e de canal não tem tipo, não quebra o build e falha em silêncio — por isso cada regra abaixo tem um vetor correspondente em `scripts/attack.ts`, e é ele o critério de aceite (SC-001).

---

## 1. Sessão

Toda sessão obtém identidade anônima do Supabase antes de qualquer tráfego, e a repassa ao Realtime:

```ts
await ensureSession()            // getSession() ?? signInAnonymously()
await supabase.realtime.setAuth() // obrigatório para canal privado
```

**Pré-requisito de projeto** (config, não migration): sessões anônimas habilitadas. Sem isso, `ensureSession()` falha e o app diz o quê fazer — nunca trava em silêncio (FR-032).

---

## 2. Tópicos

Todos privados (`config: { private: true }`).

| Tópico | Carrega | `select` (ler/entrar) | `insert` (escrever) |
|---|---|---|---|
| `room:<id>:lobby` | sala publicada, recusa de entrada, aviso de reanexação | qualquer sessão autenticada que apresente o id | só o `uid` do assento de anfitrião |
| `room:<id>:play` | comando aceito (parte pública) | só quem tem assento na sala | só o `uid` do assento de anfitrião |
| `room:<id>:s:<uid>` | comando do jogador, presença do assento, parte privada do aceito | o próprio `uid` e o anfitrião | o próprio `uid` e o anfitrião |

**A identidade é o endereço.** A política de `insert` em `room:<id>:s:<uid>` compara o sufixo do tópico com `auth.uid()`. É isso que faz o remetente ser inforjável, e é isso que dispensa assinatura de payload.

**Presença** (`extension = 'presence'`) segue a política do tópico de assento: anunciar presença de um assento exige ser aquele assento. O anfitrião assina esses tópicos e **não** chama `track()` neles — assim a presença observada ali é só a do dono.

---

## 3. Tabela `rooms`

| Operação | Política |
|---|---|
| `select` | **nenhuma** — não existe leitura direta. Tudo passa por função. |
| `insert` | qualquer sessão autenticada (quem cria a sala é o anfitrião dela) |
| `update` | só o `uid` do assento de anfitrião daquela linha |
| `delete` | **nenhuma**, como já é hoje |

Colunas: as da 037/041, mais `secrets jsonb` (data-model §7).

O trigger de monotonia (`0002`) continua intacto — é `before update` e não depende de quem chamou.

O aviso do linter `0024` (políticas permissivas demais), hoje documentado como deliberado na `0001`, deixa de ser esperado: se voltar a aparecer, é regressão (SC-005).

---

## 4. Funções

Todas `security definer`, `search_path` fixo em vazio (mesmo cuidado do linter 0011 já aplicado nos triggers da 037).

### `room_preview(room_id text) → jsonb`

Devolve `{ id, status, seats: PublicSeat[] }` — sem `reentryCode` de ninguém, **exceto** o do assento de quem chamou. O **anfitrião** recebe os assentos íntegros ([D-038](../../../docs/adr/D-038-o-codigo-de-reentrada-e-imutavel-e-a-autoridade-o-le.md)): no lobby não existe snapshot, então esta é a única leitura de onde a autoridade remonta a sala que vai gravar em seguida.

Sustenta a escada de entrada da 038 e a leitura do próprio código pelo dono (FR-019). Não devolve estado de partida. Sem id, não devolve nada — é o que torna a enumeração impossível.

### `read_snapshot(room_id text) → jsonb`

Recusa quem não tem assento na sala. Para quem tem, devolve por **seleção de chave** — e a mesma chave recorta `secrets` e `seats`:

- jogador → `game` + `secrets->auth.uid()` + assentos sem `reentryCode` alheio
- anfitrião → `game` + `secrets` inteiro + assentos íntegros

### `preserve_seat_codes(room_id text, new_seats jsonb) → jsonb`

Usada por `write_room` e `write_snapshot`, nunca pelo cliente. Conserva o `reentryCode` já guardado de cada assento, casando por `playerId`. **O código é imutável depois de mintado** ([D-038](../../../docs/adr/D-038-o-codigo-de-reentrada-e-imutavel-e-a-autoridade-o-le.md)): nenhuma gravação o altera ou apaga, nem a da própria autoridade. É o que impede que qualquer caminho futuro que remonte a sala a partir de uma leitura redigida destrua os códigos em silêncio.

Não interpreta nem `game` nem `secrets`: a divisão e o merge são TypeScript (`src/net/perspective.ts`), e é assim que o servidor não passa a conhecer o esquema do `GameState` nem o do log (040).

### `request_seat(room_id text, name text, color text, piece text) → void`

Carimba `auth.uid()`, registra o pedido e o difunde ao anfitrião pelo tópico de lobby.

**Não valida regra de sala.** Cheia, cor tomada, peça tomada e já iniciada continuam sendo decisão da autoridade, com `joinRoom` — a função só atesta quem pediu.

### `reattach_by_code(room_id text, code text) → jsonb`

Compara o código com os assentos da sala; casando, regrava `uid` daquele assento para `auth.uid()` e avisa o lobby. Devolve `{ ok: true }` ou `{ ok: false, reason: 'bad-code' }`.

**É a única regra de domínio que passa a existir em SQL**, e existe porque o caso que a justifica é o anfitrião que perdeu o aparelho — nele não há autoridade para autorizar nada. O espelho em `room.ts` continua existindo e continua testado; é o que o adapter local exercita.

---

## 5. Migration `0003` — ordem de operações

1. `delete from public.rooms` — pré-lançamento, sem migração de dados (data-model §8).
2. `alter table` — `secrets jsonb`, e o assento passa a carregar `uid` (mudança de formato dentro do `seats` jsonb; nada a converter, a tabela está vazia).
3. `drop policy` das três políticas `true` da `0001`; `create policy` das novas (§3).
4. Políticas de `realtime.messages` para as três classes de tópico (§2).
5. Funções (§4).

Aplicação no projeto vivo (`edppdqrkqljhjkbyjvsz`) **pede confirmação explícita** antes de rodar (FR-030).

---

## 6. Os seis vetores — `scripts/attack.ts`

Monta um cliente com a **chave pública do bundle**, cria a própria sala de teste e tenta:

| # | Vetor | Esperado |
|---|---|---|
| 1 | comando em nome de assento alheio (escrita em `room:<id>:s:<outro uid>`) | recusado |
| 2 | difundir comando aceito em `room:<id>:play` sem ser a autoridade | recusado |
| 3 | publicar sala / recusar entrada em `room:<id>:lobby` sem ser a autoridade | recusado |
| 4 | anunciar presença em nome de outro assento | recusado |
| 5 | ler ou gravar a linha de uma sala sem ter assento nela | recusado |
| 6 | listar salas (`select` sem filtro) | recusado |

**Critério de aceite: 6/6.** O roteiro limpa a sala que criou ao terminar.

---

## 7. O que fica de fora, e por quê

- **Assinatura de payload** — desnecessária: a identidade é o endereço (§2), não um campo assinado.
- **Rate limiting / anti-abuso** — superfície de disponibilidade, não de identidade. Nada aqui a bloqueia.
- **Revogar acesso de quem já está conectado** — a política do Realtime é avaliada ao **entrar** no tópico. Quem é removido do lobby mantém a assinatura até cair, mas perde a leitura da linha (avaliada a cada chamada) e não consegue entrar no tópico de jogo depois. Como o kick é só de lobby (FR-024 da 038), não há estado de partida a proteger nesse intervalo.
- **Limpeza de usuários anônimos acumulados** — rotina de operação, registrada nos Edge Cases da spec.
