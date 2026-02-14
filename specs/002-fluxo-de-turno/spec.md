# Feature Specification: Fluxo de Turno

**Feature Branch**: `002-fluxo-de-turno`

**Created**: 2026-05-23

**Status**: Draft

**Input**: User description: "Fluxo de Turno (rolar, mover, resolver, finalizar, duplas)"

**Depende de**: [`001-tabuleiro-48-casas`](../001-tabuleiro-48-casas/spec.md) (geometria, índices 0–47, cantos 0/12/24/36)

> **Escopo desta spec:** define a **máquina de estados de um turno** e a **rotação entre turnos** — a sequência `rolar → mover → resolver → finalizar`, o tratamento de duplas, o turno especial de Prisão, a integração do Speed Die no movimento, o gatilho de passagem pelo GO e a passagem da vez. **Não** define a mecânica interna de cada tipo de casa (compra/leilão, cálculo de aluguel, efeito das cartas, construção, hipoteca, negociação), nem o desenho das faces/ativação do Speed Die, a fórmula do GO Progressivo ou a acumulação do Free Parking — esses pertencem às suas próprias specs; aqui apenas se orquestra **quando** disparam dentro do turno. Fonte de verdade: [`docs/SRS.md`](../../docs/SRS.md) §3, §4 e §13.2.

## Clarifications

### Session 2026-05-23

- Q: Após um triple (3 dados iguais → "mover para qualquer casa"), o jogador rola novamente por causa da dupla nos brancos? → A: Não — o triple encerra a rolagem do turno; sem re-roll, mesmo com brancos iguais.
- Q: Na 1ª vez que o jogador cruza o GO, o Speed Die entra naquela mesma rolagem ou só na próxima? → A: A partir da próxima rolagem — a rolagem que cruza o GO usa 2 dados; da seguinte em diante (inclusive re-roll por dupla no mesmo turno) entra o 3º dado.
- Q: Sob a face Ônibus, mover só um dado quando os brancos saíram iguais ainda conta como dupla? → A: Sim — a dupla é pelos valores rolados dos brancos; a escolha de movimento do Ônibus não quebra a dupla.
- Q: Ações facultativas (construir/hipotecar/negociar) podem ocorrer antes de rolar, ou só depois de resolver a casa? → A: Janela livre — a qualquer momento até finalizar, inclusive antes de rolar; a rolagem + resolução é a única obrigatória, sem ordem fixa.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ciclo de turno: rolar, mover, resolver, finalizar e passar a vez (Priority: P1)

Como jogador ativo, eu clico em **Rolar Dados**, lanço dois dados de 6 faces, avanço meu token a soma no sentido horário pelos índices 0–47, **resolvo** a casa onde parei (comprar, pagar, sacar carta, etc., conforme o tipo) e então clico em **Finalizar Turno**, passando a vez ao próximo jogador da ordem. Ao passar pelo GO recebo o bônus de passagem.

**Why this priority**: É o coração do jogo. Sem o laço básico de turno e a rotação entre jogadores, nenhuma outra regra (duplas, prisão, cartas, construção) tem onde acontecer. Entrega sozinha o valor central: uma partida em que jogadores se alternam dando voltas no tabuleiro.

**Independent Test**: Numa partida de ≥2 jogadores, executar um turno completo de cada um e verificar que o token avança a soma dos dados, que a casa é resolvida antes de finalizar, que a vez passa ao próximo na ordem e que cruzar o GO concede o bônus.

**Acceptance Scenarios**:

1. **Given** é a vez do jogador A, **When** ele clica em Rolar Dados e os dados somam 7, **Then** o token de A avança 7 casas no sentido horário e a casa de destino é apresentada para resolução.
2. **Given** A parou numa casa e a resolveu, **When** A clica em Finalizar Turno, **Then** a vez passa ao próximo jogador da ordem.
3. **Given** o token de A está no índice 45, **When** A rola 5 e cruza do índice 47 para o 1, **Then** A recebe o bônus de passagem pelo GO uma vez.
4. **Given** é a vez de A, **When** B (não-ativo) tenta rolar os dados, **Then** a ação é negada — apenas o jogador ativo rola e finaliza.
5. **Given** A ainda não resolveu a casa onde parou, **When** A tenta Finalizar Turno, **Then** a finalização é bloqueada até a resolução obrigatória terminar.

