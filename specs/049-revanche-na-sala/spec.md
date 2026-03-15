# Feature Specification: Revanche na mesma sala

**Feature Branch**: `049-revanche-na-sala`

**Created**: 2026-07-29

**Status**: Aprovada

**Input**: User description: "Melhorar a tela de vencedor e, ao acabar o jogo, voltar ao lobby da mesma sala para o host iniciar outra partida."

**Depende de**: spec [037](../037-sala-online-estado-sincronizado/spec.md) (sala, autoridade e snapshot), spec [038](../038-partida-online-jogavel/spec.md) (identidade e fluxo online), spec [041](../041-resiliencia-de-sessao/spec.md) (reentrada e persistência), spec [044](../044-polimento-lancamento/spec.md) (classificação final e acessibilidade)

**Regra de origem**: SRS §9.5 e §11.6, [D-038](../../docs/adr/D-038-fim-de-jogo-tem-classificacao-e-resumo.md) e [D-052](../../docs/adr/D-052-revanche-reabre-a-mesma-sala.md). A D-052 revoga somente o caminho “sem revanche” das specs 038 e 044.

## Clarifications

### Session 2026-07-29

- Q: Depois da classificação, a pessoa deve voltar ao início do aplicativo ou continuar com o grupo atual? → A: Continuar na mesma sala, com os mesmos jogadores, para o host iniciar outra partida.
- Q: A próxima partida começa automaticamente? → A: Não. O host volta ao lobby e usa o fluxo normal de preparação e início.
- Q: O que atravessa de uma partida para outra? → A: Sala, assentos e identidades; todo estado de jogo é recriado.

## User Scenarios & Testing

### User Story 1 - Voltar à mesma sala (Priority: P1)

Como participante de uma partida online encerrada, quero sair da classificação e voltar à sala em que joguei, para continuar com o mesmo grupo sem recriar sala ou identidade.

**Why this priority**: este é o comportamento solicitado e elimina o maior atrito entre duas partidas do mesmo grupo.

**Independent Test**: encerrar uma partida online, acionar “Voltar à sala” como host e como convidado e confirmar que ambos chegam ao lobby com os mesmos assentos, nomes, cores, Avatar e Skin.

**Acceptance Scenarios**:

1. **Given** uma partida online encerrada, **When** um convidado aciona “Voltar à sala”, **Then** ele vê a mesma sala e aguarda o host sem perder seu assento ou identidade.
2. **Given** uma partida online encerrada, **When** o host aciona “Voltar à sala”, **Then** a sala volta ao estado de lobby e o host recupera os controles normais de preparação e início.
3. **Given** um participante que ainda está lendo a classificação, **When** outro participante volta à sala, **Then** a classificação aberta não desaparece da tela do primeiro.
4. **Given** uma sala reaberta, **When** um participante usa o mesmo link ou seu código de reentrada, **Then** ele recupera o mesmo assento no lobby.

---

### User Story 2 - Começar uma partida realmente nova (Priority: P1)

Como host de uma sala reaberta, quero iniciar outra partida pelo mesmo lobby, para jogar novamente sem herdar dinheiro, propriedades ou efeitos da partida anterior.

**Why this priority**: preservar o grupo só é seguro se a revanche começar de um estado inicial completo e inequívoco.

**Independent Test**: terminar uma partida com propriedades, empréstimos, cartas, efeitos, Loteria e log alterados; voltar à sala; iniciar novamente e comparar todo o estado com uma partida recém-criada.

**Acceptance Scenarios**:

1. **Given** uma sala reaberta após o fim, **When** o host inicia outra partida, **Then** o Ritual de Largada é executado novamente antes do primeiro turno.
2. **Given** uma partida anterior com estado econômico alterado, **When** a revanche começa, **Then** caixa, posições, propriedades, construções, cartas, efeitos, imunidades, empréstimos, negociações, leilões, Loteria, decks, log e classificação usam seus valores iniciais.
3. **Given** os mesmos participantes na sala, **When** a revanche começa, **Then** cada um mantém nome, cor, Avatar, Skin, assento e credencial de reentrada.
4. **Given** a classificação ainda aberta para algum participante, **When** o host inicia a revanche, **Then** o novo estado autorizado substitui o resumo e leva esse participante à nova partida.

