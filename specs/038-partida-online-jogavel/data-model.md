# Data Model — spec 038

Fase 1 do plan. Nenhuma entidade **persistida** é criada: o schema da 037 (`rooms`) não muda e o `GameState` não ganha campo algum. O que segue são as entidades **derivadas** (calculadas em memória, no cliente) que a UI passa a consumir.

## Onde cada coisa mora (invariante de fronteira)

```
GameState (persistido no snapshot)      Sala (persistida em rooms.seats)     Derivado (memória do cliente)
──────────────────────────────────      ────────────────────────────────     ────────────────────────────
players[].id  'p1'..'p8'                seat.playerId  'p1'..'p8'  ◄──join──  LocalView
players[].cash, hand, pos, …            seat.token     (nunca no jogo)        Identity
turnOrder, activeSeat, resolution       seat.name/color/piece                 ConnectionStatus
paused                                  seat.isHost/connected
```

**Regra dura**: nada da coluna do meio entra na da esquerda (D-019). O teste `identity.test.ts` fixa isso serializando o `GameState` e verificando que nenhum nome de jogador aparece.

---

## LocalView (derivada, por cliente)

O que **este dispositivo** é dentro da partida.

| Campo | Tipo | Descrição |
|---|---|---|
| `seatId` | `string \| null` | meu `playerId`; `null` = sem sala (single-player) |
| `role` | `'actor' \| 'observer' \| 'eliminated' \| 'local'` | papel agora: ator da decisão em aberto, observador dela, eliminado da partida, ou modo local (todos os assentos são meus) |
| `isMe(playerId)` | `boolean` | usado por toda superfície que hoje compara com `activeSeat` |
| `mayAct(kind)` | `boolean` | **identidade**: esta decisão é minha? Deriva de `actorOf` (mesma tabela do host) |
| `waitingFor` | `string \| null` | `playerId` de quem o jogo aguarda — vira "aguardando \<nome\>" na UI |

**Derivação**: `localView(game, room, myToken)`. Sem sala → `{ seatId: null, role: 'local', mayAct: () => true, isMe: (id) => id === ativo }` — exatamente o comportamento de hoje (FR-029).

**Invariantes**:
1. `mayAct(k) === true` ⟹ o host aceitaria a identidade desse comando vindo deste assento (não garante que o motor aceite o comando — ver a distinção identidade × elegibilidade no plan).
2. `role === 'eliminated'` ⟹ `mayAct(k) === false` para todo `k` (FR-007).
3. `seatId === null` ⟹ nunca bloqueia nada (single-player intacto).

**Transições de `role`**: `actor ⇄ observer` a cada comando aceito (é derivado, não guardado); `→ eliminated` é terminal dentro da partida (só volta em partida nova).

---

## Identity (derivada, por jogador)

| Campo | Tipo | Origem |
|---|---|---|
| `name` | `string` (1–16 chars, sem espaços-só) | escolhido no lobby (FR-012) |
| `color` | `string` (hex da paleta de assentos) | escolhido no lobby, **único por sala** (§12.5) |
| `piece` | `string` (id da peça visual) | escolhido no lobby, **única por sala** (FR-022), catálogo ≥ 8 (FR-023) |

**Derivação**: `identityOf(room, playerId)`. Sem sala → `{ name: 'Jogador N', color: SEAT_COLORS[n], piece: PIECES[n] }`, com `n` do índice do assento.

**Invariantes**: `name` pode repetir na sala (FR-011); `color` e `piece` não. Nenhum campo entra no `GameState`.

---

## ConnectionStatus (derivada, por assento)

| Campo | Tipo | Descrição |
|---|---|---|
| `connected` | `boolean` | de `seat.connected` (presence do Realtime) |
| `isHost` | `boolean` | de `seat.isHost` — muda a mensagem de pausa (FR-017) |
| `blocksPlay` | `boolean` | `!connected && !eliminated` — **só este** dispara pausa (D-029/FR-018a) |

`blocksPlay` é a entidade que materializa a D-029: é a junção do estado de conexão (sala) com o estado de eliminação (jogo), e é o que o host consulta no gatilho de pausa e o que o `PauseBanner` lista.

---

## RoutePhase (derivada, por cliente)

`'home' | 'identity' | 'lobby' | 'match' | 'ended'`

| De → Para | Gatilho |
|---|---|
| `home → identity` | criar sala, ou abrir link sem assento |
| `identity → lobby` | assento concedido (ou reanexado por token) |
| `lobby → match` | host inicia; estado inicial chega |
| `match → ended` | `game.phase === 'ended'` |
| `ended → home` | jogador escolhe voltar (FR-027) |
| qualquer `→ home` | link de sala já encerrada (FR-028) |

Sem parâmetro de sala na URL, o cliente entra direto em `match` no modo local (FR-029).
