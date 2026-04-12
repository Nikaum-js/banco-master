# Feature Specification: Compra & Aluguel

**Feature Branch**: `003-compra-aluguel`

**Created**: 2026-05-23

**Status**: Draft

**Input**: User description: "Compra & Aluguel — compra de propriedade livre (modal/recusa→leilão), pagamento de aluguel com escalonamento por posse (cidade/aeroporto/utilidade). Implementa as portas resolveProperty/resolveRentable do Fluxo de Turno (002)."

**Depende de**: [`001-tabuleiro-48-casas`](../001-tabuleiro-48-casas/spec.md) (preços, grupos, aeroportos, utilidades) · [`002-fluxo-de-turno`](../002-fluxo-de-turno/spec.md) (resolução de casa por porta, valor da rolagem)

> **Escopo desta spec:** o que acontece ao parar numa propriedade — **comprar** uma propriedade livre (modal comprar/recusar), o **leilão** quando recusada, e o **pagamento de aluguel** a uma propriedade com dono, com o **escalonamento por posse** (cidade: base/150%/200% por fração do grupo; aeroporto: por quantidade; utilidade: múltiplo do valor dos dados). Esta feature introduz as primeiras entidades de **economia**: **título de propriedade** (quem é dono) e **caixa do jogador**. Ela **preenche as portas** `resolveProperty`/`resolveRentable` que o Fluxo de Turno (002) deixou como stub. **Não** cobre: construção de casas/hotéis e os **multiplicadores de aluguel por construção** (spec Construção), hipoteca e a mecânica de hipotecar/deshipotecar (spec Hipoteca — aqui só se **lê** o estado "hipotecada"), negociação, Hangar/Skyscraper, e a **insolvência** de quem não consegue pagar (spec Falência). Fonte de verdade: [`docs/SRS.md`](../../docs/SRS.md) §2.4, §2.5, §4.1, §4.2, §5.1, §7.

## Clarifications

### Session 2026-05-23

- Q: Como o leilão encerra? → A: Cronômetro curto reiniciado a cada lance; sem novo lance no tempo → encerra. (É timer de **leilão**, não de turno — D-015 veda só timer de turno, então não há conflito.)
- Q: Em grupos de 4, a partir de quantas cidades o aluguel é 150% (maioria sem construção)? → A: 3 de 4 (maioria) → 150%; 1-2 → base; 4 → 200% (espelha o limiar de monopólio parcial do §13.3).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Comprar uma propriedade livre (Priority: P1)

Como jogador, ao parar numa propriedade **sem dono** (cidade, aeroporto ou utilidade), vejo um **modal** com o nome, o tipo e o **preço**, e escolho **Comprar** (pago o preço ao banco e recebo o título) ou **Recusar**. Enquanto eu não decidir, o turno não finaliza.

**Why this priority**: Aquisição é a base da economia do jogo — sem título de propriedade não há aluguel, construção, hipoteca nem negociação. É o primeiro mecanismo que dá conteúdo ao turno (que hoje resolve a casa por stub). MVP.

**Independent Test**: parar numa propriedade livre, comprar, e verificar que o título passou ao jogador e o caixa foi debitado exatamente no preço; e que recusar não debita nada.

**Acceptance Scenarios**:

1. **Given** o jogador parou numa cidade livre de preço $200 e tem caixa suficiente, **When** escolhe Comprar, **Then** paga $200 ao banco, recebe o título, e a casa é considerada resolvida.
2. **Given** o jogador parou numa propriedade livre, **When** escolhe Recusar, **Then** a propriedade vai a leilão (US3) e o caixa do jogador não muda pela recusa.
3. **Given** o jogador parou numa propriedade livre cujo preço excede seu caixa, **When** o modal aparece, **Then** a opção Comprar fica indisponível (não se compra fiado) e resta Recusar → leilão.
4. **Given** o modal de compra está aberto, **When** o jogador ainda não decidiu, **Then** o turno **não** pode ser finalizado (resolução pendente, integra com FR-007/FR-022 do 002).

---

### User Story 2 - Pagar aluguel a uma propriedade com dono (Priority: P2)

Como jogador, ao parar numa propriedade de **outro** jogador (não hipotecada), pago o **aluguel** automaticamente ao dono, com valor que escala conforme a posse do dono: cidade (base / 150% se maioria do grupo / 200% se grupo completo), aeroporto (por quantidade) e utilidade (múltiplo do valor dos dados).

**Why this priority**: É o retorno do investimento — o que torna comprar valioso e cria a pressão econômica do jogo. Depende de já existir título (US1).

**Independent Test**: com propriedades atribuídas a um dono, parar nelas com outro jogador e conferir o aluguel cobrado em cada caso (cidade isolada, maioria, grupo completo; 1–4 aeroportos; 1–3 utilidades).

**Acceptance Scenarios**:

1. **Given** uma cidade de outro jogador que possui **só ela** do grupo, **When** paro nela, **Then** pago o aluguel **base**.
2. **Given** uma cidade cujo dono tem a **maioria** do grupo (2 de 3 / 3 de 4) sem construção, **When** paro nela, **Then** pago **150%** do base; com o **grupo completo**, **200%**.
3. **Given** um aeroporto cujo dono possui 3 aeroportos, **When** paro nele, **Then** pago **$100** ($25/$50/$100/$200 por 1/2/3/4).
4. **Given** uma utilidade cujo dono possui 2 utilidades e a rolagem que me trouxe somou 8, **When** paro nela, **Then** pago **80** (10× o valor dos dados; 4×/10×/20× por 1/2/3).
5. **Given** uma propriedade **hipotecada** de outro jogador, **When** paro nela, **Then** **não** pago aluguel.
6. **Given** uma propriedade **minha**, **When** paro nela, **Then** nenhuma cobrança.
7. **Given** o dono está **preso**, **When** paro na propriedade dele, **Then** ele ainda recebe o aluguel (consistente com 002 FR-020).

---

### User Story 3 - Leilão ao recusar a compra (Priority: P3)

Como jogador, quando alguém recusa comprar uma propriedade livre, ela vai a **leilão**: todos os jogadores (inclusive quem recusou) podem dar lances acima do atual; quem dá o maior lance paga ao banco e recebe o título. Se ninguém der lance, a propriedade continua com o banco.

**Why this priority**: Garante que propriedade recusada não fica congelada e cria uma decisão econômica coletiva. Refinamento sobre a compra (US1), por isso P3.

**Independent Test**: recusar uma compra, abrir o leilão entre todos, dar lances e confirmar que o vencedor paga o lance (não o preço de tabela) e recebe o título; e que um leilão sem lances devolve a propriedade ao banco.

**Acceptance Scenarios**:

1. **Given** uma propriedade recusada, **When** o leilão abre, **Then** todos os jogadores ativos podem licitar, inclusive quem recusou.
2. **Given** um leilão em curso, **When** um jogador dá um lance, **Then** o lance deve ser **maior** que o atual (lance mínimo inicial $1).
3. **Given** um leilão sem novo lance dentro do cronômetro (reiniciado a cada lance), **When** o tempo esgota, **Then** o maior licitante paga seu **lance** ao banco e recebe o título.
4. **Given** um leilão em que ninguém deu lance, **When** encerra, **Then** a propriedade permanece com o banco (livre).
5. **Given** um leilão aberto, **When** ele está em curso, **Then** o turno não finaliza até o leilão encerrar.

---

### Edge Cases

- **Sem caixa para comprar:** opção Comprar indisponível; só Recusar → leilão (não há compra fiada).
- **Leilão sem lances:** propriedade volta/permanece com o banco; turno segue.
- **Sem caixa para o aluguel obrigatório:** dispara o fluxo de **insolvência** (vender/hipotecar/negociar ou falir) — **deferido à spec Falência**; esta spec apenas sinaliza o débito devido.
- **Aluguel de utilidade após movimento especial:** usa o **valor dos dados** da rolagem que levou à casa, incluindo o Speed Die (002 FR-027) — vale para movimento normal, Ônibus e Mr. Banco Master.
- **Lance maior que o caixa do licitante:** um lance não pode exceder o caixa do licitante (não se licita fiado).
- **Dono preso:** recebe aluguel normalmente.
- **Propriedade própria / hipotecada:** sem cobrança.

## Requirements *(mandatory)*

### Functional Requirements

**Compra de propriedade livre**

- **FR-001**: Ao parar numa propriedade **sem dono** (cidade/aeroporto/utilidade), o sistema MUST apresentar um modal com nome, tipo e **preço**, e as opções **Comprar** e **Recusar**.
- **FR-002**: **Comprar** MUST debitar o preço do caixa do jogador, creditar o banco e transferir o **título** ao jogador.
- **FR-003**: **Recusar** MUST enviar a propriedade imediatamente a **leilão** (FR-012); a recusa em si não altera o caixa.
- **FR-004**: A opção **Comprar** MUST ficar indisponível se o caixa do jogador for menor que o preço (sem compra fiada); resta Recusar → leilão.
- **FR-005**: A casa só MUST ser considerada **resolvida** (liberando a finalização do turno — 002 FR-007/FR-022) após a compra **ou** o leilão concluírem.

**Aluguel — cidade**

- **FR-006**: Ao parar numa **cidade com dono diferente do jogador** e **não hipotecada**, o sistema MUST cobrar aluguel do jogador e creditar o dono.
- **FR-007**: O aluguel de cidade **sem construção** MUST escalar pela posse do dono no grupo: **base** (não-maioria), **150%** (maioria sem grupo completo: 2 de 3 / 3 de 4), **200%** (grupo completo). Os valores **com construção** são deferidos à spec Construção.

**Aluguel — aeroporto e utilidade**

- **FR-008**: O aluguel de **aeroporto** MUST ser **$25/$50/$100/$200** conforme o dono possui **1/2/3/4** aeroportos (§2.4).
- **FR-009**: O aluguel de **utilidade** MUST ser **4×/10×/20×** o **valor dos dados** da rolagem que levou o jogador à casa (incluindo o Speed Die, 002 FR-027) conforme o dono possui **1/2/3** utilidades (§2.5).

