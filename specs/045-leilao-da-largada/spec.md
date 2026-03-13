# Feature Specification: Ritual de Largada configurável

**Implementation Branch**: `main`

**Created**: 2026-07-28

**Status**: Aprovada

**Input**: User description: "Ao host iniciar, convidados devem entrar automaticamente. No lobby, o host escolhe entre um leilão secreto, em que cada jogador lacra um valor e os maiores jogam primeiro, ou Maior dado, em que a maior rolagem define a ordem. No leilão, todos recebem $2.000 antes da disputa e o dinheiro pago alimenta a Loteria. Em Maior dado, cada pessoa deve jogar na sua vez e todos precisam ver um resultado de cada vez, criando tensão para saber quem tirou mais. A experiência deve ser criativa, bonita, animada e seguir o design system atual."

**Depende de**: spec [007](../007-balanceamento-catchup/spec.md) (Loteria/Free Parking), spec [037](../037-sala-online-estado-sincronizado/spec.md) (autoridade, transporte e snapshot), spec [038](../038-partida-online-jogavel/spec.md) (lobby e ordem inicial), spec [041](../041-resiliencia-de-sessao/spec.md) (reconexão) e spec [044](../044-polimento-lancamento/spec.md) (acessibilidade e movimento).

**Regra de origem**: SRS v1.18 §3.1, §11.1 e §13.4; [D-046](../../docs/adr/D-046-leilao-da-largada-financia-a-loteria.md) e [D-051](../../docs/adr/D-051-maior-dado-e-rolado-por-cada-jogador.md). Esta spec substitui o `shuffle` gratuito e a confirmação individual da ordem implementados pela spec 038 (FR-030/FR-031) por dois modos explícitos.

## Clarifications

### Session 2026-07-28

- Q: Quem escolhe entre o leilão secreto e a ordem por dados, e quando? → A: O host escolhe no lobby antes de iniciar.

### Session 2026-07-29

- Q: Maior dado é resolvido de uma vez ou cada participante joga? → A: Cada dono de assento aciona a própria rolagem, em sequência, e toda a mesa acompanha um arremesso por vez.
- Q: Quem determina os valores? → A: O clique só pede a rolagem; os dois dados continuam sendo gerados e atestados pela autoridade.

## User Scenarios & Testing

### User Story 4 - Escolher o ritual da mesa (Priority: P1)

Como host no lobby, quero escolher entre Leilão secreto e Maior dado, para alinhar a largada ao estilo da mesa antes de começar.

**Why this priority**: a escolha decide se a posição inicial terá custo estratégico ou será gratuita; precisa estar pública e fechada antes da criação do primeiro snapshot.

**Independent Test**: alternar o modo no lobby, observar a mesma seleção no convidado e iniciar uma partida em cada modo, verificando ordem e economia.

**Acceptance Scenarios**:

1. **Given** uma sala ainda no lobby, **When** o host escolhe Leilão secreto ou Maior dado, **Then** todos veem a mesma opção selecionada.
2. **Given** sou convidado, **When** vejo o modo escolhido, **Then** não consigo alterá-lo.
3. **Given** o host escolheu Maior dado, **When** inicia, **Then** a mesa entra numa sequência compartilhada em que cada dono de assento aciona dois dados brancos gerados pela autoridade.
4. **Given** a partida já começou, **When** qualquer cliente tenta mudar o modo, **Then** a escolha permanece imutável.

---

### User Story 5 - Disputar a primeira posição à vista da mesa (Priority: P1)

Como participante do modo Maior dado, quero jogar meus dados na minha vez e acompanhar cada pessoa fazendo o mesmo, para comparar o placar parcial e sentir a tensão de tentar superar a maior soma.

**Why this priority**: o ritual social é o valor central do modo gratuito; despejar todos os resultados automaticamente reduz a largada a uma tabela sem participação.

**Independent Test**: iniciar uma mesa com três clientes, verificar que somente o assento indicado consegue rolar, observar o mesmo arremesso e resultado nas três telas, repetir por assento e confirmar a ordem final sem débito.

**Acceptance Scenarios**:

1. **Given** Maior dado foi iniciado, **When** nenhum assento rolou, **Then** todas as telas indicam o primeiro jogador e somente ele recebe a ação “Rolar meus dados”.
2. **Given** o jogador da vez aciona a rolagem, **When** a autoridade aceita o pedido, **Then** todas as telas mostram esse jogador rolando antes de receber os dois valores.
3. **Given** o resultado atual foi publicado, **When** ainda há assento sem rolagem, **Then** o placar parcial permanece visível e somente o próximo jogador é liberado.
4. **Given** um cliente tenta rolar fora da vez, repetir a própria rolagem ou declarar valores, **When** a mensagem chega à autoridade, **Then** a sala permanece inalterada.
5. **Given** o último resultado foi resolvido, **When** a autoridade fecha o ritual, **Then** todos veem a mesma ordem por soma, o snapshot é criado uma vez e a entrada no tabuleiro continua automática.
6. **Given** preferência por movimento reduzido, **When** qualquer assento rola, **Then** vez, estado e resultado continuam textuais e completos sem movimento obrigatório.

---

### User Story 1 - Comprar posição sem sair da partida (Priority: P1)

Como jogador no lobby, quero decidir quanto da minha verba inicial vale uma posição melhor, sabendo que preservar caixa também é uma estratégia válida.

**Why this priority**: é a nova regra que substitui o sorteio e transforma a vantagem de começar em uma escolha econômica.

**Independent Test**: abrir uma mesa com jogadores que lacram valores diferentes e verificar ordem, saldos iniciais e Loteria sem depender de nenhuma outra ação do tabuleiro.

**Acceptance Scenarios**:

1. **Given** uma sala com pelo menos dois jogadores, **When** o host inicia, **Then** todos recebem a oportunidade de lacrar um lance entre $0 e $500 em passos de $50.
2. **Given** lances diferentes, **When** o leilão fecha, **Then** a ordem é decrescente, cada jogador começa com $2.000 menos o próprio lance e a soma entra na Loteria.
3. **Given** dois jogadores com o mesmo lance, **When** a ordem é calculada, **Then** a autoridade desempata por sorteio e todos recebem o mesmo resultado.
4. **Given** um jogador que não lacrou no prazo, **When** o leilão fecha, **Then** seu lance é $0 e nenhum valor é debitado dele.

---

### User Story 2 - Ver a mesa se comprometer sem revelar estratégia (Priority: P1)

Como participante, quero acompanhar quem já lacrou sem descobrir valores antes da hora, e depois entender de imediato a ordem, o custo e o prêmio criado.

**Why this priority**: segredo durante a coleta evita reação oportunista; revelação clara faz a cobrança parecer parte do jogo, não uma subtração escondida.

**Independent Test**: observar dois clientes durante coleta e revelação, confirmando que o lance alheio não trafega antes do fechamento e que todos veem a mesma revelação depois.

**Acceptance Scenarios**:

1. **Given** o leilão aberto, **When** outro jogador lacra, **Then** vejo apenas que ele concluiu, nunca o valor.
2. **Given** meu lance lacrado, **When** aguardo os demais, **Then** vejo meu valor e não consigo alterá-lo.
3. **Given** o fechamento, **When** a revelação começa, **Then** vejo os jogadores ordenados, cada lance, o caixa preservado e a Loteria crescendo dos $500 iniciais até o total final.
4. **Given** preferência por movimento reduzido, **When** a revelação acontece, **Then** os mesmos fatos aparecem sem animação essencial.

---

### User Story 3 - Entrar no tabuleiro sem segundo aceite (Priority: P1)

Como convidado, quero que a partida prossiga automaticamente depois da revelação, pois o clique do host já iniciou o fluxo para toda a mesa.

**Why this priority**: corrige o beco atual em que cada navegador precisa apertar “Começar” depois do host.

**Independent Test**: iniciar em um cliente host e não tocar no cliente convidado; após o leilão e a revelação, ambos devem chegar ao tabuleiro.

**Acceptance Scenarios**:

1. **Given** o host abriu o leilão, **When** todos lacram ou o prazo termina, **Then** a partida é criada e gravada uma única vez pela autoridade.
2. **Given** a revelação em qualquer cliente, **When** o ritual visual termina, **Then** o tabuleiro aparece automaticamente, sem botão local de confirmação.
3. **Given** um cliente que reconecta depois do primeiro turno, **When** carrega o snapshot, **Then** entra direto na partida sem repetir leilão ou revelação.

### Edge Cases

