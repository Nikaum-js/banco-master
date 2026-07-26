# Implementation Plan: Resiliência de sessão — a partida sobrevive à rede

**Spec**: [spec.md](./spec.md) · **Modelo**: [data-model.md](./data-model.md) · **Contrato**: [contracts/transport.md](./contracts/transport.md)

**Data**: 2026-07-26 · **ADRs de origem**: [D-033](../../docs/adr/D-033-codigo-de-reentrada-por-assento.md), [D-034](../../docs/adr/D-034-persistencia-indisponivel-pausa-a-partida.md) · **SRS**: v1.7 (§11.3/§11.4)

---

## Summary

Sete defeitos de resiliência, todos na casca de rede, consertados atrás das portas que já existem. O motor de jogo não ganha nem perde uma regra: a única mudança em `src/game/**` é a **forma** do campo de pausa, e ela foi desenhada para não tocar nenhum dos ~35 pontos que hoje leem `state.paused`.

Quatro movimentos de produção e um de prova:

1. **Pausa com causa** — `paused: boolean` vira `paused: PauseState | null`, com as causas ativas e o instante de início dentro do estado persistido. Resolve os defeitos 4 (relógio volátil) e a metade de estado do 3.
2. **Transporte durável** — a porta ganha status de conexão e sincronização de presença; a gravação ganha fila serializada, monotônica, com repetição e sinal de esgotamento. Resolve 1, 3 e parte do 6.
3. **Autoridade e cliente endurecidos** — o host reconcilia presença ao reassumir e emite a pausa por persistência; o cliente ressincroniza com espera crescente e se declara dessincronizado ao desistir. Resolve 5 e 6.
4. **Superfície local** — estado de conexão da própria sessão na UI, controles inertes enquanto fora, banner de pausa que nomeia a causa. Resolve 2.
5. **Reentrada por código** — D-033. Resolve 7.

E o que sustenta tudo: **um harness que sabe falhar**. Sem ele, esta spec é uma correção sem rede de proteção — os sete defeitos existem justamente porque o modelo de teste atual é uma rede perfeita.

---

## Technical Context

**Linguagem/stack**: TypeScript estrito, React 19, Zustand, Supabase (Realtime + Postgres). Sem dependência nova.

**Onde o trabalho acontece**: `src/net/**` (o grosso), mais uma fatia cirúrgica de `src/game/` (`turn/types.ts`, `commands.ts`, `setup.ts`) e uma migration SQL.

**Fora do caminho da spec 040** (que roda em paralelo): 040 vive em `src/game/log.ts`, nos pontos de emissão de `src/game/**`, em `src/game/ui/log/`, no `CenterLog` de `src/boards/shared.tsx`, em `sound/classify.ts` e em `src/lib/money.ts`. Esta spec não abre nenhum deles. **Um único ponto de contato conhecido**: `tests/game/emprestimos/emprestimos.test.ts:69` monta um estado com `paused: true` e está na lista de arquivos que a 040 já modificou — quem chegar depois resolve o conflito de uma linha.

**Testes**: `vitest` para tudo headless; `@playwright/test` para o E2E. Sem infra viva em nenhum caso — o adapter de produção é exercitado pelo `tests/net/fakeSupabase.ts`, que já existe.

**Restrição de determinismo**: nenhuma parte nova pode consumir relógio ou temporizador real dentro dos testes. Toda espera (backoff de gravação, backoff de ressincronização) entra por injeção, como `rng`/`now` já entram no host.

---

## Constitution Check

| Princípio | Conformidade |
|---|---|
| **I. SRS é verdade absoluta** | Nada aqui nasce na spec: §11.3/§11.4 foram bumpados para v1.7 **antes**, apoiados em D-033 e D-034. |
| **II. Discovery antes de código** | Spec escrita, ambiguidades resolvidas (três decisões de produto travadas com o usuário), ADRs registradas antes deste plano. |
| **III. Tesouro precisa impactar** | Não aplicável — nenhuma carta é tocada. |
| **IV. Catch-up é discreto** | Não aplicável. |
| **V. Sem dependência de cooperação** | Preservado: a reentrada por código **não** depende do anfitrião autorizar (foi por isso que a alternativa "host libera o assento" foi descartada na D-033). |
| **VI. Privacidade de cartas** | Inalterada. O código de reentrada entra na mesma classe de exposição do token, explicitamente aceita em D-033, e não amplia o que um cliente já vê. |
| **VII. Resiliência de sessão** | É a spec inteira. Nenhuma espera ganha timeout, nada é confiscado, nenhuma queda pune. |

