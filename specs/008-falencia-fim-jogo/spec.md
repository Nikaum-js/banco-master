# Feature Specification: Falência & Fim de jogo

**Feature Branch**: `008-falencia-fim-jogo`

**Created**: 2026-05-23

**Status**: Draft

**Input**: User description: "Falência (condição, destino dos ativos sem empréstimo, eliminação) e Fim de jogo (último com saldo positivo vence). Conecta a porta onInsolvency ao fluxo real."

**Depende de**: [`002`](../002-fluxo-de-turno/spec.md) (turno pula eliminados, `eliminated`) · [`003`](../003-compra-aluguel/spec.md) (caixa, títulos, leilão, `onInsolvency`) · [`004`](../004-construcao/spec.md) (venda de construção a metade) · [`005`](../005-hipoteca/spec.md) (valor de hipoteca) · [`006`](../006-sistema-cartas/spec.md) (`netWorth`)

> **Escopo desta spec:** o fim do ciclo econômico — **condição de falência** (§9.1), **destino dos ativos sem empréstimo ativo** (§9.2), **eliminação** (§9.4) e **fim de jogo** (§9.5). Conecta a porta **`onInsolvency`** (hoje só sinaliza) ao fluxo de falência. **Não** cobre: **§9.3** (falência **com empréstimo ativo** — credor herda ativos e passivos) que depende da spec de **Empréstimos** (§15); o **cancelamento de imunidades** (§9.4) é **no-op** até as cartas de Imunidade (subsistema deferido do 006) existirem. Fonte de verdade: [`docs/SRS.md`](../../docs/SRS.md) §9.

## Clarifications

### Session 2026-05-23

- Q: Como a falência é acionada quando o jogador não cobre uma dívida obrigatória? → A: **Manual** — a cobrança que excede o caixa cria uma **pendência de dívida** que bloqueia o turno; o jogador usa os comandos existentes (vender construção / hipotecar) para levantar caixa e **paga**, ou **declara falência** se desistir/não conseguir.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Falir e transferir os ativos (Priority: P1)

Como jogador que **não consegue pagar** uma dívida obrigatória (aluguel, imposto, multa) — mesmo depois de vender todas as construções, hipotecar tudo e usar o caixa — eu **falo**. Meus ativos são destinados conforme a dívida: se eu devia ao **banco**, minhas propriedades (sem construções) vão a **leilão**; se eu devia a **outro jogador**, minhas propriedades (sem construções) e o caixa restante vão para o **credor**. Sou **eliminado** e meu token sai do tabuleiro.

**Why this priority**: É a consequência que faltava — sem falência, dívida impagável não tem desfecho (hoje só sinaliza). Fecha o ciclo econômico e dá sentido a "perder". MVP.

**Independent Test**: pôr um jogador em dívida maior que tudo que ele pode levantar (caixa + construções + hipotecas) e verificar que ele é eliminado e que os ativos vão ao destino certo (banco→leilão / jogador→credor).

**Acceptance Scenarios**:

1. **Given** um jogador com dívida ao **banco** maior que seu valor de liquidação total, **When** ele falir, **Then** as construções voltam ao banco, as propriedades (sem construção) ficam disponíveis (leilão do banco) e o jogador é eliminado.
2. **Given** um jogador com dívida a **outro jogador** maior que sua liquidação, **When** ele falir, **Then** as propriedades (sem construção) e o caixa restante vão ao **credor**, e o jogador é eliminado.
3. **Given** um jogador eliminado, **When** o turno avança, **Then** ele é **pulado** na ordem (já garantido pelo 002).
4. **Given** um jogador que **consegue** cobrir a dívida liquidando (vender/hipotecar), **When** a dívida é cobrada, **Then** ele **não** fale (a falência só ocorre quando a liquidação total é insuficiente).

---

### User Story 2 - Fim de jogo (Priority: P2)

Como jogadores, a partida **termina** quando resta apenas **1 jogador** não-eliminado com saldo positivo; ele é declarado **vencedor**.

**Why this priority**: É o estado terminal da partida. Depende de US1 (eliminações). Sem ele a partida não "acaba".

**Independent Test**: eliminar jogadores até sobrar um e verificar que a partida entra em estado de fim com o vencedor correto.

**Acceptance Scenarios**:

1. **Given** uma partida com 1 único jogador não-eliminado, **When** o último adversário fale, **Then** a partida entra em **fim de jogo** e esse jogador é o **vencedor**.
2. **Given** ainda há ≥2 jogadores não-eliminados, **When** um fale, **Then** a partida **continua** (não termina).

---

### Edge Cases

