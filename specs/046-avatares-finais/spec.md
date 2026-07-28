# Feature Specification: Avatares finais

**Feature Branch**: `[046-avatares-finais]`

**Created**: 2026-07-28

**Status**: Aprovada

**Depende de**: specs 037, 038, 043 e 044; D-047

**Input**: Remover a Forma Líquida, desacelerar as animações dos cinco avatares aprovados, restaurar as oito skins anteriores como escolha independente compatível com todas as formas e tornar a combinação feita no menu a identidade visual persistente do jogador durante toda a partida.

## User Scenarios & Testing

### User Story 1 - Escolher o avatar final (Priority: P1)

Antes de entrar ou criar uma sala, o jogador vê as cinco formas finais e as oito skins, escolhendo um item de cada catálogo junto do nome e da cor.

**Why this priority**: A escolha só tem valor se for explícita e fizer parte do mesmo compromisso de identidade enviado ao ocupar o assento.

**Independent Test**: Abrir o formulário de identidade, escolher cada uma das cinco formas e cada uma das oito skins e confirmar que os dois estados selecionados e o preview composto correspondem às opções acionadas.

**Acceptance Scenarios**:

1. **Given** o formulário de identidade aberto, **When** o jogador escolhe um dos cinco avatares, **Then** a opção recebe estado selecionado e o preview grande mostra a mesma forma.
2. **Given** qualquer avatar selecionado, **When** o jogador escolhe uma das oito skins, **Then** o preview preserva o avatar e aplica a skin escolhida.
3. **Given** uma escolha de avatar, skin, nome e cor válidos, **When** o jogador confirma a entrada, **Then** o assento é criado com a combinação escolhida.
4. **Given** o catálogo final, **When** o jogador percorre todas as opções, **Then** Forma Líquida não aparece.

---

### User Story 2 - Reconhecer o avatar durante a partida (Priority: P1)

Depois de entrar, o jogador reencontra a forma e a skin escolhidas no token do tabuleiro e nas superfícies que representam sua identidade e a dos demais participantes.

**Why this priority**: Esta continuidade diferencia o avatar final da peça removida pela D-044, que era escolhida no lobby e desaparecia no jogo.

**Independent Test**: Criar uma sala com jogadores usando avatares distintos, iniciar a partida e verificar o mesmo avatar no lobby, token do tabuleiro, painel de jogadores e contexto de turno.

**Acceptance Scenarios**:

1. **Given** um assento com avatar e skin escolhidos, **When** a partida começa, **Then** o token móvel usa a mesma combinação e a mesma cor do assento.
2. **Given** uma superfície que mostra a identidade de um jogador, **When** ela renderiza o `PlayerFace`, **Then** usa o avatar e a skin do assento correspondente.
3. **Given** dois jogadores que escolheram o mesmo avatar, **When** ambos entram, **Then** a entrada é aceita e suas cores únicas continuam distinguindo os assentos.

---

### User Story 3 - Ver movimento discreto e legível (Priority: P2)

Os avatares mantêm personalidade por olhos, boca e pequenos movimentos, mas passam a maior parte do tempo em repouso e não parecem acelerados.

**Why this priority**: O catálogo foi aprovado visualmente, mas a repetição rápida tornou a presença artificial e distrativa.

**Independent Test**: Observar cada avatar por ao menos 20 segundos em tamanho de lobby e de token, medindo a frequência dos gestos e verificando a leitura do rosto.

**Acceptance Scenarios**:

1. **Given** movimento normal habilitado, **When** um avatar fica ocioso, **Then** seus gestos expressivos têm ciclos de pelo menos 7 segundos e repouso perceptível entre repetições.
2. **Given** preferência por movimento reduzido, **When** qualquer avatar é exibido, **Then** a identidade permanece legível sem animação contínua.
3. **Given** um token compartilhando uma casa com outros jogadores, **When** seu tamanho diminui, **Then** a silhueta, os olhos e a cor continuam identificáveis.

---

### User Story 4 - Preservar a escolha na reconexão (Priority: P2)

Ao recarregar a página ou reentrar em outro dispositivo, o jogador mantém o avatar e a skin originalmente vinculados ao assento.

**Why this priority**: O avatar pertence ao assento e deve respeitar a mesma resiliência de sessão de nome e cor.

**Independent Test**: Entrar com um avatar não clássico, persistir a sala, simular reload e reentrada por código e confirmar que a forma não muda.

**Acceptance Scenarios**:

1. **Given** uma sala persistida com avatar e skin, **When** o jogador reconecta, **Then** o assento conserva os identificadores originais.
2. **Given** uma sala legada sem avatar ou skin, **When** ela é carregada, **Then** o jogador usa Clássico Vivo + Careca sem erro ou migração manual.
3. **Given** um valor de avatar ou skin desconhecido recebido de estado antigo ou inválido, **When** a identidade é projetada, **Then** a interface usa o fallback correspondente.

