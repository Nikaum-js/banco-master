# Feature Specification: Painel "Minhas Cartas" e jogar cartas da mão (§12.4)

**Feature Branch**: `029-jogar-cartas-mao`

**Created**: 2026-05-24

**Status**: Draft

**Input**: User description: "Painel 'Minhas Cartas' e jogar cartas da mão pela UI — fecha o gap mais grave do M2: o motor de cartas de mão (015/016/017) está pronto e testado, mas o jogador não tem como ativar nenhuma carta de mão pela tela (só existe o contador X/3)."

## User Scenarios & Testing *(mandatory)*

Hoje o jogador **saca** cartas que vão para a mão (limite 3, privadas) e vê apenas um **contador "X/3"** — mas **não tem como jogá-las**. Toda a camada de cartas de mão (Aquisição Hostil, Despejo, Auditoria Fiscal, Boicote, Imunidade Temporária, Saia da Prisão) está implementada e testada no motor, porém **inalcançável pela interface**. Esta feature expõe a mão na tela (§12.4) e permite usar cada carta, escolhendo alvo quando a carta exige. É **camada de UI + seletores puros**: não muda nenhuma regra nem o estado do motor.

### User Story 1 - Ver a mão e usar cartas sem alvo (Priority: P1) 🎯 MVP

Como jogador, vejo um painel "Minhas Cartas" com cada carta que tenho na mão (cor de raridade, nome, efeito) e um contador "X / 3", e consigo **usar** as cartas cuja jogada não exige escolher um alvo, desde que o **timing** permita.

**Why this priority**: É o gap que bloqueia o M2 — sem isso, cartas de mão são inúteis. Sozinha já torna jogáveis Saia da Prisão e qualquer carta de mão sem alvo, e dá a base (lista + estado de "jogável") para a US2.

**Independent Test**: Colocar cartas na mão de um jogador e verificar que o painel as lista com nome/efeito/raridade e contador correto; que o botão "Usar" só fica habilitado quando o timing permite (ex.: Saia da Prisão habilita apenas quando preso); e que usar uma carta sem alvo a remove da mão e aplica o efeito.

**Acceptance Scenarios**:

1. **Given** tenho cartas na mão, **When** abro o painel "Minhas Cartas", **Then** vejo cada carta com a cor da raridade (laranja/azul/verde), nome, texto do efeito e o contador "X / 3".
2. **Given** uma carta cujo timing **não** se aplica agora (ex.: carta de próprio turno quando não é minha vez; Saia da Prisão quando não estou preso), **When** olho o botão "Usar", **Then** ele está **desabilitado** com um motivo explicativo (tooltip).
3. **Given** uma carta de **reação** (Diplomacia / Bunker Fiscal), **When** a vejo no painel, **Then** o "Usar" está desabilitado com o motivo "carta de reação — usada automaticamente quando aplicável".
4. **Given** estou preso e tenho "Saia da Prisão", **When** clico "Usar", **Then** a carta sai da mão, eu saio da prisão sem pagar e o contador diminui.

---

### User Story 2 - Usar cartas que exigem alvo (Priority: P2)

Como jogador, ao usar uma carta que precisa de alvo, escolho o alvo válido (propriedade ou jogador) e a jogada é aplicada; alvos inválidos não são oferecidos.

**Why this priority**: Completa a jogabilidade das cartas de mão mais impactantes (as Lendárias/Raras ofensivas e a Imunidade Temporária). Depende da lista e do "jogável" da US1.

**Independent Test**: Com cada carta de alvo na mão e um estado em que há alvos válidos e inválidos, verificar que apenas os alvos válidos são oferecidos e que escolher um alvo válido aplica o efeito (ou abre a reação de Diplomacia, quando o alvo a possui).

**Acceptance Scenarios**:

1. **Given** tenho **Aquisição Hostil**, **When** escolho usá-la, **Then** vejo apenas **propriedades de outros jogadores** elegíveis (sem construção, dono com ≥2 não-hipotecadas, com caixa suficiente); escolher uma aplica a aquisição.
2. **Given** tenho **Despejo**, **When** escolho usá-la, **Then** vejo apenas **propriedades de cidade de outros jogadores com ≥1 casa** (não hotel); escolher uma demole 1 casa.
3. **Given** tenho **Boicote**, **When** escolho usá-la, **Then** vejo **propriedades de outros jogadores**; escolher uma aplica o boicote por 2 voltas.
4. **Given** tenho **Auditoria Fiscal**, **When** escolho usá-la, **Then** escolho um **jogador adversário** (não eliminado); ele paga 10% do patrimônio ao pote.
5. **Given** tenho **Imunidade Temporária**, **When** escolho usá-la, **Then** escolho uma **propriedade minha**; ela fica protegida por 2 voltas.
6. **Given** o alvo escolhido de uma carta ofensiva possui **Diplomacia**, **When** confirmo a jogada, **Then** abre-se a reação (o alvo decide), exatamente como o motor já faz — a UI não precisa de tratamento especial.
7. **Given** uma carta de alvo **sem nenhum alvo válido** no momento, **When** olho o botão "Usar", **Then** ele está desabilitado com o motivo correspondente.

---

### Edge Cases

