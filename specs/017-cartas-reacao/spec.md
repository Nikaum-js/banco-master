# Feature Specification: Cartas de reação — Diplomacia e Bunker Fiscal

**Feature Branch**: `017-cartas-reacao`

**Created**: 2026-05-24

**Status**: Draft

**Input**: User description: "Cartas de reação (006, deferidas): Diplomacia (cancela uma carta ofensiva usada contra você — Aquisição Hostil, Despejo, Auditoria, Boicote — o atacante perde a carta) e Bunker Fiscal (cancela o próximo imposto que você pagaria). Subsistema de interrupção: quando o efeito está prestes a aplicar e o alvo tem a reação, abre uma decisão usar/não. Fecha o sistema de cartas."

**Depende de**: [`002`](../002-fluxo-de-turno/spec.md) (resolução do turno, imposto) · [`006`](../006-sistema-cartas/spec.md) (`playHandCard`, mão, decks) · [`007`](../007-balanceamento-catchup/spec.md) (pote/`onPayToCenter`) · [`015`](../015-cartas-efeitos-temporarios/spec.md) (Boicote) · [`016`](../016-cartas-ofensivas/spec.md) (Aquisição/Despejo/Auditoria)

> **Escopo desta spec:** as **2 cartas de reação** (últimas no-op do 006) — **Diplomacia** e **Bunker Fiscal** — e o **subsistema de interrupção** que as suporta. **Diplomacia** intercepta as 4 ofensivas (Aquisição Hostil, Despejo, Auditoria Fiscal — 016; Boicote — 015) quando o alvo a possui. **Bunker Fiscal** intercepta o pagamento de **imposto de casa** (Income/Luxury — casas `tax`) quando o pagador a possui. **Fora de escopo (deferido, documentado):** Bunker sobre "Auditoria Fiscal recebida" (a Diplomacia já cancela a Auditoria inteira) e o **timer de 10s** de auto-recusa (concern de UI/store — o motor modela a decisão explícita). Fonte: [`docs/SRS.md`](../../docs/SRS.md) §10.6/§12.4 + [`docs/CARTAS.md`](../../docs/CARTAS.md).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Diplomacia cancela uma ofensiva (Priority: P1)

Como **alvo** de uma carta ofensiva, se eu **tenho Diplomacia** na mão, o sistema **pausa** o efeito e me oferece reagir. Se eu **uso** Diplomacia, a ofensiva é **cancelada** (o atacante perde a carta dele) e nada me acontece. Se eu **recuso**, a ofensiva é **aplicada** normalmente.

**Why this priority**: a reação emblemática (bluff/defesa); fecha o ciclo ofensiva↔defesa. MVP.

**Independent Test**: dar Diplomacia ao alvo; o atacante joga Aquisição Hostil/Despejo/Auditoria/Boicote; verificar que abre a decisão; usar → ofensiva cancelada (sem efeito), ambas as cartas recicladas; recusar → ofensiva aplicada.

**Acceptance Scenarios**:

1. **Given** o atacante joga uma ofensiva contra um alvo que **tem Diplomacia**, **When** a carta é jogada, **Then** o efeito **não** é aplicado de imediato — abre uma **reação pendente** para o alvo (a carta ofensiva sai da mão do atacante, "em voo").
2. **Given** uma reação pendente, **When** o alvo **usa** Diplomacia, **Then** a ofensiva é **cancelada** (nenhum efeito), a Diplomacia e a ofensiva voltam ao fundo dos seus decks, e o turno segue.
3. **Given** uma reação pendente, **When** o alvo **recusa** (ou não tem como reagir), **Then** a ofensiva é **aplicada** (compra forçada/demolição/auditoria/boicote) e a carta ofensiva é reciclada.
4. **Given** um alvo **sem** Diplomacia, **When** a ofensiva é jogada, **Then** ela aplica **direto** (sem pausa) — comportamento de 015/016.

---

### User Story 2 - Bunker Fiscal cancela um imposto (Priority: P2)

Como jogador que **vai pagar um imposto de casa** (Income/Luxury), se eu **tenho Bunker Fiscal**, o sistema me oferece reagir. Se eu **uso** Bunker, **não pago** o imposto (Bunker reciclada). Se **recuso**, pago normalmente.

**Why this priority**: a defesa fiscal; usa o mesmo subsistema de interrupção. Depende dele (US1).

**Independent Test**: dar Bunker ao jogador; parar numa casa de imposto; verificar a oferta; usar → não paga; recusar → paga (ou abre dívida se não puder).

**Acceptance Scenarios**:

1. **Given** o jogador para numa casa de **imposto** e **tem Bunker**, **When** a casa resolve, **Then** abre uma **reação pendente** (em vez de cobrar).
2. **Given** uma reação de Bunker pendente, **When** ele **usa** Bunker, **Then** o imposto é **cancelado** (sem débito) e a Bunker é reciclada.
3. **Given** uma reação de Bunker pendente, **When** ele **recusa**, **Then** paga o imposto normalmente (ou abre **dívida** se não tiver caixa — 008).
4. **Given** um jogador **sem** Bunker, **When** para no imposto, **Then** cobra **direto** (comportamento 002/007).

