# Feature Specification: Uso de Bus Tickets & espaço Bus Ticket

**Feature Branch**: `009-bus-tickets`

**Created**: 2026-05-23

**Status**: Draft

**Input**: User description: "Uso de Bus Tickets (SRS §10.7) e o espaço Bus Ticket (SRS §2.7). O contador por jogador e a obtenção via carta 'Passagem de Ônibus' já existem (006). Cobre: usar um ticket antes de rolar (mover para uma casa do mesmo lado em vez de rolar; resolve a casa; crédito de GO se cruzar) e o espaço Bus Ticket (parar nele concede +1 ticket). NÃO cobre negociação de tickets nem a face Ônibus do Speed Die."

**Depende de**: [`002`](../002-fluxo-de-turno/spec.md) (FSM do turno, estado `aguardando-rolagem`, movimento/`onPassGo`, resolução de casa) · [`006`](../006-sistema-cartas/spec.md) (contador `busTickets`, carta "Passagem de Ônibus" que o credita)

> **Escopo desta spec:** as duas metades ainda inertes do subsistema de Bus Tickets — **(1) o uso do ticket** (§10.7): movimento alternativo à rolagem, dentro do mesmo lado do tabuleiro; e **(2) o espaço Bus Ticket** (§2.7): parar nele concede 1 ticket (hoje a casa é resolvida como no-op). **Não** cobre: obtenção via carta "Passagem de Ônibus" (já entregue no 006), a **face Ônibus do Speed Die** (escolha de qual dado mover — já entregue no 002, mecânica distinta apesar do nome) e **negociação** de tickets (proibida por D-012/princípio VI; sem spec de Negociação ainda). Fonte de verdade: [`docs/SRS.md`](../../docs/SRS.md) §10.7 e §2.7.

## Clarifications

### Session 2026-05-23

- Q: Quando o jogador está sobre um **canto** (0/12/24/36) no início do turno, qual é o "mesmo lado" elegível como destino do ticket? → A: **Indisponível no canto** — um canto não pertence a nenhum lado; o ticket só pode ser usado quando o jogador está numa casa de lado (pos ∉ {0,12,24,36}).
- Q: O movimento do ticket é **sempre para frente** (horário) até a casa escolhida — e só credita GO se esse caminho cruzar o GO — ou pode ir para "trás" dentro do lado sem creditar GO? → A: **Horário, credita GO ao cruzar** — o token avança no sentido horário até a casa escolhida (reuso do `advance` do 002); o bônus de GO progressivo é creditado se o caminho cruzar o GO (na prática, só ao escolher uma casa "atrás" no lado 37–47).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Usar um Bus Ticket no lugar de rolar (Priority: P1)

Como jogador **da vez**, **antes de rolar os dados**, eu posso **gastar 1 Bus Ticket** para escolher uma casa no **mesmo lado do tabuleiro** em que estou e mover meu token para lá em vez de rolar. A casa de destino é **resolvida normalmente** (compra/aluguel/carta/etc.), meu contador de tickets cai em 1, e meu turno **continua** (ações facultativas e finalizar). Como não houve rolagem, **não há dupla** nem nova rolagem.

**Why this priority**: É a mecânica central deferida — o contador já existe e a carta já o credita (006), mas o ticket não tinha utilidade nenhuma. Sem isto, Bus Tickets são pontos mortos. MVP da feature.

**Independent Test**: dar 1 ticket a um jogador no estado `aguardando-rolagem`, mandá-lo usar o ticket escolhendo uma casa válida do lado atual, e verificar que o token foi para lá, o contador caiu para 0, a casa de destino entrou em resolução e o turno seguiu sem permitir nova rolagem.

**Acceptance Scenarios**:

1. **Given** um jogador da vez com `busTickets ≥ 1` no estado `aguardando-rolagem`, **When** ele usa um ticket escolhendo uma casa válida do lado atual, **Then** seu token vai para essa casa, `busTickets` decrementa em 1 e a casa de destino fica pendente de resolução (como se tivesse parado nela ao rolar).
2. **Given** o ticket levou o jogador a uma propriedade livre, **When** a casa é resolvida, **Then** abre a compra normalmente (reuso do fluxo de 003) — o ticket não altera a resolução da casa de destino.
3. **Given** um jogador usou o ticket (não rolou), **When** a casa é resolvida e ele finaliza, **Then** **não** há direito a nova rolagem (sem dupla, pois não houve dados) e a vez passa normalmente.
4. **Given** um jogador com `busTickets = 0`, **When** ele tenta usar um ticket, **Then** a ação é **rejeitada** (sem efeito) e o estado permanece `aguardando-rolagem`.
5. **Given** um jogador **que não é o da vez**, ou um jogador da vez **fora** do estado `aguardando-rolagem` (já rolou / preso / resolvendo casa), **When** ele tenta usar um ticket, **Then** a ação é **rejeitada**.
6. **Given** uma casa escolhida que **não pertence ao lado atual** (outro lado ou um canto fora do lado), **When** o jogador tenta mover para ela, **Then** a ação é **rejeitada** (escolha inválida) e o ticket **não** é consumido.
7. **Given** um jogador da vez sobre um **canto** (pos 0/12/24/36), **When** ele tenta usar um ticket, **Then** a ação é **rejeitada** (canto não pertence a lado nenhum; ticket indisponível).
8. **Given** um jogador no lado 37–47 (ex.: pos 45) que escolhe uma casa "atrás" no mesmo lado (ex.: pos 38), **When** usa o ticket, **Then** o token avança no sentido horário cruzando o GO e **recebe** o bônus de GO progressivo.

---

### User Story 2 - Parar no espaço Bus Ticket concede um ticket (Priority: P2)

Como jogador que **para no espaço Bus Ticket** (a casa especial, kind `bus-ticket`), eu **ganho 1 Bus Ticket** somado ao meu contador. A casa não é propriedade — não há compra, aluguel nem leilão; só o ganho do ticket, e o turno segue.

**Why this priority**: É a segunda fonte de tickets prevista no SRS (§2.7) e hoje a casa é um no-op. Sem ela, a única fonte é a carta. Pequena, autocontida, mas secundária ao uso.

**Independent Test**: posicionar um jogador para parar no espaço Bus Ticket e verificar que `busTickets` aumentou em 1 e a casa resolveu sem abrir qualquer interação econômica.

**Acceptance Scenarios**:

1. **Given** um jogador que para no espaço Bus Ticket, **When** a casa é resolvida, **Then** seu `busTickets` aumenta em 1 e a casa é considerada resolvida (turno pode finalizar).
2. **Given** o espaço Bus Ticket, **When** um jogador apenas **passa** por ele (sem parar), **Then** **nenhum** ticket é concedido.

---

### Edge Cases

- **Jogador sobre um canto** (pos 0/12/24/36) ao iniciar o turno: ticket **indisponível** (canto não é um lado) — resolvido em Clarifications.
- **Cruzar o GO** durante o movimento do ticket: movimento **horário**; credita o bônus de GO progressivo se o caminho cruzar o GO (na prática, só ao escolher uma casa "atrás" no lado 37–47) — resolvido em Clarifications.
- **Destino "Vá para a Prisão" não existe no meio de um lado** (índice 36 é canto, logo nunca é destino dentro de um lado) — então o ticket nunca manda para a prisão por casa de destino.
- **Múltiplos tickets no mesmo turno**: o uso do ticket **é** o movimento do turno (substitui a rolagem); portanto, no máximo **um** ticket por turno (não se acumula movimento). Documentado em Assumptions.
- **Sem casas elegíveis**: todo lado tem 11 casas e o jogador ocupa no máximo uma; sempre há destino possível quando em um lado. (Caso de canto tratado acima.)
- **Pausa/desconexão** (princípio VII): usar ticket é bloqueado enquanto a partida está pausada, como qualquer comando de turno.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST permitir que o jogador **da vez** use 1 Bus Ticket **somente** no estado `aguardando-rolagem` (próprio turno, antes de rolar). Em qualquer outro estado (preso, casa-a-resolver, aguardando-finalização, encerrado) ou por outro jogador, a ação é rejeitada sem efeito.
- **FR-002**: O sistema MUST rejeitar o uso de ticket quando o jogador tiver `busTickets = 0`.
- **FR-003**: Ao usar um ticket, o sistema MUST exigir a escolha de uma **casa de destino** e MUST validar que ela pertence ao **lado atual** do jogador (lados: 1–11, 13–23, 25–35, 37–47; cantos 0/12/24/36 são fronteira e não são destino). Escolha inválida é rejeitada sem consumir o ticket.
- **FR-003a**: O sistema MUST rejeitar o uso de ticket quando o jogador estiver **sobre um canto** (pos ∈ {0,12,24,36}), pois um canto não pertence a nenhum lado e não há destino válido.
- **FR-004**: Ao usar um ticket com destino válido, o sistema MUST **mover** o token do jogador para a casa escolhida e **decrementar** `busTickets` em 1.
- **FR-005**: O movimento do ticket é **sempre no sentido horário** até a casa escolhida (mesmo `advance` do movimento normal, 002). Se esse caminho **cruzar o GO**, o sistema MUST creditar o bônus de GO progressivo (porta `onPassGo`, 007). Na prática isso só ocorre ao escolher uma casa "atrás" no lado 37–47.
- **FR-006**: Após o movimento por ticket, o sistema MUST **resolver a casa de destino** exatamente como se o jogador tivesse parado nela por rolagem (compra/aluguel/carta/imposto/espaço Bus Ticket/etc.), reusando o fluxo de resolução existente.
- **FR-007**: Como o uso do ticket **não** envolve rolagem, o sistema MUST NOT conceder nova rolagem (não há dupla) e MUST permitir finalizar o turno normalmente após a resolução da casa de destino.
- **FR-008**: O sistema MUST permitir **no máximo um** movimento por turno: usar o ticket consome o movimento daquele turno (não há "rolar depois de usar o ticket", nem usar um segundo ticket no mesmo turno).
- **FR-009**: Quando um jogador **para** no espaço Bus Ticket (kind `bus-ticket`), o sistema MUST incrementar seu `busTickets` em 1 e considerar a casa resolvida (sem compra/aluguel/leilão).
- **FR-010**: O sistema MUST NOT conceder ticket quando o jogador apenas **passa** pelo espaço Bus Ticket sem parar.
- **FR-011**: O sistema MUST bloquear o uso de ticket enquanto a partida estiver **pausada** (princípio VII), como os demais comandos de turno.
- **FR-012**: O contador `busTickets` MUST permanecer **privado** (outros jogadores veem apenas a quantidade), **sem limite** de acúmulo, **separado** do limite de 3 cartas e **não-negociável** (D-012, princípio VI). Esta spec não introduz negociação.

