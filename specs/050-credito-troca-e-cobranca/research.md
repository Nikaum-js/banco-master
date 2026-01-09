# Research: Prazo do crédito, contrapartida na troca e faixa de cobrança

## R1 — Onde o prazo é contado

**Decisão**: o `Loan` carrega `lapsElapsed`, incrementado dentro de `chargeLoanInterest`, que já roda na porta `afterPassGo` — depois do bônus de GO, como a ordem em `buildPorts` documenta.

**Alternativas descartadas**:

- *Contar rodadas globais*: o prazo deixaria de ser do devedor. Quem fica preso pagaria o mesmo relógio de quem dá voltas, e a D-054 é explícita em medir no GO dele.
- *Guardar a rodada de concessão e subtrair*: exige que a passagem pelo GO seja reconstruída a partir da rodada, o que não é verdade — Bus Ticket, cartas de movimento e triple mudam quantas vezes alguém cruza o GO numa rodada.
- *Contador na interface*: o motor é reproduzido no cliente; um número que só existe na apresentação divergiria entre host e cliente no primeiro reload.

## R2 — Ordem da cobrança no vencimento

**Decisão**: dentro da mesma chamada, na ordem: creditar bônus de GO (já feito por `advance`), cobrar juros da volta, e — se esta era a terceira volta — cobrar o principal. Um único débito consolidado quando o caixa cobre; caixa esvaziado e resto em dívida pendente quando não cobre.

**Por quê**: é o comportamento que a D-054 descreve e o único que não pune o devedor por ordem de operações. Cobrar antes do bônus faria o mesmo caixa reprovar num caso e aprovar no outro, sem que nada de jogo tivesse mudado.

**Nota load-bearing**: o comentário em `buildPorts` já avisa que `chargeLoanInterest` pode instalar `resolution.debt` no meio do `advance`. O vencimento herda essa propriedade e a `origin` continua marcando que a casa onde o jogador parou ainda precisa resolver depois de a dívida ser paga.

## R3 — Um empréstimo por vez e o vencimento

**Decisão**: o vencimento remove o empréstimo da lista, então o devedor pode tomar outro imediatamente, inclusive na dívida que o próprio vencimento abriu.

**Consequência aceita**: é possível encadear crédito — vencer, abrir dívida, pedir de novo. Isso não é rolagem de dívida disfarçada: o principal antigo foi efetivamente cobrado, e o novo empréstimo precisa de um credor disposto, com caixa, e recomeça o prazo. A alternativa de bloquear pedido novo enquanto houver dívida-gatilho do vencimento foi descartada por punir duas vezes o mesmo evento.

## R4 — O que avaliar numa proposta

**Decisão**: avaliação por item, com constantes declaradas na §8.5. Propriedade livre pelo preço de tabela, hipotecada pela metade, Bus Ticket $100, imunidade $100 por volta com teto $400, permanente $400.

**Alternativas descartadas**:

- *Avaliar propriedade pelo aluguel potencial ou pelo grupo que fecha*: seria mais fiel ao valor de jogo, mas torna o piso imprevisível — a mesma proposta passaria ou não dependendo do que o outro jogador tem, e o proponente não conseguiria corrigir a oferta.
- *Ignorar imunidade e ticket*: abriria exatamente o buraco que a regra fecha (doar propriedades "em troca" de uma imunidade simbólica) e reprovaria o exemplo canônico da §8.4.
- *Avaliar hipotecada pelo preço cheio*: transformaria hipoteca em ferramenta de burla — quatro propriedades hipotecadas valeriam o dobro do que representam.

## R5 — Por que dinheiro entregue não pesa contra quem paga

**Decisão**: o piso incide sobre o valor de **ativos** entregues; dinheiro entra apenas do lado do que se recebe.

**Por quê**: pagar caro é uma decisão econômica ruim para quem paga, não uma transferência de controle. Se o dinheiro pesasse contra o pagador, o piso proibiria comprar um país por um valor acima da tabela — que é negociação legítima e frequente. O padrão que a D-055 mata é o inverso: entregar tabuleiro sem receber nada.

**Verificação**: os quatro casos da spec (doação pura, doação com trocado, pagamento caro em dinheiro, propriedade por imunidade de três voltas) precisam sair como bloqueado/bloqueado/permitido/permitido, e essa matriz vira teste.

## R6 — Como a faixa encolhe o tabuleiro

**Decisão**: o palco lê uma variável de altura reservada; a faixa existe no DOM apenas durante a cobrança e o tabuleiro calcula seu lado a partir da altura da janela menos essa reserva.

**Alternativas descartadas**:

- *Sobrepor a faixa com transparência*: repete o defeito atual em menor escala — as casas de baixo continuam atrás de algo.
- *Empurrar o palco com `margin`/flex*: o palco é uma grade de três colunas com o tabuleiro quadrado limitado pela altura; mexer no fluxo reposiciona painéis laterais que não têm motivo para se mover.
- *Reduzir o tabuleiro por transform*: perderia nitidez de texto nas casas justamente quando a pessoa precisa ler preços.

**Custo aceito**: durante a cobrança, o lado do tabuleiro diminui pela altura da faixa. Como o tabuleiro já é limitado pela altura da janela, a conta é previsível e vale a troca — nenhuma casa escondida.

## R7 — A capacidade de levantar caixa

**Decisão**: a faixa exibe o mesmo valor que `liquidationValue` já calcula e que `isBankrupt` usa para autorizar a falência.

**Por quê**: é a informação que faltava e a única que responde "ainda dá para escapar?". Reusar a medida existente garante que a faixa nunca diga que dá para pagar enquanto o botão de falência está habilitado, ou o contrário.