- O host tenta abrir o leilão sozinho: a sala permanece no lobby e informa o mínimo de dois jogadores.
- Um lance está fora da faixa, não é múltiplo de $50, vem de identidade sem assento ou é enviado duas vezes: a autoridade ignora sem alterar a sala.
- Todos lacram $0: ninguém perde caixa; a ordem é toda resolvida pelo sorteio de desempate; a Loteria começa em $500.
- Todos lacram $500: todos começam com $1.500; a ordem é desempatada; a Loteria começa em $500 mais $500 por jogador.
- Um jogador desconecta antes de lacrar: o prazo continua e seu lance vira $0; nenhuma cobrança ocorre antes do fechamento.
- O host recarrega durante a coleta: nenhum lance já enviado pode ser cobrado parcialmente; a coleta pode reabrir limpa no lobby.
- A revelação é interrompida por reload: o snapshot inicial já está gravado; o cliente entra na partida, sem cobrança ou criação duplicada.
- A Loteria acrescida pelos lances é coletada no Free Parking e volta a $500 exatamente como antes.
- Sala nova ou legado sem configuração explícita usa Leilão secreto.
- Em Maior dado, uma soma empatada é desempatada pelo RNG da autoridade; a ordem final e as rolagens permanecem iguais em todos os clientes.
- Em Maior dado, pedido antecipado, duplicado, de identidade sem assento ou fora da vez é ignorado sem consumir RNG.
- Se o jogador da vez desconecta antes de pedir a rolagem, a mesa aguarda sua reconexão; resultados anteriores permanecem persistidos.
- Se o host recarrega durante um arremesso, a autoridade reassumida conclui o resultado a partir do instante persistido, sem liberar duas rolagens.

## Requirements

### Functional Requirements

**Leilão e economia**

- **FR-026**: O host DEVE escolher no lobby entre `sealed-bid` (Leilão secreto) e `dice-roll` (Maior dado); o modo DEVE ser público, persistido e imutável depois do início.
- **FR-027**: Salas novas e shapes sem modo explícito DEVEM usar Leilão secreto; convidados NÃO DEVEM poder alterar a seleção.
- **FR-028**: Em Maior dado, iniciar DEVE abrir uma fase pública e persistida de rolagens sequenciais, na ordem dos assentos do lobby.
- **FR-029**: Em Maior dado, todos DEVEM iniciar com $2.000, a Loteria com $500 e nenhum lance ou débito.
- **FR-030**: A revelação de Maior dado DEVE mostrar a ordem e os dois dados de cada jogador antes da entrada automática no tabuleiro.
- **FR-031**: Somente o dono do assento da vez DEVE poder pedir a própria rolagem; o pedido NÃO DEVE carregar identidade declarada nem valores.
- **FR-032**: A autoridade DEVE publicar quem está rolando, gerar exatamente dois d6 e publicar o resultado antes de liberar o assento seguinte.
- **FR-033**: Resultados anteriores, líder parcial, jogador da vez e arremesso em curso DEVEM convergir em todas as telas pela mesma `PublicRoom`.
- **FR-034**: Pedidos fora da vez, duplicados, sem assento ou fora da fase DEVEM ser ignorados sem alterar a sala nem consumir RNG.
- **FR-035**: Fase, resultados e arremesso em curso DEVEM sobreviver a reload; a partida DEVE ser criada exatamente uma vez depois da última rolagem.
- **FR-036**: Desconexão antes da própria rolagem DEVE aguardar reconexão, sem timer punitivo nem rolagem automática.
- **FR-001**: O host DEVE abrir o Leilão da Largada com uma única ação quando houver de 2 a 8 assentos.
- **FR-002**: Todos os assentos, inclusive o host, DEVEM poder lacrar exatamente um lance de $0 a $500, em passos de $50.
- **FR-003**: A coleta DEVE durar no máximo 15 segundos e DEVE fechar antes quando todos os assentos tiverem lacrado.
- **FR-004**: Assento sem lance ao fechar DEVE receber lance $0.
- **FR-005**: A ordem inicial DEVE ser decrescente por lance; empates DEVEM ser resolvidos pelo RNG da autoridade e resultar na mesma ordem para todos.
- **FR-006**: Cada jogador DEVE iniciar com $2.000 menos o próprio lance.
- **FR-007**: A Loteria DEVE iniciar com $500 mais a soma de todos os lances.
- **FR-008**: Coletar a Loteria no Free Parking e reabastecê-la com $500 DEVE continuar inalterado.

**Privacidade e autoridade**

- **FR-009**: Antes do fechamento, um jogador DEVE conhecer apenas o próprio lance e quais assentos já lacraram.
- **FR-010**: Valores alheios NÃO DEVEM trafegar para clientes antes da revelação.
- **FR-011**: A autoridade DEVE validar identidade do remetente, existência do assento, faixa, passo e unicidade do lance.
- **FR-012**: Valores e ordem DEVEM se tornar públicos juntos na revelação.
- **FR-013**: Nenhum débito DEVE ocorrer antes de todos os lances terem sido resolvidos no estado inicial gravado.

**Experiência e início automático**