### Edge Cases

- Dois ou mais jogadores escolhem o mesmo avatar, mas cores distintas.
- Uma sala persistida antes da D-047 não contém o campo de avatar.
- Um pedido de entrada contém um identificador fora do catálogo fechado.
- Um jogador eliminado usa a expressão de indisponibilidade sem perder sua silhueta escolhida.
- Vários tokens dividem a mesma casa e são reduzidos até o menor tamanho suportado.
- `prefers-reduced-motion` muda entre carregamentos.

## Requirements

### Functional Requirements

- **FR-001**: O catálogo final MUST conter exatamente Clássico Vivo, Olhos Orbitais, Linha Única, Prisma e Totem.
- **FR-002**: Forma Líquida MUST ser removida do catálogo e de toda escolha disponível.
- **FR-003**: O formulário de identidade MUST permitir escolher diretamente qualquer avatar final e MUST comunicar programaticamente qual opção está selecionada.
- **FR-003a**: O formulário MUST oferecer separadamente Careca, Cavanhaque, Topete, Cartola, Safári, Aviador, Robô e Astronauta e MUST comunicar programaticamente qual skin está selecionada.
- **FR-003b**: Cada uma das oito skins MUST ser renderizável sobre cada um dos cinco avatares, totalizando quarenta combinações válidas.
- **FR-004**: O preview grande MUST ser renderizado pela mesma composição visual usada durante a partida.
- **FR-005**: A confirmação de entrada MUST vincular o avatar e a skin selecionados ao assento.
- **FR-006**: Avatar e skin do assento MUST ser públicos, persistidos e preservados por reload, reassunção de autoridade e reentrada.
- **FR-007**: A escolha de avatar MUST aceitar repetição entre jogadores e MUST NOT criar nova razão de recusa de entrada.
- **FR-008**: A cor MUST continuar obrigatória, única e aplicada a qualquer avatar escolhido.
- **FR-009**: Sala ou valor legado sem avatar ou skin reconhecidos MUST usar respectivamente Clássico Vivo ou Careca.
- **FR-010**: Tokens, lobby e superfícies de identidade da partida MUST renderizar o avatar e a skin do assento correspondente.
- **FR-011**: Cada animação idle MUST ter ciclo total de pelo menos 7 segundos e MUST reservar a maior parte desse ciclo para repouso ou movimento quase imperceptível.
- **FR-012**: Animações MUST respeitar `prefers-reduced-motion` e manter olhos, boca, cor e silhueta legíveis no estado estático.
- **FR-013**: Cada avatar MUST permanecer reconhecível entre 16px e 72px, inclusive quando múltiplos tokens dividem uma casa.
- **FR-014**: A escolha MUST ser operável por teclado e toque, com alvo mínimo de 44×44px e rótulo acessível.

### Key Entities

- **Avatar**: Forma visual pública de um `PlayerFace`, identificada por um dos cinco valores do catálogo fechado.
- **Skin**: Camada visual pública aplicada a qualquer Avatar, identificada por um dos oito valores do catálogo fechado.
- **Assento**: Identidade persistente de um participante; agrega nome, cor única, avatar e skin não exclusivos.
- **Identidade de exibição**: Projeção de um assento usada pelas superfícies visuais; inclui nome, cor, avatar e skin com fallback legado.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Qualquer um dos cinco avatares pode ser selecionado diretamente com uma única ação no catálogo.
- **SC-001a**: As quarenta combinações de avatar e skin renderizam sem erro e podem ser formadas com duas escolhas diretas.
- **SC-002**: Em uma partida de 2 a 8 jogadores, 100% dos tokens e superfícies de identidade verificadas mostram a composição vinculada ao assento correto.
- **SC-003**: Reload e reentrada preservam avatar e skin em 100% dos cenários automatizados de sessão.
- **SC-004**: Nenhum gesto expressivo completo se repete em menos de 7 segundos durante idle.
- **SC-005**: Os cinco avatares permanecem distinguíveis em inspeção visual a 16px, 24px, 32px e 72px.
- **SC-006**: O caminho de escolha permanece utilizável a partir de 375px de largura, sem rolagem horizontal.

## Assumptions

- A mensagem do usuário “coloca todos eles como opção pra escolher no menu como final do jogo” aprova o catálogo de cinco e a persistência da escolha no jogo.
- Avatar e Skin não são novas peças e não têm unicidade; a cor continua sendo a distinção competitiva obrigatória.
- Clássico Vivo é a seleção inicial e o fallback de compatibilidade.
- Não há troca de avatar ou skin depois que o assento é ocupado; reentrada restaura a combinação persistida.
