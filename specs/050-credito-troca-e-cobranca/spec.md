# Feature Specification: Prazo do crédito, contrapartida na troca e faixa de cobrança

**Feature Branch**: `050-credito-troca-e-cobranca`

**Created**: 2026-07-29

**Status**: Aprovada

**Input**: User description: "No sistema de empréstimo, a pessoa tem 3 voltas pra pagar; pode quitar antes pra se livrar dos juros, mas se não pagar em 3 voltas o jogo desconta sozinho — e se não tiver dinheiro ela tem que hipotecar ou declarar falência. Criar uma validação no sistema de troca: o que acontece muito é a pessoa perder, ficar com raiva e entregar todas as propriedades pra outra pra ferrar um terceiro; travar proposta absurda. E o modal de falência é péssimo: fica grande no meio da tela, impede a pessoa de ver o jogo e tomar uma ação — refazer totalmente."

**Depende de**: spec [008](../008-divida-falencia/spec.md) (dívida pendente e falência), spec [010](../010-emprestimos/spec.md) (empréstimos entre jogadores), spec [013](../013-negociacao/spec.md) (negociação), spec [044](../044-polimento-lancamento/spec.md) (acessibilidade e caminho de jogo)

**Regra de origem**: SRS §8.5, §9.1, §12.2 e §15.3/§15.4/§15.6 (v1.21), apoiadas em [D-054](../../docs/adr/D-054-emprestimo-vence-em-tres-voltas.md), [D-055](../../docs/adr/D-055-troca-exige-contrapartida-minima.md) e [D-056](../../docs/adr/D-056-cobranca-de-divida-sai-do-centro-da-tela.md). A D-054 revoga parcialmente a [D-009](../../docs/adr/D-009-emprestimos-entre-jogadores.md); a D-056 refina a [D-039](../../docs/adr/D-039-acessibilidade-aa-no-caminho-de-jogo.md).

## Clarifications

### Session 2026-07-29

- Q: No vencimento das 3 voltas, o que é cobrado? → A: Juros a cada volta como hoje e, na 3ª passagem pelo GO, os juros daquela volta mais o principal. Quitar antes paga só o principal e evita as voltas de juros restantes.
- Q: Qual o critério da trava de troca? → A: Cada lado precisa receber ao menos 50% do valor avaliado dos ativos que entrega. Dinheiro entregue não conta contra quem paga — pagar caro continua livre.
- Q: Como a cobrança deve ocupar a tela? → A: Faixa ancorada na base, que reduz a altura do tabuleiro em vez de cobri-lo.

## User Scenarios & Testing

### User Story 1 - Empréstimo com prazo real (Priority: P1)

Como devedor, quero saber desde a assinatura que tenho três voltas para devolver o principal, para decidir se quito cedo e economizo juros ou se aposto em levantar o dinheiro até o vencimento.

**Why this priority**: é a mudança que transforma o empréstimo em decisão. Sem prazo, o instrumento é renda perpétua para o credor e nunca cobra nada do devedor.

**Independent Test**: conceder um empréstimo, fazer o devedor passar pelo GO três vezes e confirmar juros nas duas primeiras passagens e juros + principal na terceira, com o empréstimo encerrado.

**Acceptance Scenarios**:

1. **Given** um empréstimo ativo, **When** o devedor passa pelo GO pela 1ª vez, **Then** só os juros da volta são debitados dele e creditados ao credor, e o prazo restante cai para duas voltas.
2. **Given** um empréstimo com duas voltas já corridas, **When** o devedor passa pelo GO pela 3ª vez, **Then** os juros daquela volta e o principal são cobrados automaticamente e o empréstimo deixa de existir.
3. **Given** um empréstimo ativo e caixa suficiente, **When** o devedor quita antes de qualquer passagem pelo GO, **Then** ele paga apenas o principal e não paga juros nenhum.
4. **Given** um empréstimo encerrado por vencimento, **When** o devedor pede outro empréstimo numa dívida futura, **Then** o pedido é permitido, porque não há mais empréstimo ativo.
5. **Given** um devedor preso ou parado por várias rodadas, **When** ele não passa pelo GO, **Then** o prazo não avança.