---

### Edge Cases

- **Atacante perde a carta**: a ofensiva é reciclada (volta ao fundo do deck) **independentemente** de a Diplomacia ser usada (ela é "gasta" ao ser jogada).
- **Turno bloqueado**: a reação pendente é uma resolução que **bloqueia finalizar** até ser respondida (reusa o gating do turno). O respondente é o **alvo** (pode não ser o jogador da vez) — modelado pela decisão usar/não.
- **Bunker sobre Auditoria recebida**: **fora de escopo** — a Auditoria já pode ser cancelada inteira pela Diplomacia. Documentado.
- **Timer de 10s** (§12.4): **fora de escopo** (UI/store) — o motor modela a decisão explícita; "sem resposta = não usa" é auto-recusa de UI, deferida.
- **Pausa** (princípio VII): responder bloqueado quando pausado.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Ao jogar uma **ofensiva** (Aquisição Hostil/Despejo/Auditoria/Boicote) contra um alvo que **possui Diplomacia**, o sistema MUST **não** aplicar o efeito de imediato — MUST abrir uma **reação pendente** (`resolution`) destinada ao alvo, retirando a carta ofensiva da mão do atacante (em voo).
- **FR-002**: Numa reação de **Diplomacia**, **usar** MUST cancelar a ofensiva (nenhum efeito), reciclar a Diplomacia (mão do alvo) e a ofensiva (mão do atacante) aos fundos dos decks, e liberar o turno.
- **FR-003**: Numa reação de **Diplomacia**, **recusar** MUST aplicar a ofensiva (efeito de 015/016) e reciclar a carta ofensiva.
- **FR-004**: Sem Diplomacia no alvo, a ofensiva MUST aplicar **direto** (sem reação) — comportamento de 015/016 inalterado.
- **FR-005**: Ao resolver uma casa de **imposto** para um jogador que **possui Bunker Fiscal**, o sistema MUST abrir uma **reação pendente** de Bunker em vez de cobrar.
- **FR-006**: Numa reação de **Bunker**, **usar** MUST cancelar o imposto (sem débito) e reciclar a Bunker; **recusar** MUST cobrar o imposto normalmente (ou abrir **dívida** se faltar caixa, 008).
- **FR-007**: Sem Bunker, o imposto MUST ser cobrado **direto** (002/007 inalterado).
- **FR-008**: A reação pendente MUST **bloquear** finalizar o turno até ser respondida (reusa o gating de `resolution`).
- **FR-009**: As 2 cartas MUST sair de **deferido** para **implementado** (catálogo 006) — **completando o sistema de cartas** (zero no-op restante).
- **FR-010**: O subsistema MUST ser **puro**/serializável (variantes de `resolution` com os dados para aplicar/cancelar); sem timers no motor.

### Key Entities *(include if feature involves data)*

- **Reação pendente** (variantes de `ResolutionSlice`): `reaction-diplomacia` `{ reactorId, attackerId, effect, cardId, deck, targetPos|null, targetPlayer|null }` e `reaction-bunker` `{ reactorId, amount }`. Guardam o necessário para **aplicar** (recusa) ou **cancelar** (uso).
- **Comando** `respondReaction(use)`: resolve a reação pendente.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% das ofensivas contra alvo **com** Diplomacia abrem reação (não aplicam direto); 100% das contra alvo **sem** Diplomacia aplicam direto.
- **SC-002**: Usar Diplomacia cancela 100% das ofensivas (sem efeito) e recicla ambas as cartas; recusar aplica 100% o efeito.
- **SC-003**: Imposto com Bunker abre reação; usar cancela (sem débito); recusar cobra (ou dívida).
- **SC-004**: Após responder, o turno pode finalizar (reação não bloqueia mais).
- **SC-005**: As 2 cartas saem de no-op (catálogo `implementado`) — **0 cartas deferidas**; estado sobrevive a round-trip JSON.

## Assumptions

- **Interrupção via `resolution`**: a reação reusa o slot `resolution` (que já bloqueia finalizar); `respondReaction(use)` resolve. O respondente é o alvo; no demo local de 1 cliente, o comando é direto (roteamento por cliente é M3).
- **Ofensiva "em voo"**: ao abrir a reação, a carta ofensiva sai da mão do atacante e fica guardada na `resolution`; recicla ao resolver (qualquer ramo) — o atacante a perde sempre.
- **Bunker só em casas de imposto** (Income/Luxury): "Auditoria recebida" deferida (a Diplomacia cobre a Auditoria). Documentado.
- **Timer de 10s** (§12.4) deferido à UI (M2); o motor exige resposta explícita (`respondReaction`).
- **Sem UI** nesta spec além do HUD exibir a reação pendente; os modais de §12.2 são M2.
