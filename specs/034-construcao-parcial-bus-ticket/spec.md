# Feature Specification: Construção com país parcial (aluguel escalonado) + timing do Bus Ticket

**Feature Branch**: `034-construcao-parcial-bus-ticket`

**Created**: 2026-05-27

**Status**: Draft

**Input**: User description: "Hoje pra construir casa/hotel/arranha-céu preciso da maioria das propriedades de um país. Combinamos que a pessoa pode construir tendo apenas 1 propriedade, mas o aluguel é menor e vai aumentando conforme quantas propriedades do mesmo país ela tem — com um cálculo balanceado e justo. E: quando ganha um Bus Ticket, deveria poder rolar, comprar, e DEPOIS usar o ticket pra cair noutra casa e comprá-la também."

## Visão geral

Duas mecânicas de jogo numa só spec (por decisão do usuário):

- **A. Construção com país parcial + aluguel escalonado por posse** — remove a exigência de "maioria do país" para construir casas/hotéis; passa a permitir construir tendo qualquer quantidade de cidades do país (≥1). O aluguel **construído** deixa de ser binário (70% parcial / 100% completo) e passa a escalar pelo número de cidades do país que o jogador possui.
- **B. Timing do Bus Ticket** — o Bus Ticket guardado, hoje usável só antes de rolar, passa a poder ser usado **também no fim do turno** (depois de rolar e resolver a casa onde caiu).

> Contexto de regra: o SRS já previa construção com grupo parcial (§13.3) e o "set bonus" sem construção (§5.1: base → 150% → 200%). O que muda é (1) o gatilho da construção (maioria → 1 propriedade) e (2) a curva do aluguel construído (binário → contínuo por posse).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Construir tendo só parte do país (Priority: P1)

Como dono de **uma** cidade de um país (sem ter a maioria do grupo), eu quero poder construir casa nela, em vez de ficar travado esperando comprar/negociar as outras cidades do país.

**Why this priority**: É o coração da feature — destrava o "jogador parado" que tem dinheiro mas não consegue evoluir por não fechar a maioria do país. Sem isso, nada do resto importa.

**Independent Test**: Dar a um jogador 1 cidade de um país de 3, com caixa suficiente, e verificar que a ação "Construir" fica disponível e executa (sobe o nível da cidade), sem precisar possuir as outras duas.

**Acceptance Scenarios**:

1. **Given** o jogador possui 1 de 3 cidades de um país, sem nada hipotecado no que possui e com caixa para o custo, **When** ele constrói, **Then** a construção é aceita e a cidade sobe de nível.
2. **Given** o jogador possui 1 de 3 cidades, **When** ele tenta subir uma 2ª casa na mesma cidade enquanto outra cidade possuída do país está num nível menor, **Then** a uniformidade bloqueia (constrói primeiro na de menor nível) — regra mantida.
3. **Given** qualquer cidade do país que o jogador possui está hipotecada, **When** ele tenta construir, **Then** a construção é bloqueada.
4. **Given** o jogador possui 2 de 3 cidades (não o país completo) e tenta construir **arranha-céu**, **Then** é bloqueado — arranha-céu exige país completo.

---

### User Story 2 - Aluguel proporcional à posse do país (Priority: P1)

Como jogador, quero que o aluguel das minhas cidades **construídas** reflita quão "fechado" está meu país: construir tendo pouco do país rende menos; quanto mais cidades daquele país eu tiver, mais perto do aluguel cheio — fechando o país, aluguel cheio.

**Why this priority**: É o contrapeso de balanceamento da US1. Permitir construir com 1 propriedade só é justo se o retorno for proporcional; senão vira abuso. As duas andam juntas.

**Independent Test**: Com uma cidade construída no mesmo nível, cobrar aluguel em três cenários de posse (1/3, 2/3, 3/3) e verificar que os valores cobrados são 50%, 75% e 100% do valor de tabela daquele nível.

**Acceptance Scenarios**:

1. **Given** uma cidade com 1 casa num país de 3 e o jogador possui **1 de 3**, **When** um adversário cai nela, **Then** o aluguel cobrado é **50%** do valor de tabela de "1 casa".
2. **Given** a mesma cidade, agora com o jogador possuindo **2 de 3**, **When** um adversário cai nela, **Then** o aluguel é **75%** da tabela.
3. **Given** o jogador possui **3 de 3** (país completo), **When** um adversário cai, **Then** o aluguel é **100%** da tabela.
4. **Given** um país-duo (2 cidades) com construção e o jogador possui **1 de 2**, **When** cobra-se aluguel, **Then** é **50%**; possuindo **2 de 2**, é **100%**.
5. **Given** uma cidade com 1 casa e posse 1/3, **When** comparado ao aluguel da mesma cidade **sem** construção (mesma posse), **Then** o valor construído é estritamente maior (construir sempre compensa).

---

### User Story 3 - Usar o Bus Ticket depois de jogar (Priority: P2)

Como jogador que tem um Bus Ticket guardado, quero, no meu turno, rolar os dados, resolver a casa onde caí (inclusive comprar), e **depois** usar o Bus Ticket pra pular pra outra casa do mesmo lado e comprá-la também — em vez de ter que decidir usar o ticket só antes de rolar.

**Why this priority**: Melhora a flexibilidade tática do Bus Ticket sem mudar sua mecânica de salto. É independente da Feature A e pode ser entregue/testada sozinha.

**Independent Test**: Dar 1 Bus Ticket a um jogador, deixá-lo rolar e resolver a casa; após resolver, verificar que a ação "Usar Bus Ticket" fica disponível e que, ao saltar para uma casa livre do mesmo lado, é possível comprá-la antes de finalizar o turno.

**Acceptance Scenarios**:

1. **Given** o jogador rolou, caiu e resolveu a casa (estado de "pode finalizar") e tem ≥1 Bus Ticket, **When** ele usa o ticket para uma casa do mesmo lado, **Then** ele pula pra lá e a casa de destino é resolvida (compra/leilão) normalmente.
2. **Given** o jogador usou o ticket pós-jogada e resolveu o destino, **When** ele ainda tem outro ticket, **Then** pode usar de novo antes de finalizar.
3. **Given** o jogador está sobre um canto após a jogada, **When** tenta usar o ticket, **Then** fica indisponível (salto exige estar num lado do tabuleiro).
4. **Given** o uso pré-rolagem do ticket, **Then** continua funcionando como antes (a nova janela é adicional, não substitui).

---

### Edge Cases

- **Monotonicidade**: construir 1 casa possuindo 1/3 (50% da tabela de "1 casa") deve render **mais** que a mesma cidade sem construção com a mesma posse — nunca menos.
- **Limites do fator**: o fator de aluguel construído nunca passa de 100% nem fica abaixo de 50%.
- **Venda mantém uniformidade**: vender construção não pode deixar uma cidade possuída com diferença >1 nível das outras do país.
- **Arranha-céu**: continua exigindo país completo; seu bônus de **triplicar** o aluguel das demais cidades do grupo é mantido. O fator de posse não se aplica ao arranha-céu (sempre 100%, pois exige país completo).
- **Hangar**: aeroporto não é "país" — o hangar não tem requisito de grupo nem fator de posse; permanece inalterado.
- **Bus Ticket cruzando GO**: o salto continua **não** cruzando o GO (sem bônus de $200), mesmo usado no fim do turno.
- **Salto pós-jogada que cai em "Vá para a Prisão" ou casa que encerra o turno**: resolve conforme a casa de destino (o turno pode encerrar).

## Requirements *(mandatory)*

### Functional Requirements — A. Construção & aluguel

- **FR-001**: O sistema MUST permitir construir casa (níveis 1–4), hotel (5) e 2º hotel (6) numa cidade desde que o jogador seja dono dela — **sem** exigir a maioria das cidades do país.
- **FR-002**: O sistema MUST bloquear a construção se **qualquer** cidade do país que o jogador possui estiver hipotecada.
- **FR-003**: O sistema MUST manter a regra de **uniformidade** entre as cidades do país **que o jogador possui** (diferença de no máximo 1 nível; constrói-se primeiro na de menor nível).
- **FR-004**: O sistema MUST exigir caixa suficiente para o custo de construção (tier por grupo, inalterado).
- **FR-005**: O sistema MUST continuar exigindo o **país completo** para construir **arranha-céu** (nível 7) e MUST manter o bônus de triplicar o aluguel das demais cidades do grupo enquanto houver arranha-céu.
- **FR-006**: O sistema MUST deixar o **hangar** (aeroporto) inalterado — sem requisito de país e sem fator de posse.
- **FR-007**: O aluguel de uma cidade **com construção** MUST ser o valor de tabela do nível multiplicado por um **fator de posse**: `fator = 0,5 + 0,5 × (cidadesQuePossui − 1) / (tamanhoDoPaís − 1)`.
- **FR-008**: O fator MUST produzir: país de 3 cidades → **1/3 = 50%, 2/3 = 75%, 3/3 = 100%**; país-duo → **1/2 = 50%, 2/2 = 100%**; país completo sempre **100%**.
- **FR-009**: O aluguel **sem construção** (set bonus) MUST permanecer como hoje: base (sub-maioria) → **150%** (maioria) → **200%** (país completo).
- **FR-010**: O sistema MUST garantir **monotonicidade**: para a mesma posse, qualquer nível construído rende ≥ o nível imediatamente inferior (e a base sem construção).
- **FR-011**: O sistema MUST remover a razão de bloqueio "precisa da maioria do grupo" da gestão de propriedade (não é mais um impeditivo).

