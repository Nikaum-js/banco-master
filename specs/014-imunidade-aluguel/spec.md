# Feature Specification: Imunidade de aluguel (negociável)

**Feature Branch**: `014-imunidade-aluguel`

**Created**: 2026-05-24

**Status**: Draft

**Input**: User description: "Imunidade de aluguel (SRS §8.4 / D-010): como parte de uma troca, um jogador concede a outro imunidade de aluguel em uma ou mais de suas propriedades, por N voltas ou permanente. O beneficiário não paga aluguel ao parar naquela propriedade; é pessoal; não cancela a propriedade (o dono cobra dos outros); exibida no HUD."

**Depende de**: [`003`](../003-compra-aluguel/spec.md) (aluguel, títulos) · [`007`](../007-balanceamento-catchup/spec.md) / [`010`](../010-emprestimos/spec.md) (porta `afterPassGo` no GO) · [`013`](../013-negociacao-troca/spec.md) (`Trade`/`executeTrade` — a imunidade entra na troca)

> **Escopo desta spec:** **conceder** imunidade de aluguel dentro de uma troca (§8.4), a **isenção** de aluguel para o beneficiário, a **expiração por N voltas** (ou permanente) e a **exibição no HUD**. **Não** cobre a **transferência** de uma imunidade já existente para um novo beneficiário ("transferíveis em novas negociações" — caso avançado, deferido com nota). Fonte de verdade: [`docs/SRS.md`](../../docs/SRS.md) §8.4 / [D-010](../../docs/DECISIONS.md).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Conceder imunidade e não pagar aluguel (Priority: P1)

Como jogador, dentro de uma **troca**, eu concedo a outro jogador **imunidade de aluguel** em uma ou mais das **minhas** propriedades (por N voltas ou permanente). Enquanto a imunidade vigora, o **beneficiário não paga aluguel** ao parar naquela propriedade. A imunidade é **pessoal** (só para ele) e **não cancela** a propriedade — eu continuo cobrando dos outros.

**Why this priority**: é o coração da feature (§8.4 / D-010) e fecha a Negociação. MVP.

**Independent Test**: conceder imunidade a B em Paris (de A) numa troca; B para em Paris → não paga; C para em Paris → paga normalmente.

**Acceptance Scenarios**:

1. **Given** A concede a B imunidade em sua propriedade X (3 voltas) numa troca aceita, **When** a troca é processada, **Then** registra-se a imunidade `{ beneficiário: B, propriedade: X, voltas: 3 }`.
2. **Given** B tem imunidade ativa em X, **When** B para em X (de A), **Then** B **não paga** aluguel.
3. **Given** B tem imunidade em X, **When** **outro** jogador C para em X, **Then** C **paga** normalmente (imunidade é pessoal, não cancela a propriedade).
4. **Given** uma imunidade concedida sobre uma propriedade que **não** é do concedente (ou que ele está dando na mesma troca), **When** avaliada, **Then** a troca é **rejeitada** (só se concede imunidade sobre propriedade própria que se mantém).
5. **Given** uma imunidade **permanente**, **When** as voltas passam, **Then** ela **nunca** expira (até o fim do jogo).

---

### User Story 2 - A imunidade expira por voltas (Priority: P2)

Como **dono**, a imunidade que concedi por **N voltas** expira quando o **beneficiário** completa essas N voltas (passagens pelo GO). Após expirar, o beneficiário volta a pagar aluguel naquela propriedade.

**Why this priority**: dá o caráter temporal (§8.4) — sem expiração, "N voltas" não significa nada. Depende de US1.

**Independent Test**: conceder imunidade de 1 volta; passar o beneficiário pelo GO uma vez; verificar que a imunidade expirou e o aluguel volta a ser cobrado.

**Acceptance Scenarios**:

1. **Given** B tem imunidade em X por 2 voltas, **When** B passa pelo GO, **Then** restam **1 volta** de imunidade.
2. **Given** B tem imunidade em X por 1 volta, **When** B passa pelo GO, **Then** a imunidade **expira** (removida); B volta a pagar aluguel em X.
3. **Given** uma imunidade **permanente**, **When** B passa pelo GO, **Then** ela **permanece** (não decrementa).

---

### Edge Cases

