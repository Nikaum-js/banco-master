# Feature Specification: Modais centrais (M2) — interações dirigidas por resolução

**Feature Branch**: `022-modais-centrais`

**Created**: 2026-05-24

**Status**: Draft

**Input**: User description: "Modais centrais (M2) — interações dirigidas por resolução. Hoje as interações que dependem de `game.resolution` (compra/recusa, leilão, descarte por mão cheia, e o Atalho ±3) vivem na barra inferior do HUD; esta feature as apresenta como modais centrais sobre o tabuleiro. Puramente UI."

## User Scenarios & Testing *(mandatory)*

Hoje, quando o jogo precisa de uma decisão do jogador (comprar uma propriedade, dar um lance, descartar uma carta, escolher a direção do Atalho), a pergunta aparece **espremida na barra inferior do HUD**, longe do tabuleiro e do contexto da casa. Esta feature traz essas decisões para o **centro da tela**, como um cartão modal sobreposto ao miolo do tabuleiro — onde o olhar do jogador já está. O motor de regras não muda: os modais apenas **leem** o estado de resolução pendente e **disparam os comandos já existentes**.

### User Story 1 - Decidir a compra de uma propriedade livre (Priority: P1) 🎯 MVP

Ao parar numa propriedade sem dono, o jogador vê um cartão central com a propriedade (nome, cor do grupo, preço e tabela de aluguéis) e decide comprar ou recusar (mandando ao leilão).

**Why this priority**: É a decisão mais frequente do jogo e a porta de entrada da economia. Sozinha já entrega o valor central da feature (decisão no centro, com contexto visual da propriedade) e é totalmente testável.

**Independent Test**: Colocar o jogador parado numa propriedade livre (resolução de compra pendente) e verificar que o modal central aparece com os dados corretos; "Comprar" debita e dá o título; "Recusar" abre o leilão. Sem tocar em nenhuma outra interação.

**Acceptance Scenarios**:

1. **Given** o jogador parou numa propriedade livre e há uma compra pendente, **When** a tela renderiza, **Then** um modal central exibe o nome, a cor do grupo, o preço e os aluguéis daquela propriedade, com as ações "Comprar" e "Recusar → leilão".
2. **Given** o modal de compra está aberto, **When** o jogador escolhe "Comprar" e tem caixa suficiente, **Then** o modal fecha, o preço é debitado, o título passa ao jogador e o turno segue para a finalização.
3. **Given** o modal de compra está aberto, **When** o jogador escolhe "Recusar", **Then** o modal de compra fecha e o modal de leilão daquela propriedade abre.
4. **Given** uma compra está pendente, **When** o modal central está visível, **Then** a barra do HUD **não** repete os botões de comprar/recusar.

---

### User Story 2 - Disputar um leilão (Priority: P2)

Quando uma propriedade vai a leilão (recusa de compra, escassez de casas, ou falência), o jogador vê um cartão central com o item em disputa, o lance atual e o maior licitante, e pode dar lance ou passar antes do cronômetro fechar.

**Why this priority**: Decorre diretamente da recusa de compra (US1) e fecha o ciclo de aquisição. Depende do mesmo padrão de modal, mas acrescenta o cronômetro e o leilão de casas.

**Independent Test**: Abrir um leilão (de propriedade e de casas) e verificar que o modal mostra item/lance/licitante; dar lance incrementa o lance corrente; passar remove o jogador; o leilão fecha sozinho pelo prazo.

**Acceptance Scenarios**:

1. **Given** um leilão de propriedade está em andamento, **When** a tela renderiza, **Then** o modal central exibe a propriedade em disputa, o lance atual e o maior licitante, e indica que fecha sozinho em ~10s.
2. **Given** o modal de leilão está aberto, **When** o jogador dá um lance acima do atual, **Then** o lance corrente e o maior licitante são atualizados.
3. **Given** o modal de leilão de propriedade está aberto, **When** o jogador escolhe "Passar", **Then** ele deixa de participar daquele leilão.
4. **Given** um leilão de **casas** (escassez) está em andamento, **When** a tela renderiza, **Then** o modal mostra a quantidade de casas em disputa e o lance/licitante (sem a opção "Passar", conforme as regras desse leilão).
5. **Given** ninguém age, **When** o prazo do leilão expira, **Then** o leilão fecha sozinho e o modal desaparece.

