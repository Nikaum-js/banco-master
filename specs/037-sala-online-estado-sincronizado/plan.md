# Implementation Plan: Sala Online e Estado Sincronizado (fundação multiplayer host-autoritativo)

**Branch**: `037-sala-online-estado-sincronizado` | **Date**: 2026-07-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/037-sala-online-estado-sincronizado/spec.md`

## Summary

Casca de transporte/autoridade/persistência do M3. Dois ou mais clientes jogam a MESMA partida: um é **host** (única autoridade), os demais enviam **comandos** carregando o `playerId` do remetente. O host valida pelos **gates já existentes do motor**, aplica o **reducer puro inalterado**, resolve o não-determinismo (RNG/relógio) e **difunde o comando aceito** (com os resultados resolvidos + número de sequência). Cada cliente reaplica o mesmo comando localmente e converge (reducer determinístico). Snapshot completo do `GameState` é persistido a cada comando (upsert) e lido só ao **entrar** e ao **reconectar**. Desconexão pausa a partida para todos; reconexão retoma sozinha.

**Abordagem técnica-chave** (decidida com o usuário): a camada de rede é escrita contra uma **porta `Transport`** com duas implementações — `LocalTransport` (hub in-memory, determinístico, dirige N clientes num processo → toda a lógica de host/sync/pausa/reconexão é testável headless AGORA, sem infra) e `SupabaseTransport` (adapter Realtime + Postgres, pronto pra plugar). O motor M1 (`src/game`) **não muda de comportamento** — a fundação só adiciona uma casca de despacho por cima dos reducers existentes.

## Technical Context

**Language/Version**: TypeScript ~6.0, React 19, ES modules (`"type": "module"`).

**Primary Dependencies**: Zustand 5 (store), Supabase JS (novo, só no adapter real — lazy). Nenhuma dep nova obrigatória para a suíte de testes (LocalTransport é puro TS).

**Storage**: Postgres do Supabase — 1 linha por partida (upsert do snapshot JSON) + estado da sala (assentos/token). Sem log de eventos (D-020).

**Testing**: Vitest (ambiente node, headless). A fundação é validada por uma suíte nova em `tests/net/` que instancia host + 2–8 clientes sobre o `LocalTransport` e compara `GameState` serializado.

**Target Platform**: Web (browser). Testes rodam em node.

**Project Type**: Single project (SPA React/Vite), com um módulo novo `src/net/`.

**Performance Goals**: SC-002 (<1s p95 propagação) e SC-006 (tráfego por comando, ~25 partidas/8p no free tier) — verificáveis só com Supabase conectado; o desenho (difusão por comando, não snapshot) já os atende por construção.

**Constraints**: motor intacto (princípio I); `GameState` sem PII (D-019); token de sessão em `localStorage`; sem timeout de sessão (VII); sem transferência de host (D-016/D-020).

**Scale/Scope**: 2–8 jogadores por sala; MVP no free tier do Supabase.

## Constitution Check

*GATE — reavaliar após o design.*

| Princípio | Conformidade |
|---|---|
| **I. SRS é verdade absoluta** | ✅ Nenhuma regra nova. `applyCommand` é um **dispatcher** sobre os reducers existentes (`buyProperty`, `placeBid`, `validateTrade`…). Zero arquivo de `src/game/*` muda comportamento (SC-007). |
| **II. Discovery antes de código** | ✅ Spec 037 aprovada; este plan a operacionaliza. |
| **III–VI** | ✅ Não afetados — nenhuma mecânica de jogo muda (cartas seguem privadas/não-negociáveis etc.). |
| **VII. Resiliência de sessão** | ✅ É o coração da fatia: pausa por desconexão, reconexão sempre possível, snapshot sem perda, sem timeout. |

Sem violações. Nenhuma entrada na Complexity Tracking.

## Arquitetura

### Fluxo de um comando (host-autoritativo, difusão por comando)

```
Cliente-remetente          Host (autoridade)                     Todos os clientes
──────────────────         ─────────────────────────            ──────────────────
send(cmd{playerId})  ─►  1. identidade: playerId == assento?  (FR-007) → senão descarta
                         2. pausa? → rejeita              (FR-017)
                         3. recordingCtx: aplica applyCommand   (FR-008)
                            └ grava rng[]/now[] consumidos       (FR-011)
                         4. no-op? (state === prev) → descarta  (FR-009)
                         5. seq++ ; persistSnapshot(upsert)      (FR-013)
                         6. broadcast(cmd + resolved + seq) ──►  cada cliente:
                                                                  replayCtx(resolved) → applyCommand
                                                                  (mesmo reducer, mesmo resultado) → converge
                                                                  gap na seq? → refetch snapshot (FR-012)
```

O remetente é **pessimista** (Clarifications): só reflete o efeito quando o comando volta pela difusão — inclusive o próprio host aplica seu estado no passo 6, não no 3 (o passo 3 é numa cópia de trabalho descartável, ou o host também "escuta a si mesmo").

### Resolução do não-determinismo (FR-011) — o ponto crítico

Os reducers consomem `ctx.rng()` (dados, carta sacada, embaralho) e `ctx.now()` (deadlines). Para o cliente reproduzir bit-a-bit:

- **Host** aplica com um `recordingCtx` que embrulha `rng`/`now` e **grava** cada valor consumido num array (`resolved.rng`, `resolved.now`).
- O comando difundido carrega `resolved`.
- **Cliente** aplica com um `replayCtx` que devolve os valores gravados em ordem (`shift()`), sem nunca chamar `Math.random()`/`Date.now()`.

Como o reducer é determinístico dado `(state, ctx-outputs)`, host e clientes convergem exatamente. O RNG/relógio continuam injetáveis via `ctx` — só o host os executa de verdade (FR-011). `ports.taxMan` e `resolve` também passam a rng/now embrulhados.

### Módulos novos (`src/net/`)

| Arquivo | Responsabilidade | FRs |
|---|---|---|
| `src/game/commands.ts` | `GameCommand` union (produção; espelha o `SimAction` dev-only) + `applyCommand(state, cmd, ctx)` puro — **fonte única** de despacho, usada por host e cliente. | FR-008/009 |
| `src/net/recorder.ts` | `recordingCtx(base)` → `{ ctx, drain() }`; `replayCtx(base, resolved)`. | FR-011 |
| `src/net/room.ts` | Estado da sala (assentos: playerId/token/nome/cor/host/conexão; lifecycle) + reducers puros (`joinRoom`, `startGame`, `markDisconnected`, `reattach`, `takeoverConnection`); regra de cor única, sala cheia, ordem = entrada. | FR-001..006a, 016, 019 |
| `src/net/transport.ts` | Interface `Transport` (connect/disconnect, broadcast/onCommand, load/saveSnapshot, publishRoom/onRoom, onPresence) + tipos `Envelope`. | — |
| `src/net/localTransport.ts` | `LocalHub` in-memory + `localTransport(hub, token)`; entrega síncrona (microtask); simula presença/desconexão/takeover para os testes. | US1–US4 |
| `src/net/host.ts` | `createHost(transport, room)`: laço de autoridade (identidade→pausa→aplica→no-op→seq→persist→broadcast) + pausa por presença + congelamento de deadline. | FR-007..020 |
| `src/net/client.ts` | `createClient(transport, session)`: `send`, aplica difusão com replay, detecta gap→snapshot, expõe `game`/`room`/`paused` observáveis. | FR-004,010,012,014,015 |
| `src/net/session.ts` | Token de sessão (UUID em `localStorage`), parse do link (`roomId`), bootstrap create/join. | FR-003, D-019 |
| `src/net/supabaseTransport.ts` | Adapter Realtime (broadcast de comando) + Postgres (upsert/read snapshot) + Presence (desconexão). Lazy-import de `@supabase/supabase-js`. | infra |
| `supabase/migrations/*.sql` | Schema `rooms`/`room_seats`/`snapshots`, RLS, canais Realtime. | infra |

### Congelamento de deadline durante a pausa (FR-017)

O `GameState` guarda `deadline`s absolutos (ms epoch) em leilões. Hoje o store recompõe o timer pelo deadline e respeita `paused`. Na pausa por desconexão, o host: (1) seta `game.paused = true` via um comando de sistema `pause`/`resume` (não um comando de jogador — não passa pela checagem de identidade), (2) ao despausar, **desloca os deadlines** em voo pelo tempo pausado (`deadline += pausedMs`), de modo que a janela restante seja preservada. Comando de sistema também é difundido (seq) para todos congelarem/deslocarem igual. Isso reusa o `setPaused` já existente no store.

### Integração com o store Zustand

O store hoje aplica reducers direto no `set`. Para multiplayer:

- Introduz-se `connectMultiplayer(client)`: liga o `client` ao `useGameStore` — cada mudança de `client.game` faz `setState({ game })`; e os **métodos de ação** do store passam a **emitir `GameCommand`** via `client.send()` em vez de aplicar localmente (pessimista). Em single-player (default), nada muda.
- Os métodos do store são refatorados para construir um `GameCommand` e passá-lo por um único `run(cmd)`; `run` aplica local (single-player, comportamento idêntico ao de hoje) ou envia (multiplayer). Isso **não altera** nenhum reducer nem os 359 testes (que importam reducers/`createSeedState`, não os métodos do store).
- Boot mínimo de sala: `App.tsx` detecta `?room=<id>` (convidado) / `?host=1` (criar) e monta uma tela mínima de nome+cor+iniciar; sem esses params, boot single-player intacto (SC-007).

## Project Structure

### Documentation (this feature)

```text
specs/037-sala-online-estado-sincronizado/
├── spec.md          # já existe
├── plan.md          # este arquivo
└── tasks.md         # próximo passo
```

### Source Code

```text
src/
├── game/
│   └── commands.ts        # NOVO — GameCommand + applyCommand (dispatcher puro)
├── net/                   # NOVO módulo (casca de rede)
│   ├── recorder.ts
│   ├── room.ts
│   ├── transport.ts
│   ├── localTransport.ts
│   ├── host.ts
│   ├── client.ts
│   ├── session.ts
│   └── supabaseTransport.ts
└── game/store.ts          # editado — run(cmd) + connectMultiplayer

tests/net/                 # NOVO — suíte headless da fundação
├── convergence.test.ts    # US1: 2–8 clientes convergem (SC-001)
├── reconnect.test.ts      # US2: reload/reconexão sem perda (SC-003)
├── gap-recovery.test.ts   # FR-012: lacuna de seq → snapshot
├── pause.test.ts          # US3: pausa global, congela deadline, retoma (SC-004)
├── antispoof.test.ts      # US4: playerId forjado rejeitado (SC-005)
└── room.test.ts           # FR-001..006a: cor única, sala cheia, takeover

supabase/
└── migrations/
    └── 0001_rooms_snapshots.sql
```

**Structure Decision**: single project; toda a fundação vive em `src/net/` + um `src/game/commands.ts` (dispatcher). Nenhum arquivo de regra de `src/game/{turn,economy,cards,...}` é editado.

## Testabilidade (mapa SC → teste)

| SC | Como é provado |
|---|---|
| SC-001 (convergência) | `convergence.test.ts`: host + N clientes jogam sequência longa; `JSON.stringify(game)` idêntico após cada comando. |
| SC-003 (reload sem perda) | `reconnect.test.ts`: cliente descarta estado, reconecta com mesmo token → snapshot restaura assento + estado idêntico. |
| SC-004 (pausa) | `pause.test.ts`: desconecta um cliente → todos `paused`; comando rejeitado; deadline congela; reconecta → retoma. |
| SC-005 (anti-spoof) | `antispoof.test.ts`: comando com `playerId` alheio → descartado, estado imutável. |
| SC-007 (motor intacto) | Suíte existente (359) segue verde; nenhum arquivo `src/game/*` de regra editado. |
| SC-002 / SC-006 (perf/custo) | Por construção (difusão por comando); medição real só com Supabase conectado — fora do alcance dos testes headless. |

## Riscos & mitigações

- **Determinismo de replay**: qualquer `Math.random()`/`Date.now()` chamado FORA do `ctx` quebra a convergência. Mitigação: `freshGame()` (que usa `Math.random`) NÃO é usado no caminho de rede — o host cria o seed com um rng gravado; auditar que todos os reducers só usam `ctx.rng`/`ctx.now` (já é invariante do motor — princípio VII / 036).
- **Ordem de entrega no LocalTransport**: entrega síncrona pode reentrar; usar fila de microtask com processamento serial para simular o canal.
- **Store refactor**: risco de regressão de UI; mitigado por manter o caminho single-player idêntico e não tocar reducers.
```