---

## Project Structure

### Documentation (this feature)

```
specs/041-resiliencia-de-sessao/
├── spec.md
├── plan.md              ← este arquivo
├── data-model.md        ← PauseState, ConnectionState, Seat.reentryCode, fila de gravação
├── contracts/
│   └── transport.md     ← delta da porta `Transport` + o que a conformidade cobra
└── tasks.md
```

### Source Code (repository root)

```
src/game/
├── turn/types.ts             ~ paused: boolean → PauseState | null
├── commands.ts               ~ pause/resume ganham causa e instante; applyResume calcula o intervalo
└── setup.ts                  ~ estado inicial: paused: null

src/net/
├── transport.ts              ~ porta: onStatus, onPresenceSync, JoinRequest.reentryCode, JoinError 'bad-code'
├── durableWrites.ts          + decorator: fila serializada, monotônica, com retry e esgotamento
├── localTransport.ts         ~ status, presence sync, faltas injetáveis no hub
├── supabaseTransport.ts      ~ re-track na reassinatura, status, presence sync, migração de snapshot legado
├── supabaseClient.ts         ~ monta o transporte já embrulhado no decorator
├── host.ts                   ~ reconciliação de presença, pausa por causa, pausa por persistência
├── client.ts                 ~ resync com backoff, estado de conexão, reentrada por código
├── room.ts                   ~ Seat.reentryCode, reattachByCode
├── roomSession.ts            ~ fase 'reentry', escada de entrada com código
├── roomStore.ts              ~ connection: ConnectionState
├── connectStore.ts           ~ espelha a conexão no store
├── localView.ts              ~ desconectado não pode agir (FR-007)
└── ui/
    ├── ConnectionBanner.tsx  + aviso de desconexão própria
    ├── PauseBanner.tsx       ~ nomeia a causa; visível sem ausentes
    ├── LobbyScreen.tsx       ~ ReentryForm + código do próprio assento
    └── SessionBadge.tsx      + link + código de reentrada, discreto, durante a partida

supabase/migrations/
└── 0002_snapshot_monotonic.sql  + trigger que ignora escrita regressiva

tests/net/                     ~ harness com faltas; suítes novas; conformidade estendida
tests/e2e/                     + reload no meio de um leilão
```

---

## Decisões de design

### D1 — `paused` muda de tipo, **não** de nome

`state.paused` é lido em ~35 pontos de `src/game/**` — `turnMachine`, `construction`, `trade`, `emprestimos`, `cards/reacao`, `advancePolicy`, `store`, `localView`, views de UI — quase todos na forma `if (state.paused) return state`.

Renomear para `pause` e introduzir `isPaused(state)` seria mais bonito e custaria a reescrita desses 35 pontos em dez arquivos do motor — **exatamente os arquivos que a spec 040 está editando agora**. O ganho é estético; o custo é um conflito de merge em cada ponto de emissão de log.

Então o campo continua se chamando `paused` e passa a valer `PauseState | null`. Todo `if (state.paused)` segue correto por truthiness, sem uma linha de diff. Mudam só os pontos que **produzem** ou **tipam** o valor:

- `commands.ts` — os casos `pause`/`resume` e `applyResume`
- `setup.ts:72` — `paused: false` → `paused: null`
- `client.ts:148` — `paused: () => Boolean(game?.paused)`
- `host.ts` — reescrito de qualquer forma
- os `paused: true` dos testes, que passam por um builder (T004)

O compilador cobra os que faltarem: `PauseState | null` não é atribuível a `boolean`.

### D2 — A causa e o instante vivem **no estado**, não na memória do host

O defeito 4 existe porque `pausedAt` é uma variável local de `createHost`. Qualquer solução que a mantenha fora do estado persistido morre no mesmo reload.

```ts
export type PauseCause = 'disconnect' | 'persistence'
export interface PauseState {
  causes: PauseCause[]  // ordenado, sem duplicata; nunca vazio (vazio = null)
  since: number         // instante em que a PRIMEIRA causa ativa começou
}
```

`since` é o que resolve FR-018 e FR-019 de uma vez: ele não é reiniciado quando uma segunda causa entra, nem quando a primeira sai deixando outra ativa. O intervalo de deslocamento dos prazos é `at - since`, calculado quando a **última** causa se resolve.

