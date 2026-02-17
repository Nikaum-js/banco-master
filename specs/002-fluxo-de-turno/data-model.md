# Data Model — Fluxo de Turno (Fase 1)

Entidades de **runtime** (estado da partida em Zustand). Tudo aqui é **serializável** (JSON puro — sem funções, refs ou closures), pré-requisito da resiliência (FR-028). O turno **lê** dados estáticos do board (`boardData.ts`, 001) mas não os modifica.

> **Fronteira:** este modelo define só o que o **turno** possui ou precisa ler. Dinheiro, propriedades, construções, mão de cartas e pote do Free Parking pertencem a **outras specs** — referenciados aqui como campos lidos/escritos via porta, não modelados.

---

## Entidade: GameState (raiz, runtime)

| Campo | Tipo | Notas |
|---|---|---|
| `players` | `Player[]` | índice = assento; ver subtipo abaixo |
| `turnOrder` | `number[]` | ordem cíclica de índices de `players` (insumo da spec de Lobby) |
| `activeSeat` | `number` | índice em `turnOrder` do jogador da vez |
| `turn` | `Turn` | turno corrente (ver abaixo) |
| `paused` | `boolean` | `true` durante desconexão (FR-028) — bloqueia avanço |
| `phase` | `'lobby' \| 'playing' \| 'ended'` | esta feature opera em `playing` |

**Invariante:** existe exatamente **um** jogador ativo = `players[turnOrder[activeSeat]]`, e ele não está eliminado.

---

## Entidade: Player (slice lido/escrito pelo turno)

Só os campos **que o turno toca**. Demais campos (dinheiro, propriedades, cartas) são de outras specs e **não** aparecem aqui.

| Campo | Tipo | Dono | Notas |
|---|---|---|---|
| `id` | `string` | Lobby | identidade estável |
| `pos` | `number` | **Turno** | 0–47; índice no board (001) |
| `completouPrimeiraVolta` | `boolean` | **Turno** | gatilho do Speed Die (D6); vira `true` na rolagem seguinte ao 1º cruzamento do GO |
| `jail` | `JailState` | **Turno** | ver abaixo |
| `eliminated` | `boolean` | Falência | turno **lê** para pular na ordem |
| `cash` / `properties` / `hand` | — | outras specs | **não modelados aqui** |

### Subtipo: JailState

| Campo | Tipo | Notas |
|---|---|---|
| `inJail` | `boolean` | `true` = preso (não "apenas visitando") |
| `attempts` | `0..3` | tentativas de saída no ciclo atual; reseta ao sair |

---

## Entidade: Turn (turno corrente)

| Campo | Tipo | Notas |
|---|---|---|
| `state` | `TurnState` | discriminador da FSM (abaixo) |
| `seat` | `number` | jogador da vez (espelha `activeSeat`) |
| `consecutiveDoubles` | `0..2` | duplas seguidas neste turno; ao chegar à 3ª → prisão (FR-015) |
| `lastRoll` | `Roll \| null` | última rolagem (para resolução/utilidades/Ônibus) |
| `pendingResolve` | `boolean` | `true` enquanto a casa não foi resolvida (bloqueia finalizar — FR-007/FR-022) |
| `mayRollAgain` | `boolean` | `true` se a última foi dupla válida (FR-013) e não houve desvio à prisão |

**`TurnState`** (FSM):

```
aguardando-rolagem      → jogador pode rolar (ou, se preso, decidir)
prisao-decisao          → preso escolhe pagar / carta / tentar dupla (FR-016)
casa-a-resolver         → parou; resolução obrigatória pendente (FR-010)
aguardando-finalizacao  → casa resolvida; pode finalizar, re-rolar (dupla) ou agir
encerrado               → transição p/ próximo jogador
```

---

## Entidade: Roll (resultado de rolagem)

| Campo | Tipo | Notas |
|---|---|---|
| `white` | `[1..6, 1..6]` | dois dados brancos |
| `speed` | `SpeedFace \| null` | 3º dado; `null` antes da 1ª volta (FR-005) |
| `isDouble` | `boolean` | derivado: `white[0] === white[1]` — **só brancos** (FR-014) |
| `move` | `number` | casas a mover; default = soma dos brancos (+ face numérica do Speed Die) |
| `special` | `'mr-banco' \| 'onibus' \| 'triple' \| null` | movimento especial do Speed Die |

**`SpeedFace`**: `1 | 2 | 3 | 'mr-banco' | 'onibus'`. Quando os três dados coincidem → `special = 'triple'` (FR-026: encerra a rolagem, sem re-roll, mesmo com brancos iguais).

---

## Ações facultativas (referência, não modeladas)

Construir, hipotecar, deshipotecar, negociar, jogar carta de "próprio turno" (FR-006) — janela **livre** até finalizar (clarificação Q4). O turno só impõe: **rolagem + resolução** obrigatórias antes de `encerrado`. As ações em si vivem nas specs respectivas; o turno apenas não as bloqueia.

---

## Invariantes validáveis (viram testes — ver quickstart)

1. Sempre exatamente 1 jogador ativo, não eliminado.
2. `finalizar` proibido se `pendingResolve === true` (FR-007/FR-022).
3. `consecutiveDoubles` atinge 3 → estado vira prisão, `move` da 3ª rolagem **não** aplicado (FR-015).
4. `jail.attempts` nunca passa de 3; na 3ª sem dupla, paga $50 e move (FR-018).
5. `speed === null` enquanto `completouPrimeiraVolta === false`; `≠ null` depois (FR-005, SC-003).
6. `isDouble` ignora o Speed Die e a escolha do Ônibus (FR-014, FR-025).
7. Sair da prisão com dupla **não** seta `mayRollAgain` (FR-019).
8. `paused === true` ⇒ nenhum comando avança o turno nem troca `activeSeat` (FR-028).
9. Estado inteiro round-trips por `JSON.parse(JSON.stringify(state))` sem perda (serializável).