### Functional Requirements — B. Bus Ticket

- **FR-012**: O sistema MUST permitir usar um Bus Ticket guardado **também** depois de o jogador ter rolado e resolvido a casa onde caiu (fim do turno), **além** do uso antes de rolar.
- **FR-013**: O salto do Bus Ticket MUST manter as regras vigentes: destino no **mesmo lado** do tabuleiro, **não** cruza o GO (sem bônus), consome 1 ticket, **não** concede nova rolagem nem conta como dupla.
- **FR-014**: Após o salto pós-jogada e a resolução do destino, o sistema MUST permitir usar **outro** Bus Ticket (se houver) antes de finalizar o turno.
- **FR-015**: O sistema MUST manter o salto indisponível quando o jogador estiver sobre um canto (não pertence a um lado).

### Functional Requirements — Documentação

- **FR-016**: O SRS MUST ser atualizado (regras de construção/aluguel em §5.1/§13.3 e janela de uso do Bus Ticket em §10.7) e o DECISIONS MUST registrar a revisão da decisão de construção parcial (antes: maioria + 70%) para o novo modelo.

### Key Entities

- **Cidade (propriedade de país)**: pertence a um país (grupo) de tamanho 2 ou 3; tem um dono e um nível de construção (0 = sem construção, 1–4 casas, 5 hotel, 6 2º hotel, 7 arranha-céu).
- **País (grupo)**: conjunto de 2 ou 3 cidades; o **número de cidades que o jogador possui** dele determina o fator de aluguel construído e o set bonus sem construção.
- **Bus Ticket**: item guardado de uso facultativo; permite um salto dentro do mesmo lado do tabuleiro; agora utilizável em duas janelas do turno (antes de rolar e após resolver).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Um jogador que possui **1** cidade de um país consegue construir nela (ação disponível e efetiva), onde antes era 100% bloqueada.
- **SC-002**: Em 100% das cobranças de aluguel de cidade construída, o valor cobrado é igual ao valor de tabela do nível × fator de posse (50% / 75% / 100% conforme 1, 2 ou 3 de 3; 50% / 100% conforme 1 ou 2 de 2).
- **SC-003**: Para qualquer posse fixa, construir 1 casa nunca rende menos que não construir (monotonicidade verificável em todos os grupos).
- **SC-004**: Arranha-céu permanece impossível de construir sem o país 100% completo.
- **SC-005**: Num único turno, um jogador consegue rolar, comprar a casa onde caiu e, em seguida, usar um Bus Ticket para cair em outra casa do mesmo lado e comprá-la — sem precisar finalizar o turno entre as duas compras.

## Assumptions

- O "set bonus" de aluguel **sem** construção (100% / 150% / 200% por posse) **permanece** como está hoje; a feature só altera a curva do aluguel **com** construção. (Decidido com o usuário.)
- O custo de construção (tier por grupo) **não muda** — só o aluguel resultante escala por posse.
- O arranha-céu **continua** exigindo país completo (decidido com o usuário) — coerente com seu bônus de ×3 no grupo.
- O hangar **não** faz parte desta feature (aeroporto não é país).
- A nova janela do Bus Ticket é **adicional** ao uso pré-rolagem (não o substitui). Decidido com o usuário.
- A uniformidade segue calculada apenas sobre as cidades do país **que o jogador possui** (não sobre as não-possuídas) — comportamento atual.