---

### User Story 2 - Duplas e turno de Prisão (Priority: P2)

Como jogador, ao tirar **dupla** (dados brancos iguais) eu resolvo a casa e **rolo novamente** no mesmo turno; na **3ª dupla consecutiva** vou direto para a Prisão sem mover. Quando estou preso, no início do meu turno escolho **pagar $50**, **usar carta "Saia da Prisão"** ou **tentar dupla**; na 3ª tentativa sem dupla, pago obrigatoriamente e movo.

**Why this priority**: É a camada de complexidade que torna o turno fiel ao gênero — o risco/recompensa das duplas e o ciclo de prisão. Depende do ciclo básico (US1) já existir, por isso P2.

**Independent Test**: Forçar duplas sucessivas e confirmar a nova rolagem por dupla e a ida à prisão na 3ª; colocar um jogador preso e percorrer as três saídas (multa, carta, dupla) e o pagamento forçado na 3ª tentativa.

**Acceptance Scenarios**:

1. **Given** A tira dupla, **When** resolve a casa, **Then** A rola novamente no mesmo turno.
2. **Given** A tirou dupla pela 3ª vez consecutiva, **When** a 3ª rolagem ocorre, **Then** A vai direto à Prisão (índice 12), o movimento da 3ª rolagem **não** é executado e a casa não é resolvida.
3. **Given** A está preso, **When** opta por pagar $50, **Then** os $50 vão para o centro (Free Parking) e A rola normalmente.
4. **Given** A está preso e rola, **When** tira dupla, **Then** A sai, move o valor e **não** rola novamente.
5. **Given** A está preso na 3ª tentativa, **When** não tira dupla, **Then** A paga obrigatoriamente $50 e move o valor da última rolagem.
6. **Given** A está preso, **When** outro jogador para numa propriedade de A, **Then** A ainda recebe o aluguel (preso não impede receber/construir/hipotecar/negociar).

---

### User Story 3 - Movimento com Speed Die após a 1ª volta (Priority: P3)

Como jogador que já completou a **1ª volta** do tabuleiro, toda rolagem minha passa a incluir o **Speed Die** (3º dado): faces numéricas somam ao movimento; **Mr. Banco Master** me leva à próxima propriedade comprável; **Ônibus** me deixa escolher como mover; **Triples** me deixa ir a qualquer casa.

**Why this priority**: É a mecânica que mantém o ritmo no tabuleiro maior, mas é refinamento do movimento — o turno funciona sem ela na 1ª volta. Por isso P3. O **desenho** das faces e a regra de ativação pertencem à spec de Mecânicas de Balanceamento; aqui se define apenas como o turno **incorpora** o 3º dado.

**Independent Test**: Antes da 1ª volta, confirmar que só 2 dados são rolados; após a 1ª volta, confirmar que o 3º dado entra em todas as rolagens e que cada face produz o efeito de movimento correto.

**Acceptance Scenarios**:

1. **Given** A ainda não completou a 1ª volta, **When** A rola, **Then** apenas os dois dados brancos são lançados.
2. **Given** A já completou a 1ª volta, **When** A rola e o Speed Die mostra "2", **Then** o movimento é a soma dos brancos + 2.
3. **Given** A já completou a 1ª volta, **When** o Speed Die mostra Mr. Banco Master, **Then** A move o normal e depois avança até a próxima propriedade não comprada (podendo comprá-la na hora); se todas estiverem compradas, avança até a próxima propriedade não-hipotecada de adversário e paga aluguel.
4. **Given** o Speed Die mostra Ônibus, **When** A decide o movimento, **Then** A escolhe mover o valor de um dos dois dados brancos individualmente ou a soma.
5. **Given** os três dados saem iguais (triples), **When** A decide, **Then** A pode mover o token para qualquer casa do tabuleiro à sua escolha.

---

### Edge Cases

