# Feature Specification: Resiliência de sessão — a partida sobrevive à rede

**Feature Branch**: `main` (fluxo sem branch por feature)

**Created**: 2026-07-26

**Status**: Draft

**Input**: User description: "Resiliência de sessão de verdade (M3 item 4, princípio VII, D-016/D-029) — reload sem perda, host cai, reconexão pelo mesmo link, prazos congelados; endurecimento + testes de contrato sobre `src/net/**`."

**Depende de**: spec [037](../037-sala-online-estado-sincronizado/spec.md) (transporte, host autoritativo, pausa, snapshot — é a casca que esta spec endurece), spec [038](../038-partida-online-jogavel/spec.md) (perspectiva local, banner de pausa, escada de entrada por link)

**Regra de origem**: SRS §11.3 e §11.4, princípio VII. Duas regras **novas** entram por ADR escrita antes desta spec: [D-033](../../docs/adr/D-033-codigo-de-reentrada-por-assento.md) (código de reentrada por assento) e [D-034](../../docs/adr/D-034-persistencia-indisponivel-pausa-a-partida.md) (persistência indisponível pausa a partida). SRS bumped para v1.7.

**Paralelismo**: esta spec vive em `src/net/**` e não toca nenhum arquivo da spec 040 (`src/game/log.ts`, os pontos de emissão em `src/game/**`, `src/game/ui/log/`, `CenterLog`, `sound/classify.ts`, `src/lib/money.ts`). A única superfície compartilhada é `GameState.paused`, que aqui muda de forma — e o log não a lê.

---

## Por que esta spec existe

O princípio VII é o único dos sete que o projeto promete e não prova: *"desconexão mid-game pausa a partida; nenhum jogador perde propriedades por desconectar; reconexão deve ser sempre possível; persistência via Supabase garante que nada se perde"*. A spec 037 construiu a mecânica e a 038 a tornou visível. Nenhuma das duas exercitou o caso que dá nome ao princípio: **a rede falhando de verdade**.

O harness headless (`tests/net/harness.ts`) modela um hub in-memory perfeito — mensagens nunca se perdem, escritas nunca falham, sockets nunca caem. Toda a suíte de pausa e reconexão prova o **caminho feliz da queda**: alguém sai limpo do canal, alguém volta limpo. Sete defeitos vivem exatamente no que esse modelo não representa, e cada um deles tem linha de código.

**1. O socket volta e a presença não.** `supabaseTransport.ts:118-124` resolve a promessa de `connect()` no primeiro `SUBSCRIBED` e trava `subscribed = true`. Quando o supabase-js reassina o canal sozinho depois de uma queda de rede — que é o comportamento normal dele — o callback de status dispara de novo, o guard recusa, e o `channel.track({ token })` **não roda**. O jogador está de volta, vê o tabuleiro, e para todos os outros continua ausente: a partida fica pausada indefinidamente com todo mundo presente. Como não há timeout de desconexão (§11.3), a única saída é F5 — e nada na tela diz isso. É a falha mais grave da lista: transforma um soluço de rede de 3 segundos em mesa travada.

**2. A queda que eu sofro é invisível para mim.** A pausa chega por difusão. Se quem caiu fui eu, não chega difusão nenhuma: minha tela segue mostrando a partida como se nada tivesse acontecido, com os controles da minha vez acionáveis. Cada clique vira `void channel.send(...)` no vazio — `submit` é disparo-e-esquece por contrato. O `PauseBanner` (`PauseBanner.tsx:23`) só aparece com `game.paused`, que é justamente o que não me alcança. **Não existe estado de conexão local em lugar nenhum da UI**: nem no `roomStore`, nem no `connectStore`, nem no `RoomSession`. A 038 resolveu comunicar a queda dos outros e deixou a minha de fora — que é a única que eu posso agir sobre.

**3. Persistência é disparo-e-esquece, sem ordem e sem erro.** `host.ts:81` faz `void transport.saveSnapshot(...)` e difunde na linha seguinte. Três consequências, todas silenciosas: (a) uma gravação recusada é um comando que existe na tela de todos e não existe no banco — se o host recarregar, a partida **volta no tempo** enquanto os clientes seguem à frente; (b) duas gravações concorrentes na mesma linha podem chegar fora de ordem e **regredir** o `seq` persistido, e quem reconectar lê estado antigo e entra em ciclo de ressincronização; (c) a promessa rejeitada não tem `catch` — o erro nem chega ao console de forma acionável. O §11.4 depende inteiramente dessa escrita, e ela é o ponto menos defendido do sistema.

