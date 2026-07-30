# D-055 — Troca exige contrapartida mínima de metade do valor entregue

**Data:** 2026-07-29 · **Status:** revogada — substituída pela [D-058](D-058-troca-e-livre-ate-o-esvaziamento.md)

**Decisão:** uma proposta de negociação só é válida se **cada lado receber pelo menos metade do valor avaliado dos ativos que entrega**. Ativo, aqui, é propriedade, Bus Ticket e imunidade de aluguel — concedida ou transferida. Propostas que não atingem o piso são recusadas pelo próprio jogo: não podem ser enviadas nem aceitas.

**Dinheiro entregue não conta contra quem paga.** Pagar caro por uma propriedade continua livre, em qualquer valor: quem se desfaz de caixa está tomando uma decisão econômica ruim para si, não transferindo controle de tabuleiro de graça. O piso existe para o lado que **entrega ativos**, e o que ele recebe em troca conta integralmente — propriedades, tickets, imunidades **e** dinheiro.

**Entregar e não receber absolutamente nada nunca é troca**, mesmo quando o que sai é só dinheiro. Essa é a única regra que olha o caixa dos dois lados, e existe porque o piso sozinho deixaria passar a doação do caixa inteiro ao líder. Receber qualquer coisa já tira a proposta desse caso e a devolve ao piso normal.

**Avaliação** (usada só nesta verificação; nenhum destes valores é cobrado de ninguém):

| Item | Valor avaliado |
|---|---|
| Propriedade livre | preço de tabela |
| Propriedade hipotecada | metade do preço de tabela |
| Bus Ticket | $100 cada |
| Imunidade por N voltas | 10% do preço da propriedade protegida por volta, teto de 50% do preço |
| Imunidade permanente | 50% do preço da propriedade protegida |
| Dinheiro | valor nominal — conta só a favor de quem recebe |

A imunidade vale uma **fração do que ela protege**, e não um valor fixo, porque valor fixo quebra nas duas pontas. Alto demais, isentar uma casa marrom "vale" mais que a própria casa e toda troca com imunidade passa a ser recusada — foi o primeiro desenho, e ele reprovou casos legítimos já cobertos por teste. Baixo demais, a imunidade some da conta e deixa de ser contrapartida. Atrelar ao preço também fecha a lavagem: para "receber" o equivalente a um império doado, o outro lado precisa comprometer um império.

**Por quê:** o padrão que essa trava mata não é uma negociação ruim, é o abandono da partida com dano dirigido. Quem está perdendo entrega o patrimônio inteiro a um jogador escolhido a dedo e sai — e a partida dos outros deixa de ser decidida pelo que aconteceu no tabuleiro para ser decidida por uma rixa. Não é o mesmo que negociar mal: o doador não está tentando ganhar nada, e é exatamente por isso que nenhum limite baseado em intenção funcionaria.

Metade do valor é o corte que separa as duas coisas com folga. Negociação agressiva de verdade raramente passa de dois para um em valor avaliado, e continua permitida; doação e quase-doação ficam do lado de fora. Um piso mais alto começaria a proibir negociação desequilibrada legítima — pagar a mais por um país que fecha, aceitar menos por caixa urgente —, e um piso mais baixo seria contornado oferecendo trocado.

A alternativa de barrar só a doação literal (contrapartida zero) foi rejeitada: um dólar simbólico burla a regra inteira, e o jogador que quer sabotar tem todo o incentivo para descobrir isso na primeira tentativa.

**Como aplicar:** o SRS ganha a §8.5 com o piso e a tabela de avaliação. A verificação vale em toda troca — na criação da proposta e de novo na aceitação, junto da revalidação que a §8.3 já exige, porque preço não muda mas posse e hipoteca mudam. Ela **soma-se** à proteção de credor que já existe (§9.1: o devedor com dívida pendente não pode ficar insolvente por causa da troca) sem substituí-la.

O exemplo da §8.4 — uma propriedade em troca de passar de graça nas propriedades do outro por três voltas — continua válido, e é critério de aceite: a imunidade é sobre **as propriedades** do concedente, no plural, e um conjunto de peso comparável cobre o piso com folga. Uma volta de imunidade sobre uma única casa barata não paga uma propriedade cara, e recusar isso é o comportamento certo — é a mesma doação com fachada.

A recusa é explicada ao proponente na hora, com o valor que falta; uma proposta bloqueada sem explicação seria lida como bug.
