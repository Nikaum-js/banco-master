# Feature Specification: Cartas — efeitos temporários de N voltas

**Feature Branch**: `015-cartas-efeitos-temporarios`

**Created**: 2026-05-24

**Status**: Draft

**Input**: User description: "Subsistema de efeitos temporários das cartas deferidas (006): Apagão (Hangares inativos 1 volta), Greve nas Utilidades (utilidades sem aluguel 1 volta), Boicote (propriedade de outro não cobra aluguel 2 voltas) e Imunidade Temporária (propriedade própria não pode ser alvo de ofensivas 2 voltas). Ofensivas com alvo (016) e reação (017) ficam para depois."

**Depende de**: [`003`](../003-compra-aluguel/spec.md) (aluguel) · [`006`](../006-sistema-cartas/spec.md) (decks, saque, mão, `applyEffect`/`playHandCard`) · [`007`](../007-balanceamento-catchup/spec.md) / [`010`](../010-emprestimos/spec.md) (porta `afterPassGo` no GO) · [`011`](../011-construcao-avancada/spec.md) (Hangar) · [`012`](../012-tax-man/spec.md) (Tax Man lê aluguel) · [`014`](../014-imunidade-aluguel/spec.md) (precedente de efeito temporal por volta)

> **Escopo desta spec:** as **4 cartas de efeito temporário de N voltas** hoje no-op no 006 — **Apagão** (§10.6), **Greve nas Utilidades** (§10.6), **Boicote** (§10.6) e **Imunidade Temporária** (§10.6). Cria o subsistema de **efeitos temporários** (registro + expiração por volta). **Não** cobre as **ofensivas com alvo** (Aquisição Hostil/Despejo/Auditoria — spec 016) nem a **reação** (Diplomacia/Bunker — spec 017). Fonte de verdade: [`docs/SRS.md`](../../docs/SRS.md) §10.6 + [`docs/CARTAS.md`](../../docs/CARTAS.md).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Efeitos imediatos no tabuleiro: Apagão e Greve (Priority: P1)

Como jogador que **saca** Apagão ou Greve nas Utilidades (cartas **imediatas**), o efeito é aplicado na hora e dura **1 volta** (do jogador que sacou): **Apagão** deixa todos os Hangares inativos (aeroportos voltam ao aluguel base, sem a dobra); **Greve** faz as utilidades **não cobrarem aluguel**.

**Why this priority**: imediatas e board-wide, são a base do subsistema temporário (registro + expiração). MVP.

**Independent Test**: sacar Apagão → aeroporto com Hangar cobra base (sem ×2) enquanto ativo; sacar Greve → utilidade cobra $0; após o sacador passar pelo GO, o efeito expira.

**Acceptance Scenarios**:

1. **Given** um Apagão ativo, **When** alguém para num aeroporto com Hangar, **Then** o aluguel é o **base** (sem a dobra do Hangar).
2. **Given** uma Greve ativa, **When** alguém para numa utilidade, **Then** o aluguel é **$0**.
3. **Given** Apagão/Greve ativo, **When** o jogador que sacou **passa pelo GO**, **Then** o efeito **expira** (1 volta) e o aluguel volta ao normal.

---

### User Story 2 - Boicote: propriedade não cobra aluguel (Priority: P2)

Como jogador, no **meu turno**, eu jogo **Boicote** escolhendo **uma propriedade de outro jogador**: por **2 voltas**, ela **não cobra aluguel** de ninguém que parar nela. Não posso boicotar uma propriedade sob **Imunidade Temporária**.

**Why this priority**: efeito temporário **por propriedade** (não board-wide); carta de mão com alvo. Depende do subsistema (US1).

**Independent Test**: jogar Boicote em propriedade alheia → quem parar não paga; após 2 voltas do que jogou, expira; alvo sob Imunidade Temporária → rejeitado.

**Acceptance Scenarios**:

1. **Given** Boicote ativo na propriedade X (de outro jogador), **When** qualquer jogador para em X, **Then** **não paga** aluguel.
2. **Given** Boicote jogado, **When** o jogador que o jogou passa pelo GO **2 vezes**, **Then** o Boicote **expira**.
3. **Given** um alvo **próprio** ou **sem dono** ou sob **Imunidade Temporária**, **When** o Boicote é jogado, **Then** é **rejeitado** (alvo inválido).

---

### User Story 3 - Imunidade Temporária: propriedade não-alvo (Priority: P3)

Como jogador, no meu turno, eu jogo **Imunidade Temporária** escolhendo **uma propriedade minha**: por **2 voltas**, ela **não pode ser alvo** de Aquisição Hostil, Despejo ou Boicote.

**Why this priority**: a proteção (defensiva) que pareia com Boicote (e com as ofensivas do 016). Depende do subsistema.

**Independent Test**: jogar Imunidade Temporária em propriedade própria; tentar Boicote nela → rejeitado; após 2 voltas, a proteção expira.

**Acceptance Scenarios**:

1. **Given** Imunidade Temporária ativa em X (própria), **When** alguém tenta **Boicote** em X, **Then** é **rejeitado**.
2. **Given** Imunidade Temporária jogada, **When** o jogador passa pelo GO 2 vezes, **Then** a proteção **expira** (e X volta a ser alvo possível).
3. **Given** um alvo que **não** é do jogador, **When** Imunidade Temporária é jogada, **Then** é **rejeitada**.