**4. O relógio da pausa é memória volátil do host.** `host.ts:52` guarda `pausedAt` numa variável local. `game.paused` está no snapshot; `pausedAt` não. Host recarrega com a partida pausada → `open()` restaura o estado pausado, mas `pausedAt` volta `null` → na retomada, `host.ts:138` calcula `pausedMs = 0` → `applyResume` **não desloca deadline nenhum**. Um leilão pausado por dez minutos volta com o prazo vencido e o primeiro `tick()` o fecha na hora. A promessa do §11.3 ("prazos ficam exatamente como estão" — texto que o próprio `PauseBanner` exibe) quebra no cenário mais provável de todos: a pausa longa.

**5. O cliente dessincronizado desiste em silêncio.** `client.ts:80-82`: se `loadSnapshot()` devolve `null`, `resync` retorna sem fazer nada; se rejeita, a rejeição some dentro de um `void resync()`. Em ambos os casos o cliente fica **congelado** no `seq` antigo, e cada difusão seguinte reabre a mesma lacuna — tempestade de leituras contra o banco, tabuleiro parado, e nenhum sinal para quem está olhando. Não há retry com espera, não há limite, não há aviso.

**6. A autoridade que volta confia num retrato vencido.** `host.ts:168`: ao reassumir, o host lê `room` do snapshot e adota os `connected` gravados nele. Esses valores são de antes da queda. Se alguém saiu durante a ausência do host, o snapshot diz "conectado" e a partida **não pausa** — o host espera comando de quem não está lá. Se alguém voltou, o snapshot diz "desconectado" e a partida **fica pausada** com a mesa cheia. A fonte de verdade de quem está presente é a presença do canal, e ela nunca é reconciliada.

**7. Perder o aparelho é perder o assento — e travar a mesa.** O token de sessão vive no `localStorage` (`session.ts`). Celular sem bateria, dados do navegador limpos, aba anônima encerrada: token novo, `already-started`, sem volta. O assento fica órfão, e como ninguém pode ser removido depois do início e não há timeout, a partida **pausa para sempre**. Não há caminho de recuperação para o dono nem para o anfitrião. É [D-033](../../docs/adr/D-033-codigo-de-reentrada-por-assento.md).

Nenhum desses sete aparece na suíte porque a suíte não sabe falhar. Por isso esta spec entrega, junto do conserto, **a capacidade de reproduzir a falha** — um harness que derruba socket, recusa escrita, entrega fora de ordem e perde difusão. Sem ele, o conserto de hoje é a regressão de dezembro.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A rede volta e a partida volta com ela (Priority: P1) 🎯 MVP

Minha internet oscila por alguns segundos no meio de um turno. A partida pausa para todos, como prometido. Quando a conexão se restabelece — sem eu fazer nada, sem recarregar a página — a pausa some em todas as telas e o jogo continua exatamente de onde parou.

**Why this priority**: é a diferença entre o princípio VII existir e o princípio VII funcionar. Hoje, o soluço mais banal de rede deixa a mesa travada indefinidamente porque a presença não é re-anunciada quando o canal se reassina, e ninguém tem como perceber que a saída é recarregar. É a única falha da lista que **impede a partida de terminar**.

**Independent Test**: derrubar a conexão de um cliente por tempo suficiente para o canal cair, restaurá-la sem recarregar a página, e observar em outra tela a pausa aparecer e sumir sozinha.

**Acceptance Scenarios**:

1. **Given** partida em curso e meu canal cai por instabilidade de rede, **When** o canal se reassina sozinho, **Then** minha presença é reanunciada e a partida retoma em todas as telas, sem intervenção de ninguém.
2. **Given** minha conexão voltou, **When** olho meu tabuleiro, **Then** ele mostra o estado atual da partida — inclusive o que aconteceu enquanto eu estava fora, se algo aconteceu.
3. **Given** perdi difusões durante a queda, **When** volto, **Then** meu estado é reconciliado a partir do estado persistido, uma vez, sem repetir a leitura em laço.
4. **Given** a leitura de reconciliação falha (o banco também está fora), **When** ela falha, **Then** ela é repetida com espera crescente e minha tela diz que está tentando reconectar — em vez de ficar parada em silêncio.
5. **Given** o host recarregou a página e reassumiu a autoridade, **When** ele reassume, **Then** quem está presente é determinado pela presença observada no canal, não pelos valores gravados no estado anterior.
6. **Given** um jogador saiu enquanto o host estava fora, **When** o host reassume, **Then** a partida pausa nomeando esse jogador — e não segue esperando comando de quem não está lá.
7. **Given** um jogador voltou enquanto o host estava fora, **When** o host reassume, **Then** a partida **não** fica pausada por causa dele.