- **Ida à prisão cancela 2ª rolagem:** ao ir à Prisão por "Vá para a Prisão", carta ou 3ª dupla, o movimento é encerrado, **não** se concede GO e não há rolagem adicional pendente.
- **Sair da prisão com dupla:** move o valor mas **não** dá direito a nova rolagem (exceção à regra geral de duplas).
- **Speed Die não conta para dupla:** `3-3` nos brancos + `3` no Speed Die não é "tripla dupla"; a dupla é avaliada só pelos dois brancos.
- **Triple encerra a rolagem:** três dados iguais → mover para qualquer casa **e** fim do movimento do turno; sem re-roll mesmo com os brancos iguais (FR-026).
- **Carta que teleporta:** movimento por carta que envia diretamente a uma casa **não** concede GO ao passar, salvo se a carta disser explicitamente (detalhe na spec de Cartas).
- **Mr. Banco Master / Triples cruzando o GO:** por serem movimento por dados (não por carta), passar pelo GO durante eles concede o bônus, consistente com §3.3.
- **Mr. Banco Master sem propriedades livres:** se não houver propriedade não comprada, avança até a próxima de adversário não-hipotecada e paga aluguel.
- **Ativação do Speed Die no cruzamento do GO:** a rolagem que cruza o GO pela 1ª vez usa 2 dados; a próxima rolagem do jogador (inclusive re-roll por dupla no mesmo turno) já inclui o 3º dado (FR-005).
- **Turno ocioso:** sem timer, um turno deixado parado **não** avança sozinho; só termina por ação do jogador (ou ida automática à prisão).
- **Desconexão mid-turno:** a partida pausa; o jogador ativo não perde a vez nem ativos; o mesmo turno prossegue na reconexão.
- **Jogador eliminado:** a ordem de turnos pula jogadores já falidos (detalhe na spec de Falência).

## Requirements *(mandatory)*

### Functional Requirements

**Posse e rotação do turno**

- **FR-001**: Em qualquer momento MUST existir exatamente **um jogador ativo**; somente ele pode acionar **Rolar Dados** e **Finalizar Turno**.
- **FR-002**: Ao finalizar, a vez MUST avançar para o **próximo jogador na ordem de turnos** (ordem definida no início da partida — insumo desta feature, ver Assumptions), **pulando** jogadores eliminados por falência.
- **FR-003**: Jogadores **não-ativos** MUST continuar habilitados às ações que o SRS permite fora da vez — receber aluguel, propor/aceitar negociação e jogar cartas de janela "Reação" (mecânica detalhada nas specs respectivas).

**Rolagem e movimento**

- **FR-004**: O turno normal MUST exigir **uma rolagem obrigatória** de dois dados de 6 faces; o token avança a **soma**, no **sentido horário**, sobre os índices 0–47 do tabuleiro (001).
- **FR-005**: Completar a **1ª volta** = cruzar o **GO** (índice 0) pela primeira vez desde o início. O Speed Die (3º dado) MUST entrar **a partir da rolagem seguinte** ao cruzamento: a rolagem que cruza o GO ainda usa 2 dados; todas as rolagens posteriores do jogador — **inclusive um re-roll por dupla no mesmo turno do cruzamento** — incluem o 3º dado. O Speed Die **NÃO** é usado na rolagem de ordem inicial nem na tentativa de sair da prisão por dupla.
- **FR-006**: Ações facultativas (construir, hipotecar, deshipotecar, propor negociação, jogar carta de janela "próprio turno") MUST poder ocorrer a qualquer momento antes de **Finalizar Turno**, inclusive antes da rolagem; o detalhe de cada ação vive em sua spec.
- **FR-007**: O jogador MUST **resolver a casa** onde parou (despacho por tipo — FR-010) antes de poder Finalizar Turno.

**Passagem pelo GO**

- **FR-008**: Passar por ou parar no **GO** (índice 0), inclusive cruzando do índice 47 para o 0, MUST conceder o **bônus de GO** (valor calculado pelo GO Progressivo — spec de Balanceamento) **uma vez por passagem**.
- **FR-009**: Movimento por **carta** que envia diretamente a uma casa MUST **não** conceder GO ao passar, salvo menção explícita da carta (o turno simplesmente não dispara o bônus nesses casos).

