# Feature Specification: Diretório opt-in de salas públicas anônimas

**Feature Branch**: `codex/054-salas-publicas-seguras`

**Created**: 2026-07-30

**Status**: Aprovada — planejamento e implementação autorizados em 2026-07-30

**Input**: User description: "Salas públicas seguras, com diretório opt-in de lobbies e controles server-side contra abuso, preservando integralmente as salas privadas por convite. Após discovery, contas, perfis, bloqueio, denúncia, moderação e sanções foram removidos do escopo."

> **Fonte da regra:** [D-068](../../docs/adr/D-068-diretorio-opt-in-de-lobbies-anonimos.md) e SRS v1.30, §11.8. Esta spec operacionaliza um diretório simples; não autoriza conta permanente nem plataforma social.

## Clarifications

### Session 2026-07-30

- Q: A publicação exige conta permanente? → A: Não; host, visitante e participante continuam usando a identidade anônima atestada pelo servidor.
- Q: O que torna uma sala visível? → A: Opt-in do host, estado de lobby, presença do host e ao menos uma vaga; sala privada permanece invisível.
- Q: O que a listagem revela? → A: Somente identificador gerado, vagas, capacidade, Ritual de Largada e tempo aproximado de criação; nenhum conteúdo livre ou dado de jogador.
- Q: Como lotação, início, desconexão e revanche afetam a listagem? → A: Lotação esconde; início despublica; ausência do host esconde após 60 + 30 segundos; revanche exige nova publicação explícita.
- Q: Quais controles mínimos de abuso entram? → A: 3 salas distintas tornadas públicas por 10 minutos, 1 lobby publicado por identidade, 10 tentativas públicas de entrada por minuto e 1 atualização do diretório a cada 5 segundos.
- Q: Haverá camada social? → A: Não; contas, perfis, bloqueio, denúncia, moderação, sanções, chat, espectadores, ranking e matchmaking estão fora do escopo.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Host publica e retira seu lobby (Priority: P1)

Como host anônimo de uma sala, quero decidir se meu lobby aparece no diretório para receber pessoas sem convite, mantendo a sala privada como padrão.

**Why this priority**: Sem opt-in exclusivo do host, a feature expõe salas contra a vontade do grupo e viola a fronteira de privacidade existente.

**Independent Test**: Criar uma sala anônima, verificar sua ausência no diretório, publicá-la como host, observar a listagem mínima e despublicá-la sem alterar sala ou assentos.

**Acceptance Scenarios**:

1. **Given** uma sala nova, privada e em lobby, **When** qualquer pessoa consulta o diretório, **Then** a sala não aparece.
2. **Given** uma sala privada elegível, **When** o host anônimo a publica, **Then** uma única listagem segura aparece no diretório.
3. **Given** uma sala publicada, **When** o host a despublica, **Then** a listagem desaparece em até 5 segundos e a sala continua acessível pelo convite privado.
4. **Given** uma sala de outro host, **When** um convidado ou cliente adulterado tenta publicá-la ou despublicá-la, **Then** a mutação é recusada pela autoridade confiável.
5. **Given** uma sala publicada com convidados no lobby, **When** o host remove um convidado pelo controle atual de kick, **Then** o convidado sai do lobby e a elegibilidade é recalculada sem criar bloqueio persistente.

---

### User Story 2 — Pessoa encontra e entra em uma sala pública (Priority: P1)

Como pessoa sem convite, quero ver lobbies públicos com vagas, filtrar as opções e pedir entrada usando o fluxo anônimo já conhecido.

**Why this priority**: É o valor direto do diretório e não depende de conta, perfil ou formação automática de partida.

**Independent Test**: Publicar dois lobbies elegíveis, aplicar filtros, selecionar uma listagem e concluir a entrada anônima em um deles.

**Acceptance Scenarios**:

1. **Given** lobbies públicos elegíveis com diferentes vagas e Rituais de Largada, **When** o diretório abre, **Then** mostra as salas mais recentes primeiro e apenas os metadados autorizados.
2. **Given** o filtro de quantidade mínima de vagas, **When** a pessoa escolhe um valor, **Then** somente listagens que atendem ou superam esse valor permanecem.
3. **Given** o filtro de Ritual de Largada, **When** a pessoa escolhe Leilão secreto ou Maior dado, **Then** somente listagens com o Ritual escolhido permanecem.
4. **Given** uma listagem elegível, **When** a pessoa a seleciona, **Then** segue o fluxo atual de nome, cor, Avatar e Skin e pede assento com sua identidade anônima atestada.
5. **Given** duas pessoas concorrendo pela última vaga, **When** os pedidos chegam quase simultaneamente, **Then** no máximo uma entra e a outra recebe indisponibilidade recuperável; a capacidade nunca é excedida.
6. **Given** uma listagem que ficou cheia, despublicada ou iniciada entre consulta e seleção, **When** a pessoa pede entrada, **Then** o servidor recusa sem revelar `roomId`, assentos ou estado privado.

---

### User Story 3 — Salas privadas e estado de partida permanecem secretos (Priority: P1)

Como grupo em uma sala privada, quero que a introdução do diretório não permita descobrir minha sala nem ler qualquer parte da partida.

**Why this priority**: A feature só é aceitável se preservar as garantias de D-036, D-037 e D-043.

**Independent Test**: Criar salas privadas e públicas, consultar todas as superfícies com a chave pública do frontend e provar que apenas a projeção autorizada das públicas é enumerável.

**Acceptance Scenarios**:

1. **Given** qualquer conjunto de salas privadas, **When** a chave pública consulta o diretório ou tenta enumeração direta, **Then** retorna zero salas privadas.
2. **Given** uma sala pública, **When** sua listagem é consultada, **Then** a resposta não contém `roomId`, nomes, uids, avatares, skins, snapshot, histórico, log, mãos, cartas, decks, códigos de reentrada ou credenciais.
3. **Given** uma sala privada em andamento, **When** o diretório falha, fica indisponível ou devolve erro, **Then** a partida, a reconexão e o convite direto continuam funcionando.
4. **Given** um cliente adulterado, **When** tenta forjar publicação, elegibilidade, capacidade ou entrada em sala removida, **Then** a decisão confiável recusa a operação.
5. **Given** uma sala legada sem estado explícito de publicação, **When** o diretório é consultado, **Then** ela é tratada como privada.
6. **Given** uma resposta do diretório, **When** ela é inspecionada integralmente, **Then** nenhuma credencial administrativa ou segredo existe no payload ou no cliente distribuído.

---

### User Story 4 — A listagem acompanha o lobby sem controlar a sala (Priority: P2)

Como grupo em um lobby publicado, quero que a listagem reflita vagas e presença sem encerrar a sala ou modificar as regras de desconexão e revanche.

**Why this priority**: Evita listagens obsoletas preservando o princípio VII de resiliência da sessão.

**Independent Test**: Exercitar lotação, liberação de vaga, perda e retorno de presença do host, início e revanche, observando separadamente listagem e sala.

**Acceptance Scenarios**:

1. **Given** um lobby publicado que acabou de lotar, **When** a última vaga é ocupada, **Then** a listagem some em até 5 segundos, mas a publicação e a sala permanecem.
2. **Given** esse lobby ainda publicado, **When** uma vaga reaparece antes do início, **Then** a listagem pode voltar em até 5 segundos se o host estiver presente.
3. **Given** um lobby publicado, **When** a partida começa, **Then** a sala é despublicada e a listagem some em até 5 segundos.
4. **Given** a partida encerrada e o grupo no lobby de revanche, **When** ninguém publica novamente, **Then** a sala não reaparece no diretório.
5. **Given** o lobby de revanche elegível, **When** o host publica novamente, **Then** uma nova publicação explícita pode aparecer.
6. **Given** perda de presença do host, **When** passam 60 segundos, **Then** a listagem fica inelegível e é removida em até mais 30 segundos sem excluir, encerrar ou pausar a sala por causa do diretório.
7. **Given** o host reconectado enquanto o lobby continua publicado e elegível, **When** sua presença volta a ser confirmada, **Then** a listagem reaparece sem exigir nova publicação.

---

### User Story 5 — Diretório utilizável e isolado em estados adversos (Priority: P2)

Como pessoa usando teclado ou celular, quero entender carregamento, vazio, erro, limite e indisponibilidade para escolher uma sala sem ficar presa.

**Why this priority**: O diretório entra no caminho público do produto e precisa manter WCAG 2.2 AA e recuperação clara.

**Independent Test**: Renderizar os estados do diretório em viewport móvel e desktop, navegar somente por teclado e simular erro, resposta vazia, limite e listagem expirada.

**Acceptance Scenarios**:

