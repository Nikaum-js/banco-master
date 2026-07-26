# Contrato — delta da porta `Transport`

**Spec**: [../spec.md](../spec.md) · **Plan**: [../plan.md](../plan.md) · **Porta atual**: `src/net/transport.ts`

> A regra herdada da 037 e reafirmada na 041: **nada neste arquivo vale sem um caso correspondente em `tests/net/conformance.test.ts`, executado contra os dois adapters.** Nesta spec o risco é o inverso do que aconteceu com `takeover` — aqui a tentação é uma garantia que só existe no Supabase e some do adapter local, deixando os testes verdes sobre um contrato que ninguém prova.

---

## 1. `uid` — a identidade da sessão

```ts
readonly uid: string   // ERA `token`
```

**Contrato**

1. É **emitido pelo servidor**, nunca escolhido pelo participante.
2. É estável entre reloads enquanto o navegador guardar a sessão.
3. Não é credencial: conhecer o `uid` de outra sessão não permite agir por ela. Por isso ele **pode** aparecer na sala publicada.
4. Está disponível antes de qualquer envio — `connect()` não resolve sem identidade.

**Conformidade cobra**: duas sessões têm `uid` distinto; o `uid` sobrevive a uma reassinatura; enviar antes de haver identidade não trafega.

---

## 2. `onSubmit` — o remetente vem do transporte

```ts
onSubmit(cb: (cmd: CommandEnvelope, fromUid: string) => void): Unsubscribe
```

**Contrato**

1. `fromUid` é derivado do **canal por onde a mensagem chegou**, nunca do conteúdo dela. `CommandEnvelope` deixa de ter campo de identidade além do `senderId` declarado, que continua existindo só para a autoridade poder recusá-lo (FR-004).
2. Uma sessão MUST NÃO conseguir emitir `onSubmit` com `fromUid` de outra. O adapter recusa no envio e o servidor recusa na escrita — as duas coisas, porque a primeira é conveniência e a segunda é a garantia.
3. A recusa é **silenciosa para o remetente** (`submit` é disparo-e-esquece, contrato da 037) e **inexistente para a autoridade**: o comando forjado não chega.

**Conformidade cobra**: tentar submeter como outro assento não produz `onSubmit` nenhum no host; submeter como si mesmo produz exatamente um, com o `fromUid` correto.

---

## 3. `broadcast` / `onBroadcast` — só a autoridade fala

```ts
broadcast(cmd: AcceptedCommand): void
broadcastPrivate(uid: string, cmd: AcceptedCommand): void   // NOVO
onBroadcast(cb: (cmd: AcceptedCommand) => void): Unsubscribe
```

**Contrato**

1. `broadcast` só tem efeito quando chamado pela sessão que ocupa o assento de anfitrião. Chamada por qualquer outra sessão é recusada — e nenhum `onBroadcast` dispara em cliente nenhum.
2. `broadcastPrivate` entrega ao tópico de **um** assento. Só a autoridade a chama; só o dono (e a autoridade) a recebe.
3. Quando um comando tem parte privada, o dono recebe **as duas** cópias (pública e privada) e aplica a privada. Aplicar a mesma sequência duas vezes é no-op pelo guard que já existe (`cmd.seq <= seq`).
4. Uma parte privada que nunca chega vira lacuna de sequência e cai na ressincronização por snapshot (FR-012 da 037) — não há estado de espera novo.

**Conformidade cobra**: difusão por não-autoridade não alcança ninguém; parte privada chega só ao dono; o dono converge com a mesa; parte privada perdida é recuperada pelo snapshot.

---

## 4. `onPresence` / `onPresenceSync` — presença é do próprio

```ts
onPresence(cb: (change: PresenceChange) => void): Unsubscribe        // change.uid
onPresenceSync(cb: (uids: ReadonlySet<string>) => void): Unsubscribe
```

**Contrato**

1. Uma sessão só anuncia a **própria** presença. Anunciar conexão ou desconexão em nome de outro assento é impossível — a presença viaja no tópico do assento, e escrever nele exige ser ele.
2. `takeover` continua valendo (FR-006a da 041): mesma identidade reabrindo não conta como desconexão.
3. `onPresenceSync` continua entregando o conjunto **completo**, e continua sendo a fonte de verdade para a autoridade que reassume (FR-021 da 041).

