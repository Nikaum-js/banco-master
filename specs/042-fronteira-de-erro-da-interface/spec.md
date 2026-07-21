# Feature Specification: Fronteira de erro — a tela cai, a partida não

**Feature Branch**: `main` (fluxo sem branch por feature)

**Created**: 2026-07-26

**Status**: Draft

**Input**: User description: "ErrorBoundary — zero cobertura no repo; qualquer exceção não tratada derruba a tela sem recuperação, o que tensiona direto com a garantia de resiliência da D-034."

**Depende de**: spec [037](../037-sala-online-estado-sincronizado/spec.md) (sessão de sala, transporte, pausa), spec [038](../038-partida-online-jogavel/spec.md) (perspectiva local, superfície de pausa), spec [040](../040-log-eventos-tipado/spec.md) (log tipado — a fonte de exceção que virou difusão), spec [041](../041-resiliencia-de-sessao/spec.md) (reconexão, estado de conexão local, reentrada por código, pausa com causa)

**Regra de origem**: princípio VII e SRS §11.3/§11.4. A regra **nova** entra por ADR escrita antes desta spec: [D-035](../../docs/adr/D-035-falha-de-interface-nao-derruba-a-partida.md) (falha de interface não derruba a partida). SRS bumped para v1.8.

**Paralelismo**: esta spec vive na **casca** — a raiz (`src/main.tsx`, `src/App.tsx`), a fronteira nova e a tela de falha. Ela toca `src/net/**` num ponto só: a sessão precisa expor o encerramento de presença que a fronteira de último recurso chama (FR-005). Não altera o motor, não altera o `GameState`, não altera nenhum reducer, e não corrige nenhuma das exceções que hoje existem — corrigi-las é dívida das specs onde elas nasceram.

---

## Por que esta spec existe

O princípio VII promete que nada se perde e nomeia **uma** forma de falha: a rede. A [D-034](../../docs/adr/D-034-persistencia-indisponivel-pausa-a-partida.md) acrescentou a segunda, a persistência, e a 041 provou as duas com um harness que sabe falhar. A terceira sempre esteve lá e nunca foi nomeada: **o nosso próprio código**. Hoje o `grep` por fronteira de erro em `src/` volta vazio (achado F1 da auditoria de 2026-07-23, item 6 da priorização). Uma exceção em qualquer render desmonta a árvore inteira e deixa o jogador com um `<div id="root">` vazio: sem frase, sem caminho, sem saber que a partida continua existindo do outro lado.

Enquanto o projeto era single-player, isso era um jogador perdendo o próprio progresso. Com a 040, virou outra coisa.

**1. A exceção agora é difundida.** O log virou estrutura tipada que o motor emite e **todas as telas renderizam igual**. `boards/shared.tsx:1597` chama `describeLogEntry` durante o render; `ui/log/describeLog.ts:19` e `ui/log/logIcon.tsx:12` lançam por exaustividade quando encontram um `LogKind` que não conhecem; `ui/sound/classify.ts:42` lança dentro do seletor que alimenta o som — ou seja, dentro do `getSnapshot` que a UI lê a cada mudança de estado. Um `kind` novo emitido pelo motor sem descritor correspondente não derruba **um** jogador: derruba **a mesa inteira, no mesmo instante**, porque todos recebem o mesmo fato.

**2. E o veneno está no snapshot.** O log faz parte do `GameState` (`game/turn/types.ts:87`), que é exatamente o que a 041 persiste e recarrega. Recarregar a página traz o log de volta, a tela renderiza, e explode outra vez. É o único modo de falha do projeto em que **F5 não é saída** — e é justamente o remédio que a auditoria propôs ("boundary no `App` com recarregar mantendo partida"). O conselho está certo pela metade: sem interromper a repetição, o botão de recarregar é uma armadilha educada.

**3. Onde a fronteira fica decide o preço da queda.** `roomSession.dispose()` **não** derruba a conexão — é decisão deliberada da 037 para sobreviver ao StrictMode (`net/roomSession.ts:246`). Então uma fronteira única no topo, que substitui tudo pela tela de falha, desmonta o `OnlineRoom`, mata o `setInterval` que chama `tick()` (`net/ui/OnlineGate.tsx:79-82`) e **deixa o canal vivo**. O resultado é a pior combinação possível: a presença continua anunciada, a mesa **não** pausa, e o host parou de fechar prazos. Um leilão aberto nunca fecha, uma janela de reação nunca vence, e a mesa parece perfeitamente normal enquanto está morta. Trocar tela branca por mesa zumbi é repetir na interface a mesma divergência silenciosa que a D-034 recusou na persistência — que é exatamente a tensão que motivou esta spec.