---

### User Story 2 - Vencimento sem caixa vira dívida cobrável (Priority: P1)

Como jogador cujo empréstimo venceu sem caixa suficiente, quero cair na mesma cobrança de dívida que o resto do jogo usa, para poder vender construções, hipotecar, negociar ou declarar falência — em vez de ficar devendo em silêncio.

**Why this priority**: um vencimento que não cobra nada anula o prazo. É este cenário que fecha a regra.

**Independent Test**: levar um empréstimo ao vencimento com caixa menor que juros + principal e confirmar que o saldo vira dívida pendente ao credor, com o caminho de liquidação e de falência disponíveis.

**Acceptance Scenarios**:

1. **Given** um vencimento cujo total excede o caixa, **When** a cobrança automática acontece, **Then** todo o caixa disponível vai ao credor e o restante vira dívida pendente a ele.
2. **Given** essa dívida pendente, **When** o devedor hipoteca ou vende construções e o caixa passa a cobrir, **Then** ele consegue pagar e a partida segue.
3. **Given** essa dívida pendente, **When** nem liquidando tudo o devedor cobre o valor, **Then** declarar falência é permitido e o credor do empréstimo herda os ativos segundo a regra de falência vigente.
4. **Given** essa dívida pendente aberta durante o movimento, **When** ela é paga, **Then** a casa onde o jogador parou ainda é resolvida na sequência.

---

### User Story 3 - Trava contra proposta de abandono (Priority: P1)

Como jogador da mesa, quero que ninguém consiga entregar o patrimônio inteiro a um adversário escolhido a dedo, para que a partida continue sendo decidida no tabuleiro.

**Why this priority**: é o pedido explícito e o comportamento que mais corrompe uma partida em andamento.

**Independent Test**: montar propostas doando propriedades sem contrapartida, com contrapartida simbólica e com contrapartida legítima, e confirmar bloqueio nos dois primeiros casos e aceitação no terceiro.

**Acceptance Scenarios**:

1. **Given** uma proposta em que um lado entrega propriedades e não recebe nada, **When** ele tenta enviá-la, **Then** a proposta é recusada pelo jogo e ele vê quanto falta de contrapartida.
2. **Given** uma proposta em que um lado entrega propriedades caras e recebe um valor simbólico, **When** ele tenta enviá-la, **Then** ela é recusada pelo mesmo critério.
3. **Given** uma proposta em que um jogador paga caro em dinheiro por uma única propriedade, **When** ele a envia, **Then** ela é permitida — dinheiro entregue não conta contra quem paga.
4. **Given** o exemplo canônico de uma propriedade por três voltas de imunidade sobre as propriedades do outro, **When** ele é proposto, **Then** ele continua válido quando o conjunto protegido tem peso comparável.
6. **Given** uma proposta em que um lado entrega apenas dinheiro e não recebe nada, **When** ele tenta enviá-la, **Then** ela é recusada — entregar sem receber não é troca.
5. **Given** uma proposta válida quando criada, **When** o estado muda e ela deixa de atingir o piso antes da aceitação, **Then** ela não é processada e permanece disponível para recusa.

---

### User Story 4 - Cobrar dívida sem perder o tabuleiro de vista (Priority: P1)

Como jogador em dívida, quero ver o tabuleiro inteiro enquanto decido o que hipotecar ou vender, para entender minha situação e agir em vez de decidir de memória.

**Why this priority**: é a queixa direta do usuário e o único ponto do jogo em que a informação necessária para decidir estava atrás da superfície que pedia a decisão.

**Independent Test**: abrir uma cobrança de dívida e confirmar que nenhuma casa do tabuleiro fica coberta, que todas continuam clicáveis e que a faixa mostra caixa, falta e capacidade de levantar.

**Acceptance Scenarios**:

1. **Given** uma cobrança de dívida aberta, **When** observo a tela, **Then** o tabuleiro está inteiro visível e nenhuma casa está atrás da superfície de cobrança.
2. **Given** uma cobrança aberta, **When** clico numa propriedade para hipotecar, **Then** o fluxo funciona normalmente e o caixa exibido na faixa acompanha.
3. **Given** uma cobrança aberta, **When** leio a faixa, **Then** encontro a quem devo, quanto devo, meu caixa, quanto falta e quanto ainda consigo levantar liquidando tudo.
4. **Given** uma cobrança em que nem liquidando tudo eu cubro, **When** leio a faixa, **Then** a capacidade exibida é menor que a dívida e declarar falência está disponível.
5. **Given** uma cobrança com vários credores possíveis para empréstimo, **When** peço um empréstimo, **Then** escolho o credor a partir da faixa sem que ela cresça um botão por adversário.
6. **Given** uma cobrança aberta, **When** pressiono Esc, **Then** nada acontece — a cobrança não é dispensável.

### Edge Cases

- Empréstimo concedido e quitado no mesmo turno, antes de qualquer GO: encerra sem juros.
- Devedor cai exatamente no GO na volta do vencimento: o bônus dobrado é creditado antes da cobrança, e a cobrança usa o caixa já atualizado.
- Vencimento e falência na mesma passagem: a dívida do vencimento é a dívida-gatilho, e o credor do empréstimo continua sendo o herdeiro.
- Credor eliminado antes do vencimento: o empréstimo já foi liquidado pela regra de falência e não há cobrança pendente.
- Proposta de troca vazia dos dois lados: nenhum lado entrega ativos, então o piso não é violado.
- Proposta em que o lado entrega apenas dinheiro: nunca é bloqueada pelo piso.
- Proposta com propriedade hipotecada: ela é avaliada pela metade do preço de tabela, dos dois lados.
- Cobrança aberta em paisagem estreita: a faixa usa a forma compacta e o tabuleiro continua inteiro.
- Cobrança aberta para quem não é o jogador da vez: continua vendo a espera, sem ações.

## Requirements

### Functional Requirements

- **FR-001**: Todo empréstimo concedido DEVE nascer com prazo de três voltas do devedor, contadas pelas passagens dele pelo GO.
- **FR-002**: O prazo DEVE pertencer ao estado da partida e NÃO DEVE ser derivado de relógio, rodada global ou recontagem na interface.
- **FR-003**: Na 1ª e na 2ª passagem do devedor pelo GO, o jogo DEVE cobrar apenas os juros da volta, como já fazia.
- **FR-004**: Na 3ª passagem do devedor pelo GO, o jogo DEVE cobrar os juros daquela volta e o principal, automaticamente, sem confirmação de nenhum jogador.
- **FR-005**: A cobrança do vencimento DEVE ocorrer depois do crédito do bônus de GO.
- **FR-006**: A cobrança do vencimento DEVE encerrar o empréstimo.
- **FR-007**: Quando o caixa não cobrir a cobrança do vencimento, todo o caixa disponível DEVE ir ao credor e o restante DEVE virar dívida pendente a ele.
- **FR-008**: Essa dívida pendente DEVE oferecer os mesmos caminhos de qualquer dívida: pagar, liquidar para pagar, negociar ou declarar falência.
- **FR-009**: A quitação antecipada DEVE continuar custando apenas o principal e DEVE encerrar o empréstimo sem cobrar as voltas restantes.
- **FR-010**: Encerrado o empréstimo, por quitação ou por vencimento, o devedor DEVE poder tomar um novo empréstimo.
- **FR-011**: O prazo restante DEVE ser exibido para devedor e credor onde o empréstimo já aparece.
- **FR-012**: O credor NÃO DEVE poder cancelar, antecipar ou renegociar o empréstimo.
- **FR-013**: Uma proposta de troca DEVE ser inválida quando algum lado receber menos da metade do valor avaliado dos ativos que entrega.
- **FR-014**: A avaliação DEVE usar preço de tabela para propriedade livre, metade do preço para hipotecada, $100 por Bus Ticket, 10% do preço da propriedade protegida por volta de imunidade com teto de 50% do preço, e 50% do preço para imunidade permanente.
- **FR-015**: Dinheiro entregue NÃO DEVE contar contra quem paga; dinheiro recebido DEVE contar a favor de quem recebe.
- **FR-015a**: Entregar qualquer coisa — inclusive apenas dinheiro — e não receber nada DEVE ser inválido.
- **FR-016**: A verificação DEVE acontecer na criação da proposta e novamente na aceitação.
- **FR-017**: Uma proposta bloqueada pelo piso DEVE informar ao proponente quanto falta de contrapartida.
- **FR-018**: A trava NÃO DEVE substituir a proteção de credor existente; as duas DEVEM valer juntas.
- **FR-019**: A cobrança de dívida NÃO DEVE ser apresentada como cartão centralizado sobre o tabuleiro.
- **FR-020**: Enquanto a cobrança estiver aberta, o tabuleiro DEVE permanecer inteiramente visível e operável.
- **FR-021**: A faixa de cobrança DEVE exibir credor, valor devido, caixa atual, quanto falta e a capacidade de levantar caixa liquidando tudo.
- **FR-022**: A capacidade exibida DEVE ser a mesma medida que autoriza declarar falência.
- **FR-023**: A escolha de credor para empréstimo NÃO DEVE empilhar um botão por adversário na faixa.
- **FR-024**: A faixa NÃO DEVE escurecer a tela, capturar foco ao abrir nem prender foco.
- **FR-025**: Esc NÃO DEVE fechar a cobrança.
- **FR-026**: A faixa DEVE manter contraste, nome acessível, operação por teclado e alvo de toque exigidos pelo caminho de jogo, inclusive em paisagem estreita.
- **FR-027**: A cobertura automatizada DEVE provar prazo, vencimento com e sem caixa, quitação sem juros, bloqueio e liberação de propostas pelo piso, e o conteúdo da faixa.