---

### User Story 2 - Eu vejo que quem caiu fui eu (Priority: P1)

Minha conexão cai. Minha tela me diz isso imediatamente: estou tentando reconectar, a partida está esperando por mim, e os controles não me deixam agir no vazio. Quando volto, o aviso some.

**Why this priority**: a queda dos outros a 038 já comunica; a minha é a única sobre a qual eu posso agir (trocar de rede, sair do elevador, recarregar) e é justamente a que o produto esconde. Sem esta superfície, o sintoma de estar desconectado é indistinguível de "é a vez de outra pessoa e ela está pensando" — e cliques que somem no vazio ensinam o jogador a desconfiar da interface.

**Independent Test**: desligar a rede de um dispositivo com a partida aberta e observar, **naquele mesmo dispositivo**, o aviso de reconexão aparecer e os controles de decisão ficarem inertes.

**Acceptance Scenarios**:

1. **Given** partida em curso, **When** minha conexão com a sala cai, **Then** minha tela exibe que estou desconectado e tentando reconectar, sem contagem regressiva e sem ação destrutiva.
2. **Given** estou desconectado, **When** tento acionar qualquer decisão minha, **Then** o controle não está acionável — a interface não aceita um comando que não vai chegar a lugar nenhum.
3. **Given** estou desconectado, **When** a conexão volta, **Then** o aviso some sozinho e meus controles voltam ao normal.
4. **Given** estou desconectado, **When** olho a tela, **Then** o estado da partida que vejo é o último que recebi, apresentado como tal — não como estado atual.
5. **Given** sou um jogador eliminado que caiu, **When** minha conexão cai, **Then** vejo o mesmo aviso de reconexão, mas nenhuma tela diz que a partida está esperando por mim (D-029).

---

### User Story 3 - Nada avança sem estar salvo (Priority: P1)

Como jogador, eu não sei o que é um snapshot. O que eu preciso é que a partida que eu terminar de jogar seja a mesma partida que estava sendo jogada — sem que um reload de qualquer pessoa faça alguns minutos evaporarem.

**Why this priority**: é o §11.4 inteiro. Uma partida que regride em silêncio é pior do que uma partida que pausa: ninguém percebe, ninguém pode reclamar no momento certo, e o estado de todos os clientes passa a discordar do estado da autoridade sem que nenhum deles saiba.

**Independent Test**: com a persistência recusando escritas, jogar alguns comandos e observar a partida pausar com a causa correta; restaurar a persistência e observar a retomada automática com o estado íntegro.

**Acceptance Scenarios**:

1. **Given** partida em curso, **When** a gravação do estado falha uma vez por instabilidade, **Then** ela é repetida e a partida segue normalmente, sem ninguém notar.
2. **Given** a gravação falha de forma persistente, **When** as tentativas se esgotam, **Then** a partida pausa e todas as telas dizem que o problema é de salvamento — não que alguém caiu (D-034).
3. **Given** a partida está pausada por falha de salvamento, **When** tento agir, **Then** nenhum comando é aceito.
4. **Given** a partida está pausada por falha de salvamento, **When** a gravação volta a funcionar, **Then** a pausa se desfaz sozinha.
5. **Given** um jogador está desconectado **e** a gravação está falhando, **When** a gravação volta mas o jogador ainda não, **Then** a partida continua pausada, agora nomeando só a causa que resta.
6. **Given** duas gravações do mesmo estado se cruzam, **When** ambas chegam ao banco, **Then** o que fica gravado é sempre o estado mais recente — nunca o anterior.
7. **Given** o host recarregou depois de uma sequência de comandos, **When** ele reassume, **Then** o estado que ele reassume é o último que foi efetivamente gravado, e os clientes convergem para ele.

---

### User Story 4 - O prazo que estava correndo continua o mesmo (Priority: P2)

Estou num leilão com 20 segundos no relógio quando alguém cai. A partida pausa. Quinze minutos depois a pessoa volta — e o leilão retoma com os mesmos 20 segundos, não com o prazo vencido.