---

### User Story 3 - Resultado final com hierarquia clara (Priority: P2)

Como jogador que terminou uma partida, quero entender imediatamente quem venceu, como ficou a classificação e quanto a partida durou, para encerrar a mesa com uma leitura clara antes da revanche.

**Why this priority**: a classificação já existe, mas a tela precisa comunicar o resultado oficial com a mesma qualidade visual do tabuleiro.

**Independent Test**: renderizar o fim de jogo online e local em desktop e viewport estreita, verificar vencedor, classificação, estatísticas e ação correta sem rolagem horizontal.

**Acceptance Scenarios**:

1. **Given** uma partida encerrada, **When** a tela final aparece, **Then** vencedor, identidade, patrimônio, propriedades, classificação completa e duração têm hierarquia visual explícita.
2. **Given** uma partida online encerrada, **When** observo a ação principal, **Then** ela diz “Voltar à sala”.
3. **Given** uma partida local encerrada, **When** observo a ação principal, **Then** ela oferece um novo jogo local sem mencionar sala.
4. **Given** uma viewport estreita, **When** consulto a classificação, **Then** todas as colunas continuam legíveis sem rolagem horizontal.

---

### User Story 4 - Não ressuscitar a partida anterior (Priority: P2)

Como participante reconectando entre partidas, quero sempre receber a geração vigente da sala, para que reload, atraso de rede ou snapshot antigo não restaure a partida encerrada.

**Why this priority**: a sala passa a conter várias partidas sequenciais; sem uma fronteira explícita, o snapshot durável anterior pode competir com o lobby ou com a revanche.

**Independent Test**: reabrir a sala, atrasar a entrega do último snapshot encerrado, recarregar convidados e host e confirmar que todos permanecem no lobby ou na revanche mais recente.

**Acceptance Scenarios**:

1. **Given** uma sala já reaberta, **When** chega um snapshot atrasado da partida encerrada, **Then** a sala não volta ao resumo nem ao tabuleiro antigo.
2. **Given** uma sala reaberta e ainda sem nova partida, **When** a página é recarregada, **Then** o participante entra no lobby preservando o assento.
3. **Given** uma revanche já iniciada, **When** a página é recarregada, **Then** o participante recupera somente o estado da revanche vigente.
4. **Given** uma partida encerrada que o host ainda não reabriu, **When** um participante daquela partida recarrega, **Then** ele pode recuperar a classificação; uma pessoa sem assento não recebe o estado privado da partida.

### Edge Cases

- Um convidado volta à sala antes do host: ele permanece no lobby de espera e não recebe poderes para preparar ou iniciar.
- O host volta antes dos convidados: a sala reabre, mas a ação de outro cliente não apaga uma classificação já aberta localmente.
- O host inicia enquanto alguém ainda lê a classificação: o snapshot da nova partida leva esse participante à mesa vigente.
- Um jogador estava desconectado no encerramento: seu assento é preservado; no lobby, o host volta a poder removê-lo segundo as regras existentes.
- O host recarrega a classificação antes de reabrir: recupera o resultado e continua sendo a autoridade capaz de voltar ao lobby.
- Duas ações de retorno chegam quase juntas: reabrir a sala é idempotente e produz um único ciclo de lobby.
- A gravação da reabertura falha: a sala não anuncia lobby apenas localmente como se a transição fosse durável; a classificação continua recuperável.
- Uma mensagem da geração anterior chega depois da revanche: ela é ignorada.

## Requirements

### Functional Requirements

