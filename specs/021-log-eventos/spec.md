# Feature Specification: Log de eventos real (M2)

**Feature Branch**: `021-log-eventos`

**Created**: 2026-05-24

**Status**: Draft

**Input**: User description: "2ª fatia do M2: substituir o log MOCK por um event log real. O GameState ganha uma lista de eventos que os reducers-chave alimentam (rolagem, GO, compra, aluguel, imposto, dívida/falência, saque de carta); o painel Histórico mostra os eventos reais (mais recentes primeiro)."

**Depende de**: M1 (motor) · 020 (painéis ao vivo) · `boards/shared.tsx` (painel Histórico) · reducers de turno/economia/cartas/falência.

> **Escopo desta spec:** **event log do motor** — `GameState.log: LogEntry[]` + helper `logEvent`, emitido pelos reducers do **núcleo do turno** (rolagem, passagem pelo GO, compra, aluguel pago, imposto pago, pagar dívida, falência, saque de carta), e o painel **Histórico** consumindo o log real (mais recentes primeiro). **Não** cobre (futuras adições, triviais com o helper): construção/venda, hipoteca, negociação/troca, empréstimo, efeitos de carta detalhados, reação. Sem "when" (relógio) — motor é determinístico. Fonte: SRS §12.3 ("log de eventos — últimas ações").

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Histórico reflete as ações reais (Priority: P1)

Como jogador, o painel **Histórico** mostra o que **de fato** aconteceu (eu rolei 8, comprei Paris, paguei aluguel ao p2, passei pelo GO, faliu...), mais recentes primeiro — não mais texto fixo.

**Why this priority**: feedback do jogo; o painel já existe, só falta a fonte real. MVP.

**Independent Test**: rodar ações pelo motor (rolar/comprar/aluguel/imposto/falência/saque) e verificar que `game.log` recebe as entradas corretas; no `bun run dev`, o Histórico mostra os eventos reais.

**Acceptance Scenarios**:

1. **Given** um jogador rola os dados, **When** `rollDice` resolve, **Then** o log ganha "rolou X+Y" do jogador.
2. **Given** um jogador compra uma propriedade, **When** `buyProperty`, **Then** o log ganha "comprou {nome} por ${preço}".
3. **Given** um jogador paga aluguel, **When** o aluguel é cobrado, **Then** o log ganha "pagou ${valor} de aluguel a {dono}".
4. **Given** o jogador passa pelo GO, **When** o movimento cruza o GO, **Then** o log ganha "passou pelo GO (+${bônus})".
5. **Given** imposto pago / dívida paga / falência / saque de carta, **When** cada ação ocorre, **Then** o log ganha a entrada correspondente.
6. **Given** o painel Histórico, **When** renderiza, **Then** mostra as entradas do `game.log` **mais recentes primeiro**.

---

### Edge Cases

- **Privacidade de cartas (§10.3)**: o log de saque mostra só o **deck** ("sacou Acaso/Tesouro"), nunca a carta que foi para a mão.
- **Tamanho do log**: limitado às últimas N (ex.: 50) entradas para não crescer indefinidamente (serializável/leve).
- **Sem "when"**: motor determinístico não tem relógio; a recência é a ordem no log (render newest-first).
- **Eventos não cobertos** (construção/hipoteca/trade/loan/reação): adicionáveis depois com o mesmo helper — fora desta fatia.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O `GameState` MUST ter `log: LogEntry[]` (`{ who: string; what: string }`); seed `[]`.
- **FR-002**: Um helper `logEvent(state, who, what)` MUST anexar a entrada (puro; muta o clone) e **limitar** o log às últimas **50** entradas.
- **FR-003**: Os reducers do núcleo do turno MUST emitir eventos: **rolagem** (`rollDice`), **passagem pelo GO** (`advance`), **compra** (`buyProperty`), **aluguel pago** (`resolveRentable`), **imposto pago** (handler `tax`), **pagar dívida** e **falência** (`falencia`), **saque de carta** (`cardResolve` — só o deck, privacidade).
- **FR-004**: O painel **Histórico** MUST consumir `game.log` (mais recentes primeiro), substituindo o `MOCK_LOG`.
- **FR-005**: O log MUST ser **serializável**/determinístico (sem relógio; recência = ordem).
- **FR-006**: O log MUST NOT vazar carta privada (saque mostra só o deck).

### Key Entities *(include if feature involves data)*

- **LogEntry**: `{ who: string; what: string }` (sem timestamp). `who` = id do jogador (ou "Banco" para eventos de sistema). Nova lista `GameState.log` (bounded em 50).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% dos eventos do núcleo (rolagem/GO/compra/aluguel/imposto/dívida/falência/saque) aparecem no `game.log` com texto correto (verificável por teste).
- **SC-002**: O log nunca passa de 50 entradas.
- **SC-003**: O saque de carta nunca revela a carta (só o deck).
- **SC-004**: O painel Histórico mostra eventos reais newest-first; `bun run build` verde; suíte de motor verde (campo `log` novo não quebra asserções existentes).

## Assumptions

- **Cobertura curada** do núcleo do turno nesta fatia; demais eventos (construção/hipoteca/trade/loan/reação) ficam para adições futuras (one-liner com `logEvent`).
- **`who` = id** do jogador (nomes reais virão do Lobby — M3); "Banco" para sistema.
- **Sem "when"**: o painel deixa de exibir o tempo relativo (era MOCK); recência pela ordem.
- **Verificação visual** do painel pelo usuário no `bun run dev` (sem RTL); o emissor é coberto por testes de motor.
