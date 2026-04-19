# D-050 — Limite de construção por posse

**Data:** 2026-07-28 · **Status:** aceita

**Refina:** [D-026](D-026-construcao-com-pais-parcial-aluguel-escalonado-por-posse.md), SRS §5.2 e §13.3.

**Decisão:** a construção com país parcial permanece disponível desde a primeira cidade, mas a quantidade de cidades possuídas passa a limitar o nível máximo de cada cidade enquanto o país estiver incompleto. Em países de três cidades, possuir 1/3 libera até 1 casa e possuir 2/3 libera até 2 casas por cidade; com 3/3, toda a escada fica disponível. Em países de duas cidades, possuir 1/2 libera até 1 casa; com 2/2, toda a escada fica disponível. A uniformidade entre cidades possuídas, o fator de aluguel por posse, os custos e a exigência de país completo para Skyscraper permanecem.

**Por quê:** a regra anterior aplicava uniformidade apenas entre cidades possuídas. Com isso, quem tinha uma única cidade podia concentrar nela quatro casas e dois hotéis, enquanto quem adquiria uma segunda cidade passava a ser obrigado a distribuir construções. Possuir menos propriedades liberava uma progressão maior, criando incentivo inverso e comportamento percebido como injusto entre jogadores.

**Como aplicar:** a validação central de construção deriva um teto de nível a partir da quantidade possuída e do tamanho do país. O seletor da gestão de propriedade usa a mesma validação e comunica o bloqueio como necessidade de ampliar a posse do país. Testes cobrem países de três e duas cidades, uniformidade, desbloqueio ao completar o país e paridade entre jogadores em condições equivalentes.