### D3 — Pausa e retomada carregam o instante na ação

```ts
| { kind: 'pause';  cause: PauseCause; at: number }
| { kind: 'resume'; cause: PauseCause; at: number }
```

O `at` vem de fora, como `close-land-lots` já faz com `now`. Isso mantém o reducer puro e determinístico no replay do cliente — que é obrigatório, porque o cliente aplica o comando difundido com o `ctx` de replay e **não pode** consultar relógio (`client.ts:32-35` lança de propósito se alguém tentar).

`applyResume` deixa de receber `pausedMs` pronto (que era o buraco: quem calculava era o host, de memória) e passa a derivá-lo do próprio estado: `at - state.paused.since`. O cálculo migra para dentro do reducer, onde os dados são duráveis.

Consequência boa e não óbvia: o teste de deslocamento de prazo (`pause.test.ts:71`) deixa de precisar do host. É um teste de reducer puro.

### D4 — Snapshot legado é normalizado na leitura, no lugar onde isso já acontece

`supabaseTransport.loadSnapshot` já faz `normalizeLog(data.game.log ?? [])`. A migração de `paused: true|false` para `PauseState | null` entra pelo mesmo caminho, num `normalizeSnapshot(game)` que absorve as duas normalizações. Sala salva antes desta spec, com `paused: true`, vira `{ causes: ['disconnect'], since: <updated_at ou 0> }` — a informação de quando não existe, e assumir `0` faria o resume deslocar prazos por 56 anos. Regra: sem `since` confiável, **não desloca** (o `since` recebe o instante da leitura). É a única perda aceita, e só afeta salas criadas antes do deploy.

### D5 — Status de conexão é da **porta**, não de um `setInterval` de heartbeat

A UI precisa saber que a própria sessão caiu (FR-006). A tentação é inventar um heartbeat na camada de cima. Errado: quem sabe disso é o adapter, e o supabase-js já entrega — o callback de `channel.subscribe(cb)` reporta `SUBSCRIBED`, `CHANNEL_ERROR`, `TIMED_OUT`, `CLOSED`.

A porta ganha:

```ts
onStatus(cb: (s: 'connected' | 'reconnecting') => void): Unsubscribe
```

Dois estados, não cinco: para a UI e para o cliente, "não estou conectado agora" é uma coisa só. Mapear os cinco status do Realtime para dois é trabalho do adapter — é exatamente o tipo de detalhe que a porta existe para esconder.

### D6 — O conserto do defeito 1 é separar "promessa resolvida" de "presença anunciada"

`supabaseTransport.connect()` hoje:

```ts
channel.subscribe((status) => {
  if (status === 'SUBSCRIBED' && !subscribed) { subscribed = true; void channel.track({ token }); resolve() }
})
```

Uma flag para duas coisas diferentes. O `resolve()` de uma promessa **deve** rodar uma vez; o `track()` **deve** rodar em toda reassinatura. A correção é ter duas guardas:

```ts
channel.subscribe((status) => {
  if (status === 'SUBSCRIBED') {
    void channel.track({ token })   // toda vez: reassinatura reanuncia presença (FR-001)
    emitStatus('connected')
    if (!resolved) { resolved = true; resolve() }
    return
  }
  emitStatus('reconnecting')
})
```

FR-002 (idempotência) sai de graça: o `track` do mesmo token já é tratado como takeover pela contagem de presenças que a 037 implementou, e takeover não pausa.

### D7 — Reconciliação de presença é **push**, não pull

Para FR-021 o host precisa saber quem está no canal ao reassumir. Um `presenceState()` pull perde a corrida: logo após `SUBSCRIBED`, o estado de presença ainda está chegando. O Realtime tem um evento `sync` justamente para isso, e ele dispara no estado inicial e a cada mudança.

```ts
onPresenceSync(cb: (tokens: ReadonlySet<string>) => void): Unsubscribe
```

O host reconcilia `seats[].connected` contra esse conjunto e **só então** decide pausa (FR-022) — na mesma passada, para não emitir `pause` seguido de `resume` a cada reassunção. O adapter local emite o mesmo evento a partir das conexões vivas do hub; é o que torna FR-021/023 testáveis headless.

### D8 — Durabilidade é um **decorator** de transporte, não código duplicado nos dois adapters

