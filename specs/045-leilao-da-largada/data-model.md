# Data Model: Leilão da Largada

## 1. OpeningMode

Preferência pública do host:

```ts
type OpeningMode = 'sealed-bid' | 'dice-roll'
```

Invariantes:

- salas novas e shapes legados normalizam para `sealed-bid`;
- só a autoridade altera, e somente em `Room.status === 'lobby'`;
- a escolha permanece no `Room` depois do início para selecionar a revelação correta.

## 2. OpeningAuction

Fase pré-partida persistida junto da sala.

| Campo | Tipo | Regra |
|---|---|---|
| `closesAt` | number | instante absoluto em ms; definido uma vez pela autoridade |

Ausente/null fora de `Room.status === 'bidding'`.

## 3. Seat — extensão

| Campo | Tipo | Default legado | Regra |
|---|---|---|---|
| `openingBid` | `number \| null` | `null` | $0–$500, múltiplo de $50; privado durante coleta |
| `bidLocked` | boolean | `false` | `true` exatamente quando o lance foi aceito |
| `openingRoll` | `[number, number] \| null` | `null` | dois d6 gerados pela autoridade no modo `dice-roll` |

Invariantes:

- `bidLocked === true` implica `openingBid !== null`;
- `openingBid === null` enquanto não lacrado;
- no fechamento, todo assento termina com `bidLocked: true`; faltantes recebem `openingBid: 0`;
- depois da revelação, os campos permanecem no snapshot da sala como registro público e imutável.
- `openingRoll !== null` somente no resultado de `dice-roll`; nesse modo `openingBid === null` e `bidLocked === false`.

## 4. Room — transições

```text
lobby
  ├─ sealed-bid + host abre ─> bidding
  │    ├─ todos lacraram ────> playing
  │    └─ closesAt venceu ───> playing
  └─ dice-roll + host inicia ─> playing
```

`paused` e `ended` continuam transições exclusivamente pós-início.

Durante `bidding`:

- entrada nova é recusada como partida já iniciada;
- kick não é permitido;
- desconexão não pausa;
- reload remonta prazo e lances da linha persistida.

## 5. PublicSeat

Na difusão durante `bidding`:

| Campo | Valor |
|---|---|
| `bidLocked` | valor real |
| `openingBid` | `null` para todos |
| `reentryCode` | sempre removido |

O próprio valor é mantido localmente e recuperável por `room_preview`, que devolve `openingBid` somente ao dono do assento; a autoridade recebe a sala íntegra. Em `playing`, `openingBid` passa a ser público para a revelação.

`openingMode` é sempre público. `openingRoll` só deixa de ser `null` quando o resultado de Maior dado já está fechado e público.

## 6. Aplicação no GameState

Entrada: `GameState` recém-criado + assentos já ordenados.

Em `sealed-bid`, para cada assento:

```text
player.cash = THEME.INITIAL_CASH - openingBid
```

E:

```text
game.centerPot = THEME.PARKING_SEED + Σ openingBid
```

Nenhum novo campo entra em `GameState`; a Loteria continua sendo `centerPot`.

Em `dice-roll`, o `GameState` inicial não recebe ajuste econômico: caixas permanecem em $2.000 e `centerPot` em $500.

## 7. Compatibilidade

- `normalizeSeat` preenche campos ausentes.
- `openingMode` ausente vira `sealed-bid`.
- `opening_auction` ausente no banco vira `null`.
- `buildInitialGame` sem resultado de largada permanece inalterado.
- `collectCenter` continua coletando e resetando para `PARKING_SEED`.
