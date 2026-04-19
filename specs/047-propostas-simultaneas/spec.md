# Feature Specification: Propostas de negociação simultâneas

**Feature Branch**: `[047-propostas-simultaneas]`

**Created**: 2026-07-28

**Status**: Aprovada

**Depende de**: specs 013, 024, 027, 037, 038 e 043; D-048

**Input**: Exibir no painel apenas quem enviou e quem recebeu cada proposta, abrir o conteúdo somente por “Ver proposta”, melhorar o aproveitamento de espaço e permitir que qualquer jogador crie novas propostas enquanto outras continuam ativas.

## User Scenarios & Testing

### User Story 1 - Manter várias propostas ativas (Priority: P1)

Um jogador envia outra proposta mesmo quando já existem negociações em andamento, sem substituir nem bloquear as anteriores.

**Why this priority**: É a regra que corrige o botão sem efeito e permite negociações paralelas em uma partida com até oito participantes.

**Independent Test**: Enviar duas propostas do mesmo jogador e uma de outro, confirmar que as três persistem com identidades distintas e podem ser respondidas separadamente.

**Acceptance Scenarios**:

1. **Given** uma proposta ativa, **When** qualquer jogador elegível abre o compositor e envia outra proposta válida, **Then** as duas permanecem ativas.
2. **Given** duas propostas entre o mesmo par de jogadores, **When** o destinatário aceita uma, **Then** somente a escolhida é executada e removida.
3. **Given** uma proposta cujos ativos mudaram depois do envio, **When** o destinatário tenta aceitá-la, **Then** nenhuma transferência ocorre e as outras propostas permanecem intactas.

---

### User Story 2 - Percorrer propostas sem poluir o painel (Priority: P1)

Todos veem uma lista compacta que identifica proponente e destinatário, sem prévia de dinheiro, propriedades ou imunidades.

**Why this priority**: Uma proposta pode conter muitos itens; repetir esse conteúdo no painel torna a mesa ilegível e cria rolagem excessiva.

**Independent Test**: Renderizar propostas com composições pequenas e grandes e verificar que cada linha mantém a mesma estrutura e altura, mostrando somente a rota e a ação de abrir.

**Acceptance Scenarios**:

1. **Given** qualquer proposta ativa, **When** o painel de negociações é exibido, **Then** a linha mostra o nome e a identidade visual de quem enviou, a direção e o nome e a identidade de quem recebeu.
2. **Given** uma proposta com várias propriedades, dinheiro, Bus Tickets e imunidades, **When** ela aparece no painel, **Then** nenhum desses itens é antecipado na lista.
3. **Given** várias propostas ativas, **When** elas excedem a altura reservada, **Then** apenas a região da lista rola e a ação de criar proposta continua visível.

---

### User Story 3 - Abrir e responder a proposta escolhida (Priority: P1)

Qualquer participante pode abrir os detalhes de uma proposta; somente seu destinatário pode aceitar ou recusar.

**Why this priority**: O detalhe sob demanda preserva contexto sem esconder as negociações públicas nem duplicar decisões de autoridade.

**Independent Test**: Abrir propostas diferentes pelo painel, conferir que o modal acompanha o id escolhido e que apenas o destinatário recebe controles de resposta.

**Acceptance Scenarios**:

1. **Given** duas propostas ativas, **When** o jogador aciona “Ver proposta” na segunda, **Then** o modal apresenta somente a composição da segunda.
2. **Given** um observador que não é o destinatário, **When** ele abre a proposta, **Then** pode ver os detalhes, mas não aceitar nem recusar.
3. **Given** o destinatário conectado, **When** ele aceita ou recusa a proposta aberta, **Then** a ação carrega a identidade daquela proposta e o modal fecha após a remoção.
4. **Given** qualquer quantidade de propostas ativas, **When** um jogador aciona “Nova negociação”, **Then** o compositor abre sem depender do estado das demais.

### Edge Cases

- Duas ou mais propostas têm exatamente o mesmo proponente e destinatário.
- A proposta aberta é aceita ou recusada por outro cliente antes da ação local.
- O proponente ou destinatário é eliminado enquanto propostas envolvendo esse jogador estão ativas.
- Um snapshot legado contém somente `pendingTrade`.
- O destinatário abre uma proposta que se tornou inválida por mudança de caixa, posse ou item.
- O painel contém propostas suficientes para exigir rolagem interna.

## Requirements

### Functional Requirements

- **FR-001**: O estado MUST persistir uma coleção de Propostas de negociação identificadas.
- **FR-002**: Um jogador MUST poder criar uma proposta válida independentemente da existência e autoria de outras propostas ativas.
- **FR-003**: Propostas entre o mesmo par de jogadores MUST coexistir sem substituição implícita.
- **FR-004**: Criar uma proposta MUST NOT reservar dinheiro, propriedades, Bus Tickets ou imunidades.
- **FR-005**: Aceitar ou recusar MUST identificar a proposta alvo e remover somente ela.
- **FR-006**: O motor MUST revalidar a composição da proposta no momento da aceitação e MUST NOT processar uma proposta obsoleta.
- **FR-007**: Somente o destinatário MUST poder aceitar ou recusar a proposta identificada.
- **FR-008**: Propostas envolvendo jogador eliminado MUST ser removidas durante a eliminação.
- **FR-009**: Snapshot legado com `pendingTrade` MUST ser normalizado para uma coleção identificada sem perder a proposta.
- **FR-010**: O painel público MUST mostrar por proposta somente proponente, direção, destinatário e uma ação de abertura.
- **FR-011**: O painel MUST NOT antecipar itens, valores ou resumos da composição.
- **FR-012**: A região de propostas MUST ter altura limitada e rolagem própria quando necessário.
- **FR-013**: “Nova negociação” MUST permanecer acionável enquanto outras propostas estiverem ativas, sujeito apenas aos gates gerais de conexão, pausa e eliminação.
- **FR-014**: “Ver proposta” MUST abrir os detalhes da proposta correspondente pelo seu identificador.
- **FR-015**: Participantes que não são o destinatário MUST poder inspecionar os detalhes sem receber controles de resposta.
- **FR-016**: O turno ativo e o indicador global de quem deve agir MUST NOT ser bloqueados por propostas de negociação.

### Key Entities

- **Proposta de negociação**: Envelope persistente e identificado que contém uma troca e aguarda decisão do destinatário.
- **Troca**: Composição de ativos e valores entre proponente e destinatário, executada somente após validação.
- **Lista de propostas**: Projeção pública e compacta das rotas ativas, sem composição antecipada.
- **Proposta selecionada**: Identidade de tela usada para abrir uma proposta específica sem torná-la globalmente ativa.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Três propostas consecutivas podem ser criadas sem responder às anteriores, e as três permanecem disponíveis.
- **SC-002**: Aceitar ou recusar uma proposta altera exatamente um item da coleção ativa.
- **SC-003**: A altura de uma linha no painel independe de a proposta conter 1 ou mais de 5 itens.
- **SC-004**: Em uma lista com oito propostas, o CTA de nova negociação permanece visível sem rolar o painel inteiro.
- **SC-005**: 100% dos comandos de aceitar e recusar são autorizados contra o destinatário da proposta identificada.
- **SC-006**: Snapshot legado com proposta pendente carrega sem perda e continua respondível.

## Assumptions

- As propostas continuam públicas para todos os participantes da sala, como já ocorre no painel atual.
- Não existe reserva de ativos; conflitos são resolvidos por revalidação na aceitação.
- Propostas não bloqueiam o turno e não substituem o fluxo de resolução do motor.
- O histórico continua registrando somente trocas aceitas.