`durableWrites(inner, opts): Transport` embrulha um transporte e substitui `saveSnapshot`/`saveRoom` por uma fila:

- **profundidade 1 com coalescing** — a linha persistida é única e só o estado mais recente importa; enfileirar dez snapshots para gravar dez vezes é desperdício e reordenação esperando acontecer;
- **monotonia em processo** — descarta escrita com `seq` menor que o último aceito;
- **repetição com espera crescente** — `sleep` injetado (`opts.sleep`), tentativas finitas;
- **sinal de esgotamento** — `opts.onExhausted()` e `opts.onRecovered()`, que o host liga à pausa por persistência.

Uma implementação, dois adapters, testável isolada. O alternativo — cada adapter cuidando de si — é como o `takeover: false` fixo chegou à produção.

### D9 — A monotonia também vai para o banco, porque o processo não é a única barreira

O decorator resolve a reordenação **dentro** de um host. Não resolve a escrita atrasada de um host que recarregou: a requisição em voo do processo antigo pode aterrissar depois da do novo e regredir a linha.

`0002_snapshot_monotonic.sql` adiciona um trigger `before update` que transforma escrita regressiva em no-op (`return null` quando `new.seq < old.seq`). Silencioso é o comportamento certo aqui: uma escrita obsoleta não é erro, é ruído. `saveRoom` continua funcionando porque, no upsert parcial, `new.seq` é igual a `old.seq` — a guarda é estritamente `<`.

O `fakeSupabase` implementa a mesma semântica, senão a conformidade prova algo que a produção não faz.

### D10 — A pausa por persistência é circular, e isso está certo

Sequência quando o banco cai: o host aceita um comando → a gravação falha, repete, esgota → `onExhausted` → o host emite `{kind:'pause', cause:'persistence'}` → **essa gravação também vai falhar**.

Não é um problema, é o desenho. O que importa é que nenhum comando de **jogo** avance (garantido pelo `if (state.paused && !SYSTEM_KINDS.has(...))` que já existe em `commands.ts:136`, e pelo gate de `handleSubmit`). A pausa vive na memória do host e nas telas de todos por difusão. Quando o banco volta, a fila drena o estado mais recente — que já **contém** a pausa —, `onRecovered` dispara, o host emite `resume` e essa gravação persiste o estado retomado. Converge.

O que **não** pode acontecer: o host aceitar comandos de jogo nesse intervalo e depois gravar tudo de uma vez como se nada tivesse acontecido. Daí a regra de FR-013 ser "nenhum comando é aceito", e não "as gravações são bufferizadas".

### D11 — Ressincronização com espera, e um estado honesto para a desistência

`client.resync()` ganha:

- backoff com `sleep` injetado e teto de tentativas;
- **uma** ressincronização em voo por vez (hoje cada difusão com lacuna dispara outra — tempestade);
- `drainPending()` ao final, que hoje falta;
- ao esgotar: estado `desynced`, notificado à UI, em vez do `return` mudo de `client.ts:82`.

E o gancho novo: ao receber `onStatus('connected')` depois de um `'reconnecting'`, o cliente ressincroniza — é assim que ele recupera as difusões perdidas durante a queda (FR-003).

### D12 — O código de reentrada é mintado pelo chamador, para `room.ts` continuar puro

`room.ts` não tem RNG e não deveria ganhar um. `createRoom(id, host, code)` e `joinRoom(room, who, code)` recebem o código pronto; quem minta é quem já tem RNG (o host) ou o `roomSession` na criação. Os testes passam códigos fixos e ficam determinísticos sem mock.

`reattachByCode(room, code, token)` é o reducer puro da reanexação: acha o assento pelo código, troca o `token`, marca conectado. `kickSeat` e `shuffleSeatOrder` preservam `reentryCode` — a reindexação de `playerId` não pode reciclar código (FR-025).

No transporte, a reentrada **não** é uma mensagem nova: `JoinRequest` ganha `reentryCode?`. Com ele presente, o host toma o caminho `reattachByCode` em vez de `joinRoom`, e o gate de `already-started` não se aplica. Uma mensagem a menos na porta, um caminho a menos para divergir entre adapters.

### D13 — Onde a UI mostra a conexão, e por que não no `PauseBanner`

São dois fatos diferentes: *"a mesa está parada"* (todos veem, vem do estado da partida) e *"eu não estou na mesa"* (só eu vejo, vem da casca de rede). Empilhar os dois no mesmo componente força um a mentir — o `PauseBanner` desenha a partir de `game.paused`, que é justamente o que não chega a quem caiu.

