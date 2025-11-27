# Feature Specification: Negociação — troca de propriedades e caixa

**Feature Branch**: `013-negociacao-troca`

**Created**: 2026-05-24

**Status**: Draft

**Input**: User description: "Negociação (SRS §8 / D-010): troca entre dois jogadores de propriedades (incl. hipotecadas) + dinheiro, a qualquer momento. Construções, cartas e Bus Tickets NÃO são negociáveis. Imunidade de aluguel (§8.4) fica para a spec 014."

**Depende de**: [`003`](../003-compra-aluguel/spec.md) (títulos, caixa) · [`004`](../004-construcao/spec.md) (construção bloqueia troca da propriedade) · [`005`](../005-hipoteca/spec.md) (transferência de propriedade hipotecada: taxa de 10%, `transferKeepFee`) · [`006`](../006-sistema-cartas/spec.md) / [`010`](../010-emprestimos/spec.md) (cartas/Bus Tickets/empréstimos **não**-negociáveis)

> **Escopo desta spec:** o **núcleo da negociação** (§8.1–§8.3) — **trocar propriedades (incl. hipotecadas) + dinheiro** entre dois jogadores, a qualquer momento. **Não** cobre a **imunidade de aluguel** (§8.4 / D-010 — efeito temporal de N voltas, **spec 014 própria**). Construções, **cartas** e **Bus Tickets** são **não-negociáveis** (§8.2, D-011/D-012). Fonte de verdade: [`docs/SRS.md`](../../docs/SRS.md) §8.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Trocar propriedades e dinheiro (Priority: P1)

Como jogador, eu proponho a outro jogador uma **troca**: de cada lado, qualquer combinação de **propriedades** (incluindo hipotecadas) e **dinheiro**. Se o destinatário **aceita**, a troca é **processada automaticamente** — as propriedades trocam de dono e o caixa é transferido. Pode acontecer **a qualquer momento**, inclusive fora do meu turno.

**Why this priority**: é o núcleo social do jogo e a maior regra de motor pendente. MVP.

**Independent Test**: dar propriedades/caixa a dois jogadores; executar uma troca acordada e verificar que donos e caixas mudaram corretamente; trocas inválidas (não possui, construção, sem caixa) são rejeitadas.

**Acceptance Scenarios**:

1. **Given** A oferece a propriedade X + $100 e B oferece a propriedade Y, **When** a troca é executada (acordo aceito), **Then** X passa a ser de B, Y passa a ser de A, e $100 vão de A para B.
2. **Given** uma troca onde um lado oferece **só dinheiro** ou **só propriedade** (presente unilateral), **When** executada, **Then** é processada normalmente (qualquer combinação é válida, §8.2).
3. **Given** A tenta oferecer uma propriedade que **não possui** (ou de B), **When** a troca é avaliada, **Then** é **rejeitada** (sem efeito).
4. **Given** uma propriedade (cidade) **com construção** na proposta, **When** avaliada, **Then** é **rejeitada** (construções não são negociáveis; vender ao banco antes, §8.2).
5. **Given** um lado oferece **mais dinheiro do que tem** (ou ficaria com caixa negativo após taxas), **When** avaliada, **Then** é **rejeitada**.
6. **Given** a troca acontece **fora do turno** do proponente, **When** executada, **Then** é processada normalmente (§8.1) — não depende de quem é o jogador da vez.

---

### User Story 2 - Transferir propriedade hipotecada (Priority: P2)

Como jogador que **recebe** uma propriedade **hipotecada** numa troca, eu pago ao banco a **taxa de transferência de 10%** do valor da hipoteca (mantendo-a hipotecada, §6.3). A propriedade chega hipotecada; posso deshipotecá-la depois pelo comando normal.

**Why this priority**: regra do SRS §6.3 que incide na troca; reusa o 005. Secundária ao núcleo.

**Independent Test**: trocar uma propriedade hipotecada e verificar que o recebedor é debitado de 10% do valor da hipoteca (ao banco) e que a propriedade chega com `mortgaged=true`.

**Acceptance Scenarios**:

1. **Given** A transfere a B uma propriedade **hipotecada** numa troca, **When** processada, **Then** B paga ao banco **10%** do valor da hipoteca (`transferKeepFee`) e a propriedade fica de B, ainda **hipotecada**.
2. **Given** B **não tem caixa** para a taxa de transferência (somada ao que oferece), **When** avaliada, **Then** a troca é **rejeitada** (sem efeito).

---

### Edge Cases