---

### Edge Cases

- **Volta = passagem pelo GO** do jogador que jogou/sacou a carta ("voltas completas do tabuleiro", §10.6) — mesmo gancho do 014.
- **Tax Man (012)**: ao parar numa propriedade boicotada/utilidade em greve/aeroporto sob apagão, a cobrança do Fiscal segue as **mesmas** regras (boicote → não cobra; greve → utilidade $0; apagão → sem dobra) para consistência.
- **Efeitos ativos visíveis a todos** (§12.3): HUD mostra Apagão/Greve/Boicotes/Imunidades Temporárias ativos.
- **Imunidade Temporária ≠ Imunidade de aluguel (014)**: a do 014 isenta o **beneficiário** do aluguel; esta (carta) impede que a propriedade seja **alvo** de ofensivas. São listas distintas.
- **Pausa** (princípio VII): jogar Boicote/Imunidade (mão) bloqueado quando pausado (reusa `playHandCard`).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Ao **sacar Apagão** (imediato), o sistema MUST registrar um efeito temporário "apagão" por **1 volta** (do sacador); enquanto ativo, aeroportos com Hangar cobram o aluguel **base** (sem ×2).
- **FR-002**: Ao **sacar Greve** (imediato), o sistema MUST registrar um efeito "greve" por **1 volta**; enquanto ativo, **utilidades** cobram **$0**.
- **FR-003**: O jogador MUST poder jogar **Boicote** (mão, próprio turno) escolhendo **propriedade de outro jogador** não sob Imunidade Temporária → registra efeito "boicote" naquela propriedade por **2 voltas**; enquanto ativo, **ninguém paga** aluguel ao parar nela. Alvo inválido (própria/sem dono/imune) → rejeitado.
- **FR-004**: O jogador MUST poder jogar **Imunidade Temporária** (mão, próprio turno) escolhendo **propriedade sua** → registra efeito "imunidade-temp" por **2 voltas**; enquanto ativo, a propriedade **não pode ser alvo** de ofensivas (no 015: Boicote; 016 adicionará Aquisição/Despejo). Alvo não-próprio → rejeitado.
- **FR-005**: Cada efeito temporário MUST **decrementar** 1 a cada passagem do **jogador que o originou** pelo GO e ser **removido** ao chegar a 0.
- **FR-006**: A cobrança do **Tax Man** (012) sobre propriedade afetada MUST respeitar os mesmos efeitos (boicote → sem cobrança; greve → utilidade $0; apagão → aeroporto sem dobra).
- **FR-007**: Os efeitos temporários ativos MUST ser **visíveis** a todos (HUD, §12.3).
- **FR-008**: O subsistema MUST ser **puro**/serializável; o registro é uma lista em `GameState` (`tempEffects`), independente da `immunities` (014).
- **FR-009**: As 4 cartas MUST sair do estado **deferido** (no catálogo 006) para **implementado**.

### Key Entities *(include if feature involves data)*

- **TempEffect**: `{ kind: 'apagao' | 'greve' | 'boicote' | 'imunidade-temp'; ownerId: string; pos: number | null; lapsRemaining: number }`. `pos` = propriedade (boicote/imunidade-temp) ou `null` (board-wide). `ownerId` = quem originou (clock da expiração). Nova lista `GameState.tempEffects`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Apagão ativo → 100% dos aeroportos com Hangar cobram base; Greve ativa → 100% das utilidades cobram $0.
- **SC-002**: Boicote ativo → 100% das paradas na propriedade boicotada cobram $0; alvos inválidos (próprio/sem dono/imune) 100% rejeitados.
- **SC-003**: Imunidade Temporária ativa → 100% das tentativas de Boicote naquela propriedade são rejeitadas.
- **SC-004**: 100% dos efeitos expiram após N voltas (passagens pelo GO do originador) — Apagão/Greve em 1, Boicote/Imunidade em 2.
- **SC-005**: O Tax Man respeita os efeitos (boicote/greve/apagão) em 100% dos casos; estado sobrevive a round-trip JSON.

## Assumptions

- **Volta = GO do originador**: cada efeito tem `ownerId` (quem jogou/sacou) e decrementa quando esse jogador passa pelo GO (consistente com §10.6 "voltas completas do tabuleiro" e o 014). Para Apagão/Greve (board-wide), o originador é o **sacador**.
- **Apagão/Greve são imediatos** (aplicados no saque, via `applyEffect` do 006); **Boicote/Imunidade** são de **mão**, jogados no próprio turno com um **alvo** (parâmetro de `playHandCard`).
- **Boicote vale para qualquer propriedade** (cidade/aeroporto/utilidade) de outro jogador; **Imunidade Temporária** sobre propriedade própria.
- **Imunidade Temporária (carta)** registra proteção de **alvo** (≠ imunidade de aluguel do 014). No 015 ela só bloqueia **Boicote**; Aquisição/Despejo passam a checá-la no 016.
- **Sem UI de jogar carta** (consistente com 006/M2): o HUD apenas **exibe** os efeitos ativos; a escolha de alvo (Boicote/Imunidade) entra via comando do store (UX de jogar a carta é M2).
- **Tax Man consistente**: incluir as checagens no `taxMan.ts` (012) é correção de consistência, não regra nova.
