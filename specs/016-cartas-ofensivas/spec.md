# Feature Specification: Cartas ofensivas com alvo

**Feature Branch**: `016-cartas-ofensivas`

**Created**: 2026-05-24

**Status**: Draft

**Input**: User description: "Cartas ofensivas com alvo (006, deferidas): Aquisição Hostil (força venda de uma propriedade pelo preço original; 1,5× aeroporto/utilidade; alvo ≥2 não-hipotecadas; sem construção), Despejo (demole 1 casa de outro; dono não recebe), Auditoria Fiscal (alvo paga 10% do patrimônio ao pote). Reação (Diplomacia) fica para 017."

**Depende de**: [`003`](../003-compra-aluguel/spec.md) (títulos, caixa, preço) · [`004`](../004-construcao/spec.md) (casas) · [`005`](../005-hipoteca/spec.md) (transferência §6.3) · [`006`](../006-sistema-cartas/spec.md) (`playHandCard`, `netWorth`) · [`007`](../007-balanceamento-catchup/spec.md) (pote, `onPayToCenter`) · [`015`](../015-cartas-efeitos-temporarios/spec.md) (Imunidade Temporária — `isTempImmune`)

> **Escopo desta spec:** as **3 cartas ofensivas com alvo** hoje no-op (006) — **Aquisição Hostil** (§10.6), **Despejo** (§10.6), **Auditoria Fiscal** (§10.6). Jogadas no próprio turno com um **alvo** (propriedade ou jogador). **Não** cobre a **reação** (Diplomacia/Bunker — spec 017): até lá, o alvo **não pode recusar** (§10.6). Fonte de verdade: [`docs/SRS.md`](../../docs/SRS.md) §10.6 + [`docs/CARTAS.md`](../../docs/CARTAS.md).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Aquisição Hostil (Priority: P1)

Como jogador, no meu turno, eu jogo **Aquisição Hostil** mirando **uma propriedade de outro jogador** (sem construção, e cujo dono possua **≥2 propriedades não-hipotecadas**): ele é **obrigado a vendê-la** para mim pelo **preço original** (×**1,5** se aeroporto/utilidade). Não pode recusar (até a Diplomacia, 017). Não vale sobre propriedade sob **Imunidade Temporária** (015).

**Why this priority**: a carta mais impactante (destrava monopólios contra birra de negociação). MVP.

**Independent Test**: dar a um alvo ≥2 propriedades não-hipotecadas sem construção; jogar Aquisição numa delas; verificar transferência de posse + pagamento do preço ao alvo; rejeições (própria, com construção, alvo com <2 não-hipotecadas, imune, sem caixa).

**Acceptance Scenarios**:

1. **Given** o alvo tem ≥2 propriedades não-hipotecadas e a escolhida (cidade, sem construção) vale $200, **When** eu jogo Aquisição Hostil nela, **Then** ela passa a ser minha e eu **pago $200 ao alvo**.
2. **Given** a escolhida é **aeroporto/utilidade** de preço $200, **When** eu a adquiro, **Then** pago **$300** (1,5×) ao alvo.
3. **Given** a escolhida é **hipotecada**, **When** eu a adquiro, **Then** ela chega hipotecada e eu pago a **taxa de transferência de 10%** ao banco (§6.3), além do preço ao alvo.
4. **Given** a propriedade tem **construção** (casa/hotel/Hangar), ou é **minha**, ou o alvo tem **<2** propriedades não-hipotecadas, ou está sob **Imunidade Temporária**, ou eu **não tenho caixa**, **When** eu tento a Aquisição, **Then** é **rejeitada** (sem efeito).

---

### User Story 2 - Despejo (Priority: P2)

Como jogador, no meu turno, eu jogo **Despejo** numa **cidade com casa(s)** (não hotel) de outro jogador: **1 casa é demolida** e volta ao banco; o dono **não recebe nada**. Não afeta uniformidade.

**Why this priority**: ataque a investimento (derruba aluguel do líder). Autocontido.

**Independent Test**: dar a outro jogador uma cidade com casas; jogar Despejo; verificar −1 casa, +1 ao estoque do banco, dono não recebe; cidade sem casa / com hotel / própria / imune → rejeitado.

**Acceptance Scenarios**:

1. **Given** uma cidade de outro com 3 casas, **When** eu jogo Despejo nela, **Then** fica com **2 casas** e o banco recupera 1; o dono **não recebe nada**.
2. **Given** uma cidade **sem casas** ou **com hotel**, ou **própria**, ou sob **Imunidade Temporária**, **When** eu tento Despejo, **Then** é **rejeitado**.

---

### User Story 3 - Auditoria Fiscal (Priority: P3)

Como jogador, no meu turno, eu jogo **Auditoria Fiscal** escolhendo **um jogador**: ele paga **10% do patrimônio líquido** ao **pote do Free Parking**.

**Why this priority**: pune o líder e alimenta o pote (catch-up). Não mira propriedade (não há Imunidade Temporária aqui).

**Independent Test**: jogar Auditoria num alvo com patrimônio conhecido; verificar débito de 10% e crédito ao pote.

