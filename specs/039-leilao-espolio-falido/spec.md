# Feature Specification: Leilão do espólio do falido-ao-banco

**Feature Branch**: `main` (fluxo sem branch por feature)

**Created**: 2026-07-25

**Status**: Draft

**Input**: User description: "Leilão do espólio do falido-ao-banco: quando um jogador falir devendo ao banco (sem empréstimo ativo e sem credor-jogador), suas propriedades vão a pregão simultâneo em vez de voltarem de graça ao banco — cada propriedade é um lote com cronômetro próprio, licitantes são os não-eliminados, vencedor paga ao banco, lote sem lance fica livre. Reusa o slot `GameState.landAuction` com discriminador `origin` ('scarcity' | 'bankruptcy'); espólio que nasce com pregão de escassez aberto injeta os lotes no pregão em curso. Operacionaliza SRS §9.2 conforme D-031."

**Depende de**: spec 008 (falência & fim de jogo), spec 031 (pregão de escassez de terrenos), spec 037/038 (multiplayer — é o que dá licitantes de verdade)

**Regra de origem**: SRS §7.1, §7.2, §7.3 e §9.2 (v1.6) · [D-031](../../docs/adr/D-031-espolio-do-falido-vai-a-pregao-simultaneo.md) · reusa o formato da [D-023](../../docs/adr/D-023-leilao-de-escassez-de-terrenos-pregao-simultaneo.md)

---

## Por que esta spec existe

O SRS §9.2 sempre disse que as propriedades de quem falisse devendo **ao banco** vão **a leilão pelo banco**. A spec 008 implementou o resto do §9 e deixou este pedaço de fora: hoje as propriedades simplesmente perdem o dono e voltam **de graça** ao banco. É a **última regra do SRS sem implementação** — ficou para o M3 porque leilão precisa de licitantes, e licitantes só existem com vários jogadores.

O efeito da lacuna não é cosmético. Quem falir devendo ao banco hoje **destrói valor**: um portfólio construído ao longo da partida vira estoque morto que ninguém paga por, e os sobreviventes só voltam a acessá-lo por sorte de dado. Com o espólio em pregão, a falência **redistribui** — o dinheiro sai dos sobreviventes, volta ao banco, e as propriedades voltam à mesa por preço de mercado.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - O espólio vai a leilão em vez de evaporar (Priority: P1) 🎯 MVP

Um jogador não consegue pagar uma dívida ao banco nem liquidando tudo, e declara falência. Em vez de suas propriedades sumirem para o banco, elas aparecem imediatamente num pregão: cada propriedade é um lote, e os jogadores que continuam na partida disputam por elas.

**Why this priority**: é a regra do SRS. Sem isso, nada nesta spec tem valor — e com isso sozinho, o §9.2 está cumprido e o SRS não tem mais lacuna de regra.

**Independent Test**: montar um estado com um jogador insolvente devendo ao banco e propriedades no nome dele; declarar falência; verificar que existe um pregão aberto com exatamente as propriedades dele como lotes, e que nenhuma delas ficou sem dono direto.

**Acceptance Scenarios**:

1. **Given** um jogador com 3 propriedades, insolvente, com dívida cujo credor é **o banco** e **sem empréstimo ativo**, **When** ele declara falência, **Then** abre-se um pregão com exatamente essas 3 propriedades como lotes, e cada lote tem lance atual zerado e nenhum licitante líder.
2. **Given** o mesmo jogador, **When** ele declara falência, **Then** ele é eliminado, seu caixa é zerado e a vez passa normalmente — o pregão **não** bloqueia o turno de ninguém.
3. **Given** um jogador insolvente cuja dívida tem **credor jogador**, **When** ele declara falência, **Then** as propriedades vão **direto ao credor** e **nenhum** pregão abre (§9.2, linha do credor-jogador).
4. **Given** um jogador insolvente **com empréstimo ativo** e dívida ao banco, **When** ele declara falência, **Then** o credor do empréstimo herda tudo e **nenhum** pregão abre (§9.3 precede §9.2).
5. **Given** um espólio em pregão, **When** um jogador não-eliminado dá o maior lance num lote e o prazo daquele lote expira, **Then** ele paga o lance **ao banco**, recebe a escritura, e o lote sai do pregão.
6. **Given** um lote do espólio cujo prazo expira **sem nenhum lance**, **When** o prazo zera, **Then** a propriedade fica **livre** (sem dono), voltando ao fluxo normal de cair-e-comprar (§7.2).

