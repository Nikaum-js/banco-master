# Tasks: Resiliência de sessão — a partida sobrevive à rede

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Modelo**: [data-model.md](./data-model.md) · **Contrato**: [contracts/transport.md](./contracts/transport.md)

Legenda: `[P]` = paralelizável (arquivo independente) · `[USn]` = user story da spec · `[test-first]` = o teste vem antes do código.

**Testes**: obrigatórios. **Test-first onde há comportamento já provado** — pausa (037), reconexão (037), perspectiva (038) têm suíte, e é ali que uma regressão passa calada.

**A ordem em 6 fases é o desenho, não burocracia** (D15 do plan). A Fase 1 é a única que quebra muita coisa de uma vez — um tipo lido em ~35 pontos do motor — e vem sozinha de propósito, para o barulho do compilador aparecer isolado de qualquer lógica nova. **Cada fase termina com a suíte inteira verde.**

**A promessa a vigiar**: nenhuma regra de jogo muda. Se durante a implementação um reducer de jogo passar a decidir algo com base em causa de pausa, estado de conexão ou código de reentrada, **parar** — o desenho saiu do lugar. A única coisa que o motor aprende nesta spec é *quando* está parado e *desde quando*.

**O oráculo a preservar**: as 19 suítes de `tests/net/` passam hoje. Elas são a definição de "não regredi". Nenhuma delas pode ser afrouxada para acomodar a mudança de tipo — adaptar a montagem do estado é legítimo, enfraquecer a asserção não é.

**Paralelismo com a spec 040**: nada aqui abre `src/game/log.ts`, os pontos de emissão de log, `src/game/ui/log/`, `CenterLog`, `sound/classify.ts` ou `src/lib/money.ts`. Um único ponto de contato: `tests/game/emprestimos/emprestimos.test.ts:69` (T006), que a 040 já modificou.

---

## Fase 1 — A pausa ganha causa e relógio (bloqueia tudo)

**Meta**: o tipo novo entra, o motor volta ao verde, nada de comportamento novo funciona ainda.

