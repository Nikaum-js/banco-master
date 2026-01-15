# Feature Specification: Empréstimos entre jogadores

**Feature Branch**: `010-emprestimos`

**Created**: 2026-05-24

**Status**: Draft

**Input**: User description: "Empréstimos entre jogadores (D-009 / SRS §15): solicitar a um jogador específico quando o devedor não cobre uma cobrança obrigatória; credor define juros 10–50%; juros simples cobrados a cada passagem pelo GO; quitar a qualquer momento; máximo 1 ativo por devedor. Destrava a Falência §9.3/§15.5 (credor herda ativos e passivos do devedor falido)."

**Depende de**: [`002`](../002-fluxo-de-turno/spec.md) (turno, `advance`/`onPassGo` na passagem do GO) · [`003`](../003-compra-aluguel/spec.md) (caixa, títulos) · [`007`](../007-balanceamento-catchup/spec.md) (porta `onPassGo`, GO progressivo) · [`008`](../008-falencia-fim-jogo/spec.md) (resolução `debt`, `liquidationValue`, `declareBankruptcy`, `payDebt`)

> **Escopo desta spec:** o sistema de empréstimos do SRS §15 — **solicitar** (§15.2: na janela de dívida pendente do 008), **conceder com taxa** (§15.3: credor define 10–50%), **cobrar juros no GO** (§15.3/§15.4: simples, por passagem), **quitar** (§15.3), o limite de **1 empréstimo ativo por devedor** (§15.3) — e a integração com a **falência com empréstimo ativo** (§9.3/§15.5: credor herda ativos e passivos, empréstimo liquidado). **Não** cobre: solicitar empréstimo fora da janela de dívida pendente (ex.: déficit em leilão/construção, que hoje não geram resolução `debt` no motor) — deferido; negociação de propriedades (§8, sem spec). Fonte de verdade: [`docs/SRS.md`](../../docs/SRS.md) §15 e §9.3.

## Clarifications

### Session 2026-05-24

- Q: Modelo de juros — o SRS §15.3 diz "juros debitados automaticamente a cada GO" mas §15.4 diz que quitar paga "principal + juros acumulados". Qual vale? → A: **Auto-debita no GO; quitação = só principal.** A cada passagem pelo GO, `ratePct% × principal` é debitado do devedor e creditado ao credor (texto literal do §15.3). A quitação paga apenas o principal — os juros já foram cobrados por volta. O "$700 total" do §15.4 é a soma vitalícia ($200 nos GOs + $500 de principal). Estado guarda só `{principal, ratePct}` (sem juros acumulados).
- Q: Qual o **valor (principal)** do empréstimo? → A: **Escolhido pelo devedor, limitado ao credor.** O devedor pede um valor `≥` déficit da dívida pendente e `≤` caixa do credor (combina com o exemplo arbitrário de $500 do §15.4 e permite manter reserva após pagar a dívida).
- Q: Na falência §9.3, se a dívida que disparou a falência era a **outro jogador** (aluguel) e existe um empréstimo ativo com um **terceiro** credor, quem herda os ativos? → A: **O credor do empréstimo herda tudo (§9.3 literal).** O §9.3 ("Falência com Empréstimo Ativo") governa quando há empréstimo ativo: o credor do empréstimo herda todas as propriedades (construções→banco), assume os passivos com o banco, recebe o caixa restante; empréstimo liquidado. Precede o §9.2 (princípio I).
- Q: Quando o devedor passa pelo GO mas não tem caixa para os juros (mesmo após o bônus de GO), o que acontece? → A: **Abre dívida pendente ao credor.** O juro que excede o caixa abre uma resolução `debt` ao credor (reuso 008) — o devedor liquida e paga, ou fale. Consistente com aluguel/imposto sem caixa.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Pedir e receber um empréstimo para cobrir uma dívida (Priority: P1)

Como jogador **da vez** que caiu numa **dívida pendente** (aluguel/imposto que excede meu caixa, resolução `debt` do 008) e não quero/consigo liquidar tudo, eu **solicito um empréstimo** a um jogador específico. O credor **aceita definindo a taxa de juros** (10–50%) ou **recusa**. Se aceito, o **principal** é transferido do credor para mim, registra-se o empréstimo ativo, e eu uso o caixa para **pagar a dívida** (comando `payDebt` do 008). Fico com **1 empréstimo ativo** e não posso pegar outro até quitar.

**Why this priority**: É o coração da feature e a alternativa que faltava entre "liquidar tudo" e "falir". MVP.

**Independent Test**: pôr um jogador em dívida que ele não cobre; solicitar empréstimo a outro; credor aceita com taxa; verificar transferência do principal, registro do empréstimo e que a dívida pode então ser paga.

**Acceptance Scenarios**:

1. **Given** um jogador em `resolution.kind==='debt'` sem caixa suficiente, **When** ele solicita empréstimo a um jogador com caixa suficiente e este aceita com taxa válida (10–50%), **Then** o principal é debitado do credor e creditado ao devedor, e um empréstimo ativo `{ devedor, credor, principal, taxa }` é registrado.
2. **Given** o empréstimo concedido elevou o caixa do devedor acima da dívida, **When** ele executa `payDebt`, **Then** a dívida é quitada normalmente (reuso 008).
3. **Given** um devedor que **já tem** um empréstimo ativo, **When** ele tenta solicitar outro, **Then** a solicitação é **rejeitada** (máx. 1 ativo por devedor, §15.3).
4. **Given** uma taxa fora de 10–50% ou um credor sem caixa suficiente para o principal, **When** a concessão é tentada, **Then** é **rejeitada** sem efeito.
5. **Given** uma solicitação de empréstimo, **When** o credor **recusa**, **Then** nenhum valor é transferido e o devedor segue na dívida (pode liquidar, pedir a outro, ou falir).

---

### User Story 2 - Juros cobrados na passagem pelo GO e quitação (Priority: P2)

Como **credor**, eu recebo **juros** sempre que o **devedor passa pelo GO**; os juros são **simples** (sobre o principal original). O **devedor** pode **quitar a qualquer momento**. O credor **não pode** cancelar nem exigir antecipação.

**Why this priority**: dá sentido econômico ao empréstimo (retorno do credor, custo do devedor). Depende de US1 existir.

**Independent Test**: com um empréstimo ativo, mover o devedor cruzando o GO e verificar o débito de juros ao devedor / crédito ao credor; depois quitar e verificar que o empréstimo encerra.

**Acceptance Scenarios**:

1. **Given** um empréstimo ativo de principal $500 a 20%, **When** o devedor passa pelo GO, **Then** $100 (20% de $500) são debitados do devedor e creditados ao credor.
2. **Given** o mesmo empréstimo após N passagens pelo GO, **When** o devedor quita, **Then** ele paga **apenas o principal** (os juros já foram cobrados por volta), o empréstimo deixa de ser ativo e o devedor pode contrair um novo.
3. **Given** um empréstimo ativo, **When** o **credor** tenta cancelar/exigir pagamento, **Then** a ação não existe/é rejeitada (prazo é do devedor, §15.3).
4. **Given** um devedor sem caixa para os juros do GO (mesmo após o bônus), **When** ele passa pelo GO, **Then** o que exceder o caixa **abre uma resolução `debt` ao credor** (reuso 008) — o devedor liquida e paga, ou fale.

---

### User Story 3 - Falência do devedor com empréstimo ativo (Priority: P3)

Como **credor** de um devedor que **fale** com o empréstimo ainda ativo, eu **herdo todas as propriedades** dele (sem construções — voltam ao banco), **assumo as dívidas dele com o banco** (hipotecas/impostos pendentes) e recebo o **caixa restante**; o empréstimo é considerado **liquidado** (§9.3/§15.5).

**Why this priority**: é a regra que o 008 deixou explicitamente deferida ("§9.3 depende de Empréstimos"). Fecha a falência. Depende de US1.

**Independent Test**: criar empréstimo ativo, levar o devedor à falência e verificar que o **credor do empréstimo** herda as propriedades (sem construções) e o caixa, e que o empréstimo some.

**Acceptance Scenarios**:

1. **Given** um devedor com empréstimo ativo que declara falência, **When** a falência é processada, **Then** o **credor do empréstimo** recebe as propriedades do devedor (construções voltam ao banco), o caixa restante, e o empréstimo é removido (liquidado).
2. **Given** o credor herdou propriedades **hipotecadas**, **When** a herança ocorre, **Then** elas permanecem hipotecadas sob o credor (credor assumiu o passivo, §15.5).
3. **Given** um devedor **sem** empréstimo ativo, **When** ele fale, **Then** vale o §9.2 do 008 (sem mudança).

---

### Edge Cases

