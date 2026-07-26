# Contrato — delta da porta `Transport`

**Spec**: [../spec.md](../spec.md) · **Plan**: [../plan.md](../plan.md) · **Porta atual**: `src/net/transport.ts`

> A regra da porta, herdada da 037 e reafirmada aqui: **nada neste arquivo vale sem um caso correspondente em `tests/net/conformance.test.ts`, executado contra os dois adapters.** Semântica que vive só em comentário é semântica que diverge — foi assim que `takeover` acabou implementado no adapter local e fixo em `false` no de produção, e é assim que o defeito 1 desta spec chegou à produção sem que nenhum teste o visse.

---

## 1. `onStatus` — a conexão desta sessão

```ts
onStatus(cb: (s: 'connected' | 'reconnecting') => void): Unsubscribe
```

**Contrato**

1. Emite `'connected'` toda vez que o canal fica utilizável — inclusive na **reassinatura** após uma queda, não só na primeira.
2. Emite `'reconnecting'` quando o canal deixa de estar utilizável, por qualquer motivo do adapter (erro, timeout, fechamento).
3. Pode emitir o mesmo valor duas vezes seguidas; o consumidor deduplica. A porta não promete transição, promete o valor corrente.
4. Assinar **não** faz replay do último status. Para o valor atual imediatamente após `connect()`, assuma `'connected'` (a promessa de `connect()` só resolve conectado).
5. Múltiplos assinantes; desassinar desliga só o próprio callback.

**Só dois valores.** Mapear os cinco status do Realtime para dois é trabalho do adapter — para quem consome, "não estou conectado agora" é uma coisa só.

**Conformidade cobra**: queda emite `'reconnecting'`; restabelecimento emite `'connected'`; dois assinantes recebem; o desassinante não derruba o outro.

---

## 2. `onPresenceSync` — quem está no canal, em conjunto

```ts
onPresenceSync(cb: (tokens: ReadonlySet<string>) => void): Unsubscribe
```

**Contrato**

1. Emite o conjunto **completo** de tokens presentes, não um delta.
2. Emite ao menos uma vez depois de `connect()` resolver, com o estado inicial.
3. Emite a cada mudança de presença observada.
4. É a fonte de verdade de presença para a autoridade que reassume (FR-021). `onPresence` (delta) continua existindo para o caminho quente; este é para reconciliar.

**Por que push e não `presenceState()` pull**: logo após a assinatura, o estado de presença ainda está chegando. Um pull perde a corrida de forma silenciosa e intermitente — a pior classe de bug para reproduzir.

**Conformidade cobra**: após `connect()`, chega um conjunto contendo o próprio token; com dois participantes, ambos os tokens; após a saída de um, o conjunto sem ele.

---

## 3. `JoinRequest.reentryCode` — reentrada por código (D-033)

```ts
export interface JoinRequest {
  name: string
  color: string
  piece?: PieceId
  reentryCode?: string   // NOVO
}
```

**Contrato**

1. Com `reentryCode` presente, o pedido é de **reanexação**, não de assento novo: o host toma o caminho `reattachByCode` e o gate de `already-started` **não** se aplica.
2. `name`/`color`/`piece` são ignorados no caminho de reanexação — a identidade visual pertence ao assento, não a quem está reabrindo.
3. Código inválido responde pelo canal de recusa já existente, com a razão nova `'bad-code'`.
4. A reanexação bem-sucedida republica a sala; o cliente reconhece o próprio assento pelo caminho normal (`resolvePlayerId`).

**Por que não uma mensagem nova na porta**: uma mensagem a menos é um caminho a menos para os dois adapters divergirem. O host já distingue os dois casos por um campo.

**`JoinError`** ganha `'bad-code'`.

**Conformidade cobra**: pedido com código chega ao host com o token da **conexão** (como o pedido comum já faz); recusa por código inválido volta só ao pedinte.

---

## 4. Gravação — durabilidade, ordem e monotonia

`saveSnapshot` / `saveRoom` mantêm a assinatura. O que muda é a **promessa**, e ela passa a ser cumprida pelo decorator `durableWrites` (`src/net/durableWrites.ts`) em vez de por cada adapter.

**Contrato do transporte embrulhado**

1. No máximo **uma** escrita em voo por sala.
2. Escritas pedidas durante uma em voo são **coalescidas**: vale a última: a linha é única e o estado mais recente contém os anteriores.
3. Escrita com `seq` menor que o último gravado com sucesso é **descartada**, sem tentativa.
4. Falha é repetida com espera crescente, tentativas finitas.
5. Esgotamento notifica **uma vez** por episódio (`onExhausted`); a recuperação notifica uma vez (`onRecovered`), e só se houve esgotamento.
6. Nenhuma rejeição escapa sem tratamento.

**Contrato do adapter cru** (o que fica valendo por baixo, inalterado da 037): `saveRoom`/`saveSnapshot` **rejeitam** a promessa em falha — ao contrário de `submit`/`broadcast`/`publishRoom`, que são disparo-e-esquece. É essa rejeição que o decorator consome.

**Guarda no banco** (`supabase/migrations/0002_snapshot_monotonic.sql`): trigger `before update` que devolve `null` quando `new.seq < old.seq`. Estritamente `<`, para não bloquear o upsert parcial de `saveRoom` (que não envia `seq`, logo `new.seq = old.seq`). O `fakeSupabase` implementa a mesma semântica — sem isso, a conformidade prova uma garantia que a produção não tem.

**Conformidade cobra**: escrita que falha uma vez e sucede na repetição; escrita que falha sempre chama `onExhausted` **uma** vez; volta chama `onRecovered`; escrita com `seq` menor não regride o que `loadSnapshot` devolve; duas escritas cruzadas deixam a mais recente gravada.

---

## 5. Garantias que a porta continua **não** dando

Herdadas da 037, repetidas porque nada nesta spec as afrouxa:

- `onRoom` **não** faz replay do último `room` ao assinar — para o estado atual, `loadRoom()`.
- `submit` / `broadcast` / `publishRoom` / `requestJoin` / `rejectJoin` são disparo-e-esquece: falha de envio é silenciosa.
- Antes de `connect()` resolver, envio nenhum trafega.
- A identidade do remetente no adapter de produção ainda é **auto-declarada** no payload. A lógica do host rejeita spoof, mas o endurecimento de identidade de transporte continua pendente — e D-033 registra que a reentrada por código não pode servir de argumento para adiá-lo.