1. **Given** a primeira consulta em andamento, **When** a tela aparece, **Then** há estado de loading identificado sem bloquear o restante da home.
2. **Given** nenhuma sala elegível, **When** a consulta termina, **Then** o estado vazio explica que não há mesas disponíveis e preserva as opções de criar sala ou usar convite.
3. **Given** falha do diretório, **When** o erro é mostrado, **Then** há mensagem acessível e tentativa de atualização sem esconder o fluxo privado.
4. **Given** uma atualização antecipada em relação ao limite de 5 segundos, **When** a pessoa tenta atualizar, **Then** recebe estado recuperável com indicação de quando tentar novamente.
5. **Given** navegação somente por teclado, **When** a pessoa percorre filtros, listagens e ações, **Then** a ordem é previsível, o foco é visível e não há armadilha.
6. **Given** viewport móvel em retrato, **When** o diretório é usado, **Then** filtros, metadados e ação de entrada permanecem legíveis e operáveis sem rolagem horizontal.
7. **Given** movimento reduzido, zoom de 200% ou leitor de tela, **When** os estados mudam, **Then** a informação continua disponível por texto e sem depender apenas de cor ou animação.

### Edge Cases

- Uma sala é despublicada enquanto uma pessoa confirma a entrada: a revalidação confiável recusa o pedido e não revela o destino privado.
- A última vaga é ocupada e liberada em rápida sucessão: a capacidade continua consistente e a listagem converge para a elegibilidade mais recente.
- O host perde presença por menos de 60 segundos: a publicação não é encerrada e a listagem não precisa ser removida.
- O host volta depois que a listagem foi escondida: ela só reaparece se publicação, lobby e vaga continuarem válidos.
- O host inicia exatamente durante a janela de tolerância de presença: o início prevalece, despublica e impede reaparecimento.
- Uma mensagem atrasada de lobby tenta restaurar publicação após o início: a geração/estado vigente prevalece e a sala continua despublicada.
- A sala cheia perde um assento por kick: pode reaparecer se continuar publicada, em lobby e com host presente.
- A mesma identidade tenta publicar uma segunda sala enquanto a primeira permanece publicada, ainda que escondida: a segunda publicação é recusada.
- A pessoa alterna filtros durante loading ou erro: nenhum filtro dispara enumeração adicional nem expõe resultado anterior de sala que deixou de ser elegível.
- O relógio local está incorreto: o tempo aproximado e a ordenação não podem depender da hora declarada pelo cliente.
- O diretório está indisponível durante uma reentrada por código ou convite privado: o fluxo privado ignora a falha do diretório.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Toda sala deve nascer privada e ausente do diretório.
- **FR-002**: Somente a identidade anônima atestada que ocupa o assento do host pode publicar ou despublicar sua sala.
- **FR-003**: O sistema deve recusar publicação e despublicação solicitadas por convidado, estranho ou identidade não atestada, independentemente do comportamento do cliente.
- **FR-004**: Publicar uma sala não deve criar conta, perfil, identidade global nem novo método de autenticação.
- **FR-005**: O nome escolhido deve continuar pertencendo apenas ao assento daquela sala; ele não precisa ser único, global nem persistente entre salas.
- **FR-006**: O host deve conservar o poder existente de remover outro assento enquanto a sala estiver no lobby.
- **FR-007**: O diretório deve apresentar somente salas que tenham publicação explícita vigente e satisfaçam a elegibilidade atual.
- **FR-008**: Cada `PublicRoomListing` deve conter exclusivamente identificador público gerado, vagas disponíveis, capacidade total, Ritual de Largada e tempo aproximado desde a criação da sala.
- **FR-009**: A listagem não pode conter título ou descrição livre, nome de jogador, identidade visual, `roomId`, link privado, uid, snapshot, histórico, log, mão, carta, deck, código de reentrada, token ou credencial.
- **FR-010**: O identificador de listagem deve ser distinto do `roomId`, deixar de autorizar entrada quando a publicação terminar e não permitir derivar identificadores de salas privadas.
- **FR-011**: O tempo de criação deve ser aproximado e a ordenação deve usar uma referência confiável, não o relógio informado pelo cliente.
- **FR-012**: A ordenação padrão deve apresentar primeiro as salas criadas mais recentemente.
- **FR-013**: O diretório deve permitir filtro por quantidade mínima de vagas.
- **FR-014**: O diretório deve permitir filtro pelo Ritual de Largada Leilão secreto ou Maior dado.
- **FR-015**: Filtros não podem ampliar o conjunto autorizado nem fazer uma sala inelegível reaparecer.
- **FR-016**: `ListingEligibility` deve exigir simultaneamente publicação vigente, estado de lobby, presença do host e ao menos uma vaga.
- **FR-017**: Uma sala cheia deve ser escondida sem perder sua publicação.
- **FR-018**: Se uma vaga reaparecer antes do início, a sala publicada deve poder reaparecer quando os demais critérios forem satisfeitos.
- **FR-019**: Iniciar a partida deve despublicar a sala e impedir que mensagens atrasadas restaurem a publicação.
- **FR-020**: Encerrar a partida ou voltar ao lobby de revanche não deve republicar a sala automaticamente.
- **FR-021**: O host deve poder realizar nova publicação explícita no lobby de revanche, sujeita aos mesmos critérios e limites.
- **FR-022**: A perda de presença do host deve manter a listagem durante uma tolerância de 60 segundos e torná-la invisível em até 30 segundos adicionais.
- **FR-023**: Esconder a listagem por ausência do host não pode excluir, encerrar, pausar, despublicar ou alterar assentos, reentrada e estado da sala.
- **FR-024**: O retorno da presença do host deve permitir o reaparecimento se a publicação continuar vigente e a sala continuar elegível.
- **FR-025**: Selecionar uma listagem deve conduzir ao fluxo existente de entrada anônima e escolha de nome, cor, Avatar e Skin.
- **FR-026**: Toda tentativa pública de entrada deve ser revalidada por uma autoridade confiável contra publicação, elegibilidade, capacidade e identidade do solicitante no momento da decisão.
- **FR-027**: Pedidos concorrentes pela última vaga devem ser serializados logicamente para nunca exceder a capacidade.
- **FR-028**: Uma entrada pública recusada deve comunicar indisponibilidade ou limite sem revelar metadados adicionais da sala.
- **FR-029**: Entrada privada por link, QR Code ou compartilhamento deve manter o comportamento existente, inclusive para usuário anônimo.
- **FR-030**: A criação de sala privada, a prévia privada por identificador, o kick, a desconexão, a recuperação, a reentrada e a revanche devem continuar funcionando sem depender do diretório.
- **FR-031**: Cada identidade anônima pode criar no máximo 3 salas distintas que cheguem a ser públicas em qualquer janela de 10 minutos; republicar a mesma sala no lobby de revanche não cria outra sala.
- **FR-032**: Cada identidade anônima pode manter no máximo 1 lobby com publicação vigente, mesmo quando a listagem estiver temporariamente escondida.
- **FR-033**: Cada identidade anônima pode realizar no máximo 10 tentativas de entrada pública por minuto.
- **FR-034**: O diretório pode produzir no máximo 1 atualização nova por identidade anônima a cada 5 segundos; excesso deve retornar estado recuperável sem ampliar dados.
- **FR-035**: Limites de publicação, entrada e atualização devem ser decididos por autoridade confiável e não podem depender apenas de debounce ou validação do cliente.
- **FR-036**: Os limites desta feature não podem ser aplicados ao fluxo privado por convite.
- **FR-037**: A chave pública do frontend deve continuar incapaz de enumerar salas privadas, linhas completas de sala e snapshots.
- **FR-038**: A fonte enumerável do diretório deve negar por padrão e retornar somente a projeção autorizada de salas publicadas elegíveis.
- **FR-039**: Falha ou indisponibilidade do diretório deve resultar em estado de erro próprio, sem fallback para leitura direta de salas.
- **FR-040**: O diretório deve oferecer estados distintos e acessíveis de loading, vazio, erro, limite e listagem indisponível.
- **FR-041**: O diretório deve cumprir WCAG 2.2 AA no caminho público, incluindo teclado, foco visível, nomes acessíveis, contraste, alvos de toque, zoom de 200% e `prefers-reduced-motion`.
- **FR-042**: O diretório deve funcionar em celular e desktop sem rolagem horizontal e sem exigir a orientação de partida para consultar ou entrar.
- **FR-043**: Mudanças de elegibilidade devem ser anunciadas sem depender apenas de cor ou animação.
- **FR-044**: Sala legada sem estado explícito de publicação deve ser tratada como privada.
- **FR-045**: Observabilidade do diretório deve permanecer agregada e compatível com D-040, sem registrar identificador de sala/listagem, nome ou identidade anônima.
- **FR-046**: Nenhuma credencial administrativa, `service_role`, token de operação ou segredo pode ser entregue ao navegador ou incluído nas respostas do diretório.
- **FR-047**: Testes de autorização devem exercitar publicação forjada, despublicação alheia, enumeração privada, entrada em listagem expirada, excesso de capacidade e limites contra o serviço Supabase real usando apenas a mesma credencial pública disponível ao produto.
- **FR-048**: Testes multiplayer devem usar contextos de navegador isolados para provar convergência entre host, pessoa que entra pelo diretório e convidado privado.

