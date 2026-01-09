# D-056 — A cobrança de dívida sai do centro da tela e vira faixa ancorada

**Data:** 2026-07-29 · **Status:** aceita

**Decisão:** a superfície que cobra uma dívida pendente deixa de ser um cartão centralizado sobre o tabuleiro e passa a ser uma **faixa ancorada na base do palco**, que **reduz a altura do tabuleiro em vez de cobri-lo**. Enquanto a cobrança estiver aberta:

1. **Nenhuma casa fica escondida.** O tabuleiro encolhe o suficiente para caber acima da faixa e continua inteiro na tela — a decisão de qual propriedade hipotecar ou qual construção vender é tomada olhando o tabuleiro, não a memória.
2. **A faixa é a leitura do aperto**, na ordem em que a pessoa precisa: a quem se deve, quanto, quanto de caixa já existe, quanto falta e — informação nova — **quanto ainda dá para levantar** vendendo construção e hipotecando tudo. É esse último número que diz se ainda há saída ou se a falência é o único caminho, e ele nunca esteve na tela.
3. **A lista de credores não infla a faixa.** Pedir empréstimo abre a escolha de credor a partir da faixa; com sete adversários possíveis, sete botões empilhados eram o que fazia o cartão crescer.
4. **Declarar falência continua exigindo insolvência real** (§9.1) e continua sendo a ação de menor destaque visual da faixa.
5. **A faixa não é modal.** Não captura foco ao abrir, não prende o foco e não escurece a tela — o tabuleiro precisa continuar operável. Esc continua não fechando nada (§12.6): sair da cobrança só acontece pagando, quitando por negociação ou declarando falência.

**Por quê:** a cobrança é a única decisão do jogo cuja informação necessária está **fora** da superfície que a apresenta. Comprar, leiloar, reagir a uma carta — tudo isso se decide com o que está no próprio cartão. Pagar uma dívida que o caixa não cobre se decide olhando quais propriedades ainda estão livres, quais têm construção para vender e quanto cada uma levanta. Um cartão de 420 px no meio da tela cobria justamente o centro do tabuleiro e as casas em volta dele, então a pessoa mais pressionada da mesa era a única obrigada a decidir de memória.

O cartão já tinha sido desenhado para não bloquear cliques, e isso não bastou: não adianta o tabuleiro estar clicável se ele está atrás. Encolher a mesa custa alguns pixels de casa e devolve a tela inteira — e como o tabuleiro é limitado pela altura da janela, a conta é conhecida e aceitável.

**Refina:** [D-039](D-039-acessibilidade-aa-no-caminho-de-jogo.md), que fixou o comportamento de foco e de Esc dos modais de decisão. A cobrança de dívida já era a exceção declarada (não bloqueia, não prende foco); esta decisão torna a exceção coerente com a forma da superfície, em vez de mantê-la como um modal que finge não ser um.

**Como aplicar:** o SRS registra a faixa em §12.2, junto da tabela de modais, com a observação de que a cobrança não é modal. O tabuleiro passa a reservar a altura da faixa enquanto ela existir. A capacidade de levantar caixa exibida é a mesma medida que o jogo já usa para decidir se a falência é permitida (§9.1) — a interface não recalcula nada por conta própria, e a pessoa vê exatamente o número que autoriza ou proíbe o botão de falência. Em paisagem estreita a faixa usa a forma compacta, mantendo alvo de toque, contraste e ordem de foco exigidos por §12.6.
