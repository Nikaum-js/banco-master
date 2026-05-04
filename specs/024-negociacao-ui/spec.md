# Feature Specification: Negociação entre jogadores na UI (M2)

**Feature Branch**: `024-negociacao-ui`

**Created**: 2026-05-24

**Status**: Draft

**Input**: User description: "Negociação na UI — propor/aceitar/recusar trocas (propriedades + dinheiro + imunidades). Proposta pendente no GameState; modal compositor e modal recebido. Motor de troca atômico já existe (013)."

## User Scenarios & Testing *(mandatory)*

Negociar propriedades é uma mecânica central do jogo, mas hoje **não há como fazê-lo pela tela** — a troca só existe como uma operação interna "já acordada". Esta feature traz o ciclo completo de negociação: um jogador **monta uma proposta** (o que oferece e o que pede, em propriedades, dinheiro e imunidades de aluguel), **envia** ao destinatário, e o destinatário **aceita** (a troca é processada) ou **recusa** (a proposta é descartada). A negociação pode acontecer a qualquer momento, inclusive fora do turno. As regras de troca (o que é negociável, taxas, validade) já vivem no motor — esta feature acrescenta a camada de proposta pendente e os modais.

### User Story 1 - Montar e enviar uma proposta (Priority: P1) 🎯 MVP

Como jogador, abro a negociação, escolho com quem negociar, monto a oferta (minhas propriedades + dinheiro a dar) e o pedido (propriedades do outro + dinheiro a receber), e envio quando a proposta é válida.

**Why this priority**: É a porta de entrada da negociação; sem montar e enviar, nada acontece. Entrega o núcleo (compositor + envio) e é testável pela validação da proposta.

**Independent Test**: Abrir o compositor, escolher um destinatário, marcar propriedades/dinheiro dos dois lados e verificar que "Propor" só habilita com proposta válida e que, ao enviar, ela fica registrada como pendente para o destinatário.

**Acceptance Scenarios**:

1. **Given** quero negociar, **When** abro a negociação, **Then** escolho um destinatário entre os demais jogadores não-eliminados e vejo as propriedades de cada lado disponíveis para troca (apenas propriedades **sem construção**; cartas e Bus Tickets **não** aparecem).
2. **Given** montei uma proposta válida (propriedades pertencem a quem as oferece, sem construção, e ambos têm caixa para o dinheiro/taxas), **When** confiro, **Then** "Propor" está habilitado.
3. **Given** a proposta é inválida (ex.: peço propriedade que o outro não tem, ou um lado não tem caixa), **When** confiro, **Then** "Propor" fica desabilitado.
4. **Given** uma proposta válida, **When** envio, **Then** ela fica **pendente** registrada para o destinatário (sem ainda mover nada) e o compositor fecha.

---

### User Story 2 - Receber e responder uma proposta (Priority: P1) 🎯 MVP

Como destinatário de uma proposta, vejo claramente o que está sendo oferecido e pedido e decido aceitar (a troca acontece) ou recusar (a proposta some).

**Why this priority**: Fecha o ciclo — sem resposta, a proposta não vira nada. Junto da US1 forma o MVP utilizável.

**Independent Test**: Com uma proposta pendente, verificar que o modal recebido lista oferta/pedido; "Aceitar" processa a troca (propriedades e dinheiro mudam de mãos) e limpa a pendência; "Recusar" só limpa.

**Acceptance Scenarios**:

1. **Given** há uma proposta pendente para mim, **When** a tela atualiza, **Then** vejo um modal listando o que recebo (propriedades + dinheiro + imunidades) e o que dou.
2. **Given** o modal recebido está aberto, **When** aceito e a proposta ainda é válida, **Then** as propriedades e o dinheiro são transferidos conforme a proposta (incluindo taxa de 10% de propriedade hipotecada) e a pendência é limpa.
3. **Given** o modal recebido está aberto, **When** recuso, **Then** a proposta é descartada sem mover nada, e o proponente pode fazer uma nova oferta.
4. **Given** aceitei, **When** a troca conclui, **Then** os painéis e o tabuleiro refletem os novos donos/saldos imediatamente.

