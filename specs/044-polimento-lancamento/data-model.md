# Data Model — Polimento & Lançamento

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)

Três estruturas: os campos novos do `GameState` (motor), a classificação derivada (`MatchSummary`, nunca persistida) e a tabela de telemetria (fora da partida).

---

## 1. `GameState` — quatro campos novos

`src/game/turn/types.ts`. Aditivos, JSON puro, serializáveis — entram no snapshot como qualquer outro campo (princípio VII).

```ts
export interface GameState {
  // … campos existentes …

  /** Quedas na ORDEM em que a falência foi processada (§9.4). Primeiro a cair = índice 0.
   *  Único insumo da classificação final (D-038). Nunca reordenado, nunca removido.
   *  Guarda a rodada junto do id porque a FR-004 pede "em que rodada caiu" — e a rodada
   *  da queda não é derivável de um estado que já avançou. Um campo, não dois que possam
   *  discordar. */
  eliminationOrder: EliminationRecord[]   // { playerId: string; round: number }

  /** Voltas completas na ordem de assentos desde o início. Começa em 1 (a partida
   *  começa NA primeira rodada). Incrementa em `advanceSeat` quando a busca dá a volta. */
  round: number

  /** Instante do início da partida, injetado (`ctx.now`/`Date.now()` na borda). 0 = sem
   *  relógio (partidas de teste) — a duração então é apresentada como indisponível. */
  startedAt: number

  /** Instante em que `phase` virou `'ended'`, gravado por `checkEndGame` a partir do
   *  mesmo relógio injetado. `null` enquanto a partida não terminou. */
  endedAt: number | null
}
```

### Pontos de escrita (três arquivos, quatro linhas)

| Campo | Onde | Quando |
|---|---|---|
| `eliminationOrder` | `game/falencia/falencia.ts` (`bankrupt`) | na mesma linha lógica de `debtor.eliminated = true`, antes de `checkEndGame` |
| `round` | `game/turn/turnMachine.ts` (`advanceSeat`) | quando o assento escolhido dá a volta na ordem |
| `startedAt` | `game/setup.ts` (`createSeedState`) | na construção, por parâmetro opcional (default `0`) |
| `endedAt` | `game/falencia/falencia.ts` (`checkEndGame`) | na transição para `phase: 'ended'` |

### Invariantes

- **`eliminationOrder` é apenas append.** Nenhum caminho remove, reordena ou desduplica: o mesmo jogador nunca fali duas vezes (`bankrupt` roda uma vez por devedor, e `eliminated` é definitivo).
- **`eliminationOrder.length === players.filter(p => p.eliminated).length`** em todo estado válido.
- **`round` nunca decresce** e é o mesmo em toda tela — é escrito pela autoridade e difundido.
- **`endedAt !== null` ⟺ `phase === 'ended'`.**
- **Nenhuma posição final é guardada.** `rank` é derivado (ver §2) — dois lugares para a mesma verdade é um a mais.

### Compatibilidade com snapshot antigo

`game/log.ts` já normaliza log de snapshot pré-040 (`normalizeLog`, chamado por `supabaseTransport.loadSnapshot`). O mesmo ponto ganha `normalizeGame`:

| Campo ausente | Valor assumido | Efeito no resumo |
|---|---|---|
| `eliminationOrder` | `[]` | `partial: true` — eliminados aparecem agrupados, sem posição afirmada; o resumo não inventa ordem que não tem |
| `round` | `0` | rodada exibida como indisponível |
| `startedAt` | `0` | duração exibida como indisponível |
| `endedAt` | `null` | idem |

Uma partida antiga carrega, é jogável e termina normalmente; o que ela não recupera é o passado que não foi registrado — e o resumo diz isso em vez de mentir (FR-009).

---

## 2. `MatchSummary` — derivado, nunca persistido

`src/game/summary.ts`. Função **pura** de `GameState`, sem relógio, sem acesso a rede, sem estado de UI.