- **Carta de reação na mão**: listada, mas "Usar" desabilitado (dispara sozinha pelo prompt do HUD).
- **Não é minha vez / não estou preso**: "Usar" desabilitado para cartas de próprio-turno / de prisão, com motivo.
- **Carta de alvo sem alvos válidos**: "Usar" desabilitado (ex.: Despejo sem nenhuma casa adversária no tabuleiro).
- **Alvo com Diplomacia**: a jogada não falha — abre reação (comportamento já existente do motor).
- **Privacidade (§10.3 / princípio VI)**: o painel mostra só as cartas do **próprio** jogador; os demais continuam vendo apenas a quantidade.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A interface MUST exibir um painel "Minhas Cartas" listando cada carta na mão do jogador com cor de raridade (laranja/azul/verde), nome e texto do efeito, e um contador "X / 3".
- **FR-002**: O painel MUST mostrar um botão "Usar" por carta, **habilitado apenas** quando o timing da carta permite a jogada no momento; quando desabilitado, MUST exibir o motivo (tooltip).
- **FR-003**: Cartas de **reação** (Diplomacia, Bunker Fiscal) MUST aparecer no painel com "Usar" desabilitado e o motivo de que são usadas automaticamente pelo prompt de reação.
- **FR-004**: Usar uma carta **sem alvo** (quando habilitada) MUST acionar a jogada no motor, removendo-a da mão e atualizando o contador.
- **FR-005**: Para cartas que exigem **alvo**, a interface MUST permitir escolher um alvo entre os **válidos** e somente entre eles: Aquisição Hostil → propriedade elegível de outro jogador; Despejo → propriedade de cidade de outro com ≥1 casa; Boicote → propriedade de outro jogador; Auditoria Fiscal → jogador adversário; Imunidade Temporária → propriedade própria.
- **FR-006**: A jogada de carta com alvo MUST acionar o motor com o alvo escolhido; quando o alvo possui Diplomacia, o fluxo de reação já existente MUST ocorrer sem tratamento adicional da UI.
- **FR-007**: A lista de cartas da mão e o estado "jogável + motivo" de cada uma MUST ser deriváveis de forma **pura** do estado, para teste automatizado sem interface.
- **FR-008**: O conjunto de alvos válidos por carta MUST ser derivável de forma **pura** do estado, reusando os critérios de validade já existentes no motor.
- **FR-009**: O painel MUST exibir apenas as cartas do **próprio** jogador (privacidade §10.3); a quantidade dos demais continua visível como hoje.
- **FR-010**: A feature NÃO MUST alterar nenhuma regra nem o estado do motor (apenas consome comandos e seletores existentes).
- **FR-011**: Todo texto visível MUST estar em português (Brasil).

### Key Entities *(include if feature involves data)*

- **Carta de mão** (já existente, 006): id, baralho, raridade, efeito, modo (`mao`), timing (`proprio-turno` / `preso` / `reacao`). O painel apresenta cada carta da mão do jogador.
- **Visão de carta da mão** (novo, derivado): por carta — id, rótulo, descrição, cor de raridade, timing, `jogável` (booleano) e `motivo` (quando não jogável).
- **Alvos de carta** (novo, derivado): para uma carta de alvo — as posições de propriedade e/ou os jogadores que são alvos válidos no estado atual.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% das cartas de mão que o jogo entrega são **jogáveis pela interface** quando o timing permite (antes: 0%).
- **SC-002**: O botão "Usar" reflete corretamente o timing em 100% dos casos (habilita só quando a jogada é possível; mostra o motivo quando não).
- **SC-003**: Para cada carta de alvo, apenas alvos **válidos** são oferecidos (nenhum alvo inválido é selecionável).
- **SC-004**: Usar uma carta pela interface produz exatamente o mesmo resultado do comando do motor correspondente (sem divergência), e a suíte de cartas existente segue verde (nenhuma regressão).
- **SC-005**: A derivação da visão da mão e dos alvos é coberta por testes automatizados (jogável/não-jogável com motivo; alvos válidos por carta), sem necessidade de interface.

## Assumptions

- **Motor pronto e imutável**: os comandos (`playHandCard` com `target?`/`targetPlayer?`) e os critérios de validade (gates de aquisição/despejo/auditoria; dono/própria para imunidade; dono-de-outro para boicote) já existem; esta feature só os consome. A interceptação por Diplomacia (017) já é tratada pelo motor.
- **Reuso visual**: os rótulos, descrições e cores de raridade já existem nos mapas usados pelos modais (022) e são reaproveitados.
- **Parte testável**: a visão da mão (lista + jogável + motivo) e os alvos válidos por carta; a aparência do painel/seletor é validada no `bun run dev` (o projeto não tem testes de UI).
- **Privacidade (VI)**: o painel é do próprio jogador; sem revelar cartas alheias.

## Dependencies

- **006** (sistema de cartas / mão / timing), **015** (Boicote / Imunidade Temporária), **016** (Aquisição Hostil / Despejo / Auditoria Fiscal), **017** (reação Diplomacia / Bunker — prompt já no HUD), **022** (ModalLayer / activeModal + mapas de rótulo/descrição/cor), **020** (padrão de painéis ao vivo).

## Out of Scope *(deferido)*

- **Notificação "Aquisição Hostil sofrida"** para a vítima (§12.2): é per-cliente — só faz sentido com vários clientes; melhor no **M3**. Precisaria de um evento detectável por destinatário no motor.
- **Modal "Free Parking coletado"** (§12.2): precisaria de um **hook de evento** no motor (não há estado que sinalize "acabei de coletar o pote"); fica para uma fatia futura.
- Mudar qualquer regra do motor; testes de UI com RTL.