---

### User Story 3 - Negociar imunidades de aluguel (Priority: P2)

Como jogador, posso incluir na proposta a concessão de **imunidade de aluguel** sobre uma propriedade que eu **mantenho** (não estou cedendo), por um número de voltas ou permanente, em qualquer dos sentidos.

**Why this priority**: Enriquece a negociação (§8.4) e o motor já suporta, mas é menos frequente que propriedades+dinheiro. Depende do mesmo compositor.

**Independent Test**: No compositor, conceder uma imunidade sobre propriedade própria mantida por N voltas; verificar que a proposta é válida e que, ao aceitar, a imunidade passa a valer para o beneficiário.

**Acceptance Scenarios**:

1. **Given** mantenho uma propriedade (não a estou oferecendo), **When** adiciono uma imunidade sobre ela por N voltas (ou permanente), **Then** a proposta a inclui e permanece válida.
2. **Given** tento conceder imunidade sobre uma propriedade que **estou cedendo** ou que **não é minha**, **When** monto, **Then** a proposta fica inválida ("Propor" desabilitado).
3. **Given** uma proposta com imunidade foi aceita, **When** a troca processa, **Then** o beneficiário fica imune ao aluguel daquela propriedade pelas voltas acordadas.

---

### Edge Cases

- **Sem proposta pendente**: nenhum modal recebido é exibido.
- **Uma proposta por vez**: enquanto há uma pendente, não se cria outra (o compositor fica indisponível ou avisa) — sem fila no MVP.
- **Proposta inválida no aceite**: se o estado mudou entre propor e aceitar (ex.: o proponente vendeu/hipotecou algo, ou ficou sem caixa) e a proposta deixou de ser válida, **aceitar não processa** (no-op seguro) — a proposta pode ser recusada/refeita.
- **Destinatário eliminado / proponente eliminado**: a proposta pendente é descartada (não há troca com jogador fora do jogo).
- **Negociar fora do turno**: permitido; o ciclo não depende de quem é o jogador da vez.
- **Nada de cada lado**: uma proposta totalmente vazia (nada oferecido nem pedido) não é enviável.
- **Não-negociáveis**: cartas em mão, Bus Tickets, empréstimos e construções nunca entram na proposta.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST permitir que um jogador abra um compositor de negociação e selecione um destinatário entre os demais jogadores não-eliminados.
- **FR-002**: O compositor MUST permitir montar a proposta nos dois sentidos: propriedades (apenas **sem construção**) a oferecer/pedir, dinheiro (≥ 0) a dar/receber, e imunidades de aluguel a conceder/solicitar (US3).
- **FR-003**: O compositor MUST **nunca** oferecer cartas em mão, Bus Tickets, empréstimos ou construções como itens negociáveis (princípio VI / D-011 / D-012 / §8.2).
- **FR-004**: O sistema MUST validar a proposta (propriedades pertencem a quem as oferece e sem construção; ambos os lados com caixa para o dinheiro + taxa de 10% de hipoteca; imunidades sobre propriedade própria mantida, por N voltas > 0 ou permanente) e habilitar "Propor" **apenas** quando válida e não-vazia.
- **FR-005**: Ao enviar, o sistema MUST registrar a proposta como **pendente** (sem mover nada) destinada ao destinatário, e exibir um modal recebido para esse destinatário.
- **FR-006**: O modal recebido MUST listar com clareza o que o destinatário **recebe** e o que **dá** (propriedades, dinheiro, imunidades), e oferecer "Aceitar" e "Recusar".
- **FR-007**: "Aceitar" MUST processar a troca conforme a proposta (transferindo propriedades e dinheiro, aplicando taxas e imunidades) e limpar a pendência; se a proposta tiver deixado de ser válida, **não** processa (no-op) e mantém/permite recusar.
- **FR-008**: "Recusar" MUST descartar a proposta pendente sem alterar nada; depois disso, é possível montar uma nova proposta.
- **FR-009**: O sistema MUST manter **no máximo uma** proposta pendente por vez (sem fila no MVP).
- **FR-010**: A negociação MUST poder ocorrer a qualquer momento, **independente de quem é o jogador da vez**, e a proposta pendente **não** bloqueia o turno ativo.
- **FR-011**: A proposta pendente MUST fazer parte do estado persistível do jogo (para sobreviver a recarga/reconexão — princípio VII), não de estado efêmero de tela.
- **FR-012**: Após uma troca aceita, painéis e tabuleiro MUST refletir os novos donos e saldos imediatamente.
- **FR-013**: A validação da proposta MUST ser derivável de forma **pura** a partir do estado e da proposta, para teste automatizado sem renderizar a interface.
- **FR-014**: Todo texto visível MUST estar em português (Brasil).

