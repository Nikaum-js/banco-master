# Magnata Imobiliário

Clone web multiplayer do Richup.io (Monopoly online), até 8 jogadores humanos, sem IA. Tema inicial: "Cidades do Mundo".

Este é o glossário do **domínio de negócio** — os termos que o SRS usa para escrever regra. A regra em si vive em [`docs/SRS.md`](./docs/SRS.md), que é a fonte de verdade absoluta; aqui só ficam os nomes. Decisões que criaram ou mudaram um termo estão em [`docs/adr/`](./docs/adr/README.md).

## Language

### Sala e identidade

**Avatar**:
Forma base escolhida para o `PlayerFace` do assento. O catálogo final contém Clássico Vivo, Olhos Orbitais, Linha Única, Prisma e Totem; a escolha persiste do lobby à partida e pode se repetir entre jogadores ([D-047](./docs/adr/D-047-avatares-escolhiveis-e-persistentes.md)).
_Avoid_: peça

**Skin**:
Visual sobreposto ao Avatar. O catálogo contém Careca, Cavanhaque, Topete, Cartola, Safári, Aviador, Robô e Astronauta; toda Skin é compatível com todo Avatar e a combinação persiste como identidade do assento ([D-047](./docs/adr/D-047-avatares-escolhiveis-e-persistentes.md)).
_Avoid_: peça, Avatar

**Revanche**:
Nova partida iniciada no lobby da mesma sala depois do resumo final. Preserva assentos e identidades, mas recria todo o estado de jogo ([D-052](./docs/adr/D-052-revanche-reabre-a-mesma-sala.md)).
_Avoid_: reiniciar a partida, recriar sala

**Histórico da sala**:
Conjunto limitado de resumos de partidas finalizadas na sala privada atual, preservado entre revanches e sem atravessar para outra sala ([D-067](./docs/adr/D-067-retencao-leve-fica-na-sala-privada.md)).
_Avoid_: histórico do jogador, histórico global, replay

**Estatísticas da sala**:
Medidas derivadas do Histórico da sala para os jogadores daquele grupo e para as partidas preservadas ([D-067](./docs/adr/D-067-retencao-leve-fica-na-sala-privada.md)).
_Avoid_: perfil, ranking global, leaderboard

**Preset de sala**:
Objeto nomeado que seleciona somente configurações já existentes no lobby, sem criar regra ou estado paralelo ([D-067](./docs/adr/D-067-retencao-leve-fica-na-sala-privada.md)).
_Avoid_: modo de jogo, regra personalizada

### Tabuleiro e movimento

**GO**:
Casa de índice 0. Passar por ela credita $200; parar exatamente nela credita $400 ([D-007](./docs/adr/D-007-go-progressivo.md)).
_Avoid_: Início, Partida, Start

**Free Parking**:
Casa de índice 24. Quem para nela coleta toda a Loteria.
_Avoid_: Férias, Estacionamento Livre

**Loteria**:
Prêmio acumulado no centro da mesa. Começa em $500, recebe impostos, multas e, quando escolhido, todos os lances do Leilão secreto; quem parar no Free Parking leva tudo ([D-006](./docs/adr/D-006-free-parking-com-premio-acumulado.md), [D-046](./docs/adr/D-046-leilao-da-largada-financia-a-loteria.md)).
_Avoid_: centerPot (na interface), pote do Free Parking

**Ritual de Largada**:
Escolha pública do host no lobby para definir a ordem inicial: Leilão secreto ou Maior dado ([D-046](./docs/adr/D-046-leilao-da-largada-financia-a-loteria.md)).
_Avoid_: sorteio oculto, ordem de entrada

**Leilão da Largada**:
Modo do Ritual de Largada em que cada jogador lacra e paga o próprio lance, e o total entra na Loteria ([D-046](./docs/adr/D-046-leilao-da-largada-financia-a-loteria.md)).
_Avoid_: leilão aberto, pregão da largada

**Maior dado**:
Modo do Ritual de Largada em que cada jogador aciona, na sua vez, dois dados brancos gerados pela autoridade e vistos por toda a mesa; a maior soma define a ordem, sem custo ([D-046](./docs/adr/D-046-leilao-da-largada-financia-a-loteria.md), [D-051](./docs/adr/D-051-maior-dado-e-rolado-por-cada-jogador.md)).
_Avoid_: shuffle, ordem aleatória

**Dupla**:
Mesmos valores nos dois dados brancos.
_Avoid_: Duplo, Double

**Speed Die**:
Terceiro dado especial ativado após a 1ª volta, com faces 1/2/3, Mr. Magnata e Ônibus. Atualmente suspenso por flag ([D-003](./docs/adr/D-003-speed-die-apos-1a-volta.md)).
_Avoid_: Dado de velocidade, terceiro dado