---

### User Story 2 - O espólio entra no pregão que já está aberto (Priority: P2)

Um jogador falir no meio de um pregão de escassez de terrenos já em andamento. As propriedades do espólio entram como lotes novos no mesmo pregão, cada um com seu próprio prazo a partir daquele momento, em vez de abrir um segundo leilão ou ficar numa fila invisível.

**Why this priority**: é a única colisão de estado que a feature introduz, e ela é alcançável na prática — a escassez dispara no fim de jogo, exatamente quando falências acontecem. Sem tratar isso, o espólio se perderia ou sobrescreveria o pregão em curso.

**Independent Test**: abrir um pregão de escassez, depois provocar uma falência-ao-banco, e verificar que o pregão passou a ter os lotes dos dois lados, com os prazos originais dos lotes de escassez preservados.

**Acceptance Scenarios**:

1. **Given** um pregão de escassez aberto com 2 lotes, **When** um jogador falir ao banco com 3 propriedades, **Then** o pregão passa a ter 5 lotes.
2. **Given** o cenário acima, **When** os lotes do espólio entram, **Then** os prazos dos 2 lotes de escassez **não mudam** — só os lotes novos recebem prazo a partir de agora.
3. **Given** o cenário acima, **When** os lotes entram, **Then** a lista de licitantes é atualizada para os não-eliminados, ou seja, o recém-falido **deixa** de ser licitante inclusive nos lotes de escassez que já estavam abertos.

---

### User Story 3 - A mesa entende o que está sendo leiloado (Priority: P3)

Ao abrir, o pregão diz de onde os lotes vieram: escassez de terrenos ou espólio de um jogador que faliu (com o nome dele). Quem está licitando sabe se está disputando terreno virgem ou o patrimônio de quem acabou de sair.

**Why this priority**: sem isso a regra funciona, mas o jogador vê um leilão surgir do nada no meio do turno de outra pessoa. É informação, não mecânica — daí P3.

**Independent Test**: abrir cada tipo de pregão e verificar que a superfície de leilão nomeia a origem correta, e que o espólio nomeia o falido pela identidade da sala (não por `p1..pN`).

**Acceptance Scenarios**:

1. **Given** um pregão de origem escassez, **When** ele aparece, **Then** ele se identifica como leilão de escassez de terrenos.
2. **Given** um pregão de origem espólio, **When** ele aparece, **Then** ele se identifica como espólio e nomeia o falido pelo nome da sala (FR-009 da 038), com fallback quando não há sala.
3. **Given** um pregão que começou como escassez e recebeu lotes de espólio, **When** ele aparece, **Then** ele indica que contém as duas origens em vez de mentir sobre uma só.

---

### Edge Cases