- **Cartas / Bus Tickets / empréstimos**: **não** entram em proposta (§8.2, D-011/D-012) — não fazem parte do payload da troca.
- **Aeroporto com Hangar**: o Hangar **acompanha** o aeroporto na troca (como na falência, §13.6) — aeroporto com Hangar é negociável; o Hangar transfere junto.
- **Propriedade com construção**: bloqueia a troca daquela propriedade (vender ao banco antes).
- **Presente unilateral**: um lado pode oferecer nada (qualquer combinação, §8.2).
- **Pausa** (princípio VII): troca bloqueada enquanto a partida estiver pausada.
- **Contraproposta**: o §8.3 não tem contra-oferta formal — recusar descarta; o recusado pode propor uma nova (papéis invertidos). Modelado como nova troca.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST permitir executar uma **troca acordada** entre **dois jogadores distintos** (não eliminados), de cada lado uma combinação de **propriedades** e **dinheiro** (≥ 0). Não depende de quem é o jogador da vez (§8.1).
- **FR-002**: O sistema MUST validar que cada lado **possui** as propriedades que oferece e tem **caixa** suficiente para o dinheiro que oferece **e** para as taxas de transferência que lhe cabem; senão a troca é **rejeitada** (atômica, sem efeito).
- **FR-003**: O sistema MUST **rejeitar** trocas que incluam uma **cidade com construção** (casas/hotel/2º hotel/Skyscraper) — construções não são negociáveis (§8.2).
- **FR-004**: O sistema MUST NOT aceitar **cartas**, **Bus Tickets** ou **empréstimos** numa proposta (não-negociáveis; não fazem parte do payload).
- **FR-005**: Ao processar, o sistema MUST transferir a **posse** das propriedades de cada lado para o outro e transferir o **dinheiro** acordado.
- **FR-006**: Propriedades **hipotecadas** trocadas MUST permanecer hipotecadas e o **recebedor** MUST pagar ao banco a **taxa de 10%** do valor da hipoteca (`transferKeepFee`, §6.3).
- **FR-007**: Um **aeroporto com Hangar** trocado MUST transferir com o **Hangar** (acompanha o aeroporto, §13.6).
- **FR-008**: A troca MUST ser **atômica**: ou tudo é aplicado, ou nada (rejeição = estado inalterado).
- **FR-009**: A troca MUST ser bloqueada enquanto a partida estiver **pausada** (princípio VII).
- **FR-010**: O estado resultante MUST permanecer **serializável** (apenas mudança de `ownerId`/`cash`; nenhum estado novo).

### Key Entities *(include if feature involves data)*

- **Proposta de troca (transitória)**: `{ fromId, toId, fromProps: number[], fromCash: number, toProps: number[], toCash: number }` — a oferta acordada a ser processada. Não persiste no `GameState` (a UX de propor/aceitar/recusar é da UI/multiplayer; o motor processa o acordo).
- **Título / Caixa** (003): a troca muta `Title.ownerId` e `Player.cash`. Sem campos novos.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% das trocas válidas transferem posse das propriedades e o dinheiro acordado corretamente entre os dois lados.
- **SC-002**: 100% das trocas inválidas (não possui, cidade com construção, caixa insuficiente, mesmo jogador, eliminado, pausado) são **rejeitadas sem efeito** (atômicas).
- **SC-003**: 100% das propriedades hipotecadas trocadas chegam **hipotecadas** e cobram do recebedor a **taxa de 10%** ao banco.
- **SC-004**: 100% dos aeroportos com Hangar trocados transferem o Hangar junto.
- **SC-005**: Cartas/Bus Tickets/empréstimos **nunca** mudam de mão por troca.

## Assumptions

- **`executeTrade` = acordo já aceito**: o motor processa a troca acordada (como `grantLoan` no 010). A UX de propor → aceitar/recusar → contraproposta é da **UI/multiplayer** (M2/M3); recusar = não chamar o comando.
- **Hipoteca mantida na transferência**: a propriedade chega hipotecada com taxa de 10% (`transferKeepFee`, §6.3); o recebedor pode deshipotecar depois pelo comando do 005. (Não há, no momento da troca, opção de quitar embutida.)
- **Validação atômica de caixa** inclui as taxas de transferência: cada lado deve terminar com caixa ≥ 0; senão a troca toda é rejeitada.
- **Aeroporto com Hangar é negociável** e o Hangar acompanha (coerente com §13.6 na falência). Cidades com construção, não.
- **Sem UI** nesta spec (consistente com 004/011 — construção/negócio não estão no HUD mínimo; trade UI é M2).
- **Imunidade de aluguel (§8.4/D-010)**: fora de escopo — spec **014** (efeito temporal de N voltas).