**4. O que quebra quase nunca é o que importa.** A fonte de exceção mais provável do repo é o log central: uma camada **acessória**, que ninguém precisa para rolar o dado, comprar uma propriedade ou aceitar uma troca. Hoje ela leva junto o tabuleiro, os modais e os controles de decisão, porque tudo mora na mesma árvore sem nenhuma divisória.

**5. Metade das exceções não passa por fronteira nenhuma.** Fronteira de React só vê o que acontece no render. Handler de evento, `setTimeout` (os timers de leilão de `game/store.ts`), callback de canal e promessa rejeitada escapam. `net/host.ts:83` aplica o comando dentro de um callback do transporte: uma exceção ali sobe para o supabase-js, o comando é descartado, o estado não avança, o `seq` não incrementa — e quem clicou vê o botão simplesmente não fazer nada, para sempre, sem uma linha de explicação em lugar nenhum.

Nenhum desses cinco tem teste, e não teriam mesmo se alguém quisesse: `vitest.config.ts` roda em `environment: 'node'` e só inclui `tests/**/*.test.ts`. A suíte inteira do projeto — 350+ testes — é de motor e view-model puro. **Nenhum componente React deste repo jamais foi montado num teste.** Provar que uma tela não fica em branco exige, pela primeira vez, montar a tela.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Um erro na minha tela não custa a partida de ninguém (Priority: P1) 🎯 MVP

Algo na interface quebra no meio da partida — um painel, o log, um modal. Em vez da tela branca, a parte que quebrou é substituída por um aviso, o resto continua jogável, e nas telas dos outros jogadores não acontece absolutamente nada.

**Why this priority**: é a diferença entre um defeito de apresentação e uma partida perdida por oito pessoas. Também é o requisito que decide a arquitetura inteira da feature: a fronteira ficar **abaixo** da sessão é o que preserva conexão, presença, autoridade e relógio de prazos ([D-035](../../docs/adr/D-035-falha-de-interface-nao-derruba-a-partida.md)). Feito só isto, o produto já deixa de ter o modo de falha mais caro que tem hoje.

**Independent Test**: forçar uma exceção durante o render da superfície de partida em um cliente e observar (a) que aquela tela mostra um aviso em vez de ficar em branco e (b) que nenhuma outra tela da mesa registra pausa, ausência ou qualquer mudança.

**Acceptance Scenarios**:

1. **Given** partida em curso, **When** uma exceção acontece no render da minha superfície de partida, **Then** minha tela mostra uma tela de falha legível — nunca uma tela em branco.
2. **Given** minha tela caiu, **When** os outros jogadores olham as telas deles, **Then** nada mudou: a partida não pausou, eu não apareço como ausente e nenhum prazo se alterou.
3. **Given** sou o anfitrião e minha superfície de partida caiu, **When** um prazo em voo vence, **Then** ele é fechado normalmente — a autoridade e o relógio continuam de pé.
4. **Given** o log central não consegue se apresentar, **When** olho a tela, **Then** o tabuleiro, os modais e meus controles de decisão continuam funcionando, e o espaço do log diz que ele falhou.
5. **Given** uma camada acessória caiu, **When** ela cai, **Then** o espaço dela não fica silenciosamente vazio — a ausência é anunciada, para ninguém tomar decisão achando que não houve evento.

---

### User Story 2 - Eu entendo o que aconteceu e sei como voltar (Priority: P1)

A tela quebrou. O que eu leio não é um código de erro: é que algo deu errado na exibição, que minha partida continua lá com meu dinheiro, minhas propriedades e minhas cartas, e qual é o botão que me devolve para ela.

**Why this priority**: uma tela de falha sem caminho de volta é a tela branca com melhor tipografia. O caminho de volta já existe inteiro — a 041 entregou reconexão, reentrada pelo link e código de assento (D-033); esta história é o que liga a falha a esse caminho. Empata em P1 com a US1 porque conter sem devolver não resolve o problema de ninguém.