`ConnectionBanner` é um componente novo, alimentado por `roomStore.connection`, e não lê `GameState`. O `PauseBanner` muda só para nomear a causa e para deixar de sumir quando não há ausentes (`PauseBanner.tsx:23` — hoje uma pausa por persistência seria invisível).

FR-007 (controles inertes) entra por `localView.ts`, que já é o ponto único de "posso agir?" da spec 038: `mayAct` passa a exigir conexão. Nenhum componente precisa saber disso individualmente.

### D14 — O harness precisa saber falhar, e essa é a entrega mais durável desta spec

`tests/net/harness.ts` e `LocalHub` ganham falta injetável:

| Falta | Prova |
|---|---|
| derrubar/restaurar canal de um token (sem takeover) | FR-001/003, SC-001 |
| perder difusões de um token (já existe `dropped`) | FR-003, lacuna de sequência |
| recusar gravação N vezes / sempre | FR-012/013, SC-003 |
| entregar gravações fora de ordem | FR-011, SC-004 |
| recusar leitura de snapshot | FR-004/005 |

O `fakeSupabase` ganha os equivalentes de gravação e de status de canal, porque FR-033 cobra os dois adapters — e o defeito 1 desta spec **é** um defeito que só existe no adapter de produção. Se a conformidade não o alcançar, ele volta.

### D15 — Ordem de implementação: cinco movimentos, cada um verde

| # | Movimento | Por que nesta posição |
|---|---|---|
| 1 | Pausa com causa (motor + normalização) | Muda um tipo lido por todo o motor. Isolar o barulho do compilador num movimento só, antes de qualquer lógica nova. |
| 2 | Porta + faltas no harness | Nada dos movimentos 3–5 é testável sem isto. É a fundação da prova. |
| 3 | Durabilidade e presença (decorator, adapters, host, cliente) | O grosso do conserto. Depende de 1 (causa da pausa) e de 2 (como provar). |
| 4 | Superfície local (conexão, causa no banner, `mayAct`) | Depende de 3 expor o estado de conexão. |
| 5 | Reentrada por código (D-033) | Independente dos anteriores por desenho; vem por último para não misturar regra nova com endurecimento. |
| 6 | E2E de reload | Fecha SC-009; só faz sentido com 1–4 prontos. |

**Cada movimento termina com a suíte inteira verde.** O movimento 1 é o único que quebra muita coisa de uma vez, e é por isso que vem sozinho.

### D16 — O que esta spec **não** faz, apesar de encostar

- **Não** amarra identidade à conexão no transporte. O anti-spoof do adapter de produção continua confiando no token auto-declarado do payload, como `supabaseTransport.ts:16-19` já documenta. É trabalho de Edge Function e decisão de arquitetura própria — e D-033 registra explicitamente que não pode servir de desculpa para adiá-lo.
- **Não** transfere autoridade. Host fora segue pausando indefinidamente (§16, D-020).
- **Não** cria timeout de coisa nenhuma. Toda espera é indefinida, por princípio.
- **Não** limpa salas velhas. É rotina de servidor, não resiliência de sessão.

---

## Complexity Tracking

| Custo assumido | Alternativa mais simples | Por que não |
|---|---|---|
| Um campo de estado com forma nova (`PauseState`) | Manter `paused: boolean` e guardar a causa fora do estado | O instante de início **precisa** ser durável (FR-019) — foi a memória volátil que criou o defeito 4. Guardar fora do snapshot repete o erro com outro nome. |
| Decorator de transporte a mais na cadeia | Fila dentro de cada adapter | Duas implementações da mesma garantia é como a porta já divergiu uma vez (`takeover`). |
| Trigger SQL além da guarda em processo | Só a guarda em processo | Não cobre a escrita em voo de um host que recarregou — exatamente o cenário que a spec existe para fechar. |
| Um componente de UI a mais (`ConnectionBanner`) | Estender o `PauseBanner` | O `PauseBanner` lê o estado da partida, que não chega a quem está desconectado. Um componente que não pode renderizar no caso que importa. |
| Faltas injetáveis no harness | Testar só o caminho feliz | É a causa-raiz dos sete defeitos: a rede de teste nunca falhou. Sem isto, a spec conserta hoje e regride depois. |