### Key Entities

- **PublicRoomListing**: Projeção enumerável de um lobby publicado. Contém `listingId`, rótulo gerado, vagas disponíveis, capacidade, Ritual de Largada, tempo aproximado de criação e sua elegibilidade atual. Não contém `Room`, `Seat`, `RoomPreview` nem credencial privada.
- **PublicParticipationIdentity**: Papel público da `SessionIdentity` anônima já atestada pelo servidor. Autoriza publicação do próprio host, consulta limitada e pedido de entrada; não é conta, perfil ou identidade global de jogador.
- **PublicRoomStatus**: Estado da publicação separado do estado da sala: privada, publicada e visível, ou publicada e temporariamente escondida. Iniciar a partida encerra a publicação; lotação e ausência do host apenas escondem.
- **ListingEligibility**: Resultado derivado de publicação vigente, lobby, presença do host e vaga disponível. Determina visibilidade, nunca existência, pausa ou encerramento da sala.
- **RateLimitDecision**: Resultado confiável para publicação, entrada pública ou atualização do diretório, indicando permissão ou espera necessária sem expor histórico individual no cliente.
- **PublicListingId**: Identificador público gerado para a publicação vigente, exibível como “Mesa 7Q2M”, distinto e não derivável do `roomId`.

`Room`, `Seat`, `SessionIdentity` e `RoomPreview` continuam definidos pelas specs 037, 038, 041 e 043. A spec 054 depende deles e adiciona publicação e descoberta sem duplicar suas regras ou estruturas.