- **Espólio vazio**: o falido não tinha propriedade nenhuma. Nenhum pregão abre (a guarda "nunca pregão vazio" da 031 vale igual), e o resto da falência corre normal.
- **Sem licitante possível**: a falência deixa **1 só** jogador não-eliminado — a partida já terminou (§9.5). Nenhum pregão abre; leiloar para uma pessoa só não é leilão, e o fim de jogo tem precedência.
- **Licitante líder falir antes do fecho**: o pregão roda em paralelo ao turno, então quem liderava um lote pode ter sido eliminado no meio. O lote não vai para um eliminado — comportamento já existente na 031, e agora alcançável por uma segunda via.
- **Caixa do líder caiu entre o lance e o fecho**: a solvência é checada **no lance**; se outra ação reduziu o caixa, ele paga o que houver em vez de ficar negativo — comportamento já existente na 031.
- **Propriedade hipotecada no espólio**: vai a leilão **mantendo** a hipoteca; o vencedor recebe a escritura hipotecada e decide deshipotecar depois (§5).
- **Aeroporto com Hangar no espólio**: o Hangar acompanha o aeroporto ao vencedor, como já acompanha o herdeiro na §9.3 (§13.6).
- **Construções**: são desfeitas **antes** do leilão (§9.2 diz "propriedades sem construções"), como já acontece hoje na herança.
- **Espólio derrubaria a contagem de terrenos livres**: se nenhum lote do espólio receber lance, todos ficam livres e a contagem de terrenos sem dono **sobe** — o que pode re-armar o episódio da escassez. O espólio **não** consome o episódio da escassez.
- **Falência durante o pregão do próprio espólio**: um segundo jogador falir ao banco enquanto o primeiro espólio ainda está em pregão. Os lotes do segundo entram no mesmo pregão (mesma regra da US2).

---

## Requirements *(mandatory)*

### Functional Requirements

**Gatilho e escopo do espólio**

- **FR-001**: O sistema MUST levar as propriedades de um jogador que declarou falência a leilão quando, e somente quando, **não houver herdeiro** — isto é, sem empréstimo ativo (§9.3) **e** com a dívida-gatilho devida ao banco (§9.2).
- **FR-002**: O sistema MUST manter o comportamento atual quando houver herdeiro: propriedades e caixa vão ao credor, sem leilão.
- **FR-003**: O espólio MUST conter apenas as propriedades que estavam no nome do falido no momento da falência, com as construções já desfeitas (§9.2).
- **FR-004**: O espólio MUST NOT incluir o caixa do falido — o dinheiro de quem devia ao banco continua sendo destruído, como hoje (D-031 não altera isso).
- **FR-005**: O sistema MUST NOT abrir pregão quando o espólio estiver vazio.
- **FR-006**: O sistema MUST NOT abrir pregão quando restar menos de 2 jogadores não-eliminados após a eliminação — o fim de jogo (§9.5) tem precedência.

**Formato do pregão (herdado de §7.3 / D-023)**

- **FR-007**: Cada propriedade do espólio MUST ser um lote independente, com lance atual, licitante líder e **prazo próprio**.
- **FR-008**: Um lance num lote MUST reiniciar apenas o prazo **daquele** lote.
- **FR-009**: Cada lote MUST fechar sozinho quando o seu prazo expirar, independentemente dos demais.
- **FR-010**: Ao fechar um lote com licitante, o vencedor MUST pagar o lance **ao banco** e receber a escritura.
- **FR-011**: Ao fechar um lote **sem** licitante, a propriedade MUST ficar livre (sem dono).
- **FR-012**: Os licitantes MUST ser os jogadores não-eliminados; o falido MUST NOT ser licitante do próprio espólio.
- **FR-013**: A trava de solvência MUST valer igual: a soma dos lances em que um jogador é líder não pode exceder seu caixa.
- **FR-014**: Abrir ou fechar o pregão do espólio MUST NOT alterar a vez — é evento autônomo, e a falência segue passando o turno.

**Convivência com o pregão de escassez**

- **FR-015**: Quando um espólio nascer com um pregão **já aberto**, os lotes do espólio MUST ser acrescentados ao pregão em curso.
- **FR-016**: A injeção de lotes MUST NOT alterar os prazos dos lotes que já estavam no pregão.
- **FR-017**: A injeção de lotes MUST atualizar a lista de licitantes para os não-eliminados, removendo o recém-falido de todos os lotes.
- **FR-018**: O espólio MUST NOT consumir o episódio do pregão de escassez — um espólio não pode impedir que a escassez dispare depois.
- **FR-019**: Um lote MUST NOT ser leiloado duas vezes: propriedade que já é lote no pregão em curso não entra de novo pelo espólio.

**Apresentação**

- **FR-020**: O pregão MUST declarar sua origem: escassez de terrenos, espólio de falência, ou ambas quando tiver lotes das duas.
- **FR-021**: Um pregão de espólio MUST nomear o falido pela identidade da sala, com fallback quando não houver sala (mesma regra da 038).