**Independent Test**: com a tela caída e a sessão viva, acionar a volta e verificar que a partida reaparece no estado atual; com a sessão morta, verificar que a tela oferece reabrir pelo link e, sem assento reconhecido, o campo de código.

**Acceptance Scenarios**:

1. **Given** minha tela caiu e minha sessão continua conectada, **When** aciono voltar para a partida, **Then** a superfície é remontada sem recarregar a página e mostra o estado atual — inclusive o que aconteceu enquanto minha tela estava caída.
2. **Given** minha tela caiu numa sala, **When** leio a tela de falha, **Then** ela afirma o que está preservado (saldo, propriedades, cartas e prazos), na mesma linguagem que a superfície de pausa já usa.
3. **Given** minha sessão não sobreviveu à queda, **When** leio a tela de falha, **Then** ela me oferece reabrir a sala pelo link e, se meu assento não for reconhecido, o campo do código de reentrada.
4. **Given** estou numa partida **local** (sem sala), **When** minha tela cai, **Then** a tela de falha diz que esta partida não pode ser recuperada e oferece começar de novo — sem botão que finja o contrário.
5. **Given** a tela de falha está na minha frente, **When** olho para ela, **Then** não há contagem regressiva, não há prazo correndo e nenhuma ação destrói a partida sem eu confirmar.

---

### User Story 3 - A mesa nunca fica de pé sem relógio (Priority: P2)

Quebrou não a superfície da partida, mas a casca que segura a sessão. Minha tela cai por inteiro — e, para os outros, isso aparece pelo que já existe: eu saí, a partida pausou esperando por mim. Quando eu volto pelo link, tudo retoma.

**Why this priority**: é a metade escondida da decisão. Sem ela, a queda da casca deixa presença viva, mesa não pausada e host sem fechar prazos — o pior resultado da lista, porque é invisível. Fica em P2 porque a casca é bem menor e mais estável que a superfície de jogo, não porque a falha é menor.

**Independent Test**: forçar uma exceção na casca de sessão de um cliente e observar, em outra tela, a partida pausar nomeando aquele jogador — e retomar quando ele reabrir o link.

**Acceptance Scenarios**:

1. **Given** partida em curso, **When** a casca da minha sessão cai, **Then** minha presença na sala é encerrada antes de a tela de falha aparecer.
2. **Given** minha presença foi encerrada pela queda, **When** os outros olham as telas, **Then** a partida está pausada por **desconexão**, me nomeando — sem causa de pausa nova e sem mensagem diferente das outras quedas (§11.3).
3. **Given** a mesa pausou pela minha queda, **When** reabro o link da sala, **Then** volto ao meu assento e a partida retoma pelo caminho normal de reconexão (041).
4. **Given** sou um jogador **eliminado** e minha casca cai, **When** minha presença é encerrada, **Then** a partida **não** pausa (D-029).
5. **Given** a queda aconteceu antes de eu ter assento (boot, home ou lobby), **When** a tela de falha aparece, **Then** não há presença a encerrar e o caminho oferecido é voltar ao início.
6. **Given** a mesa já estava pausada por outra causa, **When** minha casca cai, **Then** a pausa continua uma só, agora também por minha ausência, e só retoma quando nenhuma causa persistir (D-034).

---

### User Story 4 - O erro que se repete não vira laço (Priority: P2)

A tela quebra, eu mando remontar, e ela quebra de novo no mesmo ponto — porque o problema está no estado da partida, não numa piscada. Em vez de ficar tentando para sempre, a tela para, me diz que parou e me dá o código da ocorrência para eu relatar.

**Why this priority**: é o cenário real do `LogKind` sem descritor, e é o único em que recarregar **piora** a situação: o estado envenenado está no snapshot, então cada reload reencena a explosão. Sem esta história, a US2 entrega um botão que gira em falso.

**Independent Test**: injetar no estado um fato que a apresentação não sabe descrever, mandar remontar e verificar que a segunda falha interrompe as tentativas automáticas, com mensagem própria e identificador da ocorrência; recarregar a página e verificar que o comportamento é o mesmo, sem laço.

**Acceptance Scenarios**:

