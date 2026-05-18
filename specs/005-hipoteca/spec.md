# Feature Specification: Hipoteca

**Feature Branch**: `005-hipoteca`

**Created**: 2026-05-23

**Status**: Draft

**Input**: User description: "Hipoteca — hipotecar (recebe metade do preço), deshipotecar (paga metade + 10%), regra de transferência de hipotecada. Muta a flag `mortgaged` que 003/004 já leem."

**Depende de**: [`001-tabuleiro-48-casas`](../001-tabuleiro-48-casas/spec.md) (preços) · [`003-compra-aluguel`](../003-compra-aluguel/spec.md) (títulos, caixa, flag `mortgaged`, isenção de aluguel) · [`004-construcao`](../004-construcao/spec.md) (construção — não hipotecar com construção; já bloqueia construir em grupo com hipotecada)

> **Escopo desta spec:** **hipotecar** uma propriedade (receber metade do preço do banco, marcar) e **deshipotecar** (pagar metade + 10% de juros), além da **regra de transferência** de propriedade hipotecada (§6.3). Esta feature **muta** a flag `mortgaged` que a 003 já lê (isenção de aluguel) e a 004 já lê (bloqueio de construção) — ou seja, fecha o ciclo da hipoteca cujos *efeitos* já estavam previstos. **Não** cobre: a mecânica de **negociação** (Negociação) nem a **transferência por falência** (Falência) — aqui fica só a **regra/taxa** de transferir uma hipotecada, não o fluxo de trade/falência que a dispara. Fonte de verdade: [`docs/SRS.md`](../../docs/SRS.md) §6.1, §6.2, §6.3.

## Clarifications

### Session 2026-05-23

- Q: Os 10% (deshipoteca e taxa de transferência) incidem sobre qual base? → A: Sobre o valor da hipoteca (= metade do preço). Deshipoteca = metade × 1,10; taxa de manter na transferência = metade × 0,10 (padrão Monopoly).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Hipotecar uma propriedade (Priority: P1)

Como jogador, no meu turno, eu hipoteco uma propriedade minha **sem construção** para levantar caixa: recebo do banco **metade** do preço de compra e a propriedade fica marcada como hipotecada (deixa de cobrar aluguel). Não posso hipotecar se a propriedade — ou qualquer outra do grupo — tiver construção; preciso vender as construções antes.

**Why this priority**: É a metade que faltava do ciclo de hipoteca — os *efeitos* (sem aluguel, sem construir) já existem em 003/004; aqui o jogador finalmente consegue **acionar** a hipoteca para sobreviver a uma dívida. MVP.

**Independent Test**: hipotecar uma propriedade própria sem construção e verificar o crédito de metade do preço e a marca; tentar hipotecar uma com construção no grupo e confirmar o bloqueio.

**Acceptance Scenarios**:

1. **Given** o jogador é dono de uma propriedade não-hipotecada e **sem** construção no grupo, **When** hipoteca, **Then** recebe **metade** do preço de compra e a propriedade fica `mortgaged`.
2. **Given** uma propriedade hipotecada, **When** outro jogador para nela, **Then** **não** paga aluguel (efeito já garantido pela 003).
3. **Given** alguma propriedade do grupo tem construção, **When** o jogador tenta hipotecar qualquer propriedade do grupo, **Then** é bloqueado (deve vender as construções antes — §6.1).
4. **Given** uma propriedade já hipotecada, **When** o jogador tenta hipotecá-la de novo, **Then** é no-op.

---

### User Story 2 - Deshipotecar uma propriedade (Priority: P2)

Como jogador, pago ao banco **metade do preço + 10% de juros** para tirar a hipoteca; a propriedade volta a cobrar aluguel normalmente. Preciso de caixa suficiente.

**Why this priority**: Fecha o ciclo (recuperar a propriedade). Depende de US1 (haver hipoteca).

**Independent Test**: deshipotecar uma propriedade hipotecada e conferir o débito de metade × 1,10 e a remoção da marca; sem caixa, é bloqueado.

**Acceptance Scenarios**:

1. **Given** uma propriedade hipotecada e caixa suficiente, **When** o jogador deshipoteca, **Then** paga **metade + 10%** ao banco e a marca `mortgaged` é removida.
2. **Given** caixa insuficiente para metade + 10%, **When** tenta deshipotecar, **Then** é bloqueado (no-op).
3. **Given** uma propriedade não-hipotecada, **When** tenta deshipotecar, **Then** é no-op.

---

### User Story 3 - Regra de transferência de propriedade hipotecada (Priority: P3)

Como jogador que **recebe** uma propriedade hipotecada (por negociação ou falência — gatilho em outras specs), eu escolho: **manter** hipotecada, pagando ao banco uma **taxa imediata de 10%** (do valor da hipoteca); ou **deshipotecar** na hora pagando **metade + 10%**.

**Why this priority**: Regra de borda que torna a hipoteca negociável/transferível de forma justa. Refinamento; o gatilho (trade/falência) é de outras specs, então P3.

