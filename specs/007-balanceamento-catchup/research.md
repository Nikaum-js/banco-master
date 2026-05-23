# Research — Balanceamento: GO Progressivo & Free Parking (Fase 0)

Decisões técnicas. Completa o fluxo de dinheiro que estava como porta no-op.

---

## D1 — `centerPot` no `GameState`

- **Decisão:** adicionar `GameState.centerPot: number` (semente $500). O pote é estado de jogo (coletável, serializável).
- **Rationale:** precisa persistir/acumular entre turnos e ser coletado em Férias; um número no estado é o suficiente.
- **Alternativas:** manter só na porta (callback) — rejeitada: porta é stateless, não acumula.

## D2 — Portas ganham `state` (sem 002 → 007)

- **Decisão:** `onPassGo`/`onPayToCenter`/`onCollectCenter` passam a receber `state` como 1º argumento e **mutam o clone**. O **store** injeta as implementações de balanceamento. O 002 continua **sem importar** o 007.
- **Rationale:** mantém a fronteira (o 002 credita/roteia sem conhecer a fórmula); o balanceamento vive só no `balancing.ts` + nas portas do store.
- **Alternativas:** 002 importar `goBonus`/pote — rejeitada: dependência retroativa (feature antiga → nova).

## D3 — GO creditado no `advance` (que ganha `state`)

- **Decisão:** `advance(state, player, steps, ports)` credita `player.cash += ports.onPassGo(state, player.id)` ao cruzar/parar no GO. `onPassGo` (porta) retorna o bônus.
- **Rationale:** `advance` é o único ponto que sabe que cruzou o GO; passar `state` permite a porta computar o ranking.
- **Alternativas:** creditar fora do `advance` — rejeitada: duplicaria a detecção de passagem.

## D4 — `goBonus` linear $100→$400 por ranking de patrimônio

- **Decisão:** `goBonus(state, playerId) = arredonda(100 + posição/(N−1) × 300)`, posição 0 = mais rico ($100), N−1 = mais pobre ($400); ranking por `netWorth` (006); **desempate estável por assento** (`turnOrder`). N=1 → $100.
- **Rationale:** extremos batem com o SRS ($100/$400); curva tunável (§13.5). Determinístico.
- **Alternativas:** degraus literais do SRS ($150/$350 nos 2º/penúltimo) — viável depois (tunável); linear é mais simples e suficiente agora.

## D5 — Completar o débito (imposto + multa de prisão)

- **Decisão:** corrige FR-010 — o handler de `tax` (resolution) passa a **debitar** o jogador e somar ao pote; `jailDecision` (pay e 3ª tentativa) **debita** $50 e soma ao pote. Hoje a porta era no-op e o dinheiro **não saía** do caixa.
- **Rationale:** sem isso, imposto/prisão não custam nada (bug latente do fluxo).

## D6 — Reuso de `netWorth` (006)

- **Decisão:** `goBonus` importa `netWorth` de `cards/effects.ts` (006).
- **Rationale:** uma só definição de patrimônio (clarificação do 006: caixa + preços[hipotecada ÷2] + construções). 007 → 006 é dependência válida (nova → anterior).

---

## Impacto em testes existentes (esperado)

A mudança de assinatura das portas (ganham `state`) e o débito de imposto/prisão afetam mocks de:
- `tests/game/turn/jail.test.ts` — `onPayToCenter` agora recebe `(state, 50)`; o caixa passa a cair $50.
- `tests/game/cards/effects.test.ts` — mocks que capturam `onPayToCenter` precisam ler o **2º** argumento (amount).

Esses ajustes fazem parte desta feature (sem regressão de comportamento além do pretendido). Nenhum `NEEDS CLARIFICATION` pendente.
