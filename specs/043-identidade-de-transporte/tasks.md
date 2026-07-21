# Tasks: Endurecimento de identidade de transporte

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Modelo**: [data-model.md](./data-model.md) · **Contratos**: [contracts/transport.md](./contracts/transport.md), [contracts/policies.md](./contracts/policies.md)

Legenda: `[P]` = paralelizável (arquivo independente) · `[USn]` = user story da spec · `[test-first]` = o teste vem antes do código.

**Testes**: obrigatórios. **Test-first onde a garantia é negativa** — "o ataque não funciona" é a classe de asserção que passa por acidente quando escrita depois do conserto. Todo caso de recusa entra antes do código que recusa, e precisa **falhar** contra o estado atual.

**A ordem em 6 fases é o desenho, não burocracia** ([D14 do plan](./plan.md#d14--ordem-de-implementação-seis-movimentos-cada-um-verde)). A Fase 5 é a única que toca o motor e vem depois de tudo o que pode ser provado sem ela, de propósito. **Cada fase termina com a suíte inteira verde.**

**A promessa a vigiar**: nenhuma regra de jogo muda. Se durante a implementação um reducer passar a decidir algo com base em quem está olhando, **parar** — o desenho saiu do lugar. A única coisa que o motor aprende nesta spec é que um slot de carta pode não ser dele.

**O oráculo a preservar**: 80 suítes passam hoje (24 em `tests/net/`, 47 em `tests/game/`, o resto em UI/lib), mais o E2E de `e2e/`. Elas são a definição de "não regredi". Na Fase 1 os renomes são mecânicos e a asserção não muda; na Fase 5 a montagem do estado pode mudar, **a asserção não**.

**Infra viva**: nada é aplicado no projeto `edppdqrkqljhjkbyjvsz` antes da Fase 6, e a aplicação pede confirmação explícita (FR-030). Até lá tudo roda contra `fakeSupabase` e o hub local.

---

## Fase 1 — A identidade passa a ser emitida (bloqueia tudo)

**Meta**: o `uid` do servidor substitui o token auto-declarado em todo lugar. Topologia inalterada, comportamento inalterado — só a origem do valor muda.

- [X] **T001** [US1] `src/net/session.ts`: remover `getSessionToken()` e o `TOKEN_KEY`. `roomLink`/`parseRoomLink`/`extractRoomId`/`newRoomId` ficam — são links, não identidade. Documentar no cabeçalho por que o UUID de `localStorage` morreu: quem persiste sessão entre reloads agora é o supabase-js, e é essa persistência que sobrevive ao F5.
- [X] **T002** [US1] `src/net/supabaseClient.ts`: `ensureSession()` (`getSession()` ?? `signInAnonymously()`) seguido de `supabase.realtime.setAuth()`, **antes** de montar o transporte. `createSupabaseTransport` passa a ser assíncrona e recebe o `uid` da sessão. Estender `describeInfraError` com o caso "sessões anônimas desabilitadas no projeto" — mensagem acionável, como já é o da migration ausente (FR-032). `isSupabaseConfigured()` continua sendo o portão: sem ambiente configurado, nenhuma sessão é criada e o app segue single-player (FR-031).
- [X] **T003** [US1] `src/net/room.ts`: `Seat.token` → `Seat.uid`, `seatByToken` → `seatByUid`, `Identity.token` → `Identity.uid`, conforme [data-model §1](./data-model.md#1-identidade). Rename, não alias: neste projeto "token" já é a peça visual do jogador (§12.5).
- [X] **T004** [P] [US1] `src/net/transport.ts`: `Transport.token` → `uid`, `PresenceChange.token` → `uid`. Atualizar o cabeçalho da porta — o comentário do `CommandEnvelope` ("o host confere contra a identidade real da conexão") deixa de ser aspiração e passa a ser descrição.
- [X] **T005** [US1] Propagar os renomes onde o compilador apontar: `host.ts`, `client.ts`, `roomSession.ts`, `roomStore.ts`, `connectStore.ts`, `localView.ts`, `ui/**`. Deixar o compilador dirigir — a lista é o esperado, não o exaustivo.
- [X] **T006** [P] [US1] `src/net/localTransport.ts` + `LocalHub`: idem, e o hub passa a tratar a identidade como propriedade da **conexão** (já era, de fato — agora fica explícito no nome).
- [X] **T007** [US1] `src/net/supabaseTransport.ts`: chave de presença passa a ser o `uid`; o campo `token` sai do payload de `submit` e de `join` — **sem ainda mudar a topologia**. Neste ponto o adapter deixa de declarar identidade e passa a não ter nenhuma: é intencional, e a Fase 2 devolve pelo endereço.
- [X] **T008** Renomes mecânicos nas 24 suítes de `tests/net/`. **Adaptar a montagem, nunca a asserção.**

**Checkpoint**: `bun run typecheck` e as 80 suítes verdes. Nenhum comportamento novo; `tests/net/antispoof.test.ts` continua passando pelo mesmo motivo de antes.

---

## Fase 2 — Três tópicos, e o remetente vira endereço (bloqueia 3–6)

**Meta**: o servidor passa a saber quem pode escrever o quê. É a fase que fecha os vetores 1–4.

- [X] **T009** [US1] [US2] `supabase/migrations/0003_attested_identity.sql` — primeira metade: `delete from public.rooms`, coluna `secrets jsonb`, `drop policy` das três políticas `true` da `0001` e as novas políticas de tabela, mais as políticas de `realtime.messages` para as três classes de tópico ([contracts/policies.md §§2–3](./contracts/policies.md)). `security definer` com `search_path` fixo em vazio onde houver função — o linter 0011 cobra. **Não aplicar em projeto nenhum ainda.**
- [X] **T010** [US1] [US2] `src/net/transport.ts`: `onSubmit(cb: (cmd, fromUid) => void)` documentado como "vem do canal, não do conteúdo"; `broadcastPrivate(uid, cmd)`; `watchSeat`/`unwatchSeat(uid)` entram (a assinatura do tópico privado — necessária para o host observar cada assento sob a nova topologia; não estava explícita no contrato original). **Desvio deliberado**: `requestJoin` continua `void` e `reattach(roomId, code)` não entra ainda — ambos dependem das RPCs `request_seat`/`reattach_by_code`, que são Fase 3 (T016/T018); adicioná-los agora deixaria API sem corpo funcional real.
- [X] **T011** [test-first] [US1] [US2] `tests/net/conformance.test.ts`: casos de recusa nos dois adapters — `asHost()` estabelece a autoridade via sala persistida; sem `watchSeat`, submit/presença de um assento não observado não chega ao host; `broadcast`/`publishRoom`/`rejectJoin` por não-autoridade não alcançam ninguém; `broadcastPrivate` alcança só o alvo. **Desvio deliberado**: `requestJoin`/reentrada por código continuam cobertos só no `localTransport` (`skipIf` no Supabase) — D4 do plan explica que o host não tem como assinar o tópico de um assento que ainda não existe; a cobertura simétrica volta na Fase 3.
- [X] **T012** [US1] [US2] `src/net/supabaseTransport.ts`: três canais (`:lobby`, `:play`, `:s:<uid>`), todos `private: true`. `onSubmit` deriva o remetente do binding do canal do assento. O host assina um tópico por assento via `watchSeat` e **não** chama `track()` neles — assim a presença observada ali é só a do dono ([D2/D3 do plan](./plan.md#d2--três-classes-de-tópico-cada-uma-com-uma-pergunta-diferente-para-o-servidor)).
- [X] **T013** [P] [US2] `src/net/localTransport.ts`: paridade de recusa ([D12 do plan](./plan.md#d12--paridade-o-hub-local-passa-a-recusar-o-que-o-servidor-recusaria)) — `broadcast`/`publishRoom`/`rejectJoin`/`broadcastPrivate` só têm efeito vindos de quem é `isHost` na sala persistida; `onSubmit`/`onPresence`/`onPresenceSync` são recortados por `watchSeat`/`unwatchSeat`, espelhando o canal por assento do adapter real.
- [X] **T014** [P] [US2] `tests/net/fakeSupabase.ts`: roteamento por TÓPICO (não mais um barramento único por sala) e simulação da política de escrita (`lobby`/`play` só a autoridade; assento só o dono ou a autoridade) — deriva "quem é a autoridade" da última linha upada em `rooms`, como a política SQL real faria. Não substitui a prova real (Fase 6) — cobre o caminho do código, não a regra do Postgres.
- [X] **T015** [US1] [US2] `src/net/host.ts`: `syncWatchedSeats()` assina o tópico de cada assento ao abrir a sala (reassunção), ao aceitar entrada/reanexar, e dessassina no kick — chamada ANTES de registrar `onPresenceSync`, senão o "estado inicial" que essa assinatura entrega na hora reflete só o próprio uid e dispara um `pause`+`resume` espúrio. `handleSubmit` continua conferindo `senderId` contra o assento (FR-004) — a checagem não sai, ela finalmente se apoia em dado que o remetente não escolhe.

**Checkpoint**: conformidade verde nos dois adapters (62 casos, 3 puladas de propósito no Supabase — ver T011) e as 80 suítes (728 testes) verdes. `tests/net/antispoof.test.ts` continua passando; o caso "forjar o uid e não conseguir nada" agora é estrutural — sem `watchSeat`, não há como o host sequer OBSERVAR um `onSubmit` alheio.

---

## Fase 3 — A escada de entrada sai do canal

**Meta**: pedir assento e reanexar passam a ser atestados pelo servidor. É o que destrava o anfitrião que perdeu o aparelho.

- [X] **T016** [US1] `0003_attested_identity.sql` — segunda metade: `request_seat(room_id, name, color, piece)` e `reattach_by_code(room_id, code)`, ambas `security definer` + `realtime.send()` (o role admin do Realtime, que alcança `:lobby` mesmo sem o pedinte ser a autoridade — RPC não passa pela política de canal do cliente). `request_seat` **não valida regra de sala**. `reattach_by_code` é a **única** regra de domínio em SQL — troca só `uid`/`connected` do assento casado, preserva o resto por construção (FR-027).
- [X] **T017** [test-first] [US1] `tests/net/reentry.test.ts`: reescrito para `Transport.reattach()` (RPC) em vez de `JoinRequest.reentryCode`. Reanexação com a autoridade **fora do ar** funciona (host nunca processa nada — só a linha persistida importa); reanexar o assento do **anfitrião** devolve a autoridade a ele (achado: `playerId` do host não é `'p1'` fixo — `startMatch` sorteia ordem de turno por cima da ordem de entrada, FR-030); código inválido recusa com `'bad-code'`; o vínculo antigo para de agir pelo assento.
- [X] **T018** [US1] `src/net/supabaseTransport.ts`: `requestJoin`/`reattach` por RPC (`supabase.rpc(...)`); `SupabaseLike` ganha `.rpc()`. `supabaseClient.ts` não precisa mudar — a RPC entra pelo `supabase` já injetado.
- [X] **T019** [US1] `src/net/transport.ts`: `JoinRequest.reentryCode` sai (o campo vivia na porta, não em `room.ts` — a tarefa original mirou o arquivo errado). `reattachByCode` **fica** em `room.ts` como espelho testado — `LocalHub.reattachByCodeRpc` chama esse MESMO reducer puro, e é o que o adapter local exercita.
- [X] **T020** [US1] `src/net/host.ts`: `handleJoinRequest` perde o ramo de reanexação; `handleSeatReattached` (assinado via `onReattachNotice`) recarrega a sala com `loadRoom()`, reconcilia os tópicos observados e republica. `syncPause` depois continua sendo o que retoma a partida se aquela era a última ausência (FR-028 da 041).
- [X] **T021** [US1] `src/net/roomSession.ts`: `requestReentry` chama `transport.reattach()` direto (não mais `client.requestJoin`); sucesso não precisa tocar `phase`/`room` — `client.ts` reage sozinho ao `onReattachNotice` (ressincroniza, descobre o próprio assento) e `syncFromClient` segue a fase dali. A fase `'reentry'` e o formulário de código da 041 seguem intactos na superfície.

**Checkpoint**: `reentry.test.ts` (14 casos), `lobby.test.ts`, `kick.test.ts`, `boot.test.ts` e as 80 suítes (728 testes) verdes. Um convidado e o anfitrião reentram pelo **mesmo** caminho (RPC).

---

## Fase 4 — O segredo do assento para de trafegar

**Meta**: o código de reentrada vira segredo do dono sem perder a funcionalidade que motivou a D-033.

- [X] **T022** [US4] `0003_attested_identity.sql`: `room_preview(room_id)` — assentos sem `reentryCode`, **exceto** o do assento de quem chamou ([contracts/policies.md §4](./contracts/policies.md)).
- [X] **T023** [test-first] [US4] `tests/net/seat-secrets.test.ts`: nada do que chega a um cliente contém código alheio — nem na sala publicada, nem na prévia, nem no estado lido (`loadSnapshot`, redigido no cliente até a Fase 5 trazer `read_snapshot`); e o dono continua obtendo o seu. Varredura no payload inteiro (`JSON.stringify` + `toContain`). **Achado real**: `Room` é estruturalmente um superconjunto de `PublicRoom` — TS não barra passar a linha inteira pra `publishRoom` por engano — então a redação roda TAMBÉM dentro dos dois adapters (defesa em profundidade), não só em `host.ts`.
- [X] **T024** [US4] `src/net/room.ts` (`PublicRoom`/`toPublicRoom`/`fromPublicRoom`/`redactRoom`), `transport.ts` (`publishRoom`/`onRoom` tipados em `PublicRoom`) e `host.ts` (`publishRoom(toPublicRoom(room))`). O `uid` permanece — não é credencial (D-042).
- [X] **T025** [US4] `src/net/supabaseTransport.ts`: `loadRoom` por `room_preview` (RPC, não mais `select`). `localTransport.ts` ganha o mesmo recorte no facade, para os dois adapters proverem a MESMA garantia headless.
- [X] **T026** [P] [US4] `src/net/ui/SessionBadge.tsx`/`LobbyScreen.tsx`/`roomStore.ts`/`connectStore.ts`/`roomSession.ts`: novo `Client.myReentryCode()` (só a prévia o alimenta) chega à UI por `useRoomStore.myReentryCode` (fase `'playing'`) e por `RoomSessionState.myReentryCode` (fase `'lobby'`, antes do `connectStore` ligar) — dois caminhos porque o store do jogo só é ligado quando `game` existe. A redação não custou a funcionalidade (FR-019).

**Checkpoint**: `seat-secrets.test.ts` (6 casos, nos dois adapters) e as 81 suítes (734 testes) verdes. A tela do dono não muda em nada.

---

## Fase 5 — Perspectiva: a mão para de trafegar (a fase cara)

**Meta**: nenhum cliente recebe carta que não é dele. É a única fase que abre `src/game/**`.

- [X] **T027** [US5] `src/game/turn/types.ts`: `CardSlot = CardId | null`; `Player.hand` e os decks passam a `CardSlot[]` ([data-model §4](./data-model.md#4-slot-oculto)). **Comprimento é verdade pública** — `hand.length` continua sendo a contagem do §12.3, e é o que preserva `playersView`, o HUD e as 47 suítes de motor.
- [X] **T028** [US5] `src/game/turn/turnMachine.ts`: `TurnCtx` ganha o port de saque. `src/net/recorder.ts`: `Resolved.draws`, gravado por `recordingCtx` e reproduzido por `replayCtx` — o mecanismo que a 037 já provou para `rng`/`now` ([D8 do plan](./plan.md#d8--o-saque-vira-não-determinismo-gravado-no-mecanismo-que-já-existe)).
- [X] **T029** [US5] `src/game/cards/draw.ts`: sacar pelo port. Regra única, igual nos dois lados: **valor não-nulo → carta conhecida; valor nulo → slot oculto**.
- [X] **T030** [P] [US5] `src/game/cards/hand.ts`: `removeFromHand(hand, cardId)` — remove o id se visível, senão um slot oculto, preservando o comprimento. Um lugar só.
- [X] **T031** [P] [US5] `src/game/cards/reacao.ts`: `findReactionCard` ignora slot oculto. **Nenhuma mudança de regra**: a janela continua abrindo só para quem tem a carta, com o vazamento aceito na FR-028 e documentado na D-037 ([D11 do plan](./plan.md#d11--a-janela-de-reação-continua-exatamente-como-está)).
- [X] **T032** [test-first] [US5] `tests/net/perspective-cards.test.ts`: partida de três jogadores; cada cliente conhece a própria mão e vê `null` na alheia; ninguém prevê a próxima do baralho; contagens do §12.3 corretas em todas as perspectivas; carta de efeito imediato é pública para todos; `play-hand-card` revela; `discard-card` não; convergência do estado **público** entre os três.
- [X] **T033** [US5] `src/net/perspective.ts`: `splitSnapshot` / `mergeSnapshot` / redação do aceito ([data-model §§6–7](./data-model.md#6-comando-aceito-público-e-privado)). Propriedade que a suíte cobra: `mergeSnapshot(...splitSnapshot(g), segredosCompletos)` devolve `g` inalterado.
- [X] **T034** [US5] `src/net/host.ts`: gravar o snapshot em duas partes; difundir o aceito redigido em `:play` e o íntegro no tópico do dono via `broadcastPrivate`.
- [X] **T035** [US5] `src/net/client.ts`: aplicar a cópia privada quando ela existir; a pública é no-op pelo guard `cmd.seq <= seq` que já existe. Parte privada que não chega vira lacuna e cai na ressincronização da 037 — **sem estado de espera novo**.
- [X] **T036** [US5] `0003_attested_identity.sql`: `read_snapshot(room_id)` por seleção de chave — jogador recebe `game` + `secrets->auth.uid()`; anfitrião recebe tudo. O servidor não interpreta nenhum dos dois ([D6 do plan](./plan.md#d6--o-snapshot-é-gravado-em-duas-partes-e-por-isso-a-sql-não-precisa-conhecer-o-jogo)).
- [X] **T037** [US5] `src/net/supabaseTransport.ts`: `loadSnapshot` por RPC; nenhum caminho da porta faz leitura direta de tabela.
- [X] **T038** [P] [US5] Verificar as superfícies que leem mão: `ui/cards/handView.ts`, `ui/panels/playersView.ts`, `ui/modals/activeModal.ts`, `ui/DebugLogger.tsx`. Nenhum ramo condicional novo por modo de jogo (FR-025) — se um `if` desses aparecer, o desenho do slot oculto falhou.
- [X] **T039** [US5] `tests/game/log/describeLog.test.ts` + o caminho de log de saque: o log narra o fato público para a mesa e o detalhe só para o dono (FR-024). O log vem do estado, então isto sai de graça se T027–T029 estiverem certos — o teste existe para provar que saiu.

**Checkpoint**: as 47 suítes de motor verdes (na perspectiva da autoridade nunca existe `null`), `perspective-cards.test.ts` verde, e a inspeção do estado de um cliente não nomeia carta alheia.

---

## Fase 6 — A prova, contra infra real

**Meta**: sair do "o código recusa" para o "o servidor recusa". Nada aqui é opcional — política de banco falha em silêncio.

- [X] **T040** [US1] [US2] [US3] `scripts/attack.ts`: os seis vetores de [contracts/policies.md §6](./contracts/policies.md#6-os-seis-vetores--scriptsattackts), com a chave pública do bundle. Cria a própria sala de teste e a limpa no fim. Imprime recusa/sucesso por vetor.
- [X] **T041** ⚠️ **Confirmar com o usuário antes**: habilitar sessões anônimas no projeto `edppdqrkqljhjkbyjvsz` (config de painel) e aplicar `0003_attested_identity.sql` — que **apaga** `public.rooms` (FR-030).
- [X] **T042** [US1] [US2] [US3] Rodar `scripts/attack.ts` contra o projeto vivo: **6/6 recusados** (SC-001). Rodar o linter do Supabase: nenhum aviso `0024` em `rooms` (SC-005).
- [X] **T043** [US5] Medir SC-002 na prática (`scripts/verify-phase5-live.ts`): partida de três contra infra real, o dono vê a própria carta, o espectador vê `null` **com o comprimento conferindo** — é o comprimento que impede a asserção de passar por vacuidade, que foi como ela passava enquanto o roteiro forçava o cenário mutando `host.game()` fora de banda. O assento de ANFITRIÃO é exceção conhecida (SRS §10.3): o navegador dele roda a autoridade.
- [X] **T044** Medir SC-004: mediana de 21ms sobre centenas de comandos aceitos contra o projeto vivo. Sem baseline "antes da Fase 2" gravado (a spec correu numa sessão contínua), então a verificação é por DESENHO — `accept()` só chama `broadcast`/`broadcastPrivate`; as RPCs novas vivem em entrar/reconectar/reanexar, fora do caminho quente — mais o teto absoluto de 1s que a 037 já usava.
- [X] **T045** `e2e/multiplayer.spec.ts`: partida completa entre navegadores + reentrada por código de um terceiro dispositivo. **5/5 verdes em três execuções seguidas da suíte inteira** (~4,4 min cada). A pausa por desconexão (SC-003) segue opt-in por `E2E_PRESENCE=1` — depende do heartbeat do Realtime, que não é determinístico; a mecânica é provada headless em `pause.test.ts`. Fechá-lo exigiu quatro correções de infra/roteiro, todas registradas na Fase 7 (T051–T054), e desenterrou o defeito de permissão do §T051, que valia para produção inteira.
- [X] **T046** Verificação de superfície (SC-007/SC-008): `senderId` sobrevive só como campo CONFERIDO contra `fromUid` (`host.ts:136`) — nenhuma identidade é derivada de conteúdo do remetente em `src/net/**`; o cabeçalho de `supabaseTransport.ts` descreve a topologia de três tópicos, e o comentário de limitação de MVP não existe mais.
- [X] **T047** `docs/PRD.md` §5.1 e `docs/MILESTONES.md` (fatia 4) atualizados: a ressalva do token auto-declarado é registrada como FECHADA pela 043, com o caminho que a fechou (o remetente vem do endereço do tópico; não foi preciso Edge Function).

**Checkpoint final**: 6/6 no ataque, 82 suítes (747 testes) verdes, `verify-phase5-live.ts` verde contra o projeto vivo, E2E 5/5 estável em três execuções.

---

## Fase 7 — O que a Fase 6 encontrou (D-043 e os defeitos de infra)

Rodar contra infra real derrubou coisas que nenhuma suíte headless pegava. Ficam registradas porque cada uma é um achado, não uma tarefa planejada:

- [X] **T048** `room_play_select` consultava `public.rooms` direto. Política roda como o CHAMADOR, e `rooms` não tem política de select (D5) — o `exists` era sempre falso, para todo mundo. **Ninguém jamais assinou `:play`**: o aceito público não chegava a cliente nenhum, e cada um ficava parado no último `seq` recebido por caminho privado. Passa por `public.has_seat()`, `security definer`, como as demais já faziam.
- [X] **T049** Reautorizar um canal exige canal NOVO: o supabase-js guarda o resultado do join, e `.subscribe()` de novo no mesmo objeto recusado não refaz nada. `ensurePlaySubscribed` descarta o canal recusado e monta outro, com tentativas espaçadas — `publishAndPersistRoom` difunde a sala ANTES de gravá-la, e a política decide pela linha gravada.
- [X] **T051** **A permissão de escrita de um canal privado é decidida no JOIN, não por mensagem** — e vale pelo resto da vida daquele canal. O anfitrião assina `:lobby` dentro de `connect()`, que roda ANTES de `host.open()` gravar a linha; ali `room_host_uid()` é NULL, a política nega, e a negativa fica cacheada. A partir daí TODO `publishRoom` era descartado em silêncio: `send()` resolvia "ok", nenhum log de erro saía, e o convidado esperava para sempre por uma sala que nunca era difundida. **Esteve mascarado o tempo todo** — a recusa de leitura do `:play` (T052) derrubava a conexão, os canais re-entravam já com a linha gravada, e a permissão era reavaliada por acidente; ao consertar o `:play`, o defeito real apareceu. Fechado reconstruindo o canal de lobby uma vez após a primeira gravação bem-sucedida, e **reemitindo a última sala publicada** — que quase certamente se perdeu, porque `durableWrites` resolve `saveRoom` no enfileiramento e não na gravação (041, D8).
- [X] **T052** Uma assinatura RECUSADA em canal privado derruba a **conexão inteira**, não só aquele canal — `:lobby` e `:s:<uid>`, saudáveis, caem junto, e tudo o que trafega durante o restabelecimento se perde. Por isso `:play` passou a confirmar o assento na linha PERSISTIDA (`room_preview`, leitura barata) ANTES de assinar: só bate na porta quem já pode entrar. Soltar o canal velho ANTES de montar o substituto também é obrigatório — os dois têm o mesmo tópico, e um `unsubscribe()` tardio faz o servidor tratar a saída como saída do tópico, deixando o canal novo mudo.
- [X] **T053** `resync` tratava snapshot ausente como "não há partida" e desistia. Com `durableWrites` resolvendo na fila, o anfitrião anuncia `playing` antes de o `game` estar gravado — e aquela difusão era a ÚNICA chance do convidado de descobrir a partida. Ele ficava preso no lobby com a mesa jogando, sem erro. `resync(minSeq)` distingue os dois casos: com piso, ausente significa CEDO DEMAIS e entra no retry com backoff. Provado em `resync.test.ts` (dois casos: o que repete e o que não deve repetir).
- [X] **T054** Correções do roteiro E2E, todas de medição e não de asserção: `fillIdentity` espera cor E peça encolherem (clicar antes levava `color-taken`/`piece-taken` e prendia o convidado em "Conectando…"); as peças são localizadas por `aria-label`, não por glifo (`/^[^ ]$/` casa uma unidade UTF-16 e os emoji são pares surrogate — o `.catch()` engolia o erro); a perspectiva mede botão ACIONÁVEL, não visível (a tela de quem observa também renderiza "Rolar dados", desabilitado); e `workers: 1`, porque as specs de simulação são limitadas por CPU e a multiplayer por latência — juntas, a primeira mata a segunda de fome (7s sozinha, 4 min em paralelo). Bônus: `server.fs.allow` no Vite, sem o qual as fontes vinham de fora da raiz servida numa worktree e davam 403.
- [X] **T050** [D-043] O `reentryCode` vazava e era destruído, por três caminhos com uma raiz só (a autoridade lia por um caminho pensado para não-autoridade e persistia o resultado): `read_snapshot` devolvia `seats` cru a todos; `handleSeatReattached` regravava a prévia redigida; e o anfitrião que dava F5 no lobby remontava a sala a partir de `Client.room()`, que não carrega código nenhum. Fechado por `preserve_seat_codes` na gravação (o código é imutável depois de mintado) + seleção por chave nas duas leituras. ADR [D-043](../../docs/adr/D-043-o-codigo-de-reentrada-e-imutavel-e-a-autoridade-o-le.md); provas em `seat-secrets.test.ts` e `reentry.test.ts`.

---

## Dependências

```
Fase 1 (identidade)  ──┬──▶ Fase 2 (topologia)  ──┬──▶ Fase 3 (entrada)
                       │                          ├──▶ Fase 4 (segredo)
                       │                          └──▶ Fase 5 (perspectiva)
                       └──────────────────────────────▶ Fase 6 (prova) ◀── todas
```

- **Fase 2 bloqueia 3, 4 e 5**: sem tópico por assento não há caminho privado, e sem caminho privado não há segredo nem perspectiva.
- **Fases 3, 4 e 5 são independentes entre si** — 4 é a mais barata, 5 é a mais cara.
- **Fase 6 depende de todas**, e é a única que toca infra viva.

## Paralelização

Dentro de cada fase, os `[P]` tocam arquivos distintos e podem ir juntos. Entre fases, não: cada checkpoint é uma barreira, e é ele que garante que a suíte nunca fica vermelha por mais de uma fase.
