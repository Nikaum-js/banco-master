# Feature Specification: Construção

**Feature Branch**: `004-construcao`

**Created**: 2026-05-23

**Status**: Draft

**Input**: User description: "Construção — casas (0→4) e hotel, uniformidade, grupo parcial (70%/100%), estoque do banco e escassez, venda de construções, aluguel por construção. Preenche o ponto de extensão de rent.ts (003)."

**Depende de**: [`001-tabuleiro-48-casas`](../001-tabuleiro-48-casas/spec.md) (grupos, estoque 40/16, limiar de maioria) · [`002-fluxo-de-turno`](../002-fluxo-de-turno/spec.md) (construir é ação facultativa do turno) · [`003-compra-aluguel`](../003-compra-aluguel/spec.md) (títulos/posse, aluguel base, caixa)

> **Escopo desta spec:** **construir** casas e hotel em cidades, com **uniformidade**, **grupo parcial** (maioria → 70% / completo → 100%), **estoque** do banco (40 casas / 16 hotéis) com **leilão de casas** na escassez, **venda** de construções (metade do preço; desmonte de hotel), e o **aluguel por construção** (preenche o ponto de extensão deixado em `rent.ts` pela 003). Os **valores concretos** de custo e da tabela de aluguel por nível são **dado de tema** (como os preços das cidades). **Não** cobre: **2º hotel** (§14/D-008) e **Skyscraper** (§13.7) — upgrades avançados, deferidos à spec de Balanceamento; **Hangar** (§13.6, aeroportos); a mecânica de **hipoteca** (Hipoteca — aqui só se lê a flag); **negociação**. Fonte de verdade: [`docs/SRS.md`](../../docs/SRS.md) §5.1, §5.2, §5.3, §5.4, §5.5, §13.3.

## Clarifications

### Session 2026-05-23

- Q: Como o leilão de casas em escassez (§5.4) é acionado num jogo por turnos? → A: Quando o pedido de construção do jogador ativo excede o estoque de casas disponível, abre-se um leilão pelas casas disponíveis entre todos os jogadores que declararem interesse em construir (fiel ao §5.4).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Construir casas e hotel num grupo (Priority: P1)

Como jogador, no meu turno, eu construo casas nas minhas cidades — desde que eu tenha **ao menos a maioria do grupo** (2 de 3 / 3 de 4), nenhuma propriedade do grupo hipotecada, caixa e estoque do banco. A construção segue **0→1→2→3→4 casas→hotel** (o hotel substitui as 4 casas) e respeita **uniformidade** (diferença máxima de 1 casa entre as cidades do grupo que eu possuo).

**Why this priority**: Construção é o principal multiplicador de aluguel — o motor de crescimento do jogo. Sem ela, o aluguel fica no escalonamento por posse da 003. MVP da feature.

**Independent Test**: possuir a maioria de um grupo, construir casas em sequência e um hotel, e verificar que a uniformidade é respeitada, o caixa é debitado e o estoque do banco é consumido.

**Acceptance Scenarios**:

1. **Given** o jogador possui a maioria de um grupo (sem hipotecas) e caixa/estoque suficientes, **When** constrói uma casa na cidade com menos casas, **Then** a casa é adicionada, o custo é debitado e o estoque do banco diminui em 1.
2. **Given** uma cidade com 4 casas, **When** o jogador constrói o hotel, **Then** as 4 casas voltam ao estoque do banco e 1 hotel é consumido do estoque.
3. **Given** uma cidade tem 1 casa a mais que outra do mesmo grupo, **When** o jogador tenta construir na cidade que já tem mais, **Then** a ação é bloqueada (uniformidade — só constrói na de menos).
4. **Given** o jogador possui apenas 1 de 3 do grupo (não-maioria), **When** tenta construir, **Then** é bloqueado.
5. **Given** uma propriedade do grupo está hipotecada, **When** o jogador tenta construir no grupo, **Then** é bloqueado (§5.2).
6. **Given** caixa insuficiente para o custo, **When** tenta construir, **Then** é bloqueado.

---

### User Story 2 - Aluguel escalonado por construção (Priority: P2)

Como jogador, quando outro jogador para numa cidade minha **com construção**, o aluguel passa a seguir a **tabela de construção** da propriedade (por nível de casas/hotel) — **100%** se eu tenho o grupo completo, **70%** se tenho só a maioria (grupo parcial). Esse valor **substitui** o escalonamento por posse (base/150%/200%) da 003.

**Why this priority**: É o retorno do investimento em construção — o que justifica construir. Depende de US1 (já haver construção).

**Independent Test**: construir numa cidade e parar outro jogador nela, conferindo o aluguel pela tabela de construção (×0.7 em grupo parcial, ×1.0 em completo), e confirmando que o escalonamento por posse foi substituído.

**Acceptance Scenarios**:

1. **Given** uma cidade com 2 casas num grupo **completo** do dono, **When** outro jogador para nela, **Then** paga **100%** do valor da tabela para "2 casas".
2. **Given** a mesma cidade num grupo **parcial** (só maioria) do dono, **When** outro jogador para nela, **Then** paga **70%** do valor da tabela.
3. **Given** uma cidade **com construção**, **When** se calcula o aluguel, **Then** usa-se a tabela de construção, **não** o escalonamento por posse (base/150%/200%) da 003.

---

### User Story 3 - Vender construções ao banco (Priority: P3)

Como jogador, posso vender casas/hotéis de volta ao banco por **metade** do preço de construção, a qualquer momento no meu turno, respeitando a uniformidade. Ao vender um hotel, recebo 4 casas de volta (se o banco tiver); se não houver 4 casas, sou obrigado a **desmontar todos os hotéis do grupo** simultaneamente, recebendo só o dinheiro das casas disponíveis.

**Why this priority**: Dá liquidez (levantar caixa) e devolve construções ao estoque, alimentando a escassez. Refinamento sobre US1.

**Independent Test**: vender casas e um hotel e conferir o crédito (metade), o retorno ao estoque, a conversão hotel→4 casas, e o desmonte forçado quando o banco não tem casas.

**Acceptance Scenarios**:

1. **Given** uma cidade com 3 casas, **When** o jogador vende 1 casa, **Then** recebe metade do custo e a casa volta ao estoque (respeitando uniformidade).
2. **Given** um hotel e o banco com ≥4 casas disponíveis, **When** o jogador vende o hotel, **Then** recebe metade do custo, o hotel volta ao estoque e a cidade fica com 4 casas (consumindo 4 do estoque).
3. **Given** um hotel e o banco **sem** 4 casas disponíveis, **When** o jogador precisa vender o hotel, **Then** todos os hotéis do grupo são desmontados juntos, com crédito apenas das casas que o banco consegue fornecer (§5.5) — não se desmonta um hotel parcialmente.

---

### User Story 4 - Escassez de estoque e leilão de casas (Priority: P4)

Como jogadores, quando o banco não tem casas suficientes para atender a demanda de construção, as casas disponíveis vão a **leilão** entre os interessados; o maior lance leva. A escassez é alavanca estratégica intencional, não trava permanente.

**Why this priority**: Caso de borda do estoque finito; raro, mas necessário para não travar o jogo quando as casas acabam. Por isso P4.

**Independent Test**: esgotar o estoque de casas, gerar demanda concorrente e verificar que as casas disponíveis vão a leilão e o vencedor paga o lance.

**Acceptance Scenarios**:

1. **Given** o banco com menos casas do que a demanda de construção concorrente, **When** a escassez é detectada, **Then** as casas disponíveis vão a leilão entre os jogadores interessados em construir.
2. **Given** um leilão de casas, **When** encerra, **Then** o maior lance leva a(s) casa(s) e paga ao banco (regras gerais de leilão da 003).

---

### Edge Cases

- **Construir sem maioria:** bloqueado (001 FR-013 — precisa de 2 de 3 / 3 de 4).
- **Quebrar uniformidade:** só se pode construir na propriedade com **menos** casas do grupo; tentativa na de mais é bloqueada.
- **Propriedade do grupo hipotecada:** bloqueia construção em todo o grupo (§5.2).
- **Hotel substitui 4 casas:** ao construir hotel, as 4 casas retornam ao estoque; ao vender hotel, viram 4 casas (ou desmonte forçado).
- **Aluguel com construção substitui o escalonamento por posse** (não se somam).
- **Construir só no próprio turno** (inclusive preso — 002 FR-020); não é ação fora de turno.
- **Estoque esgotado:** não se constrói até liberar (venda) ou via leilão de casas (US4).
- **Grupo parcial = maioria:** 70% vale para grupo possuído na maioria mas incompleto; completo → 100%.

## Requirements *(mandatory)*

### Functional Requirements

**Construir**

- **FR-001**: Para construir num grupo, o jogador MUST possuir ao menos a **maioria** do grupo (2 de 3 / 3 de 4, conforme 001 FR-013) e **nenhuma** propriedade possuída do grupo pode estar **hipotecada** (§5.2).
- **FR-002**: A construção por propriedade MUST seguir a sequência **0→1→2→3→4 casas→1 hotel**; o hotel **substitui** as 4 casas, que retornam ao estoque do banco.
- **FR-003**: A **uniformidade** MUST ser respeitada: a diferença de casas entre as cidades do mesmo grupo possuídas pelo jogador nunca pode exceder **1**; só se constrói na cidade com a **menor** contagem do grupo.
- **FR-004**: Construir MUST debitar o **custo de construção** (dado de tema) do caixa do jogador; caixa insuficiente bloqueia a construção.
- **FR-005**: Construir MUST consumir do **estoque global** do banco (**40 casas / 16 hotéis**, D-017); sem estoque disponível, bloqueia (salvo leilão de casas, FR-012).
- **FR-006**: Construir MUST ser **ação facultativa** do **próprio turno** do jogador (002 FR-006), inclusive enquanto preso (002 FR-020); não é ação fora de turno.

