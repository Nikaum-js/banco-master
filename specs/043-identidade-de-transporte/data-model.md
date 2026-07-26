# Data Model — spec 043

Delta sobre o modelo da 037/038/041. Só o que muda de **forma**; o que muda de política vive em [contracts/policies.md](./contracts/policies.md).

---

## 1. Identidade

```ts
// src/net/session.ts — o que sobra dele
export interface AttestedSession {
  uid: string   // `sub` do JWT da sessão anônima — emitido pelo servidor, não escolhido
}
```

`getSessionToken()` deixa de existir. O UUID em `localStorage` sai de cena: quem persiste a sessão entre reloads é o próprio supabase-js, e é essa persistência que sobrevive ao F5.

**Renomes** (mecânicos, sem mudança de semântica além da origem do valor):

| Antes | Depois |
|---|---|
| `Seat.token` | `Seat.uid` |
| `seatByToken(room, token)` | `seatByUid(room, uid)` |
| `Transport.token` | `Transport.uid` |
| `PresenceChange.token` | `PresenceChange.uid` |
| `Identity.token` | `Identity.uid` |

Motivo do rename e não do alias: neste projeto "token" já é a **peça visual** do jogador (§12.5). Duas coisas com o mesmo nome foi parte do que fez "identidade" parecer resolvida.

---

## 2. Assento

```ts
export interface Seat {
  playerId: string
  uid: string             // ERA `token` — agora a identidade atestada
  name: string
  color: string
  piece?: PieceId
  isHost: boolean
  connected: boolean
  reentryCode: string     // SEGREDO DO DONO — ver §3
}
```

`reentryCode` continua estável pela vida do assento (D-033) e continua legível pelo dono. O que muda é a **audiência**.

---

## 3. Sala publicada vs. sala da autoridade

Duas projeções do mesmo `Room`:

```ts
// O que a autoridade tem em memória e o que o servidor guarda
type Room = { id, status, seats: Seat[] }

// O que trafega no tópico de lobby e o que `room_preview` devolve
type PublicRoom = { id, status, seats: PublicSeat[] }
type PublicSeat = Omit<Seat, 'reentryCode'>
```

O `uid` **permanece** na sala publicada: ele não é credencial — conhecê-lo não permite usá-lo (é o ponto inteiro da D-035). O `reentryCode` sai, porque ele é credencial portadora.

O dono lê o próprio código pela função de prévia, que o devolve **apenas** para o assento de quem chamou.

---

## 4. Slot oculto

```ts
export type CardSlot = CardId | null   // null = existe uma carta aqui, e ela não é minha

interface Player {
  hand: CardSlot[]        // ERA CardId[]
  // …
}

interface Decks {
  acaso: CardSlot[]       // ERA CardId[]
  tesouro: CardSlot[]
}
```

Invariantes:

- **Comprimento é verdade pública.** `hand.length` continua sendo a contagem exibida no §12.3, e o deck continua com o comprimento real. Nenhum consumidor de contagem muda.
- **A autoridade nunca vê `null`.** Na perspectiva do anfitrião, todo slot é `CardId` — por isso os testes de motor existentes seguem válidos sem reescrita.
- **Slot oculto não carrega raridade** (FR-027). `null` é `null`: nem cor, nem efeito, nem deck de origem além daquele em que está.

Um único ponto de código passa a tolerar oculto na remoção:

```ts
// src/game/cards/hand.ts
// Remove `cardId` da mão; se ele não estiver visível ali (perspectiva alheia),
// remove um slot oculto — mantendo o comprimento correto em todas as perspectivas.
export function removeFromHand(hand: CardSlot[], cardId: CardId): CardSlot[]
```

---

## 5. Não-determinismo: o saque entra

```ts
export interface Resolved {
  rng: number[]
  now: number[]
  draws: CardSlot[]   // NOVO — cartas sacadas nesta aplicação, em ordem
}
```

`TurnCtx` ganha o port correspondente; `recordingCtx` grava, `replayCtx` devolve. A regra que o reducer aplica é única nos dois lados: **valor não-nulo → carta conhecida; valor nulo → slot oculto**.

Por que isto não existia: as cartas saíam de decks já embaralhados dentro do `GameState` (`recorder.ts:4-6`), então o saque era determinístico dado o estado. Com o deck oculto na perspectiva alheia, ele deixa de ser — e passa a entrar pelo mesmo caminho que `rng` e `now` já usam desde a 037.

---

## 6. Comando aceito: público e privado

```ts
interface AcceptedCommand {
  seq: number
  action: GameAction     // com `cardId` redigido quando privado (D10 do plan)
  resolved: Resolved     // com `draws` redigido quando privado
}
```

Não há tipo novo: é o **mesmo** `AcceptedCommand` em duas versões, distinguidas pelo canal por onde chegam.

| Situação | Tópico `play` (todos) | Tópico `s:<uid>` (dono) |
|---|---|---|
| Carta de efeito imediato | id da carta | — (nada privado) |
| Carta que vai para a mão | `draws: [null]` | `draws: [<id>]` |
| `discard-card` | `cardId: null` | `cardId: <id>` |
| `play-hand-card` | id da carta | — (jogar é revelar) |
| Qualquer comando sem carta | íntegro | — |

Uma parte privada que não chega vira lacuna de sequência e cai no caminho de ressincronização que já existe (`client.ts:85`) — e o snapshot que o dono lê já contém os segredos dele.

---

## 7. Snapshot em duas partes

```sql
rooms.game     jsonb   -- estado PÚBLICO, já redigido (slots ocultos no lugar de carta alheia)
rooms.secrets  jsonb   -- NOVO
```

```jsonc
// rooms.secrets
{
  "<uid do assento>": { "hand": ["acaso-07", null, "tesouro-02"] },  // por índice de slot
  "deck": { "acaso": ["…"], "tesouro": ["…"] }
}
```

- **Jogador** recebe `game` + `secrets->'<seu uid>'`.
- **Anfitrião** recebe `game` + `secrets` inteiro (é a autoridade — exceção conhecida do §10.3).
- O merge é por **índice**: o segredo preenche os slots ocultos da própria mão, na mesma posição.

O servidor nunca interpreta nenhum dos dois: `read_snapshot` seleciona chave e devolve. A divisão e o merge vivem em `src/net/perspective.ts`, testados em TypeScript.

```ts
// src/net/perspective.ts
export function splitSnapshot(game: GameState): { publicGame: GameState; secrets: Secrets }
export function mergeSnapshot(publicGame: GameState, secrets: Partial<Secrets>): GameState
```

Propriedade que a suíte cobra: `mergeSnapshot(...splitSnapshot(g), todosOsSegredos)` devolve `g` inalterado.

---

## 8. Migração de dados

**Nenhuma.** A migration `0003` executa `delete from public.rooms` antes de mudar o formato: o vínculo de identidade muda de natureza (token auto-declarado → uid atestado) e não há partida real para preservar (pré-lançamento). É o oposto da decisão da 041 — lá o `paused` legado foi normalizado na leitura porque havia formato antigo compatível; aqui não há o que salvar, e fingir compatibilidade deixaria linhas com assentos que ninguém consegue reivindicar.

A aplicação no projeto vivo pede confirmação explícita antes de rodar (FR-030).