### Key Entities

- **Empréstimo**: dívida entre dois jogadores com principal, taxa e, a partir desta feature, voltas já corridas dentro do prazo de três.
- **Vencimento**: a terceira passagem do devedor pelo GO, quando juros e principal são cobrados de uma vez.
- **Valor avaliado**: medida de referência de propriedades, tickets e imunidades usada só para verificar a contrapartida de uma troca.
- **Contrapartida mínima**: metade do valor avaliado dos ativos que um lado entrega.
- **Faixa de cobrança**: superfície ancorada na base do palco que apresenta a dívida pendente sem cobrir o tabuleiro.
- **Capacidade de levantar**: caixa mais venda de construções mais hipoteca de tudo que ainda é hipotecável.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Em 100% dos empréstimos levados ao fim, o desembolso total do devedor é igual a três parcelas de juros mais o principal.
- **SC-002**: Em 100% das quitações feitas antes da primeira passagem pelo GO, o devedor paga exatamente o principal.
- **SC-003**: 100% dos vencimentos sem caixa suficiente terminam em dívida pendente ao credor, nunca em perdão nem em caixa negativo.
- **SC-004**: 100% das propostas que entregam ativos sem contrapartida de metade do valor são recusadas na criação e na aceitação.
- **SC-005**: 100% das propostas que pagam a mais em dinheiro por propriedade continuam permitidas.
- **SC-006**: Com a cobrança aberta, 100% das casas do tabuleiro permanecem visíveis e clicáveis, medido em 1280×800 e em 740×360.
- **SC-007**: A faixa apresenta os cinco números da FR-021 sem rolagem.
- **SC-008**: Toda a suíte automatizada, lint, typecheck e build fecham verdes.

## Assumptions

- O prazo é o mesmo para todo empréstimo; não há negociação de prazo nesta feature.
- Os valores de avaliação da §8.5 são constantes de verificação e podem ser recalibrados sem mudar a regra.
- A faixa substitui o cartão apenas no clima de dívida; compra, leilão, reação e fim de jogo continuam como estão.
- A capacidade de levantar caixa é informação pública para quem está na cobrança, e não revela mão de cartas.
- Não há alteração no destino de ativos em falência.
