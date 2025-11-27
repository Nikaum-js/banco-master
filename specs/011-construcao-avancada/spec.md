# Feature Specification: Construção avançada — 2º hotel, Hangar e Skyscraper

**Feature Branch**: `011-construcao-avancada`

**Created**: 2026-05-24

**Status**: Draft

**Input**: User description: "Balanceamento avançado — trio de construção: 2º hotel por propriedade (§14, escassez de estoque, não muda aluguel), Hangar em aeroporto (§13.6, dobra o aluguel daquele aeroporto), Skyscraper (§13.7, 4º nível acima do 2º hotel, exige grupo completo, aluguel fixo alto e triplica o aluguel do resto do grupo). Tax Man (§13.8) fica para a spec 012."

**Depende de**: [`003`](../003-compra-aluguel/spec.md) (caixa, títulos, aluguel de cidade/aeroporto) · [`004`](../004-construcao/spec.md) (casas/hotel, uniformidade, estoque do banco, `buildCost`, venda a metade) · [`005`](../005-hipoteca/spec.md) (hipoteca — Hangar segue o aeroporto) · [`007`](../007-balanceamento-catchup/spec.md) (contexto de balanceamento)

> **Escopo desta spec:** as três mecânicas de **construção** do balanceamento avançado — **2º hotel** (§14), **Hangar** de aeroporto (§13.6) e **Skyscraper** (§13.7). **Não** cobre o **Tax Man** (§13.8 — token de turno, spec 012 própria). Estende o ladder de construção do 004 (casas→hotel→2º hotel→skyscraper) e o aluguel do 003/004. Fonte de verdade: [`docs/SRS.md`](../../docs/SRS.md) §13.6, §13.7 e §14.

> **Valores de tema (provisórios):** seguindo o padrão do motor (004/`boardData`), os custos/aluguéis aqui são provisórios e substituíveis pelo tema sem mudar a regra — Hangar **$100** (SRS §13.6), 2º hotel = custo do 1º hotel (§14.3), Skyscraper = custo de construção provisório (≥ 2º hotel, §13.7) e aluguel fixo provisório (o maior da propriedade). Estoque global de Skyscrapers: limite provisório de tema.

## Clarifications

### Session 2026-05-24

- Q: Ao erguer o **Skyscraper** (§13.7 "substitui visualmente o 2º hotel, não é construção adicional sobreposta"), o que acontece com as construções da propriedade no estoque do banco? → A: **Marcador de topo; nada volta ao banco.** Erguer consome **1 Skyscraper** do estoque; as 4 casas + 2 hotéis seguem consumidos (travados). Vender devolve 1 Skyscraper e reverte ao 2º hotel, **sem** mexer no estoque de hotéis. Preserva a escassez (§14.4) e honra o "substitui visualmente" (a UI mostra o arranha-céu).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Segundo hotel por propriedade (Priority: P1)

Como dono que já tem **1 hotel** numa propriedade (e ≥1 hotel em todas as outras do grupo que possuo), eu construo um **2º hotel** na mesma propriedade, pagando o mesmo custo do 1º. Isso **não muda o aluguel** — o valor é a **escassez** que crio no estoque global de hotéis do banco, podendo travar adversários. Posso vendê-lo ao banco por metade, respeitando uniformidade.

**Why this priority**: é a base do ladder estendido (o Skyscraper exige 2º hotel) e a mais simples (sem mudança de aluguel). É pré-requisito do US3. MVP.

**Independent Test**: dar a um jogador um grupo com hotéis; construir o 2º hotel numa cidade; verificar débito do custo, consumo de 1 hotel do estoque, aluguel inalterado; vender e verificar devolução.

**Acceptance Scenarios**:

1. **Given** uma propriedade com 1 hotel e todas as outras do grupo (que o jogador possui) com ≥1 hotel, e estoque de hotéis ≥1, **When** o jogador constrói o 2º hotel, **Then** paga o custo do 1º hotel, `bank.hotels` cai 1, e a propriedade fica com 2º hotel.
2. **Given** uma propriedade com 2º hotel, **When** o aluguel é cobrado, **Then** é **igual** ao do 1º hotel (sem alteração, §14.4).
3. **Given** estoque de hotéis = 0, **When** o jogador tenta o 2º hotel, **Then** é **rejeitado** (sem efeito).
4. **Given** uma propriedade com 2º hotel, **When** o jogador vende, **Then** recebe metade do custo, `bank.hotels` sobe 1 e volta a ter 1 hotel (respeitando uniformidade).

---

### User Story 2 - Hangar em aeroporto (Priority: P2)

Como dono de um **aeroporto**, eu construo um **Hangar** nele por **$100** (provisório), o que **dobra o aluguel daquele aeroporto específico**. Não exige possuir vários aeroportos. O Hangar segue o aeroporto na hipoteca e na falência, e pode ser vendido ao banco por metade ($50).

**Why this priority**: vetor de progresso independente do gate de grupos (princípio V), isolado dos aeroportos. Autocontido.