**Independent Test**: aplicar a regra de transferência a uma hipotecada e conferir as duas opções (taxa de 10% ao manter; metade+10% ao deshipotecar).

**Acceptance Scenarios**:

1. **Given** o novo dono recebe uma propriedade hipotecada e opta por **manter**, **When** a transferência se conclui, **Then** ele paga **10%** do valor da hipoteca ao banco como taxa imediata e a propriedade segue `mortgaged`.
2. **Given** o novo dono opta por **deshipotecar** na transferência, **When** conclui, **Then** paga **metade + 10%** e a marca é removida.

---

### Edge Cases

- **Hipotecar com construção no grupo:** bloqueado — vender as construções primeiro (§6.1).
- **Hipotecar já hipotecada / deshipotecar não-hipotecada:** no-op.
- **Caixa insuficiente para deshipotecar:** bloqueado.
- **Aluguel de hipotecada:** sempre 0 (003) — esta spec só garante a marca.
- **Construir em grupo com hipotecada:** bloqueado (004) — esta spec só garante a marca.
- **Hipotecar/deshipotecar só no próprio turno** (ação facultativa, 002 FR-006), inclusive preso (002 FR-020).
- **Transferência:** o **gatilho** (negociação/falência) é de outras specs; aqui só a regra de taxa/opção.

## Requirements *(mandatory)*

### Functional Requirements

**Hipotecar**

- **FR-001**: Hipotecar uma propriedade **própria** e **não-hipotecada** MUST creditar ao jogador **metade do preço de compra** (001) e marcar a propriedade como `mortgaged`.
- **FR-002**: Hipotecar MUST ser **bloqueado** se a propriedade — ou qualquer propriedade do mesmo grupo possuída pelo jogador — tiver **construção** (casas/hotel); o jogador deve vender as construções antes (§6.1).
- **FR-003**: Propriedade hipotecada **não** cobra aluguel — **efeito já implementado na 003** (esta spec apenas garante a marca).

**Deshipotecar**

- **FR-004**: Deshipotecar MUST cobrar **metade do preço + 10%** (= metade × 1,10) do caixa do jogador e remover a marca `mortgaged`; a propriedade volta a cobrar aluguel.
- **FR-005**: Deshipotecar MUST ser **bloqueado** (no-op) se o caixa for insuficiente.

**Transferência (regra; gatilho em outras specs)**

- **FR-006**: Ao transferir uma propriedade **hipotecada** a um novo dono, este MUST poder **manter** hipotecada pagando uma **taxa imediata de 10%** do valor da hipoteca ao banco, **ou** **deshipotecar** pagando **metade + 10%** (§6.3). O **gatilho** da transferência (negociação/falência) é de outras specs.

**Geral**

- **FR-007**: Hipotecar e deshipotecar MUST ser **ações facultativas do próprio turno** do jogador (002 FR-006), inclusive enquanto preso (002 FR-020); não são ações fora de turno.
- **FR-008**: Operações inválidas (sem posse, já no estado-alvo, sem caixa, com construção) MUST ser **no-op** (consistente com o padrão de 002/003/004).

### Key Entities

- **Título de Propriedade** (003): a flag `mortgaged` é o estado central que esta feature liga/desliga; os *efeitos* (aluguel, construção) já consomem a flag em 003/004.
- **Valor da Hipoteca** (derivado): **metade do preço de compra** (001). Deshipoteca = valor × 1,10; taxa de transferência = valor × 0,10.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Hipotecar credita **exatamente metade** do preço e marca `mortgaged`; é bloqueado quando há construção no grupo.
- **SC-002**: Deshipotecar debita **exatamente metade × 1,10** e remove a marca; bloqueado sem caixa.
- **SC-003**: Uma propriedade hipotecada **não** gera aluguel (verificável via 003) e **não** permite construir no grupo (via 004) — o ciclo fecha sem regressão.
- **SC-004**: Na transferência, **manter** hipotecada cobra **10%** do valor da hipoteca; **deshipotecar** cobra **metade + 10%**.

## Assumptions

- **Base do "+10%":** definido na clarificação — os 10% incidem sobre o **valor da hipoteca** (= metade do preço): deshipoteca = `metade × 1,10`; taxa de manter = `metade × 0,10`.
- **Hipotecar/deshipotecar movem caixa diretamente** (modelo de economia da 003).
- **A flag `mortgaged` já é lida** pela 003 (isenção de aluguel) e pela 004 (bloqueio de construção) — esta spec **escreve** a flag; não reimplementa os efeitos.
- **Transferência:** o **fluxo** de negociação (Negociação) e a redistribuição de ativos em **falência** (Falência) são de outras specs; aqui fica só a **regra/taxa** aplicável quando a transferência ocorre.
- Feature de **discovery + implementação** na sequência do 004; segue o pipeline SDD com confirmação antes de `/speckit-plan` e `/speckit-implement`.