**Mr. Magnata**:
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
Disputa de lances por uma propriedade. Dispara por recusa de compra ou pelo espólio de um falido ([D-031](./docs/adr/D-031-espolio-do-falido-vai-a-pregao-simultaneo.md)). O gatilho por **escassez de terrenos** existiu entre a D-023 e a [D-059](./docs/adr/D-059-leilao-de-escassez-de-terrenos-revertido.md), que o reverteu.

**Pregão**:
Leilão **simultâneo** de vários lotes ao mesmo tempo, cada um com cronômetro próprio. Desde a [D-059](./docs/adr/D-059-leilao-de-escassez-de-terrenos-revertido.md) tem uma procedência só — o **espólio**.

**Espólio**:
Conjunto de propriedades de um jogador que faliu **devendo ao banco**. Vai a pregão em vez de voltar de graça ao banco ([D-031](./docs/adr/D-031-espolio-do-falido-vai-a-pregao-simultaneo.md)). Quando o falido devia a um **jogador**, não há espólio: as propriedades vão direto ao credor.

**Desistência**:
Saída **voluntária** da partida, na própria vez, sem precisar dever nada ([D-057](./docs/adr/D-057-desistencia-voluntaria-encerra-a-participacao.md), §9.6). Não é falência: não exige insolvência, e sem empréstimo ativo os bens voltam **livres ao banco**, sem espólio nem pregão. Havendo empréstimo, o credor herda tudo, como no §9.3.
_Avoid_: falência voluntária, abandonar, render-se

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

**Proposta de negociação**:
Oferta persistente enviada por um jogador a outro. Várias podem coexistir; cada uma é respondida separadamente e só movimenta ativos após ser aceita e revalidada ([D-048](./docs/adr/D-048-propostas-de-negociacao-simultaneas.md)).
_Avoid_: pendingTrade, proposta global

**Empréstimo**:
Transferência de dinheiro entre jogadores, com juros de 10–50% cobrados a cada passagem do devedor pelo GO ([D-009](./docs/adr/D-009-emprestimos-entre-jogadores.md)) e prazo de três voltas ([D-054](./docs/adr/D-054-emprestimo-vence-em-tres-voltas.md)).

**Vencimento**:
Terceira passagem do devedor pelo GO, quando o jogo cobra juros e principal de uma vez e encerra o empréstimo. Caixa insuficiente vira dívida pendente ao credor.
_Avoid_: prazo estourado, calote

**Credor**:
Jogador que concedeu o empréstimo.

**Devedor**:
Jogador que recebeu o empréstimo.

**Contrapartida mínima**:
Piso de validade de uma proposta: cada lado precisa receber ao menos metade do valor avaliado dos ativos que entrega ([D-055](./docs/adr/D-055-troca-exige-contrapartida-minima.md)). Dinheiro pago não conta contra quem paga.
_Avoid_: troca justa, anti-dump

**Valor avaliado**:
Medida de referência de propriedades, Bus Tickets e imunidades, usada só para verificar a contrapartida. Nunca é cobrada de ninguém.
_Avoid_: preço de mercado, valuation

**Imunidade de Aluguel**:
Benefício negociável que permite passar por uma propriedade sem pagar aluguel por N voltas ([D-010](./docs/adr/D-010-imunidade-de-aluguel-negociavel.md)).

**Tax Man**:
Token controlado pelo banco que cobra aluguel ao banco ao cair em propriedade com dono.
_Avoid_: Fiscal, cobrador

### Design

**Catch-up mechanic**:
Mecanismo que dá vantagem a jogadores em desvantagem. Por princípio, nunca é rotulado como tal na interface.
_Avoid_: rubber banding, mecanismo de equilíbrio

**Cobrança de dívida**:
Superfície que apresenta uma dívida pendente. Fica no miolo do tabuleiro, dentro do anel de casas: não cobre casa nenhuma, não reposiciona a mesa e não é modal ([D-066](./docs/adr/D-066-cobranca-de-divida-vai-para-o-miolo-do-tabuleiro.md), que substitui a faixa ancorada da [D-056](./docs/adr/D-056-cobranca-de-divida-sai-do-centro-da-tela.md)).
_Avoid_: faixa de cobrança, modal de falência, card de dívida

**Capacidade de levantar**:
Caixa mais venda de construções mais hipoteca de tudo que ainda é hipotecável. É o número que diz se ainda há saída, e o mesmo que autoriza declarar falência.
_Avoid_: patrimônio, net worth
