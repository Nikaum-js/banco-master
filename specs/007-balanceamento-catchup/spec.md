# Feature Specification: Balanceamento — GO Progressivo & Free Parking

**Feature Branch**: `007-balanceamento-catchup`

**Created**: 2026-05-23

**Status**: Draft

**Input**: User description: "Mecânicas de Balanceamento (parte 1: catch-up) — GO Progressivo (bônus por ranking, creditado) e Free Parking (pote acumula imposto/multa/$50 prisão, coletado em Férias). Completa o fluxo de dinheiro das portas no-op do 002/003."

**Depende de**: [`001`](../001-tabuleiro-48-casas/spec.md) (GO/Férias/imposto) · [`002`](../002-fluxo-de-turno/spec.md) (movimento, passagem pelo GO, prisão, portas) · [`003`](../003-compra-aluguel/spec.md) (caixa) · [`006`](../006-sistema-cartas/spec.md) (`netWorth`, multas de carta ao centro)

> **Escopo desta spec:** duas mecânicas de **catch-up** (princípio IV — discretas, sem rótulo na UI) que hoje estão como **portas no-op**: **GO Progressivo** (§13.5 — bônus por ranking de patrimônio, **de fato creditado**) e **Free Parking** (§13.4 — pote central que acumula impostos, multas de carta e a multa de $50 da prisão, e é coletado ao parar em Férias). Também **completa o fluxo de dinheiro** que ficou incompleto: imposto e multa de prisão hoje **não debitam** o jogador (porta no-op) — passam a debitar e alimentar o pote. **Não** cobre: **Tax Man** (§13.8), **Hangar** (§13.6), **Skyscraper** (§13.7) e **2º hotel** (§14) — upgrades avançados, specs próprias; Speed Die (§13.2) e grupo parcial (§13.3) já estão implementados (002/004). Fonte de verdade: [`docs/SRS.md`](../../docs/SRS.md) §13.4, §13.5, §4.5, §4.10.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - GO Progressivo creditado por ranking (Priority: P1)

Como jogador, ao **passar por** ou **parar no** GO, recebo um bônus em dinheiro que escala **inversamente** com minha posição no ranking de **patrimônio líquido**: quem está em **último** (mais pobre) recebe mais ($400), quem está em **primeiro** (mais rico) recebe menos ($100). O bônus é **creditado ao meu caixa** — hoje passar pelo GO não dá nada (porta no-op).

**Why this priority**: É o catch-up mais visível e o principal buraco do demo atual (passar pelo GO não credita). Sem ele a economia não fecha. MVP.

**Independent Test**: com dois jogadores de patrimônios diferentes, fazer cada um passar pelo GO e verificar que o mais pobre recebe mais que o mais rico (e os valores nos extremos: $100 / $400).

**Acceptance Scenarios**:

1. **Given** o jogador em **último** no ranking de patrimônio, **When** passa pelo GO, **Then** recebe **$400** creditados no caixa.
2. **Given** o jogador em **primeiro**, **When** passa pelo GO, **Then** recebe **$100**.
3. **Given** um jogador no meio do ranking, **When** passa pelo GO, **Then** recebe um valor **entre** $100 e $400 conforme a posição.
4. **Given** um jogador que **para** exatamente no GO, **When** resolve, **Then** também recebe o bônus (passar **ou** parar).

---

### User Story 2 - Free Parking: pote do centro (Priority: P2)

Como jogador, existe um **pote** no centro do tabuleiro que **acumula** dinheiro ao longo da partida: impostos pagos, multas de cartas e a multa de $50 da prisão. Quando eu **paro em Férias** (índice 24), coleto **todo** o pote; ele então **reabastece** com $500. O pote começa a partida com **$500**.

**Why this priority**: Fecha o segundo catch-up e **completa o fluxo de dinheiro** — imposto e multa de prisão, que hoje nem saem do caixa, passam a debitar de verdade e alimentar o pote.

**Independent Test**: pagar um imposto e a multa de prisão e verificar que (a) o caixa do jogador diminui e (b) o pote aumenta no mesmo valor; depois parar em Férias e conferir que o pote inteiro vai para o caixa e reseta para $500.

**Acceptance Scenarios**:

1. **Given** o pote em $500, **When** um jogador paga $200 de imposto, **Then** o caixa dele cai $200 e o pote vai a $700.
2. **Given** um jogador paga a multa de $50 da prisão, **When** a multa é cobrada, **Then** o caixa cai $50 e o pote sobe $50.
3. **Given** o pote acumulado, **When** um jogador para em Férias, **Then** recebe **todo** o pote no caixa e o pote volta a **$500**.
4. **Given** uma multa de carta que "vai para o centro" (Honorários, Crise), **When** aplicada, **Then** alimenta o mesmo pote.