- **Imunidade exibida a todos** (§8.4): HUD mostra as imunidades ativas (beneficiário → propriedade, voltas restantes).
- **Mudança de dono da propriedade**: a imunidade é de `(beneficiário, propriedade)` e **persiste** independentemente de quem é o dono (leitura literal de §8.4 — "não paga aluguel ao parar naquela propriedade"). Documentado em Assumptions.
- **Beneficiário dono da própria propriedade**: não paga aluguel de qualquer forma; imunidade é inócua aí.
- **Tax Man (012)**: cobra o **dono**, não um "que parou" — a imunidade (que isenta o beneficiário ao parar) **não** afeta o Tax Man.
- **Transferência de imunidade existente**: fora de escopo (deferida) — ver nota de escopo.
- **Pausa** (princípio VII): conceder (via troca) bloqueado quando pausado (já garantido pelo `executeTrade`).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST permitir, dentro de uma **troca** (`executeTrade`), que cada lado conceda imunidade ao **outro** sobre **uma ou mais de suas próprias** propriedades, por **N voltas** (inteiro > 0) **ou permanente**.
- **FR-002**: O sistema MUST validar que cada propriedade da imunidade é **possuída pelo concedente** e **não** está sendo cedida na mesma troca; senão a troca é **rejeitada** (atômica, junto com a validação do 013).
- **FR-003**: Ao processar, o sistema MUST registrar cada imunidade como `{ beneficiaryId, pos, lapsRemaining }` (`lapsRemaining = null` ⇒ permanente).
- **FR-004**: Quando um jogador com imunidade ativa naquela propriedade **para** nela, o sistema MUST **isentá-lo** do aluguel (sem débito, sem dívida).
- **FR-005**: A imunidade é **pessoal**: MUST NOT isentar nenhum outro jogador; o dono continua cobrando dos demais (a propriedade **não** é cancelada).
- **FR-006**: A imunidade por N voltas MUST **decrementar** 1 a cada passagem do **beneficiário** pelo GO e ser **removida** ao chegar a 0; a permanente (`lapsRemaining = null`) **não** decrementa.
- **FR-007**: As imunidades ativas MUST ser **visíveis** a todos (HUD), não são informação privada (≠ cartas).
- **FR-008**: O estado de imunidades MUST ser **serializável** (lista de `{beneficiaryId, pos, lapsRemaining}`); concessão e expiração são **puras**/determinísticas.
- **FR-009** *(fora de escopo, registrado)*: a **transferência** de uma imunidade existente para novo beneficiário (§8.4 "transferíveis") fica **deferida**.

### Key Entities *(include if feature involves data)*

- **Imunidade (Immunity)**: `{ beneficiaryId: string, pos: number, lapsRemaining: number | null }`. `null` = permanente. Nova lista `GameState.immunities`.
- **Concessão de imunidade (ImmunityGrant)**: componente da `Trade` (013) — `{ pos, laps: number | null }`, concedida pelo dono ao outro lado.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% das imunidades concedidas em trocas válidas (sobre propriedade própria mantida) são registradas; concessões inválidas rejeitam a troca inteira (atômico).
- **SC-002**: 100% das paradas do **beneficiário** numa propriedade com imunidade ativa resultam em **aluguel zero**; 100% das paradas de **outros** jogadores cobram normalmente.
- **SC-003**: 100% das imunidades por N voltas decrementam a cada GO do beneficiário e expiram em 0; permanentes nunca expiram.
- **SC-004**: O Tax Man (012) **não** é afetado por imunidades (cobra o dono normalmente).
- **SC-005**: O estado de imunidades sobrevive a round-trip JSON e é determinístico.

## Assumptions

- **Imunidade na troca**: concedida via `executeTrade` (013), estendendo a `Trade` com `fromImmunities`/`toImmunities` opcionais — espelha "como parte da troca" (§8.4). Concessão pura, atômica com o resto da troca.
- **Tied to (beneficiário, propriedade)**: a imunidade **persiste** mesmo que a propriedade mude de dono (leitura literal de §8.4). Revisitar se indesejado.
- **Volta = passagem pelo GO** do beneficiário (mesmo gancho `afterPassGo` do 010); decrementa após o bônus de GO.
- **Permanente** = `lapsRemaining: null` ("até o fim da partida").
- **Transferência de imunidade existente** (§8.4 "transferíveis"): **deferida** — caso avançado que exige um payload de re-atribuição; o núcleo (conceder/isentar/expirar) entrega o valor de D-010.
- **Sem UI de proposta** — a concessão entra pelo `executeTrade` (engine); o HUD apenas **exibe** as imunidades ativas (status, como empréstimos). A UX de montar a proposta é M2.
