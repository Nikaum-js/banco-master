# D-061 — Obrigação a outro jogador não é truncada

**Data:** 2026-07-29 · **Status:** aceita · **Refina:** [D-031](D-031-espolio-do-falido-vai-a-pregao-simultaneo.md) (§9.1 — falência), FR-004a da spec 036

**Decisão:** quando uma regra obriga um jogador a pagar **a outro jogador** e o caixa dele não cobre, o que ele tem é transferido e **o restante permanece devido**. A diferença abre uma **dívida pendente do devedor**, que segue o fluxo do §9.1 — levantar recursos (hipotecar, vender construção, negociar, pedir empréstimo) e pagar, ou declarar falência se nem liquidando tudo cobrir.

A dívida vale **inclusive quando o devedor não é o jogador da vez**. Isto é o coração da decisão: até aqui o slot `state.resolution.debt` era implicitamente do jogador ativo (`payDebt`/`declareBankruptcy` liam `activePlayer`), e por isso a única saída para uma cobrança fora da vez era truncar. A dívida passa a nomear o **devedor** explicitamente, e a mesa aguarda a resolução dela como já aguarda uma reação a carta ofensiva ou a resposta de um credor a um pedido de empréstimo — três decisões fora do turno que o `waitingFor` já sabia representar.

**O que continua truncando, e por quê:** obrigação ao **banco ou ao pote** cujo valor é pequeno e incondicional — multa de prisão na 3ª tentativa (§4.11), Fiscal (§13.8), Honorários, Crise Imobiliária, Conserto de Imóveis, Auditoria Fiscal. Ali "paga o que houver" continua valendo, e a razão não é conveniência:

- Ninguém é **privado** de nada. Truncar um pagamento ao banco só faz sair menos dinheiro da economia; truncar um pagamento a um jogador tira dele uma receita à qual a regra lhe deu direito. São dois fatos diferentes, e só o segundo é um furo de conservação com vítima.
- O Fiscal é **catch-up discreto** (princípio IV). Uma cobrança que pode falir quem está por cima deixa de ser discreta — vira o evento mais alto do turno de outra pessoa.
- Essas cobranças são **incondicionais**: chegam sem o jogador ter feito nada. Abrir falência por elas transforma azar em eliminação, que é o oposto do que a mecânica existe para fazer.

A linha, portanto, é **quem é o credor**, não o tamanho do valor. Um credor jogador é uma parte lesada; o banco não é.

**Por quê:** o caso que expôs isso é a carta **Aniversário** (Tesouro, §10.6): "receba 50 de cada adversário". Um adversário com 43 entregava 43 e os 7 restantes **desapareciam** — não iam para o banco, não ficavam devidos, deixavam de existir. O jogador do Aniversário recebia menos do que a carta prometia e nada na tela explicava por quê. O mesmo padrão estava em `Aquisição Hostil` e em qualquer regra futura que cobrasse de um jogador para outro; era um convite a repetir o furo.

O truncamento não foi um descuido: está documentado na FR-004a da spec 036 como forma de garantir "sem saldo negativo fora do fluxo de dívida". A garantia é boa — o que estava errado era o **meio**. Zerar a diferença mantém o invariante mentindo sobre a regra; abrir dívida mantém o invariante dizendo a verdade, porque saldo negativo passa a ser exatamente o estado que a dívida pendente representa.

**Custo aceito:** a mesa pode ficar aguardando um jogador fora da vez resolver uma dívida — inclusive vários deles, quando o Aniversário cobra de todos e mais de um está curto. É o mesmo custo que o jogo já paga na reação a carta ofensiva, com a mesma mitigação (a decisão é do devedor, não tem prazo, e ele tem todas as ferramentas de liquidação disponíveis). Em compensação, a falência deixa de ter uma porta dos fundos: até aqui um jogador podia ficar indefinidamente com caixa 0 recebendo cobranças truncadas sem nunca ser eliminado.

**Como aplicar:** SRS §9.1 passa a distinguir credor jogador de credor banco e nomeia o devedor da dívida pendente; §10.6 corrige a descrição do Aniversário para dizer que o restante fica devido; §12.2 registra que a cobrança fora da vez usa a mesma faixa de dívida (D-056), endereçada ao devedor. SRS v1.25. Motor — `ResolutionSlice.debt` ganha `debtorId` obrigatório; `payDebt`/`declareBankruptcy`/`liquidationValue` passam a operar sobre o devedor nomeado, não sobre `activePlayer`; `aniversario` e `acquire` passam a abrir dívida em vez de truncar; `waitingForOf` inclui o devedor. Snapshot anterior a esta decisão não tem `debtorId` — ausente lê-se como o jogador ativo daquele snapshot, que era a semântica implícita.