**Aluguel por construção**

- **FR-007**: Numa cidade **com construção**, o aluguel MUST seguir a **tabela de construção** da propriedade (por nível; valores são dado de tema), aplicando **100%** se o dono tem o **grupo completo** e **70%** se tem só a **maioria** (grupo parcial, §13.3).
- **FR-008**: O aluguel por construção MUST **substituir** o escalonamento por posse (base/150%/200% da 003): com construção, usa a tabela; sem construção, mantém o escalonamento por posse.

**Vender construções**

- **FR-009**: O jogador MUST poder vender casas/hotéis ao banco por **metade** do preço de construção, no seu turno, respeitando a uniformidade; o valor é creditado ao caixa.
- **FR-010**: Ao vender um **hotel**, o jogador MUST receber **4 casas** do banco (a cidade volta a 4 casas) se houver estoque; se o banco **não** tiver 4 casas, todos os hotéis do grupo MUST ser desmontados **simultaneamente**, com crédito apenas das casas que o banco fornecer (§5.5) — sem desmonte parcial de um hotel.
- **FR-011**: Construções vendidas MUST retornar ao **estoque** do banco.

**Escassez e leilão de casas**

- **FR-012**: Quando um pedido de construção do jogador ativo **excede** o estoque de casas disponível, o sistema MUST abrir um **leilão** pelas casas disponíveis entre **todos os jogadores que declararem interesse** em construir; as casas vão ao maior lance (§5.4).
- **FR-013**: O leilão de casas MUST seguir as **regras gerais de leilão** (003/§7): o maior lance leva e paga ao banco.

**Integração**

- **FR-014**: Estes comportamentos MUST estender o cálculo de aluguel de cidade da 003 (ponto de extensão de `rent.ts`): com construção → tabela (70%/100%); sem construção → escalonamento por posse.

### Key Entities

- **Construção (por cidade)**: nível de construção de uma cidade possuída — `0–4 casas` ou `hotel`. Atributo da posse, não do board.
- **Estoque do Banco**: casas disponíveis (de **40**) e hotéis disponíveis (de **16**); consumido ao construir, reabastecido ao vender/desmontar.
- **Tabela de Aluguel por Construção** (por propriedade, **dado de tema**): aluguel para cada nível (1–4 casas, hotel).
- **Custo de Construção** (por propriedade/grupo, **dado de tema**): preço por casa/hotel; venda = metade.
- **Leilão de Casas**: disputa pelas casas escassas (reusa o leilão da 003).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Construir respeita a sequência 0→4 casas→hotel e a **uniformidade** (nunca >1 de diferença no grupo) — verificável tentando quebrar a regra.
- **SC-002**: Construir exige **maioria** do grupo, nenhuma hipotecada, caixa e estoque; debita o custo e consome o estoque corretamente.
- **SC-003**: O aluguel **com construção** = tabela × **70%** (parcial) / **100%** (completo), **substituindo** o escalonamento por posse da 003.
- **SC-004**: Vender devolve **metade** do custo e retorna a construção ao estoque; hotel → 4 casas, ou **desmonte forçado** do grupo quando faltam casas.
- **SC-005**: Hotel **substitui** 4 casas (que voltam ao estoque) e consome **1 hotel** do estoque; o inverso na venda.
- **SC-006**: Em **escassez**, as casas disponíveis vão a **leilão** e o vencedor paga ao banco.

## Assumptions

- **Limiar de construção = maioria do grupo** (2 de 3 / 3 de 4), conforme 001 FR-013 e D-004; grupo parcial (maioria incompleta) → aluguel 70%, completo → 100%.
- **Gatilho do leilão de casas (§5.4):** definido na clarificação — quando o pedido do jogador ativo **excede** o estoque de casas, abre-se um leilão pelas casas disponíveis entre os jogadores que declararem interesse em construir.
- **Custo de construção e tabela de aluguel por nível são dado de tema** (como os preços das cidades, 001) — esta spec define a **estrutura** e as regras (uniformidade, 70%/100%, metade na venda), não os números por propriedade.
- **Hipoteca** é da spec Hipoteca; aqui só se **lê** a flag para bloquear construção (FR-001) e o estado do título vem da 003.
- **2º hotel (§14/D-008) e Skyscraper (§13.7)** são upgrades **acima** do 1º hotel, deferidos à spec de Balanceamento; esta spec para no **1 hotel**. O estoque (16 hotéis) é definido aqui e consumido também por eles depois.
- **Construir/vender movem caixa e estoque diretamente** (modelo de economia da 003); insolvência (não desta spec) segue a spec Falência.
- Feature de **discovery + implementação** na sequência do 003; segue o pipeline SDD com confirmação antes de `/speckit-plan` e `/speckit-implement`.
