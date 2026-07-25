# Feature Specification: Partida online jogável — perspectiva local, identidade real e roteamento

**Feature Branch**: `038-partida-online-jogavel`

**Created**: 2026-07-24

**Status**: Draft

**Input**: User description: "Partida online de verdade — a UI passa a ter perspectiva de jogador local (cada cliente só decide pelo próprio assento), identidade real da sala (nomes, cores e tokens visuais no lugar de p1..pN), status de conexão/pausa visível e roteamento home → sala → partida → fim. Inclui escolha de token visual único e kick pelo host no lobby (SRS §11.1/§11.2) e a rolagem de ordem inicial (prioridade menor)."

## Contexto e fronteira

A [spec 037](../037-sala-online-estado-sincronizado/spec.md) entregou a **fundação**: sala com assentos amarrados a token de sessão, comandos com identidade validada pelo host, difusão determinística, snapshot, pausa por desconexão e um lobby mínimo (nome + cor + link + iniciar). Dois browsers já jogam a mesma partida.

Falta a **experiência**: a interface ainda é a do cliente único de desenvolvimento — ela renderiza sempre a perspectiva do *jogador da vez*, chame quem chamar. Em uma partida online isso significa que, quando é a vez do adversário, **a minha tela vira a tela dele** — inclusive a mão de cartas dele (viola o princípio VI) — e eu vejo botões que, se clicados, são simplesmente descartados pelo host (comportamento correto, mas ilegível para quem joga). Somado a isso, ninguém tem nome: a vitória celebra `p1`.

Esta spec é de **casca**: nenhuma regra do SRS muda. Ela decide **o que cada pessoa vê e pode acionar**, dado o assento que ela ocupa.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cada um joga do seu lugar (Priority: P1)

Sou um dos jogadores de uma sala. Na minha tela, as decisões que aparecem para eu tomar são **as minhas**: rolo o dado quando é a minha vez, decido comprar a propriedade em que **eu** parei, dou lance no leilão em que estou licitando, respondo à proposta de troca que **me** foi enviada. Quando a decisão é de outra pessoa, minha tela mostra o que está acontecendo e de quem o jogo está esperando — sem oferecer botões que não são meus. Minha mão de cartas é minha: dos outros eu vejo apenas quantas cartas têm.

**Why this priority**: é a diferença entre "dois browsers sincronizados" e "um jogo online". Sem isso, a interface mente (oferece ações que serão descartadas) e a privacidade de cartas — princípio VI e SRS §10.3 — é violada em toda troca de turno. Todo o resto desta spec é cosmético perto disso.

**Independent Test**: com dois dispositivos numa mesma partida, percorrer um turno completo verificando que cada ponto de decisão só é acionável no dispositivo do ator legítimo e que a mão exibida é sempre a do dono da tela.

**Acceptance Scenarios**:

1. **Given** partida em curso e é a vez de outro jogador, **When** olho minha tela, **Then** vejo o estado do tabuleiro e a indicação de quem o jogo está aguardando pelo nome dessa pessoa, e nenhum controle de decisão dela está acionável para mim.
2. **Given** é a minha vez, **When** o jogo aguarda minha rolagem, **Then** o controle de rolar está acionável para mim e para mais ninguém.
3. **Given** um leilão aberto do qual participo, **When** é a vez de qualquer jogador, **Then** posso dar lance ou passar da minha própria tela — a legitimidade de agir **não** depende de ser o dono do turno.
4. **Given** recebi uma proposta de troca, **When** ela chega, **Then** o pedido de resposta aparece **na minha** tela; na tela de quem propôs aparece o estado "aguardando resposta de <nome>".
5. **Given** sou alvo de uma carta ofensiva e tenho uma carta de reação aplicável, **When** a janela de reação abre, **Then** o prompt de reação aparece só para mim, com a janela de tempo prevista pelo SRS §12.4.
6. **Given** outro jogador tem cartas na mão, **When** olho o HUD, **Then** vejo **apenas a quantidade** de cartas e de Bus Tickets dele (§12.3) — nunca quais são.
7. **Given** é a vez de outro jogador e ele está com cartas na mão, **When** a vez passa para ele, **Then** o painel "Minhas Cartas" da minha tela continua mostrando **a minha** mão (ou o vazio, se eu não tiver cartas).
8. **Given** fui eliminado por falência, **When** a partida continua, **Then** minha tela acompanha a partida sem oferecer nenhum controle de decisão.

---

### User Story 2 - Todo mundo tem nome (Priority: P2)