1. **Given** minha tela caiu, **When** a remontagem falha pela mesma causa, **Then** nenhuma nova tentativa automática acontece e a tela diz que parou de tentar.
2. **Given** o estado da partida é o que quebra a tela, **When** recarrego a página, **Then** a tela de falha aparece de novo sem laço de remontagem e sem congelar o navegador.
3. **Given** uma falha foi contida, **When** leio a tela, **Then** vejo um identificador curto da ocorrência que serve para relatar o problema, sem precisar abrir o console.
4. **Given** uma falha foi contida, **When** ela é registrada, **Then** o registro tem o suficiente para localizar o ponto de falha (o que quebrou, em que fase da sessão, em que sequência de estado).
5. **Given** uma falha foi registrada, **When** o registro é lido, **Then** ele não contém mão de cartas de ninguém, token de sessão nem código de reentrada (princípio VI, D-030, D-033).
6. **Given** o log central é a camada envenenada, **When** a partida segue, **Then** ela **segue** — a queda do log não impede rolar, comprar, negociar nem encerrar o turno.

---

### User Story 5 - Nenhuma exceção fica muda (Priority: P3)

Cliquei num botão e nada aconteceu. Se foi porque a ação explodiu por dentro, eu preciso saber disso — e não descobrir dez minutos depois que a partida está esperando um comando que nunca vai existir.

**Why this priority**: é a metade das exceções que fronteira nenhuma alcança (handler, timer, callback de canal, promessa). É P3 porque a consequência típica é uma ação perdida, não uma partida perdida — mas quando cai no caminho de autoridade do host, uma ação perdida **é** a mesa parada.

**Independent Test**: forçar uma exceção fora do render (num handler e no caminho de aplicação de comando do host) e verificar que ela é registrada e que quem enviou o comando recebe sinal visível de que ele não foi aplicado.

**Acceptance Scenarios**:

1. **Given** uma exceção acontece fora do render (handler, timer, callback de canal ou promessa rejeitada), **When** ela acontece, **Then** ela é registrada com o mesmo tratamento das exceções contidas — nunca some.
2. **Given** um comando meu falha ao ser aplicado pela autoridade, **When** ele falha, **Then** o comando é tratado como recusado e eu recebo sinal visível de que ele não foi aplicado.
3. **Given** um comando falhou ao ser aplicado, **When** olho o estado da partida, **Then** ele não avançou pela metade: nem estado parcial, nem sequência incrementada, nem difusão enviada.
4. **Given** o mesmo comando falha toda vez que eu tento, **When** tento de novo, **Then** a recusa continua visível e traz o identificador da ocorrência — a mesa não fica parada sem que ninguém saiba por quê.

---

### Edge Cases

- **A exceção acontece na própria tela de falha.** A última linha de defesa não pode depender do estado da partida nem da sala: ela é estática e não lê nada que possa estar envenenado.
- **A exceção acontece durante o boot, antes de existir sala.** Não há presença a encerrar; o caminho é voltar ao início.
- **A exceção acontece na tela de reentrada** (partida em curso, sem assento). É casca, mas o assento não é meu: não há presença a encerrar e o campo de código continua sendo o caminho.
- **Duas abas do mesmo dispositivo, uma quebra.** A que quebra encerra a própria presença; o takeover por contagem de presenças da 037 continua valendo para as demais.
- **A tela cai no meio do meu turno.** Nada expira por minha causa (não há timer de turno — D-015), e prazos em voo continuam sendo fechados pelo host, porque a fronteira de jogo não mata o relógio. Ao voltar, encontro a partida onde ela está, não onde eu a deixei.
- **A tela cai durante um leilão em que eu estava dando lance.** Meus lances já aceitos continuam valendo; o prazo continua correndo para a mesa. A fronteira não congela nada — congelar é privilégio da pausa (§11.3).
- **Erro de rede não é erro de interface.** Queda de conexão continua sendo tratada pela 041 (aviso de reconexão) e nunca deve aparecer como falha de interface — misturar as duas ensina o jogador a ignorar as duas.
- **A queda acontece no host durante uma pausa por persistência.** A ausência do host entra como segunda causa da mesma pausa; a retomada exige as duas resolvidas (D-034).
- **A tela cai com um modal de decisão aberto.** Ao voltar, a decisão pendente é a que o estado atual determina — a superfície é remontada do estado autoritativo, não restaurada da memória da tela caída.

---

## Requirements *(mandatory)*

### Functional Requirements

**Contenção**