- **FR-001**: A tela final de uma partida online DEVE oferecer a ação “Voltar à sala”.
- **FR-002**: A tela final de uma partida local DEVE continuar oferecendo um novo jogo local.
- **FR-003**: Cada participante DEVE poder deixar a classificação no próprio cliente sem depender de outro participante.
- **FR-004**: A saída de um participante NÃO DEVE fechar uma classificação ainda aberta em outro cliente.
- **FR-005**: O convidado que voltar antes do host DEVE ver uma espera na mesma sala e NÃO DEVE receber ações exclusivas do host.
- **FR-006**: O retorno do host DEVE reabrir canonicamente a mesma sala no estado de lobby.
- **FR-007**: A reabertura DEVE ser idempotente.
- **FR-008**: A sala reaberta DEVE preservar identificador, host, assentos, nomes, cores, Avatar, Skin, códigos de reentrada e estado de conexão.
- **FR-009**: A sala reaberta DEVE restaurar os controles de lobby já existentes, inclusive seleção do Ritual de Largada, remoção de assento pelo host e início.
- **FR-010**: A próxima partida NÃO DEVE começar automaticamente.
- **FR-011**: Uma revanche DEVE recriar o estado de jogo completo a partir dos valores iniciais do tema e da configuração vigente.
- **FR-012**: Nenhum caixa, posição, propriedade, construção, carta, Bus Ticket, efeito, imunidade, empréstimo, negociação, leilão, Loteria, deck, log, ordem, resultado ou contador da partida encerrada DEVE atravessar para a revanche.
- **FR-013**: A revanche DEVE executar novamente o Ritual de Largada escolhido pelo host.
- **FR-014**: Cada ciclo de partida da sala DEVE possuir uma geração monotônica que permita distinguir estado vigente de estado atrasado.
- **FR-015**: Clientes e autoridade DEVEM ignorar estado de uma geração anterior.
- **FR-016**: Reload no lobby reaberto DEVE recuperar o lobby, sem restaurar a partida encerrada.
- **FR-017**: Reload durante a revanche DEVE recuperar apenas a revanche vigente.
- **FR-018**: Um participante com assento DEVE poder recuperar a classificação enquanto o host ainda não reabriu a sala.
- **FR-019**: Uma pessoa sem assento NÃO DEVE receber o estado da partida encerrada.
- **FR-020**: Uma nova partida autorizada DEVE substituir a classificação ainda aberta em qualquer participante.
- **FR-021**: A tela final DEVE destacar vencedor e sua identidade, classificação oficial, patrimônio, quantidade de propriedades, rodada de eliminação quando aplicável e duração.
- **FR-022**: Em viewport estreita, a classificação DEVE continuar legível sem rolagem horizontal.
- **FR-023**: A ação principal da tela final DEVE ter foco visível, nome acessível e funcionar por teclado.
- **FR-024**: A transição de volta ao lobby DEVE respeitar durabilidade antes do avanço; falha de persistência não pode produzir uma sala reaberta apenas em um cliente.
- **FR-025**: A cobertura automatizada DEVE provar retorno do host, espera do convidado, preservação de identidade, reset completo, rejeição de geração antiga e os dois rótulos da ação final.

### Key Entities

- **Sala**: agrupamento durável identificado pelo mesmo link; contém host, assentos, estado de conexão, configuração de lobby e geração vigente.
- **Geração da partida**: número monotônico da sala que identifica qual ciclo de jogo pode publicar e restaurar estado.
- **Partida encerrada**: estado final imutável usado para classificação enquanto a sala ainda não foi reaberta.
- **Lobby de revanche**: estado da mesma sala entre o encerramento de uma partida e o início da seguinte.
- **Assento**: identidade persistente do participante na sala, preservada entre gerações.

## Success Criteria

### Measurable Outcomes

- **SC-001**: 100% dos participantes conseguem chegar da classificação ao lobby da mesma sala com uma única ação.
- **SC-002**: Em testes de duas partidas sequenciais, 100% dos campos específicos da primeira usam valores iniciais na segunda.
- **SC-003**: Nome, cor, Avatar, Skin, assento e código de reentrada permanecem idênticos para todos os participantes entre duas partidas.
- **SC-004**: 100% dos snapshots atrasados de uma geração anterior são rejeitados nos testes de rede.
- **SC-005**: A classificação final permanece completa e sem rolagem horizontal em viewport de 768 px e acima, incluindo orientação paisagem.
- **SC-006**: Toda a suíte automatizada, lint, typecheck e build fecham verdes antes da publicação.

## Assumptions

- A D-052 substitui apenas a proibição de revanche; as regras de classificação da D-038 permanecem.
- O host continua sendo a autoridade da sala e não há transferência automática de host.
- O fluxo normal do lobby decide quem pode entrar, ser removido ou participar da próxima partida.
- A classificação pode permanecer apenas na memória visual de quem ainda a está lendo depois que o host reabre; reload nessa situação leva ao estado canônico mais recente da sala.
- Não há placar agregado entre partidas nesta feature.