Escolhi meu nome, minha cor e minha peça ao entrar na sala. Durante a partida, é assim que os outros me veem — no painel de jogadores, na peça que anda pelo tabuleiro, no log de eventos, nos modais de negociação e na tela de fim de jogo. Em nenhum lugar aparece um identificador técnico.

**Why this priority**: é um critério explícito de "finalizado" do produto (PRD §3, item 4) e o que dá identidade social à mesa. Depende da US1 apenas por conveniência de leitura — pode ser entregue e demonstrada sozinha.

**Independent Test**: iniciar uma partida com nomes distintos e percorrer todas as superfícies textuais (painéis, log, modais, vitória) confirmando que nenhuma exibe identificador técnico.

**Acceptance Scenarios**:

1. **Given** uma partida iniciada com nomes escolhidos no lobby, **When** qualquer evento é registrado no log, **Then** ele nomeia as pessoas envolvidas pelo nome escolhido.
2. **Given** dois jogadores escolheram o **mesmo nome** (permitido), **When** olho o painel de jogadores e o tabuleiro, **Then** consigo distinguir um do outro pela cor e pela peça.
3. **Given** a partida terminou, **When** a tela de fim de jogo aparece, **Then** ela celebra o vencedor pelo nome e pela cor dele.
4. **Given** um jogador foi eliminado, **When** olho o painel, **Then** o nome dele continua legível e marcado como eliminado.
5. **Given** entro numa partida em curso após reconectar, **When** a tela carrega, **Then** vejo os mesmos nomes/cores/peças que os demais veem.

---

### User Story 3 - Ninguém é punido por cair (Priority: P3)

Alguém perde a conexão no meio da partida. Todos veem imediatamente que a partida pausou, **quem** caiu, e que nada será perdido. Quando a pessoa volta, a partida retoma sozinha do ponto exato — inclusive prazos que estavam correndo.

**Why this priority**: a mecânica já existe (037); o que falta é torná-la **visível**. Sem essa superfície, uma pausa é indistinguível de um travamento — a confiança no produto depende de comunicar isso (princípio VII, D-016, §11.3).

**Independent Test**: derrubar a rede de um dispositivo no meio de um leilão e observar, nos demais, o aviso de pausa com o nome de quem caiu, o congelamento do prazo e a retomada automática ao reconectar.

**Acceptance Scenarios**:

1. **Given** partida em curso, **When** um jogador perde a conexão, **Then** todas as telas exibem o estado de pausa identificando quem caiu, e nenhum controle de decisão fica acionável.
2. **Given** a partida está pausada por desconexão, **When** o jogador reconecta, **Then** a pausa some sozinha em todas as telas e o jogo continua do mesmo ponto.
3. **Given** havia um prazo correndo (leilão ou janela de reação) quando a pausa começou, **When** a partida retoma, **Then** o tempo restante mostrado é o mesmo que restava no instante da pausa.
4. **Given** quem caiu foi o **anfitrião**, **When** olho minha tela, **Then** o aviso deixa claro que a partida aguarda o retorno dele e que não há transferência de comando.
5. **Given** a pausa dura muito tempo, **When** espero, **Then** nada expira, nada é confiscado e nenhuma contagem regressiva pressiona ninguém.

---

### User Story 4 - Entrar e sair da sala sem saber o que é um parâmetro de URL (Priority: P4)

Abro o endereço do jogo e encontro duas opções claras: criar uma sala ou entrar em uma com o link recebido. Como anfitrião, monto a sala escolhendo minha peça, vejo quem chegou, removo quem entrou por engano e inicio quando estiver todo mundo. Ao fim da partida, volto para a tela inicial.

**Why this priority**: hoje a única porta de entrada é digitar parâmetros na URL — inviável para qualquer pessoa fora do desenvolvimento. Depende da sala já existente (037).

**Independent Test**: a partir da tela inicial, criar uma sala, entrar por link em outro dispositivo, remover um convidado, iniciar a partida e, ao final, retornar à tela inicial — sem editar a URL em nenhum momento.

**Acceptance Scenarios**:

1. **Given** abro o endereço do jogo sem link de sala, **When** a tela inicial carrega, **Then** posso criar uma sala ou colar o link de uma sala existente.
2. **Given** estou montando minha entrada na sala, **When** escolho minha identidade, **Then** escolho nome, cor **e peça**, sendo cor e peça únicas na sala (§12.5) — as já tomadas não são oferecidas.
3. **Given** sou o anfitrião e alguém entrou por engano, **When** removo essa pessoa antes do início, **Then** ela perde o assento, é avisada do que aconteceu, e a cor/peça dela volta a ficar disponível.
4. **Given** sou o anfitrião, **When** tento me remover, **Then** a ação não é oferecida.
5. **Given** a partida terminou, **When** a tela de fim de jogo é fechada, **Then** volto à tela inicial e posso criar ou entrar em outra sala.
6. **Given** abro um link de sala cuja partida já terminou, **When** a tela carrega, **Then** sou informado disso e levado à tela inicial.

