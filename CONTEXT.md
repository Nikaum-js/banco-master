# Banco Master

Clone web multiplayer do Richup.io (Monopoly online), até 8 jogadores humanos, sem IA. Tema inicial: "Cidades do Mundo".

Este é o glossário do **domínio de negócio** — os termos que o SRS usa para escrever regra. A regra em si vive em [`docs/SRS.md`](./docs/SRS.md), que é a fonte de verdade absoluta; aqui só ficam os nomes. Decisões que criaram ou mudaram um termo estão em [`docs/adr/`](./docs/adr/README.md).

## Language

### Tabuleiro e movimento

**GO**:
Casa de índice 0. Passar por ela credita $200; parar exatamente nela credita $400 ([D-007](./docs/adr/D-007-go-progressivo.md)).
_Avoid_: Início, Partida, Start

**Free Parking**:
Casa de índice 24, que acumula impostos e multas como prêmio para quem parar nela.
_Avoid_: Férias, Estacionamento Livre

**Dupla**:
Mesmos valores nos dois dados brancos.
_Avoid_: Duplo, Double

**Speed Die**:
Terceiro dado especial ativado após a 1ª volta, com faces 1/2/3, Mr. Banco Master e Ônibus. Atualmente suspenso por flag ([D-003](./docs/adr/D-003-speed-die-apos-1a-volta.md)).
_Avoid_: Dado de velocidade, terceiro dado

**Mr. Banco Master**:
Face do Speed Die que envia o jogador à próxima propriedade disponível.

**Bus Ticket**:
Item de mão que permite mover para qualquer casa do lado atual do tabuleiro. Tem contador próprio, separado do limite de cartas ([D-012](./docs/adr/D-012-bus-tickets-como-item-separado.md)), e é negociável ([D-028](./docs/adr/D-028-bus-tickets-negociaveis.md)).
_Avoid_: Passagem, ticket de ônibus

**Turno ativo**:
O turno do jogador que deve agir no momento.

### Propriedades e construção

**Grupo completo**:
Um jogador possui todas as propriedades de um grupo de cor.
_Avoid_: Monopólio, set completo

**Hipoteca**:
Propriedade dada como garantia ao banco em troca de metade do valor.

**Hotel**:
Construção que substitui 4 casas. Até 2 hotéis por propriedade, sendo o 2º mais caro em aluguel que o 1º ([D-008](./docs/adr/D-008-segundo-hotel-por-propriedade.md)).

**Skyscraper**:
Construção acima do 2º hotel. Exige grupo completo.
_Avoid_: Arranha-céu (no código), torre

**Hangar**:
Melhoria de aeroporto que dobra o aluguel daquele aeroporto.

**Leilão**:
Disputa de lances por uma propriedade. Dispara por recusa de compra ou pelo pregão de escassez de terrenos ([D-023](./docs/adr/D-023-leilao-de-escassez-de-terrenos-pregao-simultaneo.md)).

### Cartas

**Acaso**:
Deck de cartas de efeito ofensivo/caótico — o "Chance" clássico. Termo canônico ([D-018](./docs/adr/D-018-termo-canonico-acaso-antes-surpresa.md)).
_Avoid_: Surpresa, Chance

**Tesouro**:
Deck de cartas de efeito defensivo/benigno — o "Community Chest" clássico. Difere do Acaso em tema, não em magnitude ([D-014](./docs/adr/D-014-tesouro-precisa-impactar.md)).
_Avoid_: Baú, Cofre, Community Chest

**Carta Lendária**:
Carta de alto impacto (laranja), que geralmente vai para a mão.

**Carta Rara**:
Carta de impacto médio (azul), que pode ir para a mão ou ter efeito imediato grande.

**Carta Comum**:
Carta de baixo impacto (verde), geralmente de efeito imediato.

**Carta em mão**:
Carta retida pelo jogador após o saque. Privada, não-negociável, limite de 3 somando os dois decks ([D-011](./docs/adr/D-011-cartas-em-mao-privadas-e-nao-negociaveis.md)).

**Carta de reação**:
Carta jogável fora do próprio turno, em resposta a um evento — Diplomacia, Bunker Fiscal.

**Aquisição Hostil**:
Carta Lendária que força transferência de propriedade pelo preço original.

**Diplomacia**:
Carta Lendária de reação que cancela uma carta ofensiva contra você.

### Economia entre jogadores

**Empréstimo**:
Transferência de dinheiro entre jogadores, com juros de 10–50% cobrados a cada passagem do devedor pelo GO ([D-009](./docs/adr/D-009-emprestimos-entre-jogadores.md)).

**Credor**:
Jogador que concedeu o empréstimo.

**Devedor**:
Jogador que recebeu o empréstimo.

**Imunidade de Aluguel**:
Benefício negociável que permite passar por uma propriedade sem pagar aluguel por N voltas ([D-010](./docs/adr/D-010-imunidade-de-aluguel-negociavel.md)).

**Tax Man**:
Token controlado pelo banco que cobra aluguel ao banco ao cair em propriedade com dono.
_Avoid_: Fiscal, cobrador

### Design

**Catch-up mechanic**:
Mecanismo que dá vantagem a jogadores em desvantagem. Por princípio, nunca é rotulado como tal na interface.
_Avoid_: rubber banding, mecanismo de equilíbrio