**Resolução da casa (despacho)**

- **FR-010**: Ao parar, o turno MUST despachar a resolução conforme o **tipo da casa** (cidade livre / com dono, aeroporto, utilidade, imposto, acaso, tesouro, GO, prisão/visita, vá-pra-prisão, férias, bus-ticket, cantos). A mecânica interna de cada tipo é definida na spec correspondente; esta spec define que a resolução é **obrigatória** e bloqueia a finalização.
- **FR-011**: Impostos e multas debitados durante a resolução MUST ir para o **centro** (Free Parking), não ao banco (valor/acumulação na spec de Balanceamento).
- **FR-012**: Parar em **"Vá para a Prisão"** (índice 36), ou ser enviado por carta ou pela 3ª dupla, MUST levar o token à **Prisão** (índice 12), **não** conceder GO e **encerrar** o movimento do turno.

**Duplas**

- **FR-013**: **Dupla** = valores iguais nos dois dados brancos. Após resolver a casa, o jogador que tirou dupla MUST rolar novamente no mesmo turno.
- **FR-014**: O Speed Die **NÃO** conta para dupla (ex.: `3-3` brancos + `3` no Speed Die não é "tripla dupla"); a dupla é avaliada apenas pelos dois dados brancos como rolados.
- **FR-015**: A **3ª dupla consecutiva** no mesmo turno MUST enviar o jogador direto à Prisão; o movimento dessa 3ª rolagem **NÃO** é executado e a casa **não** é resolvida.

**Turno de Prisão**

- **FR-016**: No início do turno de um jogador **preso**, antes de rolar, ele MUST poder escolher: (a) pagar multa **$50** (vai ao centro) e rolar normal; (b) usar carta **"Saia da Prisão"** e rolar normal; (c) tentar **dupla**.
- **FR-017**: Na tentativa por dupla: tirando dupla, o jogador **sai e move** o valor; sem dupla, **permanece preso** e a vez passa.
- **FR-018**: Na **3ª tentativa** sem dupla, o jogador MUST pagar obrigatoriamente **$50** e mover o valor da última rolagem.
- **FR-019**: Ao sair da prisão **com dupla**, **NÃO** há rolagem extra (exceção à regra geral de duplas — FR-013).
- **FR-020**: Enquanto preso, o jogador MUST poder receber aluguel, construir, hipotecar, propor e aceitar negociações.

**Finalização (sem timer)**

- **FR-021**: **NÃO** há timer de turno; o turno só termina quando o jogador ativo aciona **Finalizar Turno** (D-015), exceto quando o sistema encerra o movimento automaticamente (ida à prisão).
- **FR-022**: **Finalizar Turno** MUST ser permitido apenas após a rolagem obrigatória ter ocorrido, a casa resultante ter sido resolvida, e nenhuma pendência obrigatória estar aberta (ex.: descarte por limite de mão, pagamento de aluguel devido).

**Movimento com Speed Die (após a 1ª volta)**

- **FR-023**: Faces numéricas (**1, 2, 3**) do Speed Die MUST somar ao movimento dos dois dados brancos.
- **FR-024**: Face **Mr. Banco Master** MUST mover o jogador o normal e depois avançá-lo até a **próxima propriedade não comprada** (podendo comprá-la imediatamente); se todas estiverem compradas, avança até a próxima propriedade **não-hipotecada de adversário** e paga aluguel.
- **FR-025**: Face **Ônibus** MUST permitir ao jogador escolher mover o valor de **um** dos dois dados brancos individualmente, ou a **soma** dos dois. A escolha de movimento **NÃO** afeta a avaliação de dupla: brancos iguais permanecem dupla (re-roll e contagem para a prisão) mesmo que o jogador mova só um dado (FR-014).
- **FR-026**: **Triples** (os três dados iguais) MUST permitir ao jogador mover o token para **qualquer casa** do tabuleiro à sua escolha. Após o triple, o movimento do turno se **encerra**: **NÃO** há nova rolagem, mesmo que os dois dados brancos formem dupla (consistente com o triple já estar isento da contagem de duplas — FR-014/FR-015).
- **FR-027**: Para **Utilidades**, o valor do Speed Die MUST somar ao dos dois dados brancos no cálculo do aluguel (consistente com §4.4).