---

### User Story 5 - A ordem da mesa é sorteada (Priority: P5)

No início da partida, a ordem de jogo é decidida por sorteio à vista de todos, em vez de simplesmente seguir quem chegou primeiro.

**Why this priority**: é o menor incremento desta spec e o único puramente ritual; a 037 deixou a ordem de entrada como padrão explicitamente substituível aqui. Pode ser cortado sem afetar as demais histórias.

**Independent Test**: iniciar duas partidas com os mesmos assentos e observar que a ordem resultante varia e é exibida a todos antes do primeiro turno.

**Acceptance Scenarios**:

1. **Given** o anfitrião inicia a partida, **When** a ordem é sorteada, **Then** todos veem o resultado do sorteio antes do primeiro turno, com a ordem final da mesa.
2. **Given** a ordem foi sorteada, **When** a partida começa, **Then** a sequência de turnos segue exatamente essa ordem para todos os clientes.

---

### Edge Cases

- **Ator fora do turno**: leilão (qualquer licitante), proposta de troca recebida, janela de reação e resposta a pedido de empréstimo são decisões de quem **não** é o dono do turno — a perspectiva local deve habilitá-las para o ator legítimo, não para o jogador da vez.
- **Duas abas do mesmo jogador**: a última conexão assume o assento (037, FR-006a); a aba antiga precisa deixar claro que perdeu o controle, em vez de mostrar uma tela morta.
- **Eliminado que fecha a aba**: não pausa a partida dos sobreviventes (D-029) — e a mesa não pode exibir esse assento como "aguardando conexão".
- **Desconexão durante uma decisão minha**: ao voltar, a decisão continua sendo minha, no mesmo ponto.
- **Nome vazio, longo demais ou só espaços**: a entrada precisa de um limite e de um valor de exibição válido.
- **Reconexão de quem foi removido no lobby**: reabrir o link depois de removido não devolve o assento automaticamente — a pessoa entra como novo pedido, sujeito às regras de sala.
- **Sala cheia de peças**: a quantidade de peças visuais precisa cobrir o máximo de 8 assentos (§11.1).
- **Partida terminada e link reaberto**: não pode reabrir a mesa nem parecer um erro.
- **Abrir o jogo sem sala (uso de desenvolvimento)**: sem link de sala, todos os assentos pertencem ao dispositivo — o comportamento atual de cliente único não pode regredir.

## Requirements *(mandatory)*

### Functional Requirements

#### Perspectiva de jogador local (US1)

- **FR-001**: O sistema MUST determinar, em cada cliente, qual assento pertence àquele dispositivo, a partir da associação assento↔token de sessão já mantida pela sala (037), e manter essa determinação estável durante toda a partida, inclusive após reconexão.
- **FR-002**: Todo ponto de decisão MUST ser acionável apenas no cliente do **ator legítimo** daquela decisão — que é o jogador da vez em decisões de turno e o participante correspondente em decisões fora de turno (licitante em leilão, destinatário de proposta de troca, alvo de carta com reação, credor/devedor em empréstimo).
- **FR-003**: Nos clientes que **não** são o ator, o sistema MUST exibir o estado da decisão em curso identificando pelo nome de quem o jogo aguarda, sem oferecer o controle correspondente.
- **FR-004**: A restrição de FR-002 MUST ser tratada como orientação de interface, não como validação de regra: a autoridade sobre a legitimidade de um comando permanece no anfitrião (D-020), que continua descartando comandos de remetente ilegítimo mesmo que um cliente adulterado os envie.
- **FR-005**: O painel de cartas da mão MUST exibir sempre a mão do **dono da tela**, independentemente de quem é o jogador da vez.
- **FR-006**: Para os demais jogadores, o sistema MUST exibir apenas os contadores de cartas na mão e de Bus Tickets (§12.3), nunca a identidade das cartas.
- **FR-006a**: A garantia de privacidade desta spec é **de apresentação** (D-030): o estado da partida continua chegando completo a cada cliente, e a documentação do produto MUST registrar essa limitação de forma visível, em vez de prometer sigilo que o modelo de sincronização não sustenta.
- **FR-007**: Um jogador eliminado MUST continuar acompanhando a partida sem nenhum controle de decisão acionável.