- **FR-001**: Nenhuma exceção não tratada na árvore de interface DEVE resultar em tela em branco; toda queda apresenta uma tela de falha legível.
- **FR-002**: A fronteira que cobre a superfície de partida DEVE ficar **abaixo** da sessão de sala: sua atuação NÃO pode encerrar a conexão, a presença, a autoridade nem o relógio de prazos.
- **FR-003**: Uma queda contida pela fronteira de jogo NÃO DEVE produzir efeito observável nas outras telas da mesa — nem pausa, nem retomada, nem entrada ou saída.
- **FR-004**: Camadas acessórias (log central, som, painéis informativos) DEVEM ser contidas separadamente do tabuleiro e dos controles de decisão: a queda de uma delas não derruba a capacidade de jogar.
- **FR-005**: DEVE existir fronteira de último recurso cobrindo a casca de sessão e o boot.
- **FR-006**: Antes de exibir a tela de falha, a fronteira de último recurso DEVE encerrar a presença desta sessão na sala, para que a ausência chegue à mesa como **desconexão** (§11.3, D-035).
- **FR-007**: A fronteira NÃO DEVE introduzir causa de pausa nova no estado da partida, em nenhum caminho.
- **FR-008**: A tela de falha NÃO DEVE fazer parte do estado da partida nem ser difundida: é superfície de sessão, local a quem quebrou.

**Recuperação**

- **FR-009**: Quando a sessão sobreviveu, a tela de falha DEVE oferecer remontar a superfície de partida a partir do estado autoritativo, sem recarregar a página.
- **FR-010**: A remontagem bem-sucedida DEVE apresentar o estado atual da partida, incluindo o que aconteceu enquanto a tela estava caída.
- **FR-011**: A repetição da mesma falha na remontagem DEVE interromper novas tentativas automáticas e informar que foram interrompidas — sem laço, inclusive através de reload.
- **FR-012**: Quando a sessão não sobreviveu, a tela de falha DEVE oferecer o caminho de volta que a 041 já entrega: reabrir pelo link e, sem assento reconhecido, o código de reentrada (D-033).
- **FR-013**: Numa sala, a tela de falha DEVE afirmar o que está preservado (saldo, propriedades, cartas, prazos), com a mesma linguagem da superfície de pausa.
- **FR-014**: Em partida local, a tela de falha NÃO DEVE oferecer nem sugerir recuperação — apenas começar de novo.
- **FR-015**: A tela de falha NÃO DEVE conter contagem regressiva, prazo, nem ação destrutiva sem confirmação (D-015; coerente com a superfície de desconexão da 041).

**Diagnóstico**

- **FR-016**: Toda exceção contida DEVE ser registrada com o suficiente para localizar o ponto de falha: o que quebrou, em que fase da sessão e em que sequência de estado.
- **FR-017**: A tela de falha DEVE exibir um identificador curto da ocorrência, utilizável para relatar o problema sem abrir o console.
- **FR-018**: O registro NÃO DEVE conter mão de cartas de nenhum jogador, token de sessão nem código de reentrada (princípio VI, D-030, D-033).

**Exceções fora do render**

- **FR-019**: Exceções que não passam pela árvore (handler de evento, timer, callback de canal, promessa rejeitada) DEVEM ser capturadas por um coletor de último recurso e registradas como em FR-016.
- **FR-020**: Uma exceção ao aplicar comando no caminho de autoridade NÃO DEVE ser engolida: o comando é tratado como recusado e o remetente recebe sinal visível de que não foi aplicado.
- **FR-021**: Uma exceção no caminho de autoridade NÃO DEVE deixar estado parcialmente aplicado, incrementar a sequência nem difundir o comando.
- **FR-022**: A recusa por falha DEVE ser distinguível de recusa por regra (comando inválido) e DEVE trazer o identificador da ocorrência.

**Prova executável**

- **FR-023**: DEVE existir prova automatizada de que uma exceção lançada no render da superfície de partida não deixa a tela em branco e não altera o estado da mesa.
- **FR-024**: DEVE existir prova automatizada de que um fato que a apresentação não sabe descrever (o caso real do log) não impede a partida de continuar, e de que ele não produz laço de remontagem através de reload.
- **FR-025**: DEVE existir prova de que a queda da casca encerra a presença e a mesa pausa por desconexão, com retomada normal ao voltar.
- **FR-026**: A prova de FR-023/FR-024 exige montar componentes React, coisa que a suíte atual nunca fez; o ambiente necessário DEVE ser adicionado sem alterar a execução das suítes existentes de motor, rede e simulação.