**Isenções**

- **FR-010**: Propriedade **hipotecada** MUST **não** cobrar aluguel (o estado de hipoteca é gerido pela spec Hipoteca; aqui apenas se lê).
- **FR-011**: Parar na **própria** propriedade MUST não gerar cobrança.

**Leilão**

- **FR-012**: Ao ser recusada, a propriedade MUST ir a leilão aberto a **todos os jogadores ativos** (inclusive quem recusou).
- **FR-013**: O **lance mínimo inicial** MUST ser $1 (ou o mínimo do tema); cada novo lance MUST ser **maior** que o atual e **não exceder** o caixa do licitante.
- **FR-014**: O leilão MUST encerrar quando **nenhum novo lance** for dado dentro de um **cronômetro curto** reiniciado a cada lance; o **maior licitante** paga o **lance** ao banco e recebe o título. (Timer de leilão, não de turno — não conflita com D-015.)
- **FR-015**: Se **ninguém** der lance, a propriedade MUST permanecer com o banco (livre).

**Economia e integração**

- **FR-016**: Todo pagamento (compra, aluguel, lance) MUST debitar o caixa do pagador e creditar o recebedor (banco ou dono). Se o pagador **não tem caixa** para um aluguel obrigatório, o sistema MUST acionar o fluxo de **insolvência** — **deferido à spec Falência** (esta spec apenas sinaliza o valor devido).
- **FR-017**: Estes comportamentos MUST implementar as portas de resolução de `property`/`airport`/`utility` do Fluxo de Turno (002): a casa fica **pendente** (bloqueia finalizar) até compra/leilão/aluguel concluírem.

### Key Entities

- **Título de Propriedade**: vínculo propriedade → dono (jogador ou **banco** = livre); inclui a flag **hipotecada** (lida; gerida pela spec Hipoteca). Base da posse.
- **Caixa do Jogador**: saldo em dinheiro; debitado/creditado por compra, aluguel e lances. Introduzido por esta feature.
- **Leilão**: propriedade em disputa, **lance atual**, **maior licitante**, e participantes ainda ativos. Existe só durante a resolução de uma recusa.
- **Contexto de Aluguel**: dados derivados para o cálculo — nº de propriedades do grupo possuídas pelo dono, nº de aeroportos/utilidades do dono, e o valor da rolagem (para utilidades).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Comprar uma propriedade livre transfere o título ao jogador e debita **exatamente o preço**; recusar não altera o caixa.
- **SC-002**: Recusar abre um leilão em que **todos** podem licitar; o vencedor paga **o lance** (não o preço de tabela) e recebe o título; leilão sem lances mantém a propriedade com o banco.
- **SC-003**: O aluguel de cidade sem construção é **base / 150% / 200%** para posse **não-maioria / maioria / grupo completo** — verificável montando cada caso.
- **SC-004**: O aluguel de aeroporto é **$25/$50/$100/$200** para **1/2/3/4** aeroportos do dono.
- **SC-005**: O aluguel de utilidade é **4×/10×/20×** o valor dos dados para **1/2/3** utilidades do dono.
- **SC-006**: Propriedade **hipotecada** ou **própria** não gera cobrança alguma.
- **SC-007**: O turno só libera o **Finalizar** após a compra, o leilão ou o aluguel concluírem (nenhuma casa de propriedade fica "meio-resolvida").

## Assumptions

- **Escalonamento de aluguel para grupos de 4:** definido na clarificação — maioria sem completar (2 de 3 / **3 de 4**) → 150%; espelha o §13.3.
- **Encerramento do leilão:** definido na clarificação — **cronômetro curto** reiniciado a cada lance (timer de leilão, não de turno; D-015 intacto). Duração concreta é tunável no plano/tema.
- **Lance mínimo/incremento:** lance inicial $1; cada lance apenas precisa ser **maior** que o atual (sem incremento fixo) e não exceder o caixa do licitante.
- **Caixa e título são introduzidos aqui** porque a compra/aluguel são o primeiro mecanismo que move dinheiro e cria posse; o **shape** desse estado vive nesta spec e é consumido pelas specs de Construção, Hipoteca, Negociação e Falência.
- **Insolvência (não conseguir pagar aluguel) é da spec Falência**; aqui o débito é apenas **sinalizado**.
- **Hipoteca** é da spec Hipoteca; esta spec só **lê** a flag "hipotecada" para isentar o aluguel (FR-010).
- **Construção** (casas/hotéis) e seus aluguéis são da spec Construção; aqui o aluguel cobre apenas o **escalonamento por posse** sem construção.
- **Income/Luxury Tax** não é desta spec — imposto é resolvido pelo turno (002, casa `tax` → centro), não é propriedade.
- Esta é uma feature de **discovery/design + implementação** na sequência do 002; segue o pipeline SDD com confirmação do usuário antes de `/speckit-plan` e `/speckit-implement`.