#### Identidade real (US2)

- **FR-008**: Toda superfície que hoje identifica jogadores MUST usar o nome, a cor e a peça escolhidos na sala — painel de jogadores, peças no tabuleiro, log de eventos, modais de decisão/negociação, avisos e tela de fim de jogo.
- **FR-009**: Nenhuma superfície visível ao jogador MUST exibir identificador técnico de assento (`p1`..`p8`).
- **FR-010**: A identidade (nome, cor, peça) MUST permanecer fora do estado de jogo persistido, vivendo no estado da sala (D-019), com a junção feita no momento da exibição.
- **FR-011**: Nomes duplicados MUST permanecer permitidos e distinguíveis por cor e peça.
- **FR-012**: O sistema MUST limitar o tamanho do nome exibido e recusar nome vazio ou composto apenas de espaços.

#### Sessão visível (US3)

- **FR-013**: Enquanto a partida estiver pausada por desconexão, todos os clientes MUST exibir o estado de pausa identificando quem está desconectado.
- **FR-014**: Durante a pausa, nenhum controle de decisão MUST ficar acionável em nenhum cliente.
- **FR-015**: O status de conexão de cada jogador MUST ser visível no painel de jogadores (§12.3).
- **FR-016**: Prazos em andamento MUST aparecer congelados durante a pausa e retomar exibindo o tempo restante que existia no instante da pausa.
- **FR-017**: Quando o desconectado for o anfitrião, o aviso MUST informar que a partida aguarda o retorno dele e que não há transferência de comando (§11.3, D-020).
- **FR-018**: A pausa MUST retomar automaticamente quando todos os jogadores **ainda em jogo** estiverem conectados, sem qualquer ação manual.
- **FR-018a**: A desconexão de um jogador **eliminado** MUST NOT pausar a partida nem aparecer como bloqueio nas telas dos demais (§11.3 com a exceção da D-029); o retorno dele também MUST NOT ser condição para retomar.
- **FR-019**: A interface de pausa MUST NOT oferecer contagem regressiva, expiração ou qualquer ação destrutiva (princípio VII, D-015).
- **FR-020**: Quando uma segunda conexão do mesmo jogador assume o assento, a conexão anterior MUST informar que perdeu o controle para outra aba/dispositivo.

#### Entrada e saída da sala (US4)

- **FR-021**: O sistema MUST oferecer uma tela inicial com as opções de **criar sala** e **entrar por link**, sem exigir manipulação de endereço.
- **FR-022**: Ao entrar na sala, o jogador MUST escolher nome, cor e **peça visual**; cor e peça são únicas por sala (§12.5) e as já ocupadas não são oferecidas.
- **FR-023**: O catálogo de peças visuais MUST comportar o máximo de 8 assentos simultâneos (§11.1).
- **FR-024**: O anfitrião MUST poder remover um jogador da sala **antes do início da partida** (§11.1); o removido MUST ser informado, e cor/peça voltam a ficar disponíveis.
- **FR-025**: O anfitrião MUST NOT poder remover a si mesmo.
- **FR-026**: Reabrir o link após ter sido removido MUST NOT devolver o assento automaticamente — a pessoa volta a ser um pedido de entrada sujeito às regras da sala.
- **FR-027**: Ao término da partida, o jogador MUST poder retornar à tela inicial a partir da tela de fim de jogo.
- **FR-028**: Abrir o link de uma sala cuja partida já terminou MUST informar isso claramente e conduzir à tela inicial.
- **FR-029**: Abrir o jogo sem link de sala MUST preservar o comportamento de cliente único existente (todos os assentos pertencem ao dispositivo), sem regressão.

#### Ordem inicial (US5)

- **FR-030**: Ao iniciar a partida, o sistema MUST sortear a ordem de turno e exibi-la a todos antes do primeiro turno, substituindo a ordem de entrada usada como padrão pela 037.
- **FR-031**: A ordem sorteada MUST ser idêntica em todos os clientes.

### Key Entities

