# Modelo de dados — Resiliência de sessão

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)

Quatro entidades novas ou alteradas. Duas vivem no estado da partida (e portanto no snapshot persistido), duas vivem só na casca de rede.

---

## 1. `PauseState` — a pausa ganha causa e relógio

**Onde**: `src/game/turn/types.ts`. Substitui `paused: boolean` mantendo o **nome do campo** (ver D1 do plan — é o que evita reescrever os ~35 pontos que leem `state.paused` por truthiness).

```ts
export type PauseCause = 'disconnect' | 'persistence'

export interface PauseState {
  /** Causas ativas, ordenadas e sem duplicata. Nunca vazio — vazio é `null`. */
  causes: PauseCause[]
  /** Instante em que a PRIMEIRA causa ativa começou. Não reinicia quando outra entra. */
  since: number
}

export interface GameState {
  // …
  paused: PauseState | null   // era: boolean
}
```

**Invariantes**

1. `paused === null` ⟺ nenhuma causa ativa. Nunca `{ causes: [], since }`.
2. `causes` não tem duplicata; pausar uma causa já ativa é no-op.
3. `since` só é escrito na transição `null → PauseState`. Segunda causa entrando **não** o altera.
4. `since` é durável: vive no snapshot, sobrevive ao reload do host (FR-019).
5. Retomar a última causa desloca os prazos em voo por `at - since` e zera o campo.
6. Retomar uma causa que não está ativa é no-op.
7. Serializável em JSON sem perda (vai no snapshot).

**Por que `causes` é lista e não flags booleanas**: a superfície precisa nomear o que está segurando a mesa, e a ordem de entrada é a ordem de leitura natural na frase ("aguardando Ana reconectar e o salvamento voltar"). Um `Record<PauseCause, boolean>` obrigaria a reconstruir essa ordem na apresentação.

**Estado inicial** (`src/game/setup.ts`): `paused: null`.

---

## 2. Ações de pausa — o instante entra pela ação

**Onde**: `src/game/commands.ts`.

```ts
| { kind: 'pause';  cause: PauseCause; at: number }
| { kind: 'resume'; cause: PauseCause; at: number }
```

Ambas continuam em `SYSTEM_KINDS` (atravessam o gate de pausa de `commands.ts:136`) e continuam sendo emitidas só pelo host.

`at` vem de fora porque o cliente reaplica o comando difundido com o `ctx` de replay, que **lança** se alguém consultar relógio (`client.ts:32-35`). Mesmo padrão de `{ kind: 'close-land-lots', now }`.

**Reducer de `pause`**

| Estado atual | Resultado |
|---|---|
| `null` | `{ causes: [cause], since: at }` |
| já contém `cause` | inalterado (retorna o mesmo objeto — o host trata como no-op) |
| não contém `cause` | `{ causes: [...causes, cause], since }` — `since` preservado |

**Reducer de `resume`**

| Estado atual | Resultado |
|---|---|
| `null` ou sem a causa | inalterado |
| restam outras causas | `{ causes: sem a causa, since }` — **nenhum prazo é deslocado** |
| era a última causa | `paused: null` + deslocamento de `at - since` |

**Deslocamento** (o que `applyResume` já fazia, com a origem do número corrigida): `resolution.auction.deadline` e cada `landAuction.lots[].deadline` somam o intervalo. Nada mais tem prazo.

O intervalo passa a ser derivado do estado (`at - state.paused.since`) em vez de recebido pronto do host — é isso que conserta o defeito 4, porque a memória do host não sobrevive ao reload dele e o snapshot sobrevive.

---

## 3. `Seat.reentryCode` — credencial de recuperação (D-033)

**Onde**: `src/net/room.ts`.

```ts
export interface Seat {
  playerId: string
  token: string
  reentryCode: string   // NOVO — estável pela vida do assento
  name: string
  color: string
  piece?: PieceId
  isHost: boolean
  connected: boolean
}
```

**Forma**: 6 caracteres de um alfabeto sem ambiguidade visual (sem `0/O`, `1/I/L`), maiúsculas. Legível em voz alta e digitável em teclado de celular — o caso de uso é ditar para si mesmo em outro aparelho.

**Ciclo de vida**

| Evento | Efeito no código |
|---|---|
| `createRoom` / `joinRoom` | criado junto do assento, recebido pronto do chamador (D12 do plan) |
| `shuffleSeatOrder` | **preservado** — só `playerId` muda de posição |
| `kickSeat` | o código do removido some com o assento; os demais são preservados (FR-025/031) |
| `reattachByCode` | preservado — o que muda é o `token` |
| fim da partida | irrelevante: sala terminada não reabre (FR-028 da 038) |