## Dependencies

- **SRS v1.30 §11.1–§11.8**: criação, entrada, desconexão, recuperação, integridade, revanche, retenção privada e diretório.
- **D-019 e D-042**: identidade anônima sem contas, atestada pelo servidor.
- **D-020**: host continua sendo a autoridade da sala.
- **D-033 e D-043**: reentrada continua secreta e recuperável.
- **D-036 e D-037**: sala privada não enumerável e estado distribuído por perspectiva.
- **D-040**: telemetria mínima e anônima.
- **D-052**: revanche na mesma sala, sem republicação automática.
- **Spec 044**: WCAG 2.2 AA, responsividade, telemetria e gates de publicação.
- **Spec 049**: transição para o lobby de revanche.
- **Spec 051**: landing e separação entre marketing e aplicação; diretório não é matchmaking.
- **Spec 052**: convite, QR Code e compartilhamento privados permanecem independentes e inalterados.
- **Spec 053 / D-067**: histórico, estatísticas e presets permanecem internos à sala e nunca entram na listagem.
- **Supabase de produção**: necessário para validar políticas reais de autorização e os vetores de ataque que não podem ser provados por doubles locais.

## Privacy, Abuse, and Operational Risks

- **Enumeração acidental de salas privadas**: qualquer fallback, filtro só no cliente ou leitura direta de salas viola a feature. A resposta vazia é preferível a uma resposta ampliada.
- **Correlação por identificadores**: `roomId`, uid, nome e identificador de telemetria não podem aparecer nem ser deriváveis da listagem pública.
- **Vazamento de estado privado**: serializers genéricos de `Room` ou `RoomPreview` não podem ser reutilizados como listagem sem allowlist explícita dos campos autorizados.
- **Escrita forjada**: publicação, despublicação, elegibilidade, capacidade e limites precisam ser decididos fora do cliente controlado pelo usuário.
- **Spam com sessões anônimas**: os limites reduzem abuso casual, mas não transformam a identidade anônima em conta ou reputação. A feature aceita essa limitação para preservar D-019.
- **Corrida pela última vaga**: consulta e entrada podem observar momentos diferentes; a decisão final precisa revalidar capacidade e elegibilidade.
- **Presença instável**: flapping do host não pode apagar a sala nem gerar punição; a tolerância existe apenas para estabilizar a listagem.
- **Estado obsoleto**: cache ou mensagem atrasada não pode republicar sala iniciada, despublicada ou legada.
- **Falha compartilhada**: o diretório não pode virar dependência do convite privado, reentrada, sala em andamento ou revanche.
- **Credencial administrativa no cliente**: qualquer solução que dependa de segredo no navegador é inválida.

