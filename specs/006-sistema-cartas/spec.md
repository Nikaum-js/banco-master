# Feature Specification: Sistema de Cartas

**Feature Branch**: `006-sistema-cartas`

**Created**: 2026-05-23

**Status**: Draft

**Input**: User description: "Sistema de Cartas — 2 decks (Acaso/Tesouro), raridades, mão (limite 3, privada), saque, descarte, timing, contador de Bus Ticket, e framework de efeitos (autocontidos implementados; ofensivas/reação/temporários deferidos)."

**Depende de**: [`001`](../001-tabuleiro-48-casas/spec.md) (casas acaso/tesouro) · [`002`](../002-fluxo-de-turno/spec.md) (porta `drawCard`, movimento, prisão) · [`003`](../003-compra-aluguel/spec.md) (caixa, compra/desconto) · [`004`](../004-construcao/spec.md) (construção, p/ Conserto) · [`005`](../005-hipoteca/spec.md) (deshipoteca, p/ Refinanciamento)

> **Escopo desta spec:** o **sistema** de cartas — 2 decks (**Acaso**, antes "Surpresa", [D-018](../../docs/DECISIONS.md#d-018--termo-canônico-acaso-antes-surpresa); e **Tesouro**), 16 cartas cada em 3 raridades; **sacar** ao parar na casa (preenche a porta `drawCard` que o 002 deixou stub); cartas **imediatas** aplicam e voltam ao fundo, cartas de **mão** vão para a mão (limite 3, privada, não-negociável, descarte forçado na 4ª); **janelas de timing** (próprio turno / reação / preso); **contador de Bus Ticket** separado; e um **framework de despacho de efeitos** (registry carta→handler, catálogo é dado). Implementa **agora** os efeitos **autocontidos** (caixa, movimento, Saia da Prisão, Investidor Anjo, Refinanciamento, Passagem de Ônibus). **Defere** (como handlers stub) os efeitos que exigem **subsistemas novos**: ofensivas com alvo/transferência (Aquisição Hostil, Despejo, Auditoria Fiscal), reação (Diplomacia, Bunker Fiscal) e modificadores temporários de N voltas (Boicote, Imunidade, Apagão, Greve). Também **propaga o D-018** (rename "Surpresa"→"Acaso" no SRS §2.1/§4.6/§10/§13.4 e `docs/CARTAS.md`). **Não** cobre: **uso** do Bus Ticket (spec Bus Tickets), negociação, e os efeitos deferidos. Fonte de verdade: [`docs/SRS.md`](../../docs/SRS.md) §10.

## Clarifications

### Session 2026-05-23

- Q: Como calcular o patrimônio líquido (Crise Imobiliária e futuras Auditoria/GO Progressivo)? → A: Caixa + soma dos preços das propriedades + custos das construções, com propriedade **hipotecada contando pela metade** do preço (padrão Monopoly).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sacar carta ao parar em Acaso/Tesouro (Priority: P1)

Como jogador, ao parar numa casa **Acaso** ou **Tesouro**, eu saco a carta do topo do deck correspondente. Se for de **efeito imediato**, o efeito é aplicado na hora e a carta volta ao fundo do deck. Se for **carta de mão**, ela vai para a minha mão. O deck nunca esgota.

**Why this priority**: É o que dá vida às casas de carta (hoje stub no 002) — o gatilho central do sistema. MVP.

**Independent Test**: parar numa casa Acaso/Tesouro e verificar que uma carta é sacada; uma imediata aplica seu efeito e volta ao fundo; uma de mão entra na mão; o deck continua tendo próxima carta.

**Acceptance Scenarios**:

1. **Given** o deck Acaso embaralhado, **When** o jogador para numa casa Acaso, **Then** a carta do topo é sacada.
2. **Given** uma carta de **efeito imediato**, **When** é sacada, **Then** o efeito é aplicado e a carta volta ao **fundo** do deck.
3. **Given** uma carta de **mão**, **When** é sacada, **Then** vai para a **mão** do jogador (não aplica efeito ainda).
4. **Given** muitos saques, **When** um deck "acaba", **Then** ele **nunca esgota** (sempre há próxima carta — cartas usadas voltam ao fundo).

---

### User Story 2 - Gerir a mão (limite 3, privacidade, descarte) (Priority: P2)

Como jogador, guardo até **3 cartas** na mão (somando os dois decks). Minhas cartas são **privadas** — os outros veem só a **quantidade**. Se eu sacar uma 4ª carta de mão, sou forçado a **descartar** uma das 4 (vai ao fundo do deck). Cartas em mão **não** são negociáveis. Bus Tickets têm contador **separado** (não contam no limite).

**Why this priority**: A mão é a alavanca estratégica (privacidade + limite). Depende de já existir saque de cartas de mão (US1).

**Independent Test**: encher a mão com 3 cartas, sacar a 4ª e confirmar o descarte forçado; conferir que outro jogador só vê a quantidade; confirmar que Bus Tickets não entram no limite.

**Acceptance Scenarios**:

1. **Given** mão com 3 cartas, **When** o jogador saca uma 4ª de mão, **Then** é forçado a escolher 1 das 4 para descartar (vai ao fundo).
2. **Given** a mão de um jogador, **When** outro jogador a observa, **Then** vê apenas a **quantidade** (não o conteúdo).
3. **Given** o contador de Bus Ticket, **When** o jogador tem 3 cartas + 2 Bus Tickets, **Then** os Bus Tickets **não** contam no limite de 3.

---

### User Story 3 - Jogar carta de mão na janela correta (Priority: P3)

Como jogador, jogo uma carta de mão respeitando sua **janela de timing**: 🎯 **próprio turno** (antes de finalizar), 🔒 **preso** (só preso — ex.: "Saia da Prisão"), ⚡ **reação** (resposta a uma ação contra mim). A carta jogada aplica o efeito e volta ao fundo do deck.

**Why this priority**: É o uso ativo das cartas de mão. "Saia da Prisão" integra com o turno de prisão (002). As cartas de **reação** ficam deferidas (subsistema futuro), mas a janela faz parte do framework.

**Independent Test**: jogar uma carta de "próprio turno" durante o turno e fora dele (confirmar bloqueio fora da janela); usar "Saia da Prisão" preso e confirmar a saída via 002.

**Acceptance Scenarios**:

1. **Given** uma carta de janela "próprio turno" na mão, **When** o jogador a joga no seu turno antes de finalizar, **Then** o efeito aplica e a carta volta ao fundo.
2. **Given** a mesma carta, **When** o jogador tenta jogá-la fora do seu turno, **Then** é bloqueado (no-op).
3. **Given** "Saia da Prisão" na mão e o jogador preso, **When** ele a usa, **Then** sai da prisão (integra com a opção do turno de prisão do 002) e a carta volta ao fundo.

---

### Edge Cases

- **Carta cujo estado não se aplica** (Conserto sem construções, Refinanciamento sem hipoteca): efeito nulo, mas a carta **volta ao fundo** (§10.6 nota).
- **Movimento por carta cruzando o GO:** "Volta para o GO" **recebe** bônus; "Vá direto para a Prisão" e ir **para trás** (Volte 3 / Atalho ré) cruzando o GO **não** recebem (§10.6).
- **Carta de mão sacada com mão cheia:** descarte forçado (a recém-sacada também é candidata ao descarte).
- **Carta deferida sacada** (ofensiva/reação/temporária): **no-op seguro** (sem efeito) e volta ao fundo — não quebra o jogo até o subsistema existir.
- **Bus Ticket:** o **uso** não é desta spec (Bus Tickets); aqui só o **contador** e a concessão pela carta.
- **Reação fora do próprio turno:** a janela de reação existe no framework, mas as cartas de reação estão deferidas — nenhuma reação é jogável ainda.

## Requirements *(mandatory)*

### Functional Requirements

**Decks e saque**

- **FR-001**: MUST haver **2 decks** — `acaso` e `tesouro` — com **16 cartas** cada, **embaralhados** no início; um deck **nunca esgota** (carta imediata/usada volta ao **fundo**).
- **FR-002**: Parar numa casa `acaso`/`tesouro` MUST sacar a carta do **topo** do deck correspondente — preenchendo a porta `drawCard` do 002.
- **FR-003**: Carta de **efeito imediato** MUST aplicar o efeito na hora e voltar ao fundo; carta de **mão** MUST ir para a mão (sem aplicar efeito no saque).

**Raridade**

- **FR-004**: Cada carta MUST ter uma **raridade** (lendária/laranja, rara/azul, comum/verde) e um **modo** (imediato ou mão) conforme o catálogo (§10.4-10.5).

**Mão**

- **FR-005**: A mão MUST ter **limite 3** (somando os dois decks); sacar uma 4ª carta de mão MUST forçar o jogador a **descartar 1 das 4** (vai ao fundo do deck) (D-011).
- **FR-006**: Cartas em mão MUST ser **privadas** — os demais jogadores veem apenas a **quantidade**.
- **FR-007**: Cartas em mão MUST ser **não-negociáveis**.
- **FR-008**: **Bus Tickets** MUST ter contador **separado** (não contam no limite 3); a carta **Passagem de Ônibus** concede **+1** (o **uso** do ticket é da spec Bus Tickets).

**Timing**

- **FR-009**: Cartas de mão MUST só poder ser jogadas na sua **janela**: 🎯 próprio turno (antes de finalizar), 🔒 preso, ⚡ reação; fora da janela → no-op.
- **FR-010**: **Saia da Prisão** (mão, preso) MUST integrar com o turno de prisão do 002 (equivale à opção "carta").

**Framework de efeitos**

- **FR-011**: Cada carta MUST ter um **handler de efeito** (registry carta→handler); o catálogo é **dado**. Carta cujo estado não se aplica produz **efeito nulo** mas **volta ao fundo** (§10.6 nota).
- **FR-012**: Os efeitos **autocontidos** MUST ser implementados nesta feature — caixa (Boom Econômico, Erro do banco, Aniversário, Honorários, Crise Imobiliária, Conserto de Imóveis), movimento (Volta para o GO, Vá direto para a Prisão, Avance 3, Volte 3, Atalho — via 002), Saia da Prisão (via 002), Investidor Anjo (desconto de 20% na próxima compra — 003), Refinanciamento (deshipoteca a 5% — 005), Passagem de Ônibus (+1 Bus Ticket).
- **FR-013**: Os efeitos **deferidos** (ofensivas com alvo/transferência: Aquisição Hostil, Despejo, Auditoria Fiscal; reação: Diplomacia, Bunker Fiscal; temporários de N voltas: Boicote, Imunidade, Apagão, Greve) MUST entrar como **handlers stub** no catálogo (no-op seguro + volta ao fundo), a implementar num **subsistema de reação/efeitos-temporários** posterior.

**Movimento e integração**

- **FR-014**: Movimento por carta MUST usar o movimento do 002: "Volta para o GO" concede bônus; "Vá direto para a Prisão" vai à prisão **sem** GO; ir **para trás** (Volte 3 / Atalho ré) cruzando o GO **não** concede bônus; a casa de destino é resolvida normalmente (despacho do 002).
- **FR-015**: Efeitos que dependem de outras specs MUST chamá-las: Investidor Anjo marca desconto para a próxima **compra** (003); Refinanciamento usa a **deshipoteca** (005) a 5%; Conserto lê **construções** (004).

**Propagação de terminologia (D-018)**

- **FR-016**: Esta feature MUST propagar o D-018: renomear "Surpresa" → "Acaso" no SRS §2.1/§4.6/§10/§13.4 e em `docs/CARTAS.md` (apenas docs; o `SquareKind` já é `acaso`).

### Key Entities

- **Deck**: pilha ordenada de cartas (`acaso` ou `tesouro`); saca do topo, devolve ao fundo; nunca esgota.
- **Carta**: id, deck, **raridade**, **modo** (imediato/mão), **timing** (se mão), e **handler** de efeito (catálogo).
- **Mão do Jogador**: até **3** cartas, privada, não-negociável.
- **Contador de Bus Ticket** (por jogador): separado da mão; concedido pela carta Passagem de Ônibus.
- **Catálogo de Efeitos**: tabela carta → (raridade, modo, timing, handler, **status**: implementado | deferido).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Parar em Acaso/Tesouro saca a carta do topo; imediata aplica e volta ao fundo; mão vai para a mão.
- **SC-002**: A mão **nunca** passa de 3; a 4ª carta de mão força descarte.
- **SC-003**: Outro jogador vê apenas a **quantidade** da mão (privacidade); Bus Tickets não contam no limite.
- **SC-004**: Cada efeito **autocontido** do catálogo produz o resultado correto (caixa/movimento/desconto/etc.) — verificável por carta.
- **SC-005**: Sacar uma carta **deferida** não quebra o jogo (no-op seguro) e ela volta ao fundo.
- **SC-006**: Um deck **nunca esgota** mesmo após muitos saques.
- **SC-007**: "Saia da Prisão" na mão sai da prisão via a integração com o 002.

## Assumptions

- **Patrimônio líquido** (Crise Imobiliária 5%; e futuras Auditoria/GO Progressivo): definido na clarificação — **caixa + preços das propriedades + custos das construções**, propriedade **hipotecada pela metade** do preço.
- **Conteúdo dos decks e valores** (cópias, $200, $50, 20%, 5%, etc.) seguem o catálogo do SRS §10.4-10.6 — são **dado**; esta spec define o **sistema** e o framework.
- **Cartas de reação** ficam deferidas com seu subsistema; a **janela** de reação existe no framework mas nenhuma reação é jogável ainda.
- **Uso do Bus Ticket** é da spec Bus Tickets; aqui só o contador + a concessão.
- **Efeitos deferidos** (ofensivas/reação/temporários) são **no-op seguro** até o subsistema de reação/efeitos-temporários ser especificado.
- **D-018** é propagação **docs-only** (o código já usa `acaso`).
- Feature de **discovery + implementação** na sequência do 005; segue o pipeline SDD com confirmação antes de `/speckit-plan` e `/speckit-implement`.