```ts
export interface StandingRow {
  playerId: string
  /** 1 = vencedor. Posições seguem a ordem inversa de eliminação. */
  rank: number
  /** Patrimônio líquido no estado final (o mesmo `netWorth` de cards/effects.ts).
   *  Para eliminados é 0 por definição de falência (§9.1) — apresentado como tal. */
  netWorth: number
  /** Quantidade de propriedades tituladas no estado final. */
  properties: number
  /** Rodada em que foi eliminado; null para o vencedor. Só existe quando
   *  `eliminationOrder` registrou aquela queda. */
  eliminatedAtRound: number | null
}

export interface MatchSummary {
  winnerId: string | null
  standings: StandingRow[]      // ordenado por rank crescente
  rounds: number                // `round` no fim
  durationMs: number | null     // endedAt - startedAt; null quando falta relógio
  /** true quando a partida veio de um snapshot sem os campos novos — a UI
   *  usa isto para não afirmar posição que não pode afirmar. */
  partial: boolean
}

export function matchSummary(game: GameState): MatchSummary
```

**Derivação**:

1. `winnerId` = o único `!eliminated` (ou `null` se a partida não terminou / mesa vazia).
2. `standings` = `[winner, ...eliminationOrder.reverse()]`, `rank` = índice + 1.
3. `netWorth` e `properties` calculados sobre o estado final, por `netWorth()` (`game/cards/effects.ts:25`) e por varredura de `titles`.
4. `eliminatedAtRound` vem direto do registro da queda (`EliminationRecord.round`) — não é derivável de um estado que já avançou, e é por isso que a rodada viaja junto do id.

```ts
export interface EliminationRecord { playerId: string; round: number }
```

`partial` é `true` quando há jogador eliminado sem registro correspondente em `eliminationOrder` — o caso do snapshot gravado antes desta spec. A tela então mostra o vencedor e agrupa os eliminados sem afirmar posições que o estado não guardou.

---

## 3. Telemetria — `telemetry_events`

`supabase/migrations/0003_telemetry_events.sql`. **Fora** da partida: nenhum reducer, nenhuma sessão e nenhum snapshot dependem desta tabela.

```sql
create table if not exists public.telemetry_events (
  id          bigint generated always as identity primary key,
  kind        text        not null,   -- room_created | match_started | match_ended | match_paused
  match_key   text,                   -- hash irreversível do id de sala (NUNCA o id em claro)
  players     integer,                -- contagem, só em match_started/match_ended
  rounds      integer,                -- só em match_ended
  duration_ms integer,                -- só em match_ended
  cause       text,                   -- só em match_paused: disconnect | persistence
  version     text,                   -- referência do commit publicado
  created_at  timestamptz not null default now()
);
```

**RLS**: inserção anônima permitida; **nenhuma política de `select`** — o cliente escreve e não lê. É o oposto da tabela `rooms`, que precisa ser lida por quem tem o link.

**Proibições da D-040, verificadas por teste** (`tests/telemetry/`): nenhuma coluna aceita nome de jogador, mão, token de sessão, código de reentrada ou id de sala em claro. O tipo do evento não tem campo livre — não existe `payload jsonb` onde algo possa escorregar depois.

`match_key` = `SHA-256(roomId + salt público de build)`, truncado em 16 hex. Correlaciona eventos da mesma partida; não volta ao id da sala (que é credencial de acesso, D-019/D-036).

---

## 4. O que **não** entra no modelo

- **`rank` persistido** — derivado (§2).
- **Acumuladores de fluxo de caixa** (aluguel pago/recebido, total construído) — exigiriam instrumentar os 40 pontos onde o caixa muda; recusado na D-038.
- **Registro de partida no banco** (histórico, replay) — fora do v1 (§16).
- **Qualquer identificação de pessoa** em telemetria — D-040, princípio VI.
