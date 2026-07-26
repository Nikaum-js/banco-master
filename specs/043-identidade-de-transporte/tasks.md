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

- [ ] **T001** [US1] `src/net/session.ts`: remover `getSessionToken()` e o `TOKEN_KEY`. `roomLink`/`parseRoomLink`/`extractRoomId`/`newRoomId` ficam — são links, não identidade. Documentar no cabeçalho por que o UUID de `localStorage` morreu: quem persiste sessão entre reloads agora é o supabase-js, e é essa persistência que sobrevive ao F5.
- [ ] **T002** [US1] `src/net/supabaseClient.ts`: `ensureSession()` (`getSession()` ?? `signInAnonymously()`) seguido de `supabase.realtime.setAuth()`, **antes** de montar o transporte. `createSupabaseTransport` passa a ser assíncrona e recebe o `uid` da sessão. Estender `describeInfraError` com o caso "sessões anônimas desabilitadas no projeto" — mensagem acionável, como já é o da migration ausente (FR-032). `isSupabaseConfigured()` continua sendo o portão: sem ambiente configurado, nenhuma sessão é criada e o app segue single-player (FR-031).
- [ ] **T003** [US1] `src/net/room.ts`: `Seat.token` → `Seat.uid`, `seatByToken` → `seatByUid`, `Identity.token` → `Identity.uid`, conforme [data-model §1](./data-model.md#1-identidade). Rename, não alias: neste projeto "token" já é a peça visual do jogador (§12.5).
- [ ] **T004** [P] [US1] `src/net/transport.ts`: `Transport.token` → `uid`, `PresenceChange.token` → `uid`. Atualizar o cabeçalho da porta — o comentário do `CommandEnvelope` ("o host confere contra a identidade real da conexão") deixa de ser aspiração e passa a ser descrição.
- [ ] **T005** [US1] Propagar os renomes onde o compilador apontar: `host.ts`, `client.ts`, `roomSession.ts`, `roomStore.ts`, `connectStore.ts`, `localView.ts`, `ui/**`. Deixar o compilador dirigir — a lista é o esperado, não o exaustivo.
- [ ] **T006** [P] [US1] `src/net/localTransport.ts` + `LocalHub`: idem, e o hub passa a tratar a identidade como propriedade da **conexão** (já era, de fato — agora fica explícito no nome).
- [ ] **T007** [US1] `src/net/supabaseTransport.ts`: chave de presença passa a ser o `uid`; o campo `token` sai do payload de `submit` e de `join` — **sem ainda mudar a topologia**. Neste ponto o adapter deixa de declarar identidade e passa a não ter nenhuma: é intencional, e a Fase 2 devolve pelo endereço.
- [ ] **T008** Renomes mecânicos nas 24 suítes de `tests/net/`. **Adaptar a montagem, nunca a asserção.**

**Checkpoint**: `bun run typecheck` e as 80 suítes verdes. Nenhum comportamento novo; `tests/net/antispoof.test.ts` continua passando pelo mesmo motivo de antes.

---

## Fase 2 — Três tópicos, e o remetente vira endereço (bloqueia 3–6)

**Meta**: o servidor passa a saber quem pode escrever o quê. É a fase que fecha os vetores 1–4.

- [ ] **T009** [US1] [US2] `supabase/migrations/0003_attested_identity.sql` — primeira metade: `delete from public.rooms`, coluna `secrets jsonb`, `drop policy` das três políticas `true` da `0001` e as novas políticas de tabela, mais as políticas de `realtime.messages` para as três classes de tópico ([contracts/policies.md §§2–3](./contracts/policies.md)). `security definer` com `search_path` fixo em vazio onde houver função — o linter 0011 cobra. **Não aplicar em projeto nenhum ainda.**
- [ ] **T010** [US1] [US2] `src/net/transport.ts`: `onSubmit(cb: (cmd, fromUid) => void)` documentado como "vem do canal, não do conteúdo"; `broadcastPrivate(uid, cmd)`; `requestJoin` vira `Promise`; `reattach(roomId, code)` entra — conforme [contracts/transport.md §§2–3, 6–7](./contracts/transport.md).
- [ ] **T011** [test-first] [US1] [US2] `tests/net/conformance.test.ts`: os casos de recusa, **nos dois adapters** — submeter no tópico de outro assento não produz `onSubmit` no host; difundir aceito sem ser a autoridade não alcança cliente nenhum; publicar sala/recusar entrada sem ser a autoridade idem; anunciar presença alheia não produz `onPresence`. **Cada um precisa falhar contra o código atual** — se passar antes do conserto, o teste está provando outra coisa.
- [ ] **T012** [US1] [US2] `src/net/supabaseTransport.ts`: três canais (`:lobby`, `:play`, `:s:<uid>`), todos `private: true`. `onSubmit` deriva o remetente do binding do canal do assento. O host assina um tópico por assento e **não** chama `track()` neles — assim a presença observada ali é só a do dono ([D2/D3 do plan](./plan.md#d2--três-classes-de-tópico-cada-uma-com-uma-pergunta-diferente-para-o-servidor)).
- [ ] **T013** [P] [US2] `src/net/localTransport.ts`: paridade de recusa ([D12 do plan](./plan.md#d12--paridade-o-hub-local-passa-a-recusar-o-que-o-servidor-recusaria)) — o hub recusa escrita no tópico alheio, difusão de aceito por não-autoridade e presença em nome de terceiro. O que o hub prova é que host e cliente se comportam bem **quando o servidor recusa**.
- [ ] **T014** [P] [US2] `tests/net/fakeSupabase.ts`: simulação de política por tópico, para o adapter de produção ser exercitado headless. Não substitui a prova real (Fase 6) — cobre o caminho do código, não a regra do Postgres.
- [ ] **T015** [US1] [US2] `src/net/host.ts`: assinar o tópico de cada assento ao aceitar entrada e ao reanexar; desassinar no kick. `handleSubmit` continua conferindo `senderId` contra o assento (FR-004) — a checagem não sai, ela finalmente se apoia em dado que o remetente não escolhe.

**Checkpoint**: conformidade verde nos dois adapters e vermelha contra o `supabaseTransport` da Fase 1. `tests/net/antispoof.test.ts` ganha o caso que hoje é impossível: forjar o `uid` e não conseguir nada.

---

## Fase 3 — A escada de entrada sai do canal

**Meta**: pedir assento e reanexar passam a ser atestados pelo servidor. É o que destrava o anfitrião que perdeu o aparelho.

- [ ] **T016** [US1] `0003_attested_identity.sql` — segunda metade: `request_seat(room_id, name, color, piece)` e `reattach_by_code(room_id, code)` ([contracts/policies.md §4](./contracts/policies.md)). `request_seat` **não valida regra de sala** — só carimba `auth.uid()` e difunde ao lobby. `reattach_by_code` é a **única** regra de domínio em SQL, e escreve a linha porque no caso que a justifica não existe autoridade para autorizar.
- [ ] **T017** [test-first] [US1] `tests/net/reentry.test.ts`: reanexação com a autoridade **fora do ar** funciona; reanexar o assento do **anfitrião** devolve a autoridade a ele; código inválido recusa com `'bad-code'`; o vínculo antigo para de agir pelo assento. Os dois primeiros são a razão da fase existir e hoje são impossíveis.
- [ ] **T018** [US1] `src/net/supabaseTransport.ts` + `supabaseClient.ts`: `requestJoin` e `reattach` por RPC.
- [ ] **T019** [US1] `src/net/room.ts`: `JoinRequest.reentryCode` sai (reanexar deixa de ser um tipo de pedido de assento). `reattachByCode` **fica** como espelho testado — é o que o adapter local exercita e o que mantém a conformidade honesta dos dois lados.
- [ ] **T020** [US1] `src/net/host.ts`: `handleJoinRequest` perde o ramo de reanexação; o host passa a aprender da reanexação pelo aviso no tópico de lobby e a recarregar a sala. `syncPause` depois de republicar continua sendo o que retoma a partida se aquela era a última ausência (FR-028 da 041).
- [ ] **T021** [US1] `src/net/roomSession.ts`: escada de entrada apontando para as RPCs; a fase `'reentry'` e o formulário de código da 041 seguem intactos na superfície.

**Checkpoint**: `reentry.test.ts`, `lobby.test.ts`, `kick.test.ts`, `boot.test.ts` verdes. Um convidado e o anfitrião reentram pelo **mesmo** caminho.

---

## Fase 4 — O segredo do assento para de trafegar

**Meta**: o código de reentrada vira segredo do dono sem perder a funcionalidade que motivou a D-033.

- [ ] **T022** [US4] `0003_attested_identity.sql`: `room_preview(room_id)` — assentos sem `reentryCode`, **exceto** o do assento de quem chamou ([contracts/policies.md §4](./contracts/policies.md)).
- [ ] **T023** [test-first] [US4] `tests/net/seat-secrets.test.ts`: nada do que chega a um cliente contém código alheio — nem na sala publicada, nem na prévia, nem no estado lido; e o dono continua obtendo o seu. Varredura no payload inteiro, não em campo esperado: o teste precisa pegar o código escondido num lugar em que ninguém pensou.
- [ ] **T024** [US4] `src/net/host.ts` + `transport.ts`: `publishRoom` passa a difundir a projeção `PublicRoom` ([data-model §3](./data-model.md#3-sala-publicada-vs-sala-da-autoridade)). O `uid` permanece — não é credencial, e esse é o ponto inteiro da D-035.
- [ ] **T025** [US4] `src/net/supabaseTransport.ts`: `loadRoom` por `room_preview`.
- [ ] **T026** [P] [US4] `src/net/ui/SessionBadge.tsx` e `LobbyScreen.tsx`: o dono lê o próprio código da prévia, no mesmo lugar em que a 041 o colocou. A redação não pode custar a funcionalidade (FR-019).

**Checkpoint**: `seat-secrets.test.ts` verde e vermelha contra a Fase 3. A tela do dono não muda em nada.

---

## Fase 5 — Perspectiva: a mão para de trafegar (a fase cara)

**Meta**: nenhum cliente recebe carta que não é dele. É a única fase que abre `src/game/**`.

- [ ] **T027** [US5] `src/game/turn/types.ts`: `CardSlot = CardId | null`; `Player.hand` e os decks passam a `CardSlot[]` ([data-model §4](./data-model.md#4-slot-oculto)). **Comprimento é verdade pública** — `hand.length` continua sendo a contagem do §12.3, e é o que preserva `playersView`, o HUD e as 47 suítes de motor.
- [ ] **T028** [US5] `src/game/turn/turnMachine.ts`: `TurnCtx` ganha o port de saque. `src/net/recorder.ts`: `Resolved.draws`, gravado por `recordingCtx` e reproduzido por `replayCtx` — o mecanismo que a 037 já provou para `rng`/`now` ([D8 do plan](./plan.md#d8--o-saque-vira-não-determinismo-gravado-no-mecanismo-que-já-existe)).
- [ ] **T029** [US5] `src/game/cards/draw.ts`: sacar pelo port. Regra única, igual nos dois lados: **valor não-nulo → carta conhecida; valor nulo → slot oculto**.
- [ ] **T030** [P] [US5] `src/game/cards/hand.ts`: `removeFromHand(hand, cardId)` — remove o id se visível, senão um slot oculto, preservando o comprimento. Um lugar só.
- [ ] **T031** [P] [US5] `src/game/cards/reacao.ts`: `findReactionCard` ignora slot oculto. **Nenhuma mudança de regra**: a janela continua abrindo só para quem tem a carta, com o vazamento aceito na FR-028 e documentado na D-037 ([D11 do plan](./plan.md#d11--a-janela-de-reação-continua-exatamente-como-está)).
- [ ] **T032** [test-first] [US5] `tests/net/perspective-cards.test.ts`: partida de três jogadores; cada cliente conhece a própria mão e vê `null` na alheia; ninguém prevê a próxima do baralho; contagens do §12.3 corretas em todas as perspectivas; carta de efeito imediato é pública para todos; `play-hand-card` revela; `discard-card` não; convergência do estado **público** entre os três.
- [ ] **T033** [US5] `src/net/perspective.ts`: `splitSnapshot` / `mergeSnapshot` / redação do aceito ([data-model §§6–7](./data-model.md#6-comando-aceito-público-e-privado)). Propriedade que a suíte cobra: `mergeSnapshot(...splitSnapshot(g), segredosCompletos)` devolve `g` inalterado.
- [ ] **T034** [US5] `src/net/host.ts`: gravar o snapshot em duas partes; difundir o aceito redigido em `:play` e o íntegro no tópico do dono via `broadcastPrivate`.
- [ ] **T035** [US5] `src/net/client.ts`: aplicar a cópia privada quando ela existir; a pública é no-op pelo guard `cmd.seq <= seq` que já existe. Parte privada que não chega vira lacuna e cai na ressincronização da 037 — **sem estado de espera novo**.
- [ ] **T036** [US5] `0003_attested_identity.sql`: `read_snapshot(room_id)` por seleção de chave — jogador recebe `game` + `secrets->auth.uid()`; anfitrião recebe tudo. O servidor não interpreta nenhum dos dois ([D6 do plan](./plan.md#d6--o-snapshot-é-gravado-em-duas-partes-e-por-isso-a-sql-não-precisa-conhecer-o-jogo)).
- [ ] **T037** [US5] `src/net/supabaseTransport.ts`: `loadSnapshot` por RPC; nenhum caminho da porta faz leitura direta de tabela.
- [ ] **T038** [P] [US5] Verificar as superfícies que leem mão: `ui/cards/handView.ts`, `ui/panels/playersView.ts`, `ui/modals/activeModal.ts`, `ui/DebugLogger.tsx`. Nenhum ramo condicional novo por modo de jogo (FR-025) — se um `if` desses aparecer, o desenho do slot oculto falhou.
- [ ] **T039** [US5] `tests/game/log/describeLog.test.ts` + o caminho de log de saque: o log narra o fato público para a mesa e o detalhe só para o dono (FR-024). O log vem do estado, então isto sai de graça se T027–T029 estiverem certos — o teste existe para provar que saiu.

**Checkpoint**: as 47 suítes de motor verdes (na perspectiva da autoridade nunca existe `null`), `perspective-cards.test.ts` verde, e a inspeção do estado de um cliente não nomeia carta alheia.

---

## Fase 6 — A prova, contra infra real

**Meta**: sair do "o código recusa" para o "o servidor recusa". Nada aqui é opcional — política de banco falha em silêncio.

- [ ] **T040** [US1] [US2] [US3] `scripts/attack.ts`: os seis vetores de [contracts/policies.md §6](./contracts/policies.md#6-os-seis-vetores--scriptsattackts), com a chave pública do bundle. Cria a própria sala de teste e a limpa no fim. Imprime recusa/sucesso por vetor.
- [ ] **T041** ⚠️ **Confirmar com o usuário antes**: habilitar sessões anônimas no projeto `edppdqrkqljhjkbyjvsz` (config de painel) e aplicar `0003_attested_identity.sql` — que **apaga** `public.rooms` (FR-030).
- [ ] **T042** [US1] [US2] [US3] Rodar `scripts/attack.ts` contra o projeto vivo: **6/6 recusados** (SC-001). Rodar o linter do Supabase: nenhum aviso `0024` em `rooms` (SC-005).
- [ ] **T043** [US5] Medir SC-002 na prática: partida de três, inspeção do estado de um cliente, nenhuma carta alheia nomeável — exceto a reação exposta por janela aberta (FR-028).
- [ ] **T044** Medir SC-004: mediana do intervalo entre enviar comando e ver o aceito, contra a medição feita **antes** da Fase 2. Teto: +20%. O desenho não põe salto HTTP no caminho quente; a medição é para provar que não pôs mesmo.
- [ ] **T045** `e2e/multiplayer.spec.ts`: partida completa entre navegadores (lobby → partida → fim), com reentrada por código de um terceiro dispositivo e pausa/retomada por desconexão (SC-003).
- [ ] **T046** Verificação de superfície (SC-007/SC-008): busca em `src/net/**` não encontra identidade derivada de conteúdo do remetente; o comentário de limitação de MVP do cabeçalho de `supabaseTransport.ts:17-19` **some**, junto com o código que o justificava.
- [ ] **T047** Atualizar `docs/PRD.md` (a ressalva do §5.1 sobre token auto-declarado deixa de existir) e `docs/MILESTONES.md` (o item "fora do escopo, registrado, não resolvido" da fatia 4 é fechado por esta spec).

**Checkpoint final**: 6/6 no ataque, 80+ suítes verdes, E2E verde, e nenhuma linha do repo dizendo que o endurecimento está pendente.

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