- **FR-014**: A tela DEVE apresentar o leilão como ritual da sala de mapas do design system, usando apenas tokens, tipografia, cores, sombras e primitivos existentes.
- **FR-015**: A coleta DEVE mostrar prazo, valor selecionado, caixa restante, destino do dinheiro e estado lacrado/pendente de cada assento.
- **FR-016**: A revelação DEVE mostrar ordem, lances, caixa preservado e progressão da Loteria de $500 ao total final.
- **FR-017**: Depois da revelação, cada cliente DEVE entrar automaticamente no tabuleiro; NÃO DEVE existir botão individual “Começar”.
- **FR-018**: Prazo, fechamento, cobrança, persistência e disponibilidade do tabuleiro NÃO DEVEM depender do término de animação.
- **FR-019**: Toda informação transmitida por movimento ou cor DEVE ter equivalente textual; foco, teclado, contraste e alvos DEVEM cumprir WCAG 2.2 AA no caminho de jogo.
- **FR-020**: `prefers-reduced-motion` DEVE remover movimento ornamental e preservar todos os fatos e a transição automática.
- **FR-021**: A interface DEVE caber sem rolagem horizontal nas viewports de paisagem suportadas pelo caminho de jogo.

**Reconexão e compatibilidade**

- **FR-022**: Recarregar durante a revelação NÃO DEVE recriar a partida nem cobrar lances duas vezes.
- **FR-023**: Reconectar depois de a partida avançar DEVE entrar diretamente no tabuleiro.
- **FR-024**: Snapshots e salas anteriores a esta feature DEVEM continuar carregando sem erro.
- **FR-025**: Partidas locais e simuladores sem leilão explícito DEVEM continuar iniciando com $2.000 e Loteria de $500.

### Key Entities

- **Leilão da Largada**: fase pré-partida com prazo, assentos participantes, estado lacrado/pendente e resultado público após o fechamento.
- **Lance lacrado**: compromisso único de um assento, entre $0 e $500 em passos de $50; privado até a revelação.
- **Resultado da largada**: ordem final, lance e caixa preservado de cada jogador, além do total transferido à Loteria.
- **Modo da largada**: escolha pública e persistida do host entre `sealed-bid` e `dice-roll`.
- **Rolagem da largada**: par de dados brancos gerado pela autoridade para um assento no modo Maior dado.
- **Disputa de dados**: fase compartilhada do modo Maior dado, com um assento da vez, resultados parciais e no máximo um arremesso em curso.
- **Loteria**: `centerPot` já existente; recebe a semente de $500 e a soma dos lances antes do primeiro turno.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Em teste com 2 a 8 jogadores, 100% dos clientes chegam à mesma ordem, saldos e valor da Loteria.
- **SC-002**: Um convidado sem qualquer interação após lacrar chega ao tabuleiro automaticamente em até 6 segundos após o fechamento.
- **SC-003**: Inspeção do estado público durante a coleta encontra zero valores de lances alheios.
- **SC-004**: 100% dos lances fora da faixa, fora do passo, duplicados ou sem assento são rejeitados sem alterar caixa ou ordem.
- **SC-005**: O fluxo completo é operável por teclado e não apresenta violações sérias ou críticas na auditoria automatizada de acessibilidade.
- **SC-006**: Com movimento reduzido, toda a revelação permanece compreensível e a entrada automática continua funcionando.
- **SC-007**: Testes existentes de Free Parking, reconexão, privacidade de transporte, partida local e conservação econômica continuam verdes.
- **SC-008**: Em Maior dado com 2 a 8 jogadores, 100% dos clientes veem as mesmas rolagens e ordem, enquanto todos os caixas permanecem em $2.000 e a Loteria em $500.
- **SC-009**: Em mesa de 2 a 8 jogadores, cada assento conclui exatamente uma rolagem por ação do próprio dono, nunca existem dois arremessos simultâneos e o próximo botão aparece somente depois do resultado atual.

## Assumptions

- “Paga ao banco” significa que o banco recebe o lance e o deposita integralmente na Loteria na mesma criação atômica do estado inicial.
- O lance fica travado após confirmação; não há atualização oportunista até o prazo.
- O sorteio de desempate pode ser apresentado como dados do banco, mas a regra é apenas produzir uma ordem total atestada pela autoridade.
- Desconexão no ritual pré-partida não aciona a pausa de partida; o assento sem lance recebe $0.
- O design visual de referência é o design system atual: sala de mapas, tinta, latão, starlight, marcas de registro e movimento reduzido.
- “Maior dado” usa a soma de dois dados brancos; o Speed Die não participa.
- A sequência de quem rola usa a ordem pública dos assentos no lobby; apenas a ordem final da partida é recalculada pelas somas.