---

### User Story 3 - Resolver decisões de carta (descarte e Atalho) (Priority: P3)

Quando o jogador saca a 4ª carta (mão cheia) ou tira a carta "Atalho", a decisão aparece no centro: escolher qual carta descartar, ou escolher a direção (±3 casas).

**Why this priority**: Menos frequente que compra/leilão, mas é a única forma de resolver esses dois estados que bloqueiam o turno. Mantém a privacidade das cartas (princípio VI): só o próprio jogador vê a própria mão.

**Independent Test**: Forçar uma mão cheia (descarte pendente) e verificar que o modal mostra as cartas do próprio jogador e que escolher uma a descarta; forçar o Atalho pendente e verificar as opções "Frente"/"Trás".

**Acceptance Scenarios**:

1. **Given** o jogador sacou a 4ª carta e há um descarte pendente, **When** a tela renderiza, **Then** o modal central exibe as cartas da mão do próprio jogador (cor de raridade, nome e efeito) e pede que ele escolha 1 para descartar.
2. **Given** o modal de descarte está aberto, **When** o jogador escolhe uma carta, **Then** ela é descartada, a mão volta ao limite e o modal fecha.
3. **Given** o Atalho está pendente, **When** a tela renderiza, **Then** o modal central oferece "Frente" e "Trás".
4. **Given** o modal de Atalho está aberto, **When** o jogador escolhe uma direção, **Then** o movimento ±3 é aplicado e o modal fecha.
5. **Given** o descarte está pendente, **When** o modal está visível, **Then** as cartas exibidas são apenas as do jogador da vez — nenhuma carta de adversário é revelada.

---

### Edge Cases

- **Sem resolução pendente**: quando não há nenhum estado de resolução dirigido por modal, nenhum modal central é exibido (a tela mostra o tabuleiro normalmente).
- **Apenas um modal por vez**: o motor mantém no máximo uma resolução pendente; portanto, no máximo um modal central está visível por vez. A passagem de um para outro (ex.: recusar compra → abrir leilão) é uma troca de modal, nunca dois sobrepostos.
- **Estados não cobertos por esta fatia** (prisão, dívida/falência, reação Diplomacia/Bunker, empréstimo, fim de jogo, Bus Ticket): continuam sendo resolvidos pela barra do HUD; o modal central não aparece para eles.
- **Leilão sem lance**: o modal mostra "lance $0 / sem licitante" e ainda assim fecha pelo prazo.
- **Recusa em propriedade que não pode ir a leilão**: não se aplica — toda recusa de compra abre leilão (regra existente).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A interface MUST exibir um **modal central** sobreposto ao miolo do tabuleiro sempre que houver uma resolução pendente entre os tipos cobertos por esta fatia: compra de propriedade, leilão de propriedade, leilão de casas, descarte por mão cheia e escolha do Atalho.
- **FR-002**: A interface MUST exibir, no modal de **compra**, o nome da propriedade, a cor do grupo, o preço e a tabela de aluguéis, reaproveitando o vocabulário visual já usado para mostrar propriedades/aeroportos/utilidades.
- **FR-003**: O modal de compra MUST oferecer "Comprar" (que efetua a compra existente) e "Recusar → leilão" (que abre o leilão existente).
- **FR-004**: A interface MUST exibir, no modal de **leilão**, o item em disputa (propriedade ou quantidade de casas), o lance atual e o maior licitante, e indicar que o leilão fecha sozinho pelo prazo.
- **FR-005**: O modal de leilão MUST permitir dar um lance acima do atual (incremento padrão de +$50, com a opção de informar um valor) e, **apenas no leilão de propriedade**, "Passar".
- **FR-006**: A interface MUST exibir, no modal de **descarte**, as cartas da mão do **próprio jogador da vez** (cor de raridade, nome, efeito) e permitir escolher exatamente 1 para descartar; nenhuma carta de outro jogador pode ser revelada (princípio VI).
- **FR-007**: A interface MUST exibir, no modal de **Atalho**, as opções "Frente" e "Trás" e aplicar o movimento correspondente ao escolher.
- **FR-008**: Cada ação dos modais MUST disparar exclusivamente os comandos de jogo já existentes (comprar, recusar, dar lance, passar, descartar, escolher Atalho); a feature **não** altera nenhuma regra do motor.
- **FR-009**: Enquanto um modal central desta fatia estiver visível, a barra do HUD MUST **não** duplicar as mesmas ações daquele estado.
- **FR-010**: Quando **não** houver resolução pendente coberta por esta fatia, a interface MUST não exibir nenhum modal central.
- **FR-011**: A decisão de "qual modal mostrar e com quais dados" MUST ser derivável de forma **pura** a partir do estado do jogo (uma função determinística do estado), para permitir teste automatizado sem renderizar a interface.
- **FR-012**: Todo texto visível ao usuário MUST estar em português (Brasil).

