# Feature Specification: Painel Trades ao vivo (M2)

**Feature Branch**: `027-trades-ao-vivo`

**Created**: 2026-05-24

**Status**: Draft

**Input**: User description: "Substituir o MOCK do painel Trades por dados reais: proposta pendente (024) como ativo + histórico de trocas aceitas (novo `tradeHistory` + log no acceptTrade)."

## User Scenarios & Testing *(mandatory)*

O painel lateral "Trades" mostra hoje propostas de exemplo (mock) — não reflete o que está acontecendo no jogo. Com a negociação real já funcionando (propor/aceitar/recusar, 024), este painel passa a mostrar a **proposta pendente atual** e um **histórico das trocas que foram aceitas**, dando ao jogador uma visão viva das negociações da partida. As trocas aceitas também passam a aparecer no log de eventos. A regra de troca não muda — apenas registramos o que foi aceito e exibimos.

### User Story 1 - Ver a negociação atual e o histórico (Priority: P1) 🎯 MVP

Como jogador, abro o painel "Trades" e vejo se há uma proposta pendente (de quem, para quem, e um resumo do que está em jogo) e a lista das trocas já concluídas.

**Why this priority**: É a feature inteira — tornar o painel real. Sem ela, o painel é decorativo. Testável pela camada que deriva o que mostrar.

**Independent Test**: Com uma proposta pendente, verificar que o painel a lista como "ativa" (de→para + resumo) e o contador mostra 1 ativo; ao aceitar, verificar que ela some dos ativos e entra no histórico (e aparece no log de eventos).

**Acceptance Scenarios**:

1. **Given** não há proposta pendente nem trocas aceitas, **When** abro o painel Trades, **Then** vejo "Nenhuma proposta no momento" e o contador "0 ativos".
2. **Given** há uma proposta pendente, **When** abro o painel, **Then** vejo uma linha **ativa** com proponente → destinatário e um resumo (nº de propriedades e dinheiro oferecidos/pedidos, e nº de imunidades), e o contador "1 ativo".
3. **Given** uma proposta pendente foi **aceita**, **When** a troca conclui, **Then** ela deixa de ser ativa, entra no **histórico** de trocas (linha concluída) e aparece uma entrada no **log de eventos**.
4. **Given** uma proposta pendente foi **recusada**, **When** observo o painel, **Then** ela some dos ativos e **não** entra no histórico (só aceitas são registradas).
5. **Given** o painel Trades, **When** clico "+ Nova proposta", **Then** abre o compositor de negociação (mesmo do 024).

---

### Edge Cases

- **Sem trocas**: estado vazio com mensagem; contador 0.
- **Histórico longo**: o histórico é limitado às trocas aceitas mais recentes (as antigas saem).
- **Resumo, não detalhe**: o painel mostra um resumo (contagens + dinheiro); o detalhe completo da proposta pendente está no modal de negociação (024).
- **Privacidade**: a negociação envolve só propriedades/dinheiro/imunidades (públicos); nenhuma carta é exibida (não são negociáveis).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O painel "Trades" MUST exibir a **proposta pendente** atual (se houver) como item ativo, com proponente → destinatário e um **resumo** do que é oferecido e pedido (nº de propriedades, dinheiro, nº de imunidades em cada sentido).
- **FR-002**: O painel MUST exibir um **histórico** das trocas **aceitas** recentes (linhas concluídas), das mais recentes para as mais antigas.
- **FR-003**: O contador de "ativos" MUST refletir a existência (0 ou 1) de proposta pendente.
- **FR-004**: Ao **aceitar** uma proposta, o sistema MUST registrá-la no histórico de trocas e emitir uma entrada no **log de eventos** identificando os dois jogadores; ao **recusar**, MUST **não** registrar (só aceitas entram).
- **FR-005**: O histórico de trocas MUST ser **limitado** a um número recente (descarta as mais antigas) e fazer parte do estado persistível do jogo (princípio VII).
- **FR-006**: O botão "+ Nova proposta" MUST abrir o compositor de negociação existente.
- **FR-007**: A regra de processamento de troca MUST permanecer **inalterada** (apenas se acrescenta o registro/anúncio).
- **FR-008**: O conteúdo do painel MUST ser derivável de forma **pura** a partir do estado (proposta pendente + histórico), para teste automatizado sem renderizar a interface.
- **FR-009**: O painel MUST deixar de usar dados de exemplo (mock) — passa a refletir apenas o estado real.
- **FR-010**: Todo texto visível MUST estar em português (Brasil).

### Key Entities *(include if feature involves data)*

- **Histórico de trocas**: lista das trocas **aceitas** recentes (limitada), parte do estado do jogo. Cada item é uma troca já processada (quem, para quem, o que mudou de mãos). Só aceitas; recusadas não entram.
- **Proposta pendente** (já existente, 024): a oferta atual aguardando resposta; o painel a mostra como item ativo (resumo). Detalhe completo no modal de negociação.
- **Log de eventos** (já existente, 021): ganha uma linha por troca aceita.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Em 100% dos casos, o painel reflete exatamente o estado: 1 ativo quando há proposta pendente, 0 quando não há; e o histórico contém exatamente as trocas aceitas (na ordem mais-recente-primeiro).
- **SC-002**: Aceitar uma proposta a remove dos ativos, adiciona ao histórico e gera 1 entrada no log; recusar a remove sem adicionar ao histórico nem ao log.
- **SC-003**: Nenhum dado de exemplo (mock) aparece no painel (0 itens fictícios).
- **SC-004**: A regra de troca produz exatamente o mesmo resultado de antes (transferências idênticas) — só o registro é novo.
- **SC-005**: A derivação do conteúdo do painel e o registro no aceitar são cobertos por testes automatizados.

## Assumptions

- **Reúso da negociação (024)**: a proposta pendente, o processamento e o compositor já existem; esta feature acrescenta o registro das aceitas + a visão do painel.
- **Resumo no painel**: contagens + dinheiro (não item a item); o detalhe está no modal. Mantém o painel enxuto.
- **Parte testável**: um seletor puro do conteúdo do painel (pendente + histórico) e o registro no aceitar; o render é validado no `bun run dev` (sem testes de UI no projeto).
- **Limite do histórico**: mantém as trocas aceitas mais recentes (ex.: ~12); as antigas saem (estado serializável, mas não cresce sem limite).
- **Fora de escopo**: histórico de recusadas; persistência entre sessões além do estado do jogo; detalhe item-a-item no painel.
- **Dependências**: 024 (proposta/processamento/compositor), 021 (log), 020 (estado na UI).
