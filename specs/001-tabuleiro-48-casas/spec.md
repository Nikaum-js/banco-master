# Feature Specification: Tabuleiro de 48 Casas

**Feature Branch**: `001-tabuleiro-48-casas`

**Created**: 2026-05-23

**Status**: aprovada (2026-05-23)

**Input**: User description: "Tabuleiro de 48 casas (expansão do tabuleiro clássico de 40 → 48, inspirado no Monopoly Mega Edition). Operacionaliza a estrutura definida no SRS §2 e na decisão D-017."

> **Escopo desta spec:** define a **estrutura e o layout** do tabuleiro de 48 casas — quantas casas, de que tipo, em que posição, regras de composição dos grupos, e os ajustes de economia que acompanham (dinheiro inicial, estoque de construção). **Não** enumera os preços/aluguéis concretos das 28 cidades nem desenha as cartas — isso é dado de tema, tratado a jusante (ver Assumptions). Fonte de verdade: [`docs/SRS.md`](../../docs/SRS.md) §2 e decisão [D-017](../../docs/DECISIONS.md#d-017--tabuleiro-de-48-casas).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Percorrer o tabuleiro expandido de 48 casas (Priority: P1)

Como jogador, eu percorro um tabuleiro de **48 casas** dispostas em quadrado, no sentido horário, passando pelos 4 cantos especiais nas posições corretas (GO no índice 0, Prisão no 12, Férias no 24, Vá-pra-Prisão no 36), com 11 casas entre cada par de cantos. Ao completar uma volta, retorno ao GO.

**Why this priority**: É a fundação. Sem o tabuleiro com a contagem e a geometria corretas, nenhuma outra regra (movimento, GO progressivo, Bus Ticket por lado, prisão) funciona. Entrega sozinha o valor central pedido: um tabuleiro maior que sustenta partidas mais longas e ricas para 7-8 jogadores.

**Independent Test**: Iniciar uma partida, mover o token uma volta completa e verificar que existem exatamente 48 casas, que os cantos estão nos índices 0/12/24/36, e que cruzar do índice 47 para o 0 conta como passagem pelo GO.

**Acceptance Scenarios**:

1. **Given** uma partida nova, **When** o tabuleiro é montado, **Then** há 48 casas indexadas de 0 a 47, percorridas no sentido horário.
2. **Given** um token na casa 47, **When** o jogador anda 1 casa, **Then** ele chega ao GO (índice 0) e recebe o bônus do GO Progressivo.
3. **Given** um token que tira um valor que ultrapassa um canto, **When** ele se move, **Then** ele para na casa correta contando 11 casas por lado entre cantos.
4. **Given** um jogador enviado à Prisão, **When** o efeito é aplicado, **Then** o token vai para o índice 12 e **não** recebe GO.

---

### User Story 2 - Disputar 28 propriedades de cidade em grupos de 3-4 (Priority: P2)

Como jogador numa partida de 7-8 pessoas, eu compro e disputo cidades distribuídas em 8 grupos de cor — os grupos **premium** (laranja, vermelho, amarelo, verde) com 4 propriedades, os demais (marrom, azul-claro, rosa, azul-escuro) com 3 — totalizando 28 cidades. Para construir num grupo preciso da maioria dele (3 de 4 nos premium, 2 de 3 nos demais).

**Why this priority**: É o coração do "mais graça para muitos jogadores". Mais propriedades dão carteira para todos (~5 compráveis por jogador num jogo de 7, contra ~4 antes), e grupos maiores tornam o monopólio mais difícil de fechar — sobretudo o do líder — segurando o *runaway leader* e forçando negociação.

**Independent Test**: Distribuir as propriedades entre 7 jogadores e verificar que cada um consegue montar uma carteira; tentar fechar um grupo premium e confirmar que exige 4 propriedades (3 para construir parcialmente).

**Acceptance Scenarios**:

1. **Given** o tabuleiro montado, **When** conto as propriedades de cidade, **Then** há 28, distribuídas 3/3/3/4/4/4/4/3 pelos 8 grupos.
2. **Given** um jogador com 3 das 4 cidades de um grupo premium, **When** tenta construir, **Then** é permitido (grupo parcial, aluguel reduzido conforme §13.3); com as 4, aluguel cheio.
3. **Given** um jogador com 2 das 3 cidades de um grupo não-premium, **When** tenta construir, **Then** é permitido como grupo parcial.
4. **Given** uma partida de 7 jogadores, **When** todos jogam a primeira volta, **Then** ainda há propriedades livres para comprar (o tabuleiro não satura instantaneamente).

---

### User Story 3 - Casas de variedade: 3ª utilidade e espaço Bus Ticket (Priority: P3)

Como jogador, encontro **3 utilidades** (aluguel escalando 4× / 10× / 20× o valor dos dados conforme quantas possuo) e um novo **espaço Bus Ticket**, onde, ao parar, recebo uma carta Bus Ticket (se ainda houver no baralho) que me permite pular para um canto do lado atual.

**Why this priority**: Quebra a monotonia de fileiras longas de propriedade e ativa o mecanismo de Bus Tickets que o jogo já define. É refinamento de ritmo, não fundação — por isso P3.

**Independent Test**: Parar numa utilidade possuindo 1, 2 e 3 utilidades e verificar o aluguel (4×/10×/20× dos dados); parar no espaço Bus Ticket e confirmar que recebo uma carta Bus Ticket no contador próprio (separado do limite de 3 cartas).

**Acceptance Scenarios**:

1. **Given** um jogador dono de 3 utilidades, **When** outro para numa delas, **Then** o aluguel é 20× o valor dos dados.
2. **Given** o baralho de Bus Tickets com cartas disponíveis, **When** um jogador para no espaço Bus Ticket, **Then** recebe 1 carta Bus Ticket no contador separado.
3. **Given** o baralho de Bus Tickets esgotado, **When** um jogador para no espaço Bus Ticket, **Then** nada acontece (sem carta) e o turno segue normalmente.

---

### Edge Cases

- **Cruzar o "fim" do tabuleiro:** mover do índice 47 de volta ao 0 conta como uma passagem pelo GO (recebe progressivo).
- **Baralho de Bus Ticket esgotado:** parar no espaço Bus Ticket não dá carta; sem erro, turno continua.
- **Escassez de construção:** com 28 propriedades e estoque de 40 casas / 16 hotéis, é possível esgotar casas — nesse caso vale o leilão de casas (§5.4). A escassez é alavanca estratégica intencional, não bug.
- **Bus Ticket vs. limite de mão:** Bus Tickets têm contador separado das 3 cartas (D-012); parar no espaço não conta contra o limite de cartas.
- **Movimento via Bus Ticket cruzando o GO:** recebe o bônus progressivo (consistente com §10.7).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O tabuleiro MUST ter exatamente **48 casas**, indexadas de 0 a 47, dispostas em quadrado e percorridas no sentido horário.
- **FR-002**: Os 4 cantos especiais MUST ocupar os índices **0 (GO), 12 (Prisão / Apenas Visitando), 24 (Férias / Free Parking) e 36 (Vá-pra-Prisão)**.
- **FR-003**: MUST haver **11 casas entre cada par de cantos consecutivos** (lados de 11 casas: 1–11, 13–23, 25–35, 37–47).
- **FR-004**: MUST haver **28 propriedades de cidade** divididas em 8 grupos de cor com os tamanhos: marrom 3, azul-claro 3, rosa 3, laranja 4, vermelho 4, amarelo 4, verde 4, azul-escuro 3.
- **FR-005**: A disposição das casas pelos índices MUST seguir a convenção do Richup.io estendida ao estilo Mega Edition (cantos nos múltiplos de 12, aeroportos um por lado, utilidades, cartas e impostos intercalados entre as cidades), preservando o "feel" do tabuleiro clássico.
- **FR-006**: MUST haver **4 aeroportos**, um em cada lado do tabuleiro, com aluguel escalando conforme a quantidade possuída ($25/$50/$100/$200).
- **FR-007**: MUST haver **3 utilidades**, com aluguel **4× / 10× / 20×** o valor dos dados conforme 1, 2 ou 3 possuídas.
- **FR-008**: MUST haver **3 cartas Surpresa, 3 cartas Tesouro e 2 impostos** como casas no tabuleiro.
- **FR-009**: MUST haver **1 espaço Bus Ticket**: ao parar, o jogador compra uma carta Bus Ticket se houver no baralho; é casa não-comprável (não vira propriedade, não pode ser hipotecada). O uso da carta segue §10.7.
- **FR-011**: Cada jogador MUST iniciar a partida com **$2.000**.
- **FR-012**: O estoque global de construção MUST ser **40 casas e 16 hotéis**, com leilão de casas em caso de escassez (§5.4).
- **FR-013**: A regra de monopólio parcial MUST respeitar o tamanho do grupo: grupos de 4 constroem com a maioria (3 de 4); grupos de 3 com a maioria (2 de 3) — conforme §13.3.
- **FR-014**: Os preços e aluguéis das 28 cidades MUST formar uma escada crescente e granular, do mais barato (~$60) ao mais caro (~$400), coerente com o ordenamento dos grupos.
- **FR-015**: Passar ou parar no GO MUST conceder o valor do GO Progressivo (§13.5); cruzar do índice 47 ao 0 conta como passagem.

### Key Entities

- **Casa (Square)**: posição (0–47), tipo (cidade, aeroporto, utilidade, surpresa, tesouro, imposto, bus-ticket, canto) e lado do tabuleiro. Unidade base do tabuleiro.
- **Propriedade de Cidade**: pertence a um grupo de cor; tem preço de compra, aluguel base (e tabela de aluguel por construção) e custo de construção.
- **Grupo de Cor**: cor, tamanho (3 ou 4 propriedades) e o limiar de monopólio parcial/completo derivado do tamanho.
- **Aeroporto**: aluguel escalonado pela quantidade possuída; aceita Hangar, não casas/hotéis.
- **Utilidade**: ordem de aluguel (4×/10×/20×) pela quantidade possuída; não recebe construção.
- **Espaço Bus Ticket**: casa-gatilho que entrega carta Bus Ticket ao parar; não-comprável.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: O tabuleiro montado tem **exatamente 48 casas** com cantos verificáveis nos índices 0/12/24/36 e 11 casas por lado.
- **SC-002**: O total de casas **compráveis** é **35** (28 cidades + 4 aeroportos + 3 utilidades) — o que dá ~5 propriedades por jogador numa partida de 7, contra ~4 no tabuleiro de 40.
- **SC-003**: Nenhum grupo **premium** pode ser monopolizado (aluguel cheio) com menos de **4** propriedades, e nenhum grupo regular com menos de **3** — verificável tentando construir/cobrar aluguel cheio com grupo incompleto.
- **SC-004**: Numa partida simulada de 8 jogadores, após a **primeira volta completa de todos**, ainda restam **propriedades livres para compra** (o tabuleiro não satura na 1ª volta).
- **SC-005**: A soma de tipos no tabuleiro fecha em 48: 28 + 4 + 3 + 3 + 3 + 2 + 1 + 4 = 48 (auditável contra a tabela do SRS §2.1).

## Assumptions

- **Preços/aluguéis concretos das 28 cidades são dado de tema, fora do escopo desta spec.** A escada de valores ($60–$400) e os nomes das cidades partem do Richup.io como base e são definidos no arquivo de tema antes do desenvolvimento de UI (SRS §2.3). Esta spec define a estrutura e as restrições, não os números individuais.
- **As regras de movimento, prisão, GO progressivo, Free Parking, construção, hipoteca, cartas, Bus Tickets, aeroportos e utilidades já estão definidas no SRS** e não são redefinidas aqui — esta feature apenas as ancora na nova geometria de 48 casas.
- **O layout em grade segue o padrão quadrado do Richup** (perímetro com cantos maiores). A geometria de renderização (grid 13×13) é detalhe de implementação a ser tratado no `/speckit-plan`.
- **Speed Die permanece padrão** no modo de 48 casas (ativado após a 1ª volta de cada jogador, §13.2) — essencial para conter a duração da partida no tabuleiro maior.
- **Dinheiro inicial ($2.000) e estoque de construção (40/16) são tunáveis** após playtesting; os valores aqui são o ponto de partida balanceado (D-017).
- Esta é uma feature de **discovery/design**: o trabalho para na spec; não avança para `/speckit-plan` ou `/speckit-implement` sem confirmação explícita do usuário.