**Multiplayer**

- **FR-022**: A abertura e o fecho do pregão do espólio MUST convergir em todos os clientes — o resultado não pode depender de qual cliente processou o quê.
- **FR-023**: O lance no espólio MUST estar preso ao assento local, como já está no pregão de escassez (FR-002 da 038).

### Key Entities

- **Espólio**: conjunto de propriedades de um jogador que faliu devendo ao banco. Não é entidade persistida — nasce no instante da falência e se dissolve em lotes.
- **Pregão**: leilão simultâneo de vários lotes, cada um com prazo próprio. Entidade **já existente** (spec 031); esta spec lhe acrescenta o atributo **origem** e a capacidade de **receber lotes** depois de aberto.
- **Origem do pregão**: de onde os lotes vieram — escassez de terrenos, espólio de falência, ou ambas. Serve à apresentação (FR-020) e é o que distingue duas mecânicas que compartilham o mesmo mecanismo.
- **Lote**: uma propriedade em disputa, com lance atual, licitante líder e prazo. Entidade **já existente**, inalterada por esta spec — é o ponto do reuso.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% das falências sem herdeiro em que o falido tinha ao menos 1 propriedade e restam ≥2 jogadores resultam em pregão contendo exatamente aquelas propriedades. Nenhuma propriedade de espólio perde o dono sem passar por leilão.
- **SC-002**: O espólio inteiro é resolvido dentro de **uma** janela de prazo, não de uma por propriedade: um espólio de 8 propriedades fecha no mesmo tempo que um de 1.
- **SC-003**: Falência **com** herdeiro (credor-jogador ou credor de empréstimo) continua sem abrir leilão em 100% dos casos — a spec não muda §9.3 nem a linha do credor-jogador de §9.2.
- **SC-004**: Nenhuma regra do motor fora da falência muda: a suíte existente do motor continua verde sem asserção reescrita, exceto as que afirmavam explicitamente que o espólio voltava sem dono ao banco.
- **SC-005**: Um espólio que nasce com pregão aberto produz um pregão com a soma dos lotes, e os prazos dos lotes preexistentes ficam idênticos aos de antes da injeção.
- **SC-006**: Em partida de 3+ clientes, o estado após abertura e fecho do pregão do espólio é idêntico byte a byte entre todos os clientes.
- **SC-007**: O oráculo independente de conservação de dinheiro continua fechando: o valor que sai do caixa dos vencedores é exatamente a soma dos lances arrematados, e o caixa destruído do falido continua sendo contabilizado como sink legítimo.
- **SC-008**: O lote de espólio sem lance fica livre, e a contagem de terrenos livres resultante é capaz de re-armar o episódio da escassez.

## Assumptions

- **O formato já foi decidido** em D-031 (pregão simultâneo reusando §7.3, lotes injetados no pregão em curso). Esta spec operacionaliza a decisão, não a reabre.
- **A janela de prazo por lote é a mesma** do pregão de escassez (tunável no tema, padrão 8s). Não há knob separado para espólio — um espólio não é mais nem menos urgente que um terreno virgem.
- **O lance mínimo é o mesmo** de §7.2 ($1 / mínimo do tema). O espólio não tem preço de reserva: propriedade caríssima pode sair por $1 se ninguém cobrir, e isso é consequência aceita da regra ("sem lance fica livre" é o único piso).
- **Hipoteca e Hangar acompanham** a propriedade ao vencedor, como já acompanham o herdeiro na §9.3.
- **A UI reusa a camada de pregão existente** (spec 031) — esta spec não pede tela nova, só que a superfície existente declare a origem.
- **Não há histórico de espólio**: quem arrematou o quê aparece no log de eventos como qualquer arremate, sem painel próprio.
- O motor permanece **puro e serializável** (constitution: reducers `(state, ctx) → state`), e a origem do pregão é dado serializável — a convergência multiplayer depende disso.