### Key Entities *(include if feature involves data)*

- **Bus Ticket (contador)**: `player.busTickets` (inteiro ≥ 0), já existente (006). Esta feature passa a **gastá-lo** (uso) e a **creditá-lo** também pela casa (§2.7), além da carta (006).
- **Lado do tabuleiro**: uma das 4 sequências de 11 casas entre cantos (1–11, 13–23, 25–35, 37–47). Define o conjunto de destinos válidos de um ticket a partir da posição atual.
- **Movimento por ticket (interação transitória)**: estado pendente "jogador deve escolher a casa de destino" após decidir usar um ticket — análogo às escolhas pré-movimento já existentes no turno (ex.: face Ônibus/Triple do Speed Die).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% dos usos de ticket a partir de uma posição **dentro de um lado** resultam no token na casa escolhida desse lado e em `busTickets` decrementado em exatamente 1.
- **SC-002**: 100% das tentativas inválidas (sem ticket, fora da vez, fora do estado `aguardando-rolagem`, destino fora do lado) são rejeitadas **sem** alterar posição nem contador.
- **SC-003**: Em 100% dos casos, a casa de destino do ticket é resolvida com o mesmo desfecho que teria se o jogador tivesse parado nela por rolagem (mesma compra/aluguel/carta).
- **SC-004**: 100% das paradas no espaço Bus Ticket aumentam `busTickets` em exatamente 1; 100% das passagens (sem parar) não concedem ticket.
- **SC-005**: Nenhum uso de ticket concede nova rolagem; o turno sempre segue para finalização após a resolução da casa de destino.

## Assumptions

- **Um movimento por turno**: usar o ticket substitui a rolagem daquele turno; não há combinação "ticket + rolar" nem dois tickets no mesmo turno. (Leitura natural de "antes de rolar os dados … move-se para lá **em vez de** rolar", §10.7.)
- **Disponibilidade só em `aguardando-rolagem`**: ticket não tira o jogador da prisão (estado `prisao-decisao` é distinto) e não pode ser usado depois de já ter rolado/movido no turno.
- **Destino é uma casa do lado atual diferente da atual**: o jogador não "usa o ticket para ficar parado".
- **Espaço Bus Ticket sem baralho finito**: o ganho do ticket é um incremento de contador (não há um deck finito de cartas-ticket a esgotar); a menção do SRS §2.7 a "se ainda houver no baralho" é tratada como sem limite prático nesta versão, coerente com §10.7 ("sem limite de Bus Tickets acumuláveis"). Registrar como simplificação se uma futura regra de escassez surgir.
- **Reuso de resolução**: a casa de destino e o espaço Bus Ticket usam o mesmo mecanismo de resolução de casa do turno (002), sem caminho novo de regras econômicas.
- A **face Ônibus do Speed Die** (002) e o **uso de Bus Ticket** (esta spec) são mecânicas **distintas** apesar do nome compartilhado ("ônibus"); esta spec não altera a face do Speed Die.