---

### Edge Cases

- **Passar e parar no GO na mesma jogada:** crédito **uma vez** por passagem (consistente com 002 FR-008).
- **Movimento por carta de teleporte direto:** não credita GO (002 FR-009) — esta feature não muda isso.
- **Empate de patrimônio:** ordem de ranking estável (por assento) — bônus determinístico.
- **Imposto/multa de prisão sem caixa suficiente:** o débito leva o jogador a insolvência → fluxo de **Falência** (deferido); aqui o débito é registrado/sinalizado.
- **Férias com pote = $500 (nada acumulado):** jogador coleta $500 e o pote volta a $500 (efetivamente troca; sem ganho líquido para o banco).
- **Catch-up discreto:** a UI mostra apenas o **valor recebido**, sem rótulo "porque você está perdendo" (princípio IV).

## Requirements *(mandatory)*

### Functional Requirements

**GO Progressivo**

- **FR-001**: Passar por **ou** parar no **GO** MUST creditar um bônus ao caixa do jogador (hoje a passagem é no-op).
- **FR-002**: O bônus MUST escalar **inversamente** com o ranking de **patrimônio líquido**: **$100** para o 1º (mais rico) … **$400** para o último (mais pobre), interpolando as posições intermediárias.
- **FR-003**: O **patrimônio líquido** MUST seguir a definição do 006: **caixa + preços das propriedades (hipotecada ÷2) + custos de construção** (reusa `netWorth`).
- **FR-004**: O crédito MUST ocorrer **uma vez por passagem** e **não** ocorrer em movimento por carta de teleporte direto (002 FR-008/FR-009 inalterados).

**Free Parking (pote do centro)**

- **FR-005**: MUST existir um **pote central** único, iniciado em **$500** no começo da partida.
- **FR-006**: Pagamento de **imposto** (casas de imposto, §4.5) MUST **debitar** o caixa do jogador e somar o valor ao pote.
- **FR-007**: A **multa de $50 da prisão** (pagar à entrada ou na 3ª tentativa) MUST **debitar** o caixa e somar ao pote.
- **FR-008**: Multas de **cartas** que vão "para o centro" (Honorários, Crise Imobiliária, Conserto) MUST alimentar o **mesmo** pote.
- **FR-009**: Parar em **Férias** (índice 24) MUST creditar **todo** o pote ao caixa do jogador e **reabastecer** o pote com **$500**.
- **FR-010**: Imposto e multa de prisão — hoje **porta no-op que não debita** — MUST passar a **debitar de fato** o caixa (correção do fluxo de dinheiro 002/003).

### Key Entities

- **Pote do Centro** (`centerPot`): valor único acumulado; inicia e reabastece em $500.
- **Ranking de Patrimônio** (derivado): ordenação dos jogadores ativos por `netWorth`; define a posição usada no GO Progressivo.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Passar/parar no GO credita: **último** lugar **+$400**, **primeiro** lugar **+$100**; meio entre os dois.
- **SC-002**: Pagar imposto **debita** o caixa e **aumenta o pote** no mesmo valor.
- **SC-003**: Pagar a multa de $50 da prisão **debita** o caixa e soma $50 ao pote.
- **SC-004**: Parar em **Férias** credita o **pote inteiro** ao jogador e reseta o pote para **$500**.
- **SC-005**: O bônus do GO usa o **patrimônio líquido** (caixa + ativos, hipotecada ÷2), não só o caixa.

## Assumptions

- **Curva do GO Progressivo:** interpolação **linear** por posição — `bônus = arredonda(100 + posição/(N−1) × 300)`, com posição 0 = mais rico ($100) e N−1 = mais pobre ($400). Os $150/$350 do SRS para 2º/penúltimo são pontos dessa escala; valores são **tunáveis** após playtesting (§13.5). (Candidato a `/speckit-clarify`.)
- **Empates de patrimônio:** desempate **estável por assento** (ordem de `turnOrder`), para um bônus determinístico.
- **Insolvência** (não conseguir pagar imposto/multa) é da spec **Falência**; aqui o débito é aplicado/sinalizado.
- **Tax Man, Hangar, Skyscraper, 2º hotel** ficam para uma spec de Balanceamento avançado.
- A mecânica é **catch-up discreto** (princípio IV): nenhum rótulo de "perdendo" na UI; só o valor.
- Feature de **discovery + implementação** na sequência do 006; segue o pipeline SDD com confirmação antes de `/speckit-plan` e `/speckit-implement`.