**Why this priority**: é a promessa que o banner de pausa faz por escrito hoje ("saldo, propriedades, cartas e **prazos** ficam exatamente como estão") e que quebra assim que o host recarrega durante a pausa. Uma promessa exibida na tela e desmentida pelo comportamento custa mais confiança do que uma promessa nunca feita.

**Independent Test**: abrir um leilão, pausar por desconexão, recarregar a página do host durante a pausa, reconectar o ausente e conferir que o tempo restante do leilão é o mesmo de antes.

**Acceptance Scenarios**:

1. **Given** um leilão em curso com tempo restante, **When** a partida pausa e retoma, **Then** o tempo restante é o mesmo de antes da pausa.
2. **Given** a partida está pausada, **When** o host recarrega a página e reassume a autoridade, **Then** o instante em que a pausa começou não se perde — a retomada desloca os prazos pelo intervalo real.
3. **Given** um pregão simultâneo com vários lotes, **When** a partida pausa e retoma, **Then** todos os lotes preservam seus tempos restantes.
4. **Given** a partida esteve pausada por duas causas que começaram em momentos diferentes, **When** ambas se resolvem, **Then** os prazos são deslocados pelo intervalo inteiro em que a partida ficou parada.
5. **Given** a partida está pausada, **When** o tempo passa, **Then** nenhum prazo vence e nenhum leilão fecha sozinho.

---

### User Story 5 - Volto de outro aparelho (Priority: P2)

Meu celular descarregou no meio da partida. Pego o notebook, abro o link da sala, informo o código de reentrada que a sala me deu, e volto ao meu assento — com meu dinheiro, minhas propriedades e minhas cartas.

**Why this priority**: é o único cenário da lista em que a mesa trava **e não há saída para ninguém** — nem para mim, nem para o anfitrião, nem com F5. Fica em P2 porque é menos frequente que os anteriores, não porque é menos grave.

**Independent Test**: entrar numa partida em curso a partir de um navegador sem o token da sessão original, apresentar o código de reentrada do assento e verificar que a reanexação devolve o assento e retoma a partida.

**Acceptance Scenarios**:

1. **Given** estou numa sala, **When** olho minha identidade na sala, **Then** vejo meu código de reentrada junto do link, em lugar onde eu consiga anotá-lo antes de precisar dele.
2. **Given** perdi o dispositivo original, **When** abro o link da sala em outro aparelho e informo meu código, **Then** volto ao meu assento com o estado íntegro e a partida retoma.
3. **Given** reanexei de outro aparelho, **When** o dispositivo original volta a abrir o link, **Then** ele não tem mais aquele assento — um assento tem um dono de cada vez.
4. **Given** abro o link de uma partida já iniciada sem assento e sem código, **When** a tela carrega, **Then** ela me oferece o campo de código em vez de me deixar num beco sem saída.
5. **Given** informo um código inválido, **When** confirmo, **Then** recebo uma recusa legível e posso tentar de novo, sem sair da tela.
6. **Given** a sala ainda está no lobby, **When** o anfitrião remove um jogador, **Then** o código daquele assento deixa de valer e os códigos dos demais continuam os mesmos.

---

### Edge Cases

- **Duas abas do mesmo dispositivo.** Já resolvido pela 037 (FR-006a, takeover por contagem de presenças): a última assume, a anterior cai, e isso não pausa a partida. Esta spec preserva o comportamento e o mantém coberto na conformidade dos dois adapters.
- **Reentrada com o dispositivo original ainda vivo.** A reanexação por código vale mesmo com o token antigo conectado: o assento passa para o token novo e o antigo perde acesso. Não é takeover (são tokens diferentes) e não deve pausar a partida.
- **Todos caem ao mesmo tempo** (queda do provedor). A partida pausa com todos listados; a retomada só acontece quando todos os que ainda jogam voltarem. Nada expira nesse intervalo.
- **Host cai e volta com o banco fora.** Duas causas de pausa simultâneas desde o primeiro instante; a mensagem nomeia as duas.
- **Difusão chega durante a reconciliação.** O comando não pode ser descartado nem aplicado fora de ordem — vai para o buffer e é reconciliado depois, como já acontece na entrada.
- **A gravação falha exatamente no primeiro snapshot da partida.** A partida não pode começar com estado só na memória do host: a falha aqui pausa antes do primeiro turno.
- **Sala terminada.** Continua não reabrindo (FR-028 da 038), e o código de reentrada não muda isso.
- **Jogador eliminado que reentra por código.** Volta ao assento como espectador do próprio assento, sem destravar nem travar nada (D-029).

---

## Requirements *(mandatory)*

### Functional Requirements