- **Juros no GO sem caixa**: o débito de juros ao passar pelo GO pode exceder o caixa do devedor (mesmo com o bônus de GO creditado antes). Comportamento — ver Assumptions/[NEEDS CLARIFICATION].
- **Credor eliminado** depois de conceder: se o credor falir/sair antes de o devedor quitar, o que acontece com o empréstimo? (Assumption: empréstimo permanece como passivo do devedor mas sem destinatário ativo → tratado como liquidado/perdoado se o credor for eliminado. Documentar.)
- **Devedor passa pelo GO via Bus Ticket** (009) ou carta de movimento: o crédito de GO (e portanto a cobrança de juros) segue a mesma porta `onPassGo` — juros cobrados igualmente ao cruzar.
- **Precedência §9.2 × §9.3** quando a dívida-gatilho é a um terceiro: resolvido — §9.3 precede; o credor do empréstimo herda (Clarifications).
- **Pausa** (princípio VII): solicitar/conceder/quitar bloqueados enquanto pausado.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST permitir que o jogador da vez **solicite um empréstimo** a um jogador específico **somente** quando houver uma dívida pendente (`resolution.kind==='debt'`) e o caixa não a cobrir (§15.2).
- **FR-002**: O sistema MUST impedir um novo empréstimo quando o solicitante **já é devedor** de um empréstimo ativo (máx. 1 ativo por devedor, §15.3).
- **FR-003**: O credor MUST poder **aceitar definindo a taxa** de juros, validada em **10%–50%** do principal, ou **recusar**. Taxa fora do range é rejeitada.
- **FR-004**: O sistema MUST validar que o **credor tem caixa ≥ principal**; senão a concessão é rejeitada.
- **FR-005**: Ao conceder, o sistema MUST debitar o **principal** do credor, creditá-lo ao devedor e registrar um empréstimo ativo `{ debtorId, creditorId, principal, ratePct }`.
- **FR-006**: O sistema MUST cobrar **juros** do devedor a cada **passagem pelo GO** (porta `onPassGo`), **simples** sobre o principal original (`ratePct% × principal`), debitando do devedor e creditando ao credor. Se o caixa do devedor (já com o bônus de GO) não cobrir o juro, o excedente **abre uma resolução `debt` ao credor** (reuso 008).
- **FR-007**: O sistema MUST permitir ao devedor **quitar** o empréstimo a qualquer momento pagando **apenas o principal** (juros já cobrados por volta), encerrando-o.
- **FR-008**: O sistema MUST NOT oferecer ao credor qualquer ação de **cancelar** ou **exigir** pagamento antecipado (§15.3).
- **FR-009**: O **principal** é **escolhido pelo devedor**, validado em `≥` déficit da dívida pendente e `≤` caixa do credor.
- **FR-010**: Na **falência do devedor com empréstimo ativo** (§9.3/§15.5), o sistema MUST transferir as propriedades do devedor (construções → banco) e o caixa restante ao **credor do empréstimo**, manter hipotecas sob o credor, **remover** o empréstimo (liquidado), eliminar o devedor e checar fim de jogo. O §9.3 **precede** o §9.2: havendo empréstimo ativo, o credor do empréstimo herda, ainda que a dívida-gatilho fosse a um terceiro.
- **FR-011**: Sem empréstimo ativo, a falência segue o **§9.2** existente (008) sem alteração.
- **FR-012**: Solicitar, conceder, quitar e cobrar juros MUST ser bloqueados enquanto a partida estiver **pausada** (princípio VII).
- **FR-013**: O empréstimo ativo (e seu status) MUST ser **visível** a todos (HUD: "status de empréstimos ativos", SRS §12.3) — não é informação privada como cartas.

### Key Entities *(include if feature involves data)*

- **Empréstimo (Loan)**: registro serializável de um empréstimo ativo — `debtorId`, `creditorId`, `principal`, `ratePct` (10–50). **Sem** contador de juros acumulados (juros são cobrados e quitados por volta; quitação = principal). Estado novo em `GameState` (ex.: `loans: Loan[]`).
- **Devedor / Credor**: papéis sobre `Player` existentes; "1 ativo por devedor" é invariante sobre `loans`.
- **Janela de solicitação**: a resolução `debt` (008) — ponto onde o empréstimo pode ser pedido.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% das concessões válidas (taxa 10–50%, credor com caixa, devedor sem empréstimo ativo) transferem o principal e registram o empréstimo; 100% das inválidas são rejeitadas sem efeito.
- **SC-002**: Em 100% das passagens do devedor pelo GO com empréstimo ativo, os juros corretos (`ratePct% × principal`) são debitados do devedor e creditados ao credor.
- **SC-003**: 100% das quitações encerram o empréstimo e liberam o devedor para contrair um novo.
- **SC-004**: 100% das falências **com** empréstimo ativo destinam ativos+caixa ao credor do empréstimo e removem o empréstimo; 100% das falências **sem** empréstimo seguem o §9.2 inalterado.
- **SC-005**: Nunca há mais de **1 empréstimo ativo por devedor** em nenhum estado alcançável.

## Assumptions

- **Janela = resolução `debt`**: empréstimos só são solicitáveis no ponto de insolvência já modelado (aluguel/imposto sem caixa, 008). Déficit em leilão/construção não gera `debt` hoje, então fica **fora de escopo** (deferido).
- **Credor eliminado**: se o credor for eliminado antes da quitação, o empréstimo é tratado como **liquidado/perdoado** (sem cobrança futura). Documentar; revisitar se indesejado.
- **Juros no GO insuficientes**: resolvido em Clarifications — debita até o caixa e o excedente abre uma resolução `debt` ao credor (reuso 008).
- **Aceite do credor é decisão humana**: no demo local de 1 cliente, o HUD expõe aceitar/recusar e a taxa; multiplayer real (M3) roteia ao cliente do credor.
- **Reuso**: transferência de ativos na falência reusa `declareBankruptcy` (008), estendido para o ramo §9.3.