- **Assento**: lugar na sala, já existente (037) — vincula o identificador de jogador usado pelo jogo ao token de sessão do dispositivo e ao estado de conexão.
- **Identidade visual**: nome, cor e peça escolhidos por quem ocupa o assento; vive na sala, nunca no estado de jogo (D-019); cor e peça são únicas por sala.
- **Visão local**: o que o cliente sabe sobre si — qual assento é o dele e, para cada decisão em aberto, se ele é o ator, um observador ou um eliminado.
- **Ponto de decisão**: uma decisão em aberto na partida, com seu ator legítimo (que pode não ser o jogador da vez) e, quando houver, o prazo associado.
- **Estado de sessão da mesa**: se a partida está em curso ou pausada, quem está desconectado e se o ausente é o anfitrião.
- **Fase de navegação**: onde a pessoa está no fluxo — tela inicial, sala, partida ou fim de jogo.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Em uma partida de 3 jogadores, percorrendo um turno completo, **100%** dos pontos de decisão são acionáveis apenas no dispositivo do ator legítimo — e isso inclui as decisões fora do turno (leilão, troca recebida, reação, empréstimo).
- **SC-002**: Em uma partida com nomes escolhidos, **nenhuma** superfície visível exibe identificador técnico de assento — verificável varrendo painéis, log, modais, tabuleiro e tela de vitória.
- **SC-003**: Em nenhum momento a interface de um jogador exibe a identidade das cartas na mão de outro; para os demais, o que se vê é sempre e apenas a contagem.
- **SC-004**: A queda de um jogador aparece como pausa identificada em todas as demais telas em **até 2 segundos**, e a retomada após a reconexão é automática, sem clique de ninguém.
- **SC-005**: Após uma pausa de qualquer duração, o prazo retomado difere em **no máximo 1 segundo** do que restava no instante da pausa.
- **SC-006**: Uma pessoa que nunca viu o jogo consegue, partindo da tela inicial, criar uma sala, receber outro jogador por link e iniciar a partida **sem editar o endereço** e sem ajuda.
- **SC-007**: Abrir o jogo sem link de sala continua entregando o cliente único de hoje, com a suíte de regras existente inalterada — **zero** mudança de comportamento no motor.
- **SC-008**: Em 10 partidas iniciadas com os mesmos assentos, a ordem de turno sorteada varia e é sempre idêntica entre todos os clientes da mesma partida.

## Assumptions

- A perspectiva local é uma decisão de **apresentação**: a autoridade sobre o que é um comando legítimo continua sendo do anfitrião (D-020/037). Nada aqui afrouxa ou substitui essa validação.
- Nenhum arquivo de regra do motor muda de comportamento; esta spec opera sobre o estado que a fundação já difunde (princípio I, SC-007 da 037).
- **Kick apenas no lobby**: o SRS §11.1 dá ao anfitrião o poder de remover jogadores sem qualificar o momento; remover alguém **durante** a partida colidiria com D-016/princípio VII (desconexão não pune, propriedades não voltam ao banco). Esta spec restringe a remoção ao período pré-início; kick mid-game exigiria ADR próprio.
- **Sem link de sala, todos os assentos são locais** — o modo de cliente único segue existindo como andaime de desenvolvimento e demonstração (PRD §1), com a perspectiva acompanhando o jogador da vez.
- A escolha de peça reaproveita o vocabulário visual de tokens já existente no tabuleiro; o catálogo precisa apenas garantir 8 opções distintas.
- Espectadores externos continuam fora de escopo (§16): "observar" aqui é só o estado de quem tem assento e não é o ator do momento, ou de quem foi eliminado.
- Esta spec depende da 037 **operante com infraestrutura viva** (sala persistida e canal de tempo real funcionando) para ser demonstrada ponta a ponta.

## Clarificações resolvidas (2026-07-24)

Ambas foram decididas com o usuário e registradas como ADR antes de entrarem na spec — nenhuma regra nasceu aqui (princípio I).

- **Q1 — Privacidade de cartas: apresentação ou dados?** → **Garantia de apresentação no v1** ([D-030](../../docs/DECISIONS.md#d-030--privacidade-de-cartas-é-garantia-de-apresentação-no-v1), SRS §10.3 v1.5). Nenhuma interface exibe a mão alheia; o estado segue chegando completo a cada cliente, porque filtrar por destinatário quebraria a convergência determinística da 037 e exigiria autoridade de servidor real. A limitação é registrada, não escondida (FR-006a); o endurecimento entra junto do anti-spoof de transporte.
- **Q2 — Desconexão de jogador eliminado pausa a partida?** → **Não pausa** ([D-029](../../docs/DECISIONS.md#d-029--desconexão-de-jogador-eliminado-não-pausa-a-partida), SRS §11.3 v1.5). Eliminado não tem patrimônio nem turno a proteger; como não há timeout de desconexão, a regra literal deixaria a mesa refém de quem já perdeu. Vira FR-018a.