**Acceptance Scenarios**:

1. **Given** um alvo com patrimônio líquido $5.000, **When** eu jogo Auditoria nele, **Then** ele paga **$500** ao **pote** (Free Parking).
2. **Given** o alvo **não tem caixa** suficiente para os 10%, **When** a Auditoria é aplicada, **Then** ele paga **o que tem** (sem caixa negativo; sem falir nesta versão).
3. **Given** o alvo sou **eu mesmo**, **When** eu tento Auditoria, **Then** é **rejeitada**.

---

### Edge Cases

- **"Preço original"**: o motor não rastreia o preço pago por cada dono (compra/leilão) — usamos o **preço de tabela** da propriedade como preço original (documentado).
- **Aquisição de hipotecada**: chega hipotecada; o atacante paga o preço ao alvo **e** a taxa de 10% ao banco (§6.3).
- **Imunidade Temporária (015)** bloqueia Aquisição/Despejo (alvo = propriedade); **não** bloqueia Auditoria (alvo = jogador).
- **Alvo sem caixa na Auditoria**: paga o que tem (sem falir — falência cross-player fora do modelo, como no Tax Man).
- **Reação**: não há (Diplomacia em 017) — o alvo não pode recusar.
- **Pausa** (princípio VII): jogar (mão) bloqueado quando pausado (reusa `playHandCard`).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: **Aquisição Hostil** MUST exigir: alvo = propriedade de **outro** jogador, **sem construção** (cidade `cityLevel=0`; aeroporto sem Hangar), dono com **≥2 propriedades não-hipotecadas**, **não** sob Imunidade Temporária, e o atacante com caixa suficiente. Senão, **rejeitada**.
- **FR-002**: Ao aplicar Aquisição Hostil, o sistema MUST transferir a posse ao atacante e debitar dele o **preço** (= preço de tabela; **×1,5** se aeroporto/utilidade), creditando-o ao **dono** (compensação). Propriedade **hipotecada** chega hipotecada e cobra do atacante a **taxa de 10%** ao banco (§6.3).
- **FR-003**: **Despejo** MUST exigir: alvo = **cidade** de outro jogador com **≥1 casa** e **sem hotel**, não sob Imunidade Temporária. Efeito: **−1 casa** (volta ao estoque do banco); o dono **não recebe nada**. Não enforça uniformidade.
- **FR-004**: **Auditoria Fiscal** MUST exigir: alvo = **outro** jogador. Efeito: debita **10% do patrimônio líquido** (`netWorth`) do alvo, creditando ao **pote** (`onPayToCenter`). Se o alvo não tiver caixa, debita **o que houver** (sem negativo; sem falir nesta versão).
- **FR-005**: As 3 cartas são de **mão**, jogadas **no próprio turno** com **alvo** (propriedade para Aquisição/Despejo; jogador para Auditoria); inválido → no-op; consomem a carta (vai ao fundo do deck).
- **FR-006**: O alvo **NÃO pode recusar** (reação Diplomacia é spec 017).
- **FR-007**: As 3 cartas MUST sair do estado **deferido** para **implementado** no catálogo (006).
- **FR-008**: A lógica MUST ser **pura**/serializável (só muta posse/caixa/casas/estoque); sem estado novo no `GameState`.

### Key Entities *(include if feature involves data)*

- **Sem entidade nova.** As cartas mutam `Title.ownerId` / `Title.houses` / `Player.cash` / `bank.houses` / `centerPot` (existentes). O **alvo** é um parâmetro de `playHandCard` (posição para Aquisição/Despejo; `targetPlayer` para Auditoria).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% das Aquisições válidas transferem a posse e pagam o preço (×1,5 aeroporto/utilidade; +10% ao banco se hipotecada) ao dono; inválidas 100% rejeitadas.
- **SC-002**: 100% dos Despejos válidos removem 1 casa (ao banco) sem pagar o dono; alvos inválidos (sem casa/hotel/próprio/imune) 100% rejeitados.
- **SC-003**: 100% das Auditorias debitam 10% do patrimônio (ou o caixa disponível) ao pote.
- **SC-004**: Imunidade Temporária (015) bloqueia 100% das Aquisições/Despejos sobre a propriedade protegida; não bloqueia Auditoria.
- **SC-005**: As 3 cartas saem de no-op (catálogo `implementado`); estado sobrevive a round-trip JSON.

## Assumptions

- **"Preço original" = preço de tabela** (o motor não rastreia o preço pago por dono); documentado.
- **Auditoria sem caixa**: debita o que houver (sem falir) — consistente com o Tax Man (012).
- **Alvo via `playHandCard`**: estende com `target?` (posição: Aquisição/Despejo) e `targetPlayer?` (jogador: Auditoria). A UX de escolher alvo (modais §12.2) é M2.
- **Reação (Diplomacia/Bunker)** deferida ao 017 — até lá "não pode recusar".
- **Sem UI** nesta spec (consistente com 006/015 — jogar carta com modal é M2; o efeito aplica via comando do store).