### Key Entities *(include if feature involves data)*

- **Proposta de troca (pendente)**: quem propõe, quem recebe, e a composição nos dois sentidos — propriedades oferecidas/pedidas, dinheiro a dar/receber, imunidades concedidas/solicitadas (propriedade + voltas ou permanente). É o **mesmo formato** do acordo que o motor já processa; aqui ela existe como item **pendente** no estado do jogo até ser aceita ou recusada. No máximo uma por vez.
- **Imunidade de aluguel** (já existente): direito de não pagar aluguel numa propriedade por N voltas ou permanente; pode ser concedida na troca sobre propriedade própria mantida (§8.4).
- **Título / saldo** (já existentes): a troca transfere donos de propriedades e ajusta saldos; esta feature os consome via o processamento de troca existente.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Um jogador consegue montar e enviar uma proposta de propriedades + dinheiro em menos de 1 minuto, e o destinatário consegue aceitar/recusar em 1 clique.
- **SC-002**: Em 100% dos casos, "Propor" só habilita para propostas válidas e não-vazias; e aceitar uma proposta produz exatamente a mesma transferência que o processamento de troca do motor (incluindo taxas de hipoteca e imunidades).
- **SC-003**: Recusar nunca altera o estado (0 transferências); aceitar uma proposta que deixou de ser válida nunca altera o estado (no-op seguro).
- **SC-004**: Em nenhum momento cartas, Bus Tickets, empréstimos ou construções aparecem como itens negociáveis (0 vazamentos).
- **SC-005**: A proposta pendente sobrevive a uma recarga do estado (continua exibível com os mesmos termos).
- **SC-006**: A validação pura da proposta e as transições propor/aceitar/recusar são cobertas por testes automatizados (válida/ inválida por dono, construção, caixa, imunidade; aceitar aplica; recusar descarta; refactor de extração não quebra os testes de troca existentes).

## Assumptions

- **Reúso do motor de troca**: a transferência (propriedades, dinheiro, taxa de 10% de hipoteca, imunidades) é a operação de troca já existente (013); esta feature só acrescenta a camada de **proposta pendente** (propor/aceitar/recusar) e a valida com um predicado **extraído** da validação que já existe dentro dessa operação (refactor sem mudança de comportamento — os testes de troca existentes devem continuar verdes).
- **Estado persistível**: a proposta pendente vive no estado do jogo (serializável), pensando no multiplayer; o conteúdo que o jogador monta no compositor antes de enviar é estado de tela.
- **Acesso**: um ponto de entrada "Negociar" abre o compositor com seleção de destinatário (SRS §8.3). O acabamento visual segue o fluxo do Richup.io e é validado em execução local (sem testes de renderização de UI no projeto).
- **Parte testável**: validação pura da proposta + transições dos comandos propor/aceitar/recusar; o render dos modais é conferido manualmente no `bun run dev`.
- **Fora de escopo**: contraproposta automática (recusar apenas descarta; o proponente refaz — §8.3.5); timer de proposta; fila de múltiplas propostas; painel "Trades ao vivo" (pode vir depois consumindo a proposta/histórico).
- **Dependências**: 013 (processamento de troca + formato + imunidades §8.4), 014 (imunidades), 020 (estado na UI).