**Unicidade**: dentro da sala. O gerador tenta de novo em colisão — 6 caracteres em alfabeto de 32 dá margem folgada para 8 assentos, mas a checagem é barata e a alternativa é um bug de um em muitos milhares que ninguém consegue reproduzir.

**Exposição**: o `Room` é difundido inteiro e persistido numa linha legível por qualquer portador do link — `Seat.token` **já** está assim. O código entra na mesma classe, por decisão explícita da D-033, e some junto com ela quando o endurecimento de identidade de transporte acontecer.

**Reducer novo**

```ts
reattachByCode(room, code, token):
  | { ok: true; room: Room; seat: Seat }
  | { ok: false; reason: 'bad-code' }
```

Puro. Acha o assento pelo código (comparação case-insensitive, espaços ignorados — quem digita um código ditado erra o caixa alta), substitui `token`, marca `connected: true`. O token anterior deixa de ter assento por construção (FR-027).

---

## 4. `ConnectionState` — a conexão da própria sessão

**Onde**: `src/net/client.ts` (produz), `src/net/roomStore.ts` (espelha para a UI).

```ts
export type ConnectionState =
  | 'connected'      // canal vivo
  | 'reconnecting'   // canal caído; o adapter está tentando
  | 'desynced'       // conectado, mas a reconciliação de estado esgotou as tentativas
```

**Por que fora do `GameState`**: não é regra de jogo, difere por cliente e não pode trafegar por difusão — quem está desconectado não recebe difusão nenhuma, que é exatamente o caso que este estado existe para cobrir.

**Transições**

| De | Para | Gatilho |
|---|---|---|
| `connected` | `reconnecting` | `onStatus('reconnecting')` do transporte |
| `reconnecting` | `connected` | `onStatus('connected')` **e** ressincronização bem-sucedida |
| `connected` | `desynced` | ressincronização esgotou as tentativas (FR-005) |
| `desynced` | `connected` | ressincronização posterior bem-sucedida |

`reconnecting → connected` **passa pela ressincronização**: declarar-se conectado antes de reconciliar mostraria estado velho como atual, que é o que FR-005 recusa.

**Consumidores**: `ConnectionBanner` (aviso), `localView.mayAct` (FR-007 — desconectado não aciona nada).

---

## 5. Fila de gravação — durabilidade (D-034)

**Onde**: `src/net/durableWrites.ts`, decorator sobre `Transport`.

```ts
interface DurableWriteOptions {
  retries: number                      // tentativas por escrita
  sleep(ms: number): Promise<void>     // injetado — testes não esperam de verdade
  backoff(attempt: number): number     // ms da n-ésima espera
  onExhausted(): void                  // → host emite pause('persistence')
  onRecovered(): void                  // → host emite resume('persistence')
}
```

**Estado interno**

| Campo | Papel |
|---|---|
| `inFlight` | há uma escrita em voo? (profundidade 1) |
| `pending` | a **última** escrita pedida enquanto havia uma em voo (coalescing) |
| `lastAcked` | maior `seq` gravado com sucesso — base da monotonia em processo |
| `exhausted` | esgotou; a próxima gravação bem-sucedida dispara `onRecovered` |

**Invariantes**

1. Nunca mais de uma escrita em voo por sala.
2. `pending` guarda **um** snapshot, não uma fila — a linha é única e só o mais recente importa.
3. Escrita com `seq < lastAcked` é descartada sem tentativa (FR-011).
4. `onExhausted` dispara uma vez por episódio, não por tentativa.
5. `onRecovered` só dispara se `onExhausted` disparou antes.
6. Nenhuma promessa rejeitada escapa sem tratamento (FR-015).

**Guarda de banco** (`0002_snapshot_monotonic.sql`): trigger `before update` que devolve `null` — no-op silencioso — quando `new.seq < old.seq`. Estritamente `<`, para que o upsert parcial de `saveRoom` (que não envia `seq`, e portanto tem `new.seq = old.seq`) continue passando. Cobre o que a guarda em processo não alcança: a requisição em voo de um host que recarregou.

---

## Migração de dados

Salas persistidas antes desta spec têm `game.paused` como booleano.

`normalizeSnapshot(game)` — no mesmo ponto onde `supabaseTransport.loadSnapshot` já chama `normalizeLog`:

| Valor gravado | Vira |
|---|---|
| `false` / ausente | `null` |
| `true` | `{ causes: ['disconnect'], since: <instante da leitura> }` |

`since` recebe o instante da leitura, e não `0`, deliberadamente: o momento real da pausa não foi gravado, e assumir a época faria a retomada deslocar prazos por décadas. Assim o pior caso é um leilão que não ganha o tempo da pausa — perda pequena, limitada a salas anteriores ao deploy, e preferível a um deadline no ano de 2082.