### Key Entities *(include if feature involves data)*

- **Descritor de modal ativo**: representação derivada do estado do jogo que diz **qual** modal exibir (compra, leilão de propriedade, leilão de casas, descarte ou Atalho) e **quais dados** ele precisa (ex.: propriedade-alvo; lance atual e licitante; cartas da mão do jogador da vez). É somente-leitura — não guarda estado próprio. Quando não há resolução coberta, o descritor é "nenhum".
- **Resolução pendente** (já existente no motor): o estado bloqueante do turno que origina o modal. Esta feature apenas o **consome**; não cria nem modifica seus tipos.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Em 100% dos casos em que o motor abre uma resolução de compra, leilão (propriedade ou casas), descarte ou Atalho, o modal central correspondente é exibido com os dados daquele estado.
- **SC-002**: A partir de cada modal, o jogador consegue concluir a decisão (comprar/recusar, dar lance/passar, descartar, escolher direção) e o resultado no jogo é idêntico ao que a barra do HUD produzia antes — sem nenhuma mudança de regra.
- **SC-003**: Em nenhum momento o modal de descarte exibe cartas de um jogador que não seja o da vez (privacidade preservada em 100% dos casos).
- **SC-004**: Quando não há resolução coberta pendente, nenhum modal central aparece (0 falsos positivos).
- **SC-005**: A função que decide o modal ativo é coberta por testes automatizados para cada um dos cinco estados e para o caso "nenhum", todos verdes.

## Assumptions

- **Reaproveitamento visual**: os modais reutilizam o vocabulário visual já existente para propriedades/aeroportos/utilidades e para as cartas; nenhuma nova identidade visual é introduzida. O acabamento visual fino será validado manualmente em execução local (o projeto não possui testes de renderização de interface).
- **Parte testável**: por não haver biblioteca de teste de componentes no projeto, a garantia automatizada recai sobre a função pura que mapeia estado → descritor de modal (mesmo padrão do seletor de jogadores do 020); o render é validado visualmente.
- **HUD permanece**: a barra do HUD continua dirigindo o turno (rolar, finalizar, prisão, dívida/falência, reação, empréstimo, Bus Ticket); esta fatia move para o centro apenas os cinco estados listados.
- **Carta sacada (revelação/anúncio)**: o modal de revelação de carta de efeito imediato ou que vai para a mão **não** faz parte desta fatia — exigiria o motor pausar num novo estado de resolução. Fica diferido (o anúncio público já é parcialmente coberto pelo Histórico, feature 021).
- **Construção/hipoteca/negociação iniciadas pelo jogador**: fora de escopo (modelo de interação diferente — iniciado pelo jogador, não por resolução); fatia própria no futuro.
- **Campo de valor no lance**: o incremento +$50 é o caminho principal; permitir digitar um valor de lance é desejável mas opcional para o MVP.
- **Dependências**: opera sobre os estados de resolução já entregues por 002 (FSM/`resolution`), 003 (compra/leilão/leilão de casas) e 006 (descarte/Atalho); segue o padrão de UI de 020 e 021. Não depende de multiplayer (M3).