### Key Entities

- **Fronteira de jogo** — contenção da superfície da partida, posicionada abaixo da sessão de sala. Escopo: o que o gate de sala serve. Não toca estado da partida e não é observável pelas outras telas.
- **Fronteira de último recurso** — contenção da casca de sessão e do boot. Sua atuação encerra a presença antes de renderizar, e por isso é visível para a mesa como desconexão.
- **Tela de falha** — superfície de sessão (nunca do estado da partida, nunca difundida): o que aconteceu, o que está preservado, um caminho de volta e um identificador. Varia por modo (sala vs. local) e por sobrevivência da sessão.
- **Ocorrência de falha** — registro de uma exceção contida: identificador curto, origem, fase da sessão, sequência de estado. Deliberadamente sem dados privados.
- **Camada acessória** — parte da tela cuja ausência não impede jogar (log, som, painéis informativos). Contida separadamente, e obrigada a anunciar a própria ausência.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Nenhum caminho de exceção da interface termina em tela em branco — em todos os casos exercitados há tela com frase e caminho de volta.
- **SC-002**: Uma exceção na superfície de partida de um jogador produz **zero** efeito observável nas telas dos outros: nenhuma pausa, nenhuma ausência, nenhum prazo alterado.
- **SC-003**: Um fato que a apresentação não sabe descrever deixa de derrubar a mesa: a partida continua jogável em todas as telas, com a camada afetada anunciando que falhou.
- **SC-004**: Um estado que quebra a tela de forma reproduzível não gera nenhuma remontagem automática além da primeira — zero laços, inclusive após reload.
- **SC-005**: A queda da casca de sessão chega à mesa como desconexão, com a mesma mensagem de qualquer outra queda, e a retomada acontece ao voltar pelo link.
- **SC-006**: Todo relatório de falha traz identificador que localiza a ocorrência sem console aberto, e nenhum registro contém mão de jogador, token ou código de reentrada.
- **SC-007**: Uma partida local que quebra nunca oferece recuperação — a tela diz a verdade sobre o que foi perdido.
- **SC-008**: Um comando que falha ao ser aplicado pela autoridade nunca é silencioso: quem enviou vê a recusa em todas as tentativas.
- **SC-009**: A suíte passa a montar componentes React pela primeira vez, e as suítes existentes de motor, rede e simulação seguem passando sem alteração de comportamento.

---

## Assumptions

- **A fronteira contém, não conserta.** As exceções que existem hoje (exaustividade do log, entre outras) continuam sendo dívida das specs onde nasceram. A fronteira existe para que a **próxima** fonte, que ninguém previu, não custe a mesa.
- **Não existe persistência de partida local.** O item 8 da auditoria (snapshot do estado fora da aba) segue aberto, e esta spec não o antecipa: por isso a tela de falha local promete apenas recomeçar.
- **O motor não muda.** Nenhuma regra de jogo é tocada e nenhum campo novo entra no estado da partida.
- **O modelo de autoridade não muda** (D-020): host que cai continua pausando a mesa, sem transferência.
- **Registro é local.** O que o navegador já oferece basta para FR-016/FR-017; enviar erro para serviço externo é decisão de produto e privacidade que ninguém tomou.
- **A suíte precisa de ambiente novo.** `vitest.config.ts` roda em `environment: 'node'` e inclui apenas `tests/**/*.test.ts`; não há biblioteca de teste de componente nas dependências. Qual ferramenta entra é decisão do plano — a spec exige a prova, não o instrumento. O caminho de browser real (Playwright) já existe e serve para FR-025.

## Fora de escopo

- **Persistência da partida local** (item 8 da auditoria) — pré-requisito para prometer recuperação fora de sala; spec própria.
- **Telemetria de erros em serviço externo** — decisão de produto e privacidade, não de resiliência.
- **Saneamento automático de estado envenenado** (migração ou descarte de fatos que a apresentação não entende) — esta spec exige interromper o laço e diagnosticar, não consertar o dado.
- **Revisão da exaustividade do log** — dívida da 040, conserta-se lá.
- **Transferência de host, timeout de ausente, contas** — seguem recusados (§16, D-015, D-019).