**Independent Test**: dar um aeroporto a um jogador; construir o Hangar; verificar débito de $100 e aluguel dobrado naquele aeroporto; vender e verificar reembolso $50 e aluguel normal.

**Acceptance Scenarios**:

1. **Given** um aeroporto sem Hangar e dono com caixa ≥ $100, **When** o dono constrói o Hangar, **Then** paga $100 e o aeroporto passa a ter Hangar.
2. **Given** um aeroporto **com** Hangar, **When** um adversário para nele, **Then** o aluguel cobrado é o **dobro** do aluguel base daquele aeroporto (pela contagem de aeroportos do dono).
3. **Given** um aeroporto com Hangar, **When** o dono vende o Hangar, **Then** recebe **$50** e o aeroporto volta ao aluguel base.
4. **Given** um aeroporto que já tem Hangar, **When** tenta construir outro, **Then** é **rejeitado** (máx. 1 por aeroporto).
5. **Given** um aeroporto hipotecado, **When** um adversário para nele, **Then** **não** há aluguel (nem com Hangar) — hipoteca isenta (reuso 003/005).

---

### User Story 3 - Skyscraper (4º nível) (Priority: P3)

Como dono de um **grupo completo** com **4 casas + 1º hotel + 2º hotel em todas** as propriedades do grupo, eu ergo um **Skyscraper** numa propriedade (consumindo do estoque global de Skyscrapers do banco). O Skyscraper tem **aluguel fixo alto** (o maior da propriedade) e, enquanto ≥1 propriedade do grupo tiver Skyscraper, o aluguel das **outras** propriedades do grupo (sem Skyscraper) é **triplicado**. Vendo por metade, respeitando uniformidade.

**Why this priority**: topo do ladder, depende do 2º hotel (US1). Mais complexo (efeito de grupo). Entrega por último.

**Independent Test**: montar um grupo completo todo no nível 2º hotel; erguer Skyscraper numa cidade; verificar consumo de estoque, aluguel fixo na cidade com Skyscraper e aluguel triplicado nas demais do grupo; vender e reverter.

**Acceptance Scenarios**:

1. **Given** um jogador com **grupo completo** e todas as cidades no nível **2º hotel**, e estoque de Skyscraper ≥1, **When** ele ergue o Skyscraper numa cidade, **Then** a cidade passa a Skyscraper e o estoque de Skyscraper cai 1.
2. **Given** o jogador **não** possui o grupo completo (só maioria), **When** tenta o Skyscraper, **Then** é **rejeitado** (Skyscraper exige grupo completo, §13.7).
3. **Given** uma cidade com Skyscraper, **When** o aluguel é cobrado nela, **Then** é o **valor fixo** de Skyscraper (o maior da propriedade).
4. **Given** uma cidade **sem** Skyscraper num grupo onde **outra** cidade tem Skyscraper, **When** o aluguel é cobrado nela, **Then** é **triplicado**.
5. **Given** uma cidade com Skyscraper, **When** o dono vende, **Then** recebe metade do custo e a cidade volta ao 2º hotel (estoque de Skyscraper sobe 1).
6. **Given** alguma cidade do grupo **abaixo** do nível 2º hotel, **When** tenta o Skyscraper, **Then** é **rejeitado** (uniformidade: todas no 2º hotel).

---

### Edge Cases

- **Skyscraper e o destino das construções**: erguer consome só do estoque de Skyscrapers; as 4 casas + 2 hotéis seguem travados; vender devolve 1 Skyscraper e reverte ao 2º hotel (resolvido em Clarifications).
- **Hangar em aeroporto hipotecado**: construir exige aeroporto **não** hipotecado (reuso da regra de construção); um aeroporto já com Hangar pode ser hipotecado junto (§13.6) — sem aluguel enquanto hipotecado.
- **2º hotel e o desmonte forçado (§5.5)**: quando faltam casas no banco e um hotel precisa ser desmontado, o 2º hotel conta como nível acima do 1º — a venda/uniformidade segue o ladder estendido.
- **Estoque de Skyscraper esgotado**: erguer é rejeitado (como casas/hotéis em escassez).
- **Pausa** (princípio VII): construir/vender bloqueados enquanto pausado (reuso 004).

## Requirements *(mandatory)*

### Functional Requirements

#### Segundo hotel (§14)

- **FR-001**: O sistema MUST permitir construir um **2º hotel** numa propriedade que já tem 1 hotel, desde que **todas** as outras propriedades do grupo possuídas pelo jogador tenham ≥1 hotel (uniformidade estendida) e `bank.hotels ≥ 1`.
- **FR-002**: O 2º hotel MUST custar o mesmo que o 1º hotel da propriedade e **consumir 1** do estoque global de hotéis do banco.
- **FR-003**: O 2º hotel MUST NOT alterar o aluguel cobrado (igual ao 1º hotel, §14.4).
- **FR-004**: O 2º hotel MUST poder ser vendido ao banco por **metade** do custo, devolvendo 1 hotel ao estoque e respeitando uniformidade (vende do nível mais alto do grupo).