- **Liquidação suficiente:** se o jogador consegue cobrir a dívida vendendo construções + hipotecando + caixa, **não** há falência — ele paga (manual ou orientado) e segue.
- **Dívida ao banco com propriedades:** propriedades (sem construção) vão a leilão (§9.2); construções voltam ao banco antes.
- **Falência com empréstimo ativo:** **deferida** (§9.3 / spec Empréstimos) — fora desta feature.
- **Imunidades do eliminado:** canceladas (§9.4) — **no-op** até as cartas de Imunidade existirem.
- **Token do eliminado:** sai do tabuleiro (não renderizado); ele não joga mais.
- **Empate impossível por design:** o fim de jogo é com **1** sobrevivente; não há cenário de dois "vencedores".

## Requirements *(mandatory)*

### Functional Requirements

**Condição & detecção**

- **FR-001**: O sistema MUST determinar **insolvência** como: a dívida obrigatória excede o **valor de liquidação total** do jogador = caixa + (construções vendidas a metade) + (propriedades não-hipotecadas hipotecadas a metade do preço) (§9.1).
- **FR-002**: Uma cobrança obrigatória que **excede o caixa** MUST criar uma **pendência de dívida** (devedor, valor, credor) que **bloqueia** a finalização do turno até ser resolvida (substitui o `onInsolvency` no-op para aluguel/imposto).
- **FR-002b**: O jogador em dívida MUST poder **liquidar** (vender construções / hipotecar, pelos comandos de 004/005) e então **pagar** (`payDebt` — paga se o caixa cobrir, transfere ao credor e libera o turno); ou **declarar falência** (`declareBankruptcy`).

**Destino dos ativos (sem empréstimo ativo)**

- **FR-003**: Na falência, as **construções** do devedor MUST retornar ao banco (estoque), e o aluguel/posse passam a contar sem construção.
- **FR-004**: Se a dívida era com o **banco**, as **propriedades** (sem construção) do devedor MUST ir a **leilão** pelo banco (§9.2).
- **FR-005**: Se a dívida era com **outro jogador**, as **propriedades** (sem construção) e o **caixa restante** do devedor MUST ser transferidos ao **credor** (§9.2).

**Eliminação & fim**

- **FR-006**: O jogador falido MUST ser **eliminado** (`eliminated`), com o token removido do tabuleiro; ele é **pulado** na ordem de turno (já no 002).
- **FR-007**: As **imunidades** concedidas e recebidas pelo eliminado MUST ser canceladas (§9.4) — **no-op** até existirem cartas de Imunidade.
- **FR-008**: A partida MUST entrar em **fim de jogo** (`phase = 'ended'`) quando restar **1** jogador não-eliminado; esse jogador é o **vencedor** (§9.5).

### Key Entities

- **Valor de Liquidação** (derivado): caixa + metade do custo das construções + metade do preço das propriedades não-hipotecadas — o máximo que o jogador consegue levantar.
- **Resolução de Falência**: contexto da falência — devedor, **credor** (`'banco'` ou id do jogador) e o destino dos ativos.
- **Estado de Fim** (`phase`): `'playing' → 'ended'`; o vencedor é o único não-eliminado.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Um jogador cuja liquidação total **< dívida** é declarado falido e **eliminado**; quem **consegue** liquidar para cobrir **não** fale.
- **SC-002**: Falência devendo ao **banco** → construções ao banco e propriedades (sem construção) a leilão; devendo a **jogador** → propriedades + caixa restante ao **credor**.
- **SC-003**: O turno **pula** o eliminado (sem regressão no 002).
- **SC-004**: Quando resta **1** não-eliminado, a partida entra em **fim de jogo** com esse jogador como **vencedor**; com ≥2, **continua**.

## Assumptions

- **Gatilho da falência:** definido na clarificação — **manual** (pendência de dívida bloqueia o turno; jogador liquida e `payDebt`, ou `declareBankruptcy`).
- **Escopo do débito-pendente nesta versão:** **aluguel** e **imposto** (as cobranças obrigatórias mais comuns) roteiam pela pendência de dívida; multa de prisão e multas de carta seguem como débito direto (simplificação — valores menores).
- **Leilão dos bens (dívida ao banco):** reusa o leilão do 003; numa primeira versão pode simplificar para "propriedades retornam ao banco (livres)" se o leilão-em-cascata for custoso — a regra-alvo é o leilão (§9.2).
- **Empréstimos (§9.3) e Imunidades (§9.4):** deferidos (specs Empréstimos e subsistema de cartas) — credor herdar ativos+passivos e cancelamento de imunidade ficam fora/no-op.
- **Valor de liquidação** usa metade do custo de construção (004) e metade do preço para hipoteca (005), coerente com as regras de venda/hipoteca já implementadas.
- Feature de **discovery + implementação** na sequência do 007; segue o pipeline SDD com confirmação antes de `/speckit-plan` e `/speckit-implement`.