**Resiliência**

- **FR-028**: Se um jogador desconectar durante qualquer turno, a partida MUST **pausar** e o turno **não** avançar até a reconexão; o jogador ativo não perde a vez nem ativos (princípio VII / D-016). Detalhe na spec de Sessão & Resiliência.

### Key Entities

- **Turno**: a vez de um jogador. Atributos: jogador ativo, rolagem(ns) realizadas, contador de **duplas consecutivas**, e estado (`aguardando rolagem` → `casa a resolver` → `aguardando finalização` → `encerrado`).
- **Ordem de Turnos**: sequência cíclica de jogadores definida no início da partida (insumo da spec de Lobby); pula jogadores eliminados.
- **Rolagem**: resultado dos dados — dois brancos (+ Speed Die após a 1ª volta). Deriva: soma de movimento, flag de **dupla** (só brancos), e **face** do Speed Die.
- **Estado de Prisão** (por jogador): se está preso e o **nº de tentativas** de saída no ciclo atual (0–3).
- **Progresso de Volta** (por jogador): se já completou a **1ª volta** — gatilho de ativação do Speed Die.
- **Jogador Ativo**: o único habilitado a Rolar Dados e Finalizar Turno no momento.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Um turno normal completo (rolar → mover → resolver → finalizar) passa a vez ao **próximo jogador da ordem**, pulando eliminados — verificável numa partida de ≥3 jogadores.
- **SC-002**: Tirar dupla gera **exatamente uma** rolagem adicional por dupla; **3 duplas consecutivas** enviam à prisão no mesmo turno sem executar o 3º movimento.
- **SC-003**: A partir da 1ª volta completa de um jogador, **100%** das rolagens dele incluem o 3º dado (Speed Die); **antes** disso, nenhuma.
- **SC-004**: Um turno de prisão se resolve em **no máximo 3 tentativas** (saída por dupla / multa / carta), nunca deixando o jogador preso sem caminho de saída.
- **SC-005**: **Nenhum** turno avança por tempo — só encerra por ação do jogador ou por ida automática à prisão; verificável deixando um turno ocioso e confirmando que não passa sozinho.
- **SC-006**: Cruzar do índice 47 para o 0 concede o bônus de GO **exatamente uma vez** por passagem; ida à prisão por "Vá para a Prisão" / carta / 3 duplas **não** concede GO.
- **SC-007**: Desconexão durante um turno pausa a partida **sem** trocar o jogador ativo nem alterar ativos; ao reconectar, o **mesmo** turno prossegue.

## Assumptions

- **A ordem inicial e a rolagem de desempate são responsabilidade da spec de Lobby & Sala**; aqui a ordem de turnos é **insumo**. Esta feature começa quando a partida já tem ordem definida.
- **Ações facultativas podem ocorrer antes ou depois da rolagem**, em qualquer ordem, até a finalização; a única ação obrigatória do turno normal é a **rolagem + resolução da casa**.
- **Mr. Banco Master e Triples movem o token por dados** (não por carta) → passar pelo GO durante esses movimentos **concede** o bônus, consistente com §3.3.
- **"Dupla" é avaliada sempre pelos dois dados brancos** como rolados, independentemente da face do Speed Die ou da escolha na face Ônibus.
- **Detalhes internos de cada tipo de casa** (compra/leilão, aluguel, cartas, construção, hipoteca, negociação), o **desenho das faces/ativação do Speed Die**, a **fórmula do GO Progressivo** e a **acumulação do Free Parking** pertencem às suas próprias specs; esta spec apenas orquestra **quando** disparam no turno.
- **Eliminação por falência e seu efeito na ordem de turnos** são detalhados na spec de Falência; aqui assume-se que a ordem **pula** jogadores eliminados.
- Esta é uma feature de **discovery/design**: o trabalho para na spec; **não** avança para `/speckit-plan` ou `/speckit-implement` sem confirmação explícita do usuário.