#### Hangar (§13.6)

- **FR-005**: O sistema MUST permitir ao dono de um **aeroporto não hipotecado** construir **1 Hangar** nele por **$100** (provisório de tema). Máx. 1 Hangar por aeroporto; não exige múltiplos aeroportos.
- **FR-006**: Um aeroporto com Hangar MUST cobrar o **dobro** do aluguel base daquele aeroporto (a base segue a contagem de aeroportos do dono, 003).
- **FR-007**: O Hangar MUST seguir o aeroporto na **hipoteca** (sem aluguel enquanto hipotecado) e na **falência** (vai com o aeroporto).
- **FR-008**: O Hangar MUST poder ser vendido ao banco por **metade** do custo ($50 provisório).

#### Skyscraper (§13.7)

- **FR-009**: O sistema MUST permitir erguer um **Skyscraper** numa cidade somente quando o jogador possui o **grupo completo**, **todas** as cidades do grupo estão no nível **2º hotel**, e há Skyscraper no estoque global do banco.
- **FR-010**: O Skyscraper MUST consumir 1 do estoque global de Skyscrapers e ter custo de construção provisório (≥ 2º hotel).
- **FR-011**: Uma cidade com Skyscraper MUST cobrar um **aluguel fixo** (provisório de tema, o maior da propriedade).
- **FR-012**: Enquanto ≥1 cidade do grupo tiver Skyscraper, o aluguel das demais cidades do grupo **sem** Skyscraper MUST ser **triplicado**.
- **FR-013**: O Skyscraper MUST poder ser vendido por **metade** do custo, revertendo a cidade ao nível 2º hotel e devolvendo 1 Skyscraper ao estoque, respeitando uniformidade.
- **FR-014**: Erguer o Skyscraper MUST consumir apenas 1 do estoque de Skyscrapers (as 4 casas + 2 hotéis permanecem consumidos); vendê-lo MUST devolver 1 Skyscraper ao estoque e reverter ao 2º hotel, **sem** alterar `bank.hotels` nem `bank.houses`.

#### Transversais

- **FR-015**: Todas as ações (2º hotel, Hangar, Skyscraper — construir/vender) MUST ser **puras** e bloqueadas enquanto a partida estiver **pausada** (princípio VII), reusando o gating de construção do 004.
- **FR-016**: O estado MUST permanecer **serializável** (novos campos são flags/contadores em `Title`/`bank`).

### Key Entities *(include if feature involves data)*

- **Title (estendido)**: além de `houses`/`hotel`/`mortgaged`, ganha `hotel2: boolean` (2º hotel), `skyscraper: boolean` (Skyscraper) e `hangar: boolean` (só relevante em aeroportos). Ladder de cidade: 0–4 casas → hotel → 2º hotel → Skyscraper.
- **BankStock (estendido)**: além de `houses`/`hotels`, ganha `skyscrapers: number` (limite global provisório de tema).
- **Aluguel**: cidade com Skyscraper = valor fixo; cidades sem Skyscraper no grupo com Skyscraper = ×3; aeroporto com Hangar = ×2 da base.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% das construções de 2º hotel válidas debitam o custo, consomem 1 hotel do estoque e **não** alteram o aluguel; inválidas (sem estoque, sem uniformidade) são rejeitadas sem efeito.
- **SC-002**: 100% dos aeroportos com Hangar cobram o **dobro** do aluguel base; venda devolve metade e zera o efeito.
- **SC-003**: 100% dos Skyscrapers erguidos exigem grupo completo + todas no 2º hotel + estoque; cidade com Skyscraper cobra o fixo; demais do grupo cobram ×3.
- **SC-004**: 100% das vendas (2º hotel, Hangar, Skyscraper) devolvem metade do custo e revertem o nível/estoque corretamente, respeitando uniformidade.
- **SC-005**: Nenhuma ação ultrapassa os estoques globais (hotéis/Skyscrapers) nem viola uniformidade em nenhum estado alcançável.

## Assumptions

- **Valores de tema provisórios** (consistente com 004/`boardData`): Hangar $100 (SRS), 2º hotel = custo do 1º hotel, Skyscraper custo = `buildCost` provisório, Skyscraper aluguel = multiplicador fixo provisório (maior que hotel), estoque global de Skyscrapers = limite provisório (definido no plan).
- **Ladder de construção** estende o do 004 (níveis 0–4, hotel, 2º hotel, Skyscraper) reusando uniformidade (constrói no menor nível, vende do maior).
- **Hangar é independente do ladder de cidade** (vive em aeroportos; campo `hangar` em `Title`).
- **Skyscraper exige grupo completo** (não só maioria) — diferente das casas (D-004), pois é luxo de topo, não o caminho-base de progresso (princípio V preservado).
- **2º hotel em grupo parcial** é permitido (basta todas as que o jogador possui terem hotel) — coerente com o 70% do 004; não muda aluguel de qualquer forma.