**Conformidade cobra**: presença forjada em nome de outro não produz `onPresence` no host; F5 do convidado continua gerando `takeover: true` e não pausa a mesa.

---

## 5. `publishRoom` / `rejectJoin` — segredo não trafega

```ts
publishRoom(room: Room): void          // publica a projeção PÚBLICA
rejectJoin(uid: string, reason): void
```

**Contrato**

1. O que sai em `publishRoom` é `PublicRoom` — sem `reentryCode` de ninguém (data-model §3). O `uid` permanece: não é credencial.
2. Só a autoridade publica sala e recusa entrada.
3. O dono obtém o próprio código pela prévia (`room_preview`), que o devolve apenas para o assento de quem chamou — não pela difusão.

**Conformidade cobra**: nenhum código de reentrada alheio aparece em nada que chega a um cliente; o dono continua conseguindo ler o seu.

---

## 6. `requestJoin` — o pedido sai do canal

```ts
requestJoin(who: JoinRequest): Promise<void>   // ERA void — agora é RPC
onJoinRequest(cb: (who: JoinRequest, fromUid: string) => void): Unsubscribe
```

**Contrato**

1. O pedido de assento passa por função no servidor, que carimba a identidade de quem pediu. `JoinRequest` continua **sem** campo de identidade: quem pede não escolhe quem é (regra da 037, agora sem como burlar).
2. A regra de sala (cheia, cor tomada, peça tomada, já iniciada) continua sendo decisão da **autoridade**, com o código que já existe. A função só atesta.
3. `reentryCode` sai de `JoinRequest`: reanexar deixa de ser um tipo de pedido de assento e passa a ser caminho próprio (§7).

**Conformidade cobra**: pedido chega ao host com o `fromUid` real; declarar identidade alheia não muda o `fromUid`.

---

## 7. `reattach` — reanexação não passa pela autoridade

```ts
reattach(roomId: string, code: string): Promise<{ ok: true } | { ok: false; reason: JoinError }>
```

**Contrato**

1. Valida link + código **no servidor** e regrava o vínculo assento↔identidade.
2. Vale para **todos** os assentos, inclusive o do anfitrião — é o caso que justifica o caminho existir (Clarifications da spec).
3. O token/uid anterior deixa de valer para aquele assento (D-033).
4. Concluída a reanexação, a mesa é avisada pelo tópico de lobby, e a autoridade — se estiver viva — republica a sala. Se não estiver, quem reanexou como anfitrião reassume pelo caminho normal de `open()` (FR-015 da 037).

**Conformidade cobra**: código válido reanexa; código inválido recusa com `'bad-code'`; reanexar o assento do anfitrião com a autoridade **fora** funciona; o vínculo antigo para de agir pelo assento.

---

## 8. `loadSnapshot` / `loadRoom` — leitura é função, não tabela

```ts
loadSnapshot(): Promise<PersistedSnapshot | null>   // devolve a PERSPECTIVA de quem chamou
loadRoom(): Promise<PublicRoom | null>              // prévia
```

**Contrato**

1. `loadSnapshot` devolve o estado já filtrado pela perspectiva da sessão: mão própria completa, mão alheia e deck como slots ocultos. Para a autoridade, o estado inteiro.
2. Uma sessão sem assento MUST NÃO obter estado de partida — recebe `null` ou recusa, nunca dado.
3. `loadRoom` devolve a prévia por id, e o `reentryCode` **apenas** do assento de quem chamou.
4. Nenhum caminho da porta faz leitura direta de tabela.

**Conformidade cobra**: sessão sem assento não lê estado; cada assento lê a própria mão e nunca a alheia; a autoridade lê tudo; a prévia devolve um código e só um.

---

## 9. O que a porta continua NÃO prometendo

Herdado da 037/041, inalterado:

- `onRoom` não faz replay do último `room` ao assinar.
- `submit`/`broadcast`/`publishRoom` são disparo-e-esquece; `saveRoom`/`saveSnapshot` rejeitam a promise.
- Antes de `connect()` resolver, envio nenhum trafega — agora com um motivo a mais: antes dele não há identidade.
- `onWriteExhausted`/`onWriteRecovered` continuam sendo do decorator `durableWrites`, não do adapter cru.