- [ ] **T001** `src/game/turn/types.ts`: `PauseCause`, `PauseState` e `paused: PauseState | null` conforme [data-model §1](./data-model.md#1-pausestate--a-pausa-ganha-causa-e-relógio). **O nome do campo não muda** — é o que preserva os ~35 `if (state.paused)` do motor sem uma linha de diff (D1 do plan).
- [ ] **T002** `src/game/commands.ts`: `pause`/`resume` ganham `cause` e `at`; os dois reducers seguem as tabelas de [data-model §2](./data-model.md#2-ações-de-pausa--o-instante-entra-pela-ação). `applyResume` deixa de receber `pausedMs` e passa a derivá-lo de `at - state.paused.since` — **é aqui que o defeito 4 morre**: o número passa a vir de dado durável, não da memória do host.
- [ ] **T003** [P] `src/game/setup.ts:72`: `paused: null`.
- [ ] **T004** [P] `tests/net/harness.ts`: helper `pausedBy(cause, at?)` que monta um `PauseState`, exportado para as suítes de `tests/game/` e `tests/net/` usarem no lugar de `paused: true`. Um lugar só — doze literais espalhados envelhecem em doze velocidades.
- [ ] **T005** [test-first] `tests/game/turn/pause.test.ts`: as sete invariantes de [data-model §1](./data-model.md#1-pausestate--a-pausa-ganha-causa-e-relógio) como teste de **reducer puro**, sem host: pausa dupla é no-op; segunda causa não reinicia `since`; retomar causa ausente é no-op; retomar com causa restante **não** desloca prazo; retomar a última desloca por `at - since`; `null` ⟺ sem causa; round-trip JSON.
- [ ] **T006** Migrar os literais `paused: true` das suítes existentes para o helper de T004 — `tests/game/economy/predicados.test.ts:28,127`, `negociacao.test.ts:58`, `tests/game/turn/advancePolicy.test.ts:67`, `turnMachine.test.ts:72`, `tests/game/emprestimos/emprestimos.test.ts:69`, `tests/game/busticket/busticket.test.ts:64`, `tests/game/ui/diceArenaView.test.ts:43`, `tests/net/commands.test.ts:38,61`, `tests/net/localView.test.ts:128`. **Adaptar a montagem, nunca a asserção.** ⚠️ `emprestimos.test.ts` está na árvore de trabalho da spec 040 — conflito de uma linha, resolver na integração.
- [ ] **T007** [P] Coerções de fronteira: `src/net/client.ts:148` (`paused: () => Boolean(game?.paused)`) e o que mais o compilador apontar como `PauseState | null` onde se espera `boolean`. Deixar o compilador dirigir — a lista acima é o esperado, não o exaustivo.
- [ ] **T008** `src/net/host.ts`: adaptar `syncPause` ao tipo novo emitindo `cause: 'disconnect'` e `at: now()`, e **remover `pausedAt`** (linhas 52/135/138-139). A variável morre aqui; o `since` do estado a substitui.

**Checkpoint**: `bun run typecheck` e a suíte inteira verdes. `tests/net/pause.test.ts:71` (deslocamento de prazo) deve continuar passando — agora sem depender do host.

---

## Fase 2 — A porta cresce e o harness aprende a falhar (bloqueia 3–5)

**Meta**: existir como reproduzir cada uma das sete falhas. Nenhum conserto ainda.

- [ ] **T009** `src/net/transport.ts`: `onStatus`, `onPresenceSync`, `JoinRequest.reentryCode?`, `JoinError` com `'bad-code'` — conforme [contracts/transport.md](./contracts/transport.md) §§1–3. Documentar no cabeçalho, junto das garantias que a porta **não** dá.
- [ ] **T010** `src/net/localTransport.ts` + `LocalHub`: implementar `onStatus`/`onPresenceSync` e adicionar as faltas injetáveis de [D14 do plan](./plan.md#d14--o-harness-precisa-saber-falhar-e-essa-é-a-entrega-mais-durável-desta-spec) — derrubar/restaurar canal de um token **sem** contar como takeover, recusar gravação (N vezes ou sempre), entregar gravações fora de ordem, recusar leitura de snapshot. A perda de difusão (`dropped`) já existe.
- [ ] **T011** [P] `tests/net/fakeSupabase.ts`: os equivalentes — status de canal (incluindo **reassinatura**, que é o cenário do defeito 1), presence sync, falha de gravação/leitura e a guarda monotônica do banco. Sem isto, FR-033 não tem como ser cumprido no adapter que roda em produção.
- [ ] **T012** [US1] `src/net/supabaseTransport.ts`: **o conserto do defeito 1** — separar a guarda de `resolve()` da guarda de `track()`, conforme [D6 do plan](./plan.md#d6--o-conserto-do-defeito-1-é-separar-promessa-resolvida-de-presença-anunciada). Reassinatura reanuncia presença e emite `'connected'`; qualquer outro status emite `'reconnecting'`. Implementar `onPresenceSync` sobre o evento `sync` do Realtime (ampliar `SupabaseChannelLike`).
- [ ] **T013** [test-first] `tests/net/conformance.test.ts`: os casos de §1 e §2 do contrato, **nos dois adapters** — queda emite `reconnecting`; restabelecimento emite `connected`; reassinatura **reanuncia presença**; conjunto de presença completo após conectar, com dois participantes, e sem quem saiu; dois assinantes; desassinatura isolada.
- [ ] **T014** `tests/net/harness.ts`: expor as faltas no `NetGame` (`net.dropChannel(playerId)`, `net.restoreChannel(playerId)`, `net.failWrites(n | 'always')`, `net.reorderWrites()`), para as suítes das fases 3–5 escreverem cenário em vez de encanamento.

**Checkpoint**: a conformidade cobre o transporte novo nos dois adapters e **falha** contra o `supabaseTransport` de antes de T012. Se não falhar, o teste não está provando o defeito.

---

## Fase 3 — Durabilidade e autoridade (o grosso do conserto)

**Meta**: nada avança sem estar gravado; a autoridade que volta enxerga a mesa real; o cliente dessincronizado se recupera ou se declara.

- [ ] **T015** [US3] [test-first] `tests/net/durableWrites.test.ts`: as seis invariantes de [data-model §5](./data-model.md#5-fila-de-gravação--durabilidade-d-034) — uma escrita em voo; coalescing guarda **uma**; `seq` menor é descartado sem tentativa; `onExhausted` **uma vez por episódio**; `onRecovered` só depois de esgotar; nenhuma rejeição sem tratamento. `sleep` injetado — o teste não espera de verdade.
- [ ] **T016** [US3] `src/net/durableWrites.ts`: o decorator conforme [D8 do plan](./plan.md#d8--durabilidade-é-um-decorator-de-transporte-não-código-duplicado-nos-dois-adapters). Uma implementação para os dois adapters — a alternativa é como o `takeover` divergiu.
- [ ] **T017** [P] [US3] `supabase/migrations/0002_snapshot_monotonic.sql`: trigger `before update` que devolve `null` quando `new.seq < old.seq`. Estritamente `<`, para não bloquear o upsert parcial de `saveRoom`. `search_path` fixo em vazio e `security invoker`, como a `touch_rooms_updated_at` da 0001 — o linter do Supabase cobra isso.
- [ ] **T018** [US3] `tests/net/conformance.test.ts`: §4 do contrato nos dois adapters — falha transitória se recupera na repetição; falha persistente chama `onExhausted` uma vez; volta chama `onRecovered`; escrita com `seq` menor não regride o que `loadSnapshot` devolve; duas escritas cruzadas deixam gravada a mais recente (**SC-004**).
- [ ] **T019** [US3] `src/net/supabaseClient.ts`: `createSupabaseTransport` devolve o adapter **já embrulhado** em `durableWrites`. É o único ponto de montagem de produção; embrulhar em qualquer outro lugar deixa um caminho cru vivo.
- [ ] **T020** [US3] `src/net/host.ts`: ligar `onExhausted`/`onRecovered` a `pause('persistence')`/`resume('persistence')`. Documentar a circularidade de [D10 do plan](./plan.md#d10--a-pausa-por-persistência-é-circular-e-isso-está-certo) no código — a própria gravação da pausa falha, e isso é o desenho, não um bug a "consertar" depois.
- [ ] **T021** [US1] `src/net/host.ts`: reconciliação de presença em `open()` — assinar `onPresenceSync`, sobrescrever `seats[].connected` pelo conjunto observado e **só então** chamar `syncPause` (FR-021/022). Remove a confiança nos `connected` do snapshot (`host.ts:168`), que são um retrato de antes da queda.
- [ ] **T022** [US1] [test-first] `tests/net/authority-reassume.test.ts`: as quatro combinações — ninguém mudou; alguém saiu durante a ausência do host (**pausa nomeando essa pessoa**); alguém voltou durante a ausência (**não** fica pausada); ambos. Mais: reassumir **não** emite `pause` seguido de `resume` (FR-022) — asserção sobre a sequência de comandos difundidos, não sobre o estado final.
- [ ] **T023** [US1] `src/net/client.ts`: `resync` com backoff (`sleep` injetado), **uma em voo por vez**, `drainPending()` ao final (falta hoje), e `'desynced'` ao esgotar em vez do `return` mudo de `client.ts:82`. Ressincronizar ao receber `onStatus('connected')` depois de `'reconnecting'` — é assim que as difusões perdidas na queda são recuperadas (FR-003).
- [ ] **T024** [US1] [test-first] `tests/net/resync.test.ts`: queda e volta de canal recupera e converge (**SC-001**); leitura falhando repete com espera e **não** entra em laço; esgotamento vira `'desynced'`; difusão chegada durante a ressincronização é aplicada em ordem, não descartada.
- [ ] **T025** [P] `src/net/supabaseTransport.ts`: `normalizeSnapshot` absorvendo `normalizeLog` e a migração de `paused` legado conforme [data-model — Migração](./data-model.md#migração-de-dados). `since` recebe o instante da **leitura**, nunca `0` — um deadline deslocado por 56 anos é pior que um leilão sem o bônus da pausa.
- [ ] **T026** [P] `tests/net/snapshot-legacy.test.ts`: linha com `paused: true` vira `{ causes: ['disconnect'], since: <leitura> }`; `paused: false` e ausente viram `null`; o log continua normalizado (não regredir o que a 021/040 garantem).

**Checkpoint**: **SC-001**, **SC-003**, **SC-004**, **SC-006** provados headless nos dois adapters.

---

## Fase 4 — A tela conta a verdade sobre a minha conexão

**Meta**: quem caiu sabe que caiu, não age no vazio, e a pausa nomeia a causa.

- [ ] **T027** [US2] `src/net/roomStore.ts`: campo `connection: ConnectionState` conforme [data-model §4](./data-model.md#4-connectionstate--a-conexão-da-própria-sessão), com `'connected'` como valor inicial.
- [ ] **T028** [US2] `src/net/client.ts` + `src/net/connectStore.ts`: o cliente expõe `connection()`; o `sync` do `connectStore` a espelha no `roomStore`. `reconnecting → connected` **só depois** da ressincronização — declarar-se conectado antes mostra estado velho como atual.
- [ ] **T029** [US2] `src/net/localView.ts`: `mayAct` exige conexão (FR-007). Ponto único de "posso agir?" desde a 038 — nenhum componente precisa saber disso sozinho.
- [ ] **T030** [US2] [test-first] `tests/net/localView.test.ts`: desconectado não pode acionar **nenhum** ponto de decisão, inclusive os que não dependem da vez (lance de leilão, resposta a proposta, reação) — o teste de exaustividade que já existe ali é o lugar certo para cobrar isso.
- [ ] **T031** [US2] `src/net/ui/ConnectionBanner.tsx`: aviso de desconexão própria, alimentado pelo `roomStore`, **sem** ler `GameState` (D13 do plan). Sem contagem regressiva e sem ação destrutiva (FR-009). Estado `'desynced'` tem texto próprio: reconectado, mas ainda reconciliando. Montar em `src/App.tsx`, ao lado do `PauseBanner`.
- [ ] **T032** [US3] `src/net/ui/PauseBanner.tsx`: nomear a causa e **deixar de sumir sem ausentes** (`PauseBanner.tsx:23` — hoje uma pausa por persistência é invisível). Com as duas causas ativas, a frase nomeia as duas; a promessa "nada se perde" continua, porque com esta spec ela finalmente é verdade.
- [ ] **T033** [P] `tests/net/pause-view.test.ts`: a frase do banner por combinação de causa (só desconexão / só persistência / ambas / host fora), e o banner de conexão por estado. Testar a **view**, não o DOM — mesma abordagem dos `*View` da 038.

**Checkpoint**: **SC-002** provado. Não existe estado em que a tela mostre a partida como normal enquanto a sessão está fora.

---

## Fase 5 — Reentrada por código (D-033)

**Meta**: perder o aparelho deixa de travar a mesa.

- [ ] **T034** [US5] `src/net/room.ts`: `Seat.reentryCode`; gerador `newReentryCode(rng, taken)` (alfabeto sem ambiguidade visual, unicidade na sala); `createRoom`/`joinRoom` recebem o código **pronto** do chamador (D12 do plan — `room.ts` continua puro); `kickSeat` e `shuffleSeatOrder` **preservam** os códigos dos assentos que ficam; `reattachByCode(room, code, token)` conforme [data-model §3](./data-model.md#3-seatreentrycode--credencial-de-recuperação-d-033), comparando sem caixa e sem espaços.
- [ ] **T035** [US5] [test-first] `tests/net/reentry.test.ts` (parte pura): código preservado pelo sorteio de ordem e pela remoção de outro assento; código de removido deixa de valer; `reattachByCode` troca o token e mantém tudo o mais; código inválido recusa; unicidade na sala.
- [ ] **T036** [US5] `src/net/host.ts`: em `handleJoinRequest`, `reentryCode` presente toma o caminho `reattachByCode` — **sem** o gate de `already-started` —, republica a sala e deixa `syncPause` retomar se aquela era a última ausência (FR-028). Código inválido recusa com `'bad-code'`.
- [ ] **T037** [US5] `src/net/roomSession.ts`: fase `'reentry'`. `enter()` com partida em curso e sem assento deixa de ser beco (`fail('already-started')`) e passa a oferecer o código; `requestReentry(code)` submete. Recusa por `'bad-code'` volta ao formulário, legível, sem sair da tela.
- [ ] **T038** [US5] `src/net/ui/LobbyScreen.tsx` + `src/net/ui/SessionBadge.tsx`: formulário de reentrada; código do próprio assento visível no lobby **e** durante a partida (FR-030) — quem nunca o anotou precisa conseguir lê-lo antes de precisar dele. Discreto: link e código no mesmo lugar, recolhido por padrão.
- [ ] **T039** [US5] `tests/net/reentry.test.ts` (parte de sessão): reentrada por outro token no meio da partida devolve o assento com estado íntegro (**SC-007**); o token antigo perde o assento (FR-027); a reanexação retoma a partida se era a última ausência; eliminado que reentra não destrava nem trava nada (D-029).
- [ ] **T040** [P] [US5] `tests/net/conformance.test.ts`: §3 do contrato — pedido com `reentryCode` chega ao host com o token da **conexão**; recusa `'bad-code'` volta só ao pedinte.

**Checkpoint**: **SC-007** provado. Nenhum cenário de assento irrecuperável resta.

---

## Fase 6 — Prova em browser real e fechamento

- [ ] **T041** [US4] `e2e/multiplayer.spec.ts`: teste novo — dois browsers, abrir um leilão, **recarregar a página do host** com o prazo correndo, reconectar e conferir que o leilão continua vivo com o tempo restante preservado e o estado íntegro (**SC-005**, **SC-009**). Vizinho do teste de pausa que já existe ali (linha 109).
- [ ] **T042** [P] `docs/MILESTONES.md`: marcar o item 4 do M3 (Sessão & Resiliência) e registrar o que ficou fora — endurecimento de identidade de transporte segue pendente e **não** foi resolvido por esta spec.
- [ ] **T043** Fechamento: `bun run lint`, `bun run typecheck`, suíte completa, `bun run test:e2e`. **SC-010** — nenhuma regressão nas 19 suítes de `tests/net/` nem no smoke existente.

---

## Rastreabilidade

| Requisito | Tasks |
|---|---|
| FR-001/002 (reanunciar presença na reassinatura) | T012, T013 |
| FR-003/004/005 (ressincronizar, backoff, desistir honesto) | T023, T024 |
| FR-006..009 (conexão local, controles inertes, aviso) | T027–T033 |
| FR-010..015 (gravação serializada, monotônica, com retry) | T015–T020, T017 |
| FR-016..020 (pausa com causa, `since` durável, banner) | T001, T002, T005, T008, T020, T032 |
| FR-021..023 (autoridade reassumida vê a mesa real) | T021, T022 |
| FR-024..031 (reentrada por código) | T034–T040 |
| FR-032/033 (harness que falha, conformidade nos dois adapters) | T010, T011, T013, T014, T018, T040 |
| FR-034 (prova em browser real) | T041 |
| Migração de snapshot legado | T025, T026 |
