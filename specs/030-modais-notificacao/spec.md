# Feature Specification: Modais informativos — Free Parking coletado & Aquisição Hostil sofrida (§12.2)

**Feature Branch**: `030-modais-notificacao`

**Created**: 2026-05-24

**Status**: Draft

**Input**: User description: "Fechar os 2 modais informativos que faltavam no M2 (§12.2): 'Free Parking coletado' e 'Aquisição Hostil sofrida', com o mínimo de hook de evento no motor."

## User Scenarios & Testing *(mandatory)*

São os dois últimos modais obrigatórios do §12.2 ainda sem UI. Ambos são **notificações** (não decisões): comunicam que algo aconteceu. Modelados como um **evento autônomo** no estado (`notice`), no mesmo padrão de `pendingTrade`/`houseAuction` — serializável (princípio VII), não bloqueia o turno, dispensado pela UI. Fecham 100% do §12.2.

### User Story 1 - Ver que coletei o Free Parking (Priority: P1) 🎯 MVP

Como jogador, ao **parar em Férias** e coletar o pote acumulado, vejo um modal confirmando quanto recebi.

**Why this priority**: É um dos dois modais que faltam para o §12.2 estar completo; o valor coletado é informação relevante (catch-up, D-006).

**Independent Test**: Com um pote acumulado, fazer o jogador coletar o Free Parking e verificar que o estado passa a ter uma notificação com o jogador e o valor coletado; dispensá-la limpa o estado.

**Acceptance Scenarios**:

1. **Given** há um pote acumulado e o jogador para em Férias, **When** o pote é coletado, **Then** o estado registra uma notificação "Free Parking coletado" com o jogador e o valor.
2. **Given** a notificação está ativa, **When** o jogador a dispensa, **Then** o estado volta a não ter notificação.

---

### User Story 2 - Ser notificado de uma Aquisição Hostil sofrida (Priority: P1)

Como jogador que **perdeu uma propriedade** por Aquisição Hostil, vejo um modal informando qual propriedade foi tomada e por quem.

**Why this priority**: É o outro modal que falta no §12.2. A perda de propriedade por carta ofensiva é impactante e hoje só aparece discretamente no log.

**Independent Test**: Aplicar uma Aquisição Hostil válida e verificar que o estado passa a ter uma notificação com a vítima, o atacante e a propriedade; dispensá-la limpa o estado.

**Acceptance Scenarios**:

1. **Given** uma Aquisição Hostil válida é aplicada, **When** a propriedade é transferida, **Then** o estado registra uma notificação "Aquisição Hostil sofrida" com vítima, atacante e propriedade.
2. **Given** a notificação está ativa, **When** é dispensada, **Then** o estado volta a não ter notificação.

---

### Edge Cases

- **Não bloqueia o turno**: a notificação é informativa; o turno pode prosseguir/finalizar com ela ativa (a UI a exibe sobreposta até dispensar).
- **Eventos em sequência**: se um novo evento ocorre antes de dispensar, a notificação mais recente substitui a anterior (informativo; sem fila).
- **Per-cliente no multiplayer (M3)**: a "Aquisição Hostil sofrida" é, conceitualmente, da vítima; no single-client é exibida na tela atual. O roteamento por destinatário fica para o M3 (não altera o dado).

## Requirements *(mandatory)*

- **FR-001**: Ao coletar o pote do Free Parking, o sistema MUST registrar uma notificação contendo o **jogador** e o **valor coletado**.
- **FR-002**: Ao aplicar uma Aquisição Hostil, o sistema MUST registrar uma notificação contendo a **vítima**, o **atacante** e a **propriedade**.
- **FR-003**: A interface MUST exibir a notificação ativa como um modal informativo, com botão de dispensar.
- **FR-004**: Dispensar a notificação MUST limpá-la do estado.
- **FR-005**: A notificação MUST ser parte **serializável** do estado (princípio VII) e **não** alterar o fluxo do turno (não bloqueia finalizar).
- **FR-006**: As notificações MUST ser deriváveis/aplicáveis de forma **pura** do estado, para teste sem interface.
- **FR-007**: O comportamento existente do Free Parking (coleta/reabastecimento) e da Aquisição Hostil (transferência/preço) MUST permanecer **inalterado** — só se acrescenta o registro da notificação.
- **FR-008**: Todo texto visível MUST estar em português (Brasil).

### Key Entities *(include if feature involves data)*

- **Notificação (`Notice`)** (novo, no `GameState`): um evento informativo ativo. Variantes: **Free Parking coletado** (jogador, valor) e **Aquisição Hostil sofrida** (vítima, atacante, propriedade). `null` = nenhuma.

## Success Criteria *(mandatory)*

- **SC-001**: 100% das coletas de Free Parking e das Aquisições Hostis aplicadas registram a notificação correspondente.
- **SC-002**: Dispensar limpa a notificação em 100% dos casos.
- **SC-003**: A suíte existente (Free Parking 007, Aquisição 016) segue verde — nenhuma regressão no comportamento.
- **SC-004**: O registro e a dispensa são cobertos por testes automatizados, sem interface.

## Assumptions

- **Evento autônomo, não resolução**: a notificação não bloqueia o turno (não usa `completeResolution`); vive como `pendingTrade`/`houseAuction`.
- **Sempre que coleta**: o pote tem semente (≥ $500), então a coleta sempre gera notificação ao parar em Férias.
- **Parte testável**: registro (na coleta / na aquisição) + dispensa; a aparência do modal é validada no `bun run dev`.

## Dependencies

- **007** (Free Parking / `collectCenter`), **016** (Aquisição Hostil / `acquire`), **022** (padrão de modal central — overlay), **020** (padrão de camada ao vivo).

## Out of Scope *(deferido)*

- Roteamento per-destinatário das notificações (M3 multiplayer).
- Fila de múltiplas notificações simultâneas (substituição basta no v1).
- Notificações para outros eventos (Despejo, Auditoria, Boicote) — fora do §12.2 obrigatório; o log já cobre.