**Reconexão de canal e presença**

- **FR-001**: Quando o canal de uma sessão se reassina após uma queda, a presença dessa sessão DEVE ser reanunciada, sem depender de recarregar a página.
- **FR-002**: A reassinatura DEVE ser idempotente: reanunciar presença de uma sessão já presente não pode ser interpretado como entrada nova nem gerar pausa espúria.
- **FR-003**: Após reconectar, o cliente DEVE reconciliar seu estado com o estado persistido uma vez, e aplicar em ordem as difusões que chegaram durante a reconciliação.
- **FR-004**: A reconciliação que falha DEVE ser repetida com espera crescente, com um número finito de tentativas, sem laço de leituras consecutivas contra a persistência.
- **FR-005**: Esgotadas as tentativas de reconciliação, o cliente DEVE se declarar dessincronizado na própria tela, em vez de exibir estado antigo como se fosse atual.

**Estado de conexão local**

- **FR-006**: O cliente DEVE expor, para a UI, se a própria sessão está conectada à sala — informação que hoje não existe em nenhuma camada.
- **FR-007**: Enquanto a própria sessão estiver desconectada, nenhum controle de decisão DEVE estar acionável para o dono da tela.
- **FR-008**: O aviso de desconexão própria DEVE ser distinto do banner de pausa por terceiros, e DEVE desaparecer sozinho na reconexão.
- **FR-009**: O aviso de desconexão própria NÃO DEVE conter contagem regressiva, prazo, nem ação destrutiva (§11.3, D-015).

**Durabilidade do estado**

- **FR-010**: A gravação do estado DEVE ser serializada por sala: no máximo uma escrita em voo, com coalescing das pendentes (a linha é única; só o estado mais recente importa).
- **FR-011**: A gravação DEVE ser monotônica: uma escrita nunca pode substituir um estado gravado de sequência maior.
- **FR-012**: A gravação que falha DEVE ser repetida com espera crescente e um número finito de tentativas.
- **FR-013**: Esgotadas as tentativas, a partida DEVE entrar em pausa com causa de persistência (D-034), e nenhum comando DEVE ser aceito enquanto ela durar.
- **FR-014**: A pausa por persistência DEVE se desfazer automaticamente na primeira gravação bem-sucedida.
- **FR-015**: Falha de gravação NÃO DEVE resultar em rejeição de promessa sem tratamento em nenhum caminho.

**Pausa com causa**

- **FR-016**: O estado de pausa DEVE registrar **quais** causas estão ativas, e não apenas que existe pausa.
- **FR-017**: Causas simultâneas DEVEM coexistir; a partida só retoma quando nenhuma persiste.
- **FR-018**: O deslocamento de prazos em voo DEVE usar o intervalo entre o início da **primeira** causa ativa e o fim da **última**, não o da causa que se resolveu por último.
- **FR-019**: O instante de início da pausa DEVE sobreviver à troca de autoridade e ao reload do host — pertence ao estado persistido, não à memória do processo.
- **FR-020**: A superfície de pausa DEVE nomear a causa; uma pausa sem jogadores ausentes não pode ser invisível.

**Autoridade reassumida**

- **FR-021**: Ao reassumir a autoridade, o host DEVE determinar quem está conectado pela presença observada no canal, não pelos valores de conexão gravados no estado anterior.
- **FR-022**: A reconciliação de presença DEVE preceder a decisão de pausar ou retomar, para não emitir pausa e retomada em sequência a cada reassunção.
- **FR-023**: Um jogador que saiu durante a ausência do host DEVE ser detectado como ausente após a reassunção; um que voltou NÃO DEVE manter a partida pausada.

**Reentrada por código (D-033)**

- **FR-024**: Todo assento DEVE ter um código de reentrada, criado junto do assento e estável pela vida dele.
- **FR-025**: O código DEVE sobreviver à reordenação de assentos do início da partida e à remoção de outros assentos no lobby.
- **FR-026**: Apresentar link da sala + código válido DEVE reanexar o assento à sessão que apresentou, mesmo com a partida em curso e mesmo sem o token original.
- **FR-027**: Após a reanexação, o token anterior NÃO DEVE mais ter aquele assento.
- **FR-028**: A reanexação por código DEVE seguir o caminho normal de reconexão: se ela remove a última ausência, a partida retoma.
- **FR-029**: A tela de entrada de uma partida já iniciada DEVE oferecer o campo de código; código inválido recusa de forma legível e permite nova tentativa.
- **FR-030**: O dono do assento DEVE conseguir ler o próprio código durante o lobby e durante a partida.
- **FR-031**: O código de um assento removido no lobby DEVE deixar de valer.