## Out of Scope

- Contas permanentes, magic link, Google ou qualquer tela de login.
- Perfil público, nome global, nome único ou identidade persistente entre salas.
- Denúncia, bloqueio, moderação, sanção ou painel administrativo.
- Título, descrição livre, chat, mensagem privada ou conteúdo criado pelo host.
- Espectadores, bots, ranking, Elo, torneio, feed social, amizade ou seguidores.
- Matchmaking automático, fila, recomendação algorítmica ou formação de grupos.
- Convite, QR Code e compartilhamento da spec 052.
- Histórico, estatísticas e presets da spec 053, exceto exibir o Ritual já escolhido.
- Search Console, SEO, novo tabuleiro, novo tema, monetização ou aplicativo nativo.
- Mudança de regra econômica ou transferência da autoridade integral do jogo para o servidor.
- Leitura pública de snapshot, mãos, cartas, histórico, código de reentrada ou `roomId`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Testes de enumeração com salas privadas, públicas, cheias, iniciadas e legadas retornam 0 salas privadas em 100% das execuções.
- **SC-002**: 100% das respostas do diretório contêm somente identificador gerado, vagas, capacidade, Ritual de Largada e tempo aproximado; 0 snapshots, segredos, credenciais ou dados de jogador.
- **SC-003**: 100% das tentativas de publicar ou despublicar sala alheia são recusadas por autorização confiável.
- **SC-004**: Sala cheia, iniciada ou despublicada deixa de aparecer em até 5 segundos; ausência contínua do host remove a listagem em no máximo 90 segundos.
- **SC-005**: 100% dos inícios de partida encerram a publicação, e 0 lobbies de revanche reaparecem sem nova ação explícita do host.
- **SC-006**: Os limites de 3 salas distintas tornadas públicas por 10 minutos, 1 lobby publicado, 10 entradas públicas por minuto e 1 atualização a cada 5 segundos são exercitados e recusam todo excesso.
- **SC-007**: Duas entradas concorrentes pela última vaga resultam em exatamente 1 sucesso e 1 recusa, sem exceder a capacidade.
- **SC-008**: O fluxo privado existente passa sem regressão: criação, link, QR Code/compartilhamento, entrada anônima, kick, reload, reentrada e revanche.
- **SC-009**: Falha total do diretório causa 0 interrupções em salas privadas ou partidas em andamento nos testes de isolamento.
- **SC-010**: A auditoria Axe do diretório registra 0 violações sérias ou críticas nos estados loading, vazio, resultado, erro, limite e indisponibilidade.
- **SC-011**: Todas as ações do diretório são concluíveis somente por teclado e em viewport móvel sem rolagem horizontal, perda de informação ou alvo de toque menor que 24 × 24 px.
- **SC-012**: Host, participante vindo do diretório e convidado privado convergem sobre sala, vagas e início em contextos de navegador isolados.
- **SC-013**: Os vetores de publicação forjada, enumeração privada, escrita alheia, entrada expirada e excesso de capacidade são executáveis contra o Supabase real com a credencial pública do produto.
- **SC-014**: A inspeção do artefato distribuído encontra 0 credenciais administrativas, `service_role`, tokens operacionais ou segredos.
- **SC-015**: 100% das salas legadas sem publicação explícita continuam privadas e utilizáveis por convite.

## Assumptions

- Uma publicação temporariamente escondida por lotação ou ausência do host continua contando como o único lobby público ativo da identidade.
- Toda tentativa de entrada pelo identificador público, aceita ou recusada, conta para o limite de 10 por minuto; entradas por convite privado não contam.
- Consultas antecipadas podem ser recusadas com tempo de espera ou receber resultado já válido, desde que não provoquem mais de uma atualização nova a cada 5 segundos.
- O tempo aproximado representa a idade da sala em precisão reduzida; o horário exato não é requisito de interface.
- O diretório pode ser consultado por qualquer sessão anônima válida; não existe visitante com conta permanente nesta feature.
