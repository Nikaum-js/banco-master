# Research: Empréstimos entre jogadores

Decisões técnicas de suporte ao [plan.md](./plan.md). Sem NEEDS CLARIFICATION pendentes (4 resolvidos em clarify).

## R1 — Modelo de juros (clarify Q1)

**Decisão**: juros **simples** auto-debitados a cada passagem pelo GO (`interest = round(principal · ratePct/100)`); a **quitação paga só o principal**. Estado guarda apenas `{ debtorId, creditorId, principal, ratePct }` — **sem** contador de juros acumulados.

**Rationale**: texto literal do §15.3 ("debitado automaticamente a cada GO"). Mantém o estado mínimo e recalculável (princípio VII). O "$700 total" do §15.4 é a soma vitalícia ($200 de GOs + $500 de principal), não o valor da quitação.

**Alternativas**: acumular juros e cobrar na quitação (rejeitado em clarify — contraria "debitado automaticamente"); juros compostos (rejeitado — §15.4 diz "sempre simples").

## R2 — Valor do principal (clarify Q2)

**Decisão**: principal **escolhido pelo devedor**, validado `≥ shortfall` (`shortfall = debt.amount − debtor.cash`) e `≤ creditor.cash`.

**Rationale**: combina com o exemplo arbitrário de $500 do §15.4 e permite reserva após pagar a dívida. O piso `shortfall` garante que o empréstimo de fato resolva a insolvência; o teto protege o credor.

**Alternativas**: principal = dívida exata (rejeitado — devedor ficaria com $0, sem reserva, e remove decisão estratégica).

## R3 — Janela de solicitação = resolução `debt`

**Decisão**: empréstimo só é solicitável quando `state.resolution?.kind === 'debt'` e o devedor é o jogador ativo. `grantLoan` valida isso.

**Rationale**: §15.2 ("durante o turno do devedor, quando precisar pagar algo e não tiver fundos") mapeia exatamente ao ponto de insolvência já modelado no 008 (aluguel/imposto sem caixa). Reusa o gating e o HUD da dívida.

**Alternativas**: solicitar a qualquer momento (rejeitado — §15.2 restringe à janela de necessidade); cobrir déficit de leilão/construção (deferido — não geram `debt` no motor hoje; documentado como fora de escopo na spec).

## R4 — Cobrança no GO via porta `afterPassGo`

**Decisão**: nova porta **opcional** `afterPassGo?(state, playerId)` em `TurnPorts`, chamada em `advance` **logo após** `player.cash += onPassGo(...)` e `completouPrimeiraVolta = true`. O store a wira para `chargeLoanInterest`. Default (sem 010) = `undefined` → no-op.

**Rationale**: mantém o 002 desacoplado do 010 (mesmo padrão da porta opcional `onInsolvency?`). Rodar **após** o bônus garante que o juro seja debitado do caixa já acrescido do GO progressivo (a ordem importa para a checagem de insuficiência). Reusa todos os caminhos de GO (rolagem, Bus Ticket 009, cartas de movimento) sem duplicação.

**Alternativas**: dobrar a semântica de `onPassGo` para retornar líquido (bônus−juros) (rejeitado — mistura balanceamento e empréstimos numa porta só, e o sinal/ordem fica obscuro); cobrar fora de `advance` (rejeitado — perderia passagens por Bus Ticket/cartas).

## R5 — Juro insuficiente no GO (clarify Q4) + simplificação da sobreposição

**Decisão**: se o caixa pós-bônus não cobre o juro, `chargeLoanInterest` debita o devedor até $0, credita o parcial ao credor e **abre `state.resolution = { kind:'debt', amount: restante, creditorId }`** (reuso 008). **Simplificação registrada**: se nesse mesmo GO-pass o jogador também pousaria numa casa com aluguel impagável (segundo credor), o slot único de `resolution` fica com a dívida de juros e a casa de pouso **não** é re-resolvida naquele turno.

**Rationale**: unifica "obrigação que não consigo pagar" → resolução `debt` (consistente com aluguel/imposto). A sobreposição de dois credores num único GO-pass é raríssima e uma pilha de resoluções seria complexidade desproporcional (princípio de simplicidade; ver Complexity Tracking do plan).

**Alternativas**: pular o juro daquela volta (rejeitado em clarify — cria "volta de graça"); permitir caixa negativo (rejeitado — o motor não modela caixa negativo; insolvência é sempre via `debt`).

## R6 — Falência §9.3/§15.5 (clarify Q3)

**Decisão**: `declareBankruptcy` (008) checa `activeLoanFor(state, debtor.id)`. Se houver, **ramo §9.3**: o `creditorId` do empréstimo recebe todas as propriedades do devedor (hotéis/casas→banco; hipotecas permanecem sob o credor), recebe o caixa restante, o empréstimo é **removido** e o devedor eliminado. Esse credor **substitui** o destinatário do §9.2 (mesmo que a dívida-gatilho fosse a um terceiro). Sem empréstimo ativo → §9.2 inalterado.

**Rationale**: §9.3 é a seção que governa quando há empréstimo ativo (clarify Q3 literal, princípio I). O credor "herda ativos E passivos" — modelado mantendo as hipotecas sob o novo dono (o motor não cobra a taxa de deshipoteca aqui; a herança preserva o estado `mortgaged`).

**Alternativas**: §9.2 prevalece e empréstimo só liquida (rejeitado em clarify).

## R7 — Limite de 1 empréstimo ativo por devedor (§15.3)

**Decisão**: `activeLoanFor(state, debtorId)` procura `loans.find(l => l.debtorId === debtorId)`. `grantLoan` rejeita se já existir. **Não** há limite para um jogador ser **credor** de vários (a restrição do §15.3 é sobre tomar empréstimo, não conceder).

**Rationale**: §15.3 "não pode pegar novo enquanto tiver um em aberto" refere-se ao papel de devedor. Conceder é risco que o credor pode assumir múltiplas vezes.

**Alternativas**: limitar também o credor (rejeitado — sem base no SRS; reduziria a alavanca social sem motivo).

## R8 — Credor eliminado antes da quitação (Assumption da spec)

**Decisão**: se o credor for eliminado (falência própria) enquanto o empréstimo está ativo, o empréstimo é **removido** (liquidado/perdoado) — o devedor deixa de pagar juros. Implementado limpando `loans` onde `creditorId` é o eliminado, dentro de `declareBankruptcy`.

**Rationale**: sem destinatário ativo não há a quem creditar juros; perdoar é o mínimo coerente e serializável. Documentado para revisão.

**Alternativas**: transferir o crédito a quem herda os bens do credor (complexidade desproporcional; deferido).