**Prova executável**

- **FR-032**: O harness de rede DEVE saber falhar: derrubar e restaurar canal, recusar gravação (transitória e persistente), entregar gravações fora de ordem e perder difusões.
- **FR-033**: Toda garantia nova de transporte DEVE ter caso correspondente na suíte de conformidade, executada contra **os dois** adapters (in-memory e Supabase falso).
- **FR-034**: DEVE existir prova de ponta a ponta em browser real de que recarregar a página no meio de um prazo em voo preserva o prazo e o estado.

### Key Entities

- **Causa de pausa** — motivo pelo qual a partida está parada (`disconnect`, `persistence`), com o instante em que a primeira causa ativa começou. Vive no estado da partida, porque precisa sobreviver ao reload do host (FR-019). Substitui o booleano de pausa de hoje.
- **Estado de conexão da sessão** — se esta sessão está conectada, reconectando ou dessincronizada. Vive na casca de rede, fora do estado da partida (não é regra de jogo e não pode divergir entre clientes por difusão).
- **Código de reentrada** — credencial de recuperação de um assento, independente do dispositivo. Vive na sala, ao lado do token, com a mesma exposição que ele já tem (D-033).
- **Fila de gravação** — escrita serializada e monotônica do estado persistido, com repetição e sinal de esgotamento. Vive no adapter de transporte, atrás da porta existente.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Uma queda de canal seguida de restabelecimento, **sem recarregar a página**, devolve a partida ao curso normal em todas as telas. Hoje ela trava indefinidamente.
- **SC-002**: Um jogador desconectado vê, na própria tela, que está desconectado, em toda queda — não existe estado em que a tela mostre a partida como normal enquanto a sessão está fora.
- **SC-003**: Nenhum comando aceito pelo host fica sem estar gravado: com a persistência derrubada, a partida pausa em vez de avançar, e o estado após a retomada é contínuo.
- **SC-004**: Duas gravações fora de ordem nunca deixam gravado o estado mais antigo.
- **SC-005**: Recarregar a página do host durante uma pausa e retomar depois preserva o tempo restante de todo prazo em voo, com tolerância de um tick.
- **SC-006**: Após a reassunção da autoridade, a lista de ausentes coincide com quem de fato não está no canal, em todas as combinações de quem saiu e quem voltou durante a ausência do host.
- **SC-007**: Um jogador sem o token original entra pelo link com o código de reentrada e recupera o assento com estado íntegro.
- **SC-008**: A suíte de conformidade cobre, nos dois adapters, todos os comportamentos novos de transporte — nenhuma garantia nova existe só em comentário.
- **SC-009**: Um E2E em browser real recarrega a página no meio de um leilão e a partida continua, com prazo e estado preservados.
- **SC-010**: Nenhuma regressão nas 19 suítes de `tests/net/` nem no smoke E2E existente.

---

## Assumptions

- **O modelo de autoridade não muda.** Host-autoritativo, sem transferência de host (D-020, §16). Host fora continua sendo pausa indefinida — esta spec endurece o caminho, não o substitui.
- **O motor não muda.** Nenhuma regra de jogo é tocada. A única alteração no estado da partida é a forma da pausa, que existe para servir a §11.3/§11.4.
- **A exposição do código de reentrada é a mesma do token.** Aceito explicitamente em D-033; o endurecimento de identidade de transporte segue como pendência separada, e esta spec não o resolve nem o adia.
- **Não há timeout de desconexão.** Toda espera desta spec é indefinida por desenho (D-015, §11.3).
- **O free tier do Supabase continua sendo o alvo.** A repetição de gravação usa espera crescente e limite finito justamente para não transformar uma falha em tempestade de requisições.

## Fora de escopo

- **Autoridade de servidor** e endurecimento de anti-spoof no transporte — pendência conhecida desde a 037, exige Edge Function e é decisão de arquitetura própria.
- **Contas e login** — v2 por decisão explícita (D-019).
- **Transferência de host** — recusada pelo SRS §16.
- **Timeout ou eliminação de ausente** — recusado pelo princípio VII e pela D-016.
- **Limpeza/TTL de salas antigas na persistência** — operação, não resiliência de sessão.
- **Espectadores** — fora do escopo do v1 (§16); a reentrada por código devolve o assento ao dono, não cria acesso de terceiros.
