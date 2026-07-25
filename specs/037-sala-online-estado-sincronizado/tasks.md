# Tasks: Sala Online e Estado Sincronizado (fundação multiplayer)

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)

Legenda: `[P]` = paralelizável (arquivo independente). Ordem = dependência técnica, não prioridade de US.

> **Status de execução (2026-07-24):** fundação IMPLEMENTADA e verde — **397 testes** (363 do motor + 34 de rede em `tests/net/`), typecheck + `bun run build` + lint (delta) limpos. Motor intacto (SC-007). Provados headless via `LocalTransport`: SC-001 (convergência 2/3/8p), SC-003 (reconexão), SC-004 (pausa), SC-005 (anti-spoof), FR-001..020. **T018 destravada e feita nesta sessão** (lobby no browser + join de convidado sobre a rede + retomada de autoridade do host) — o que fica para o 038+ é o lobby RICO (avatares, rolagem de ordem inicial, perspectiva de jogador local na UI). SC-002/006 (perf/custo) só medíveis com Supabase conectado.

## Fase 0 — Dispatcher puro (base de host e cliente)

- [x] **T001** `src/game/commands.ts`: definir `GameCommand` union (produção; mesma forma do `SimAction` dev-only) e `applyCommand(state, cmd, ctx): GameState` — `switch` sobre os reducers existentes, incluindo o gatilho de escassez de terrenos (`maybeOpenLandAuction`) nos mesmos pontos do store/driver. Puro; no-op preserva referência. (FR-008/009)
- [x] **T002** `tests/net/commands.test.ts` [P]: `applyCommand` reproduz o store para uma sequência canônica (roll→buy→finalize); no-op de comando inválido preserva referência.

## Fase 1 — Determinismo (FR-011)

- [x] **T003** `src/net/recorder.ts`: `recordingCtx(base)` → `{ ctx, drain(): Resolved }` grava `rng[]`/`now[]`; `replayCtx(base, resolved)` devolve os valores em ordem; embrulha também `ports.taxMan` e `resolve`.
- [x] **T004** `tests/net/recorder.test.ts` [P]: host grava, cliente replica → mesmo `GameState` para um `roll` (dados idênticos) sem chamar `Math.random`.

## Fase 2 — Sala e identidade (US1 setup, US4)

- [x] **T005** `src/net/room.ts`: tipo `Room`/`Seat` + reducers puros `createRoom`, `joinRoom` (cor única, nome livre, sala cheia=8, recusa pós-início de token novo), `startGame` (2+ jogadores, ordem=entrada, host=1º), `reattach` (mesmo token→mesmo assento), `markDisconnected`/`markConnected`, `takeoverConnection` (mesmo token nova conexão derruba a antiga, sem pausa). (FR-001..006a, 019)
- [x] **T006** `src/net/session.ts` [P]: token de sessão (UUID `localStorage`), parse do link `?room=`, helpers create/join.
- [x] **T007** `tests/net/room.test.ts` [P]: cor única rejeita duplicata; nome duplicado ok; 9º recusado; token desconhecido pós-início recusado; takeover não dispara desconexão. (SC — US1/US4 de sala)

## Fase 3 — Transport

- [x] **T008** `src/net/transport.ts`: interface `Transport` (connect/disconnect, broadcast/onCommand, loadSnapshot/saveSnapshot, publishRoom/onRoom, onPresence) + tipos `Envelope`/`PersistedSnapshot`.
- [x] **T009** `src/net/localTransport.ts`: `LocalHub` in-memory (fila serial de microtask) + `localTransport(hub, token)`; APIs de teste p/ simular desconexão/reconexão/takeover.

## Fase 4 — Host (autoridade) — US1, US3, US4

- [x] **T010** `src/net/host.ts`: `createHost(transport, room)` — pipeline: identidade (FR-007) → pausa (FR-017) → `recordingCtx`+`applyCommand` (FR-008) → no-op check (FR-009) → `seq++` → `saveSnapshot` upsert (FR-013) → `broadcast(cmd+resolved+seq)` (FR-010/011). Comando de sistema `pause`/`resume` (não passa por identidade) desloca deadlines em voo ao retomar (FR-017). Pausa por presença: qualquer desconexão → pausa; host desconectado → pausa indefinida sem transferência (FR-016/019); reconexão → resume automático (FR-018). Estado intacto do desconectado (FR-020).
- [x] **T011** `tests/net/antispoof.test.ts` [P]: `playerId` forjado → descartado, estado imutável; sessão sem assento → descartada; ação legítima fora-de-turno (lance/resposta a trade) aceita. (SC-005)

## Fase 5 — Cliente — US1, US2

- [x] **T012** `src/net/client.ts`: `createClient(transport, session)` — `send(cmd)` injeta `playerId`; `onCommand` aplica com `replayCtx`; detecta gap de `seq` → `loadSnapshot` (FR-012); `join`/reconnect lê snapshot (FR-014); expõe `game`/`room`/`paused` + `subscribe`.
- [x] **T013** `tests/net/convergence.test.ts`: host + 2..8 clientes rodam sequência longa (via agente aleatório do harness ou roteiro fixo); `JSON.stringify(game)` idêntico entre todos após cada comando difundido. (SC-001)
- [x] **T014** `tests/net/reconnect.test.ts` [P]: cliente zera estado e reconecta (mesmo token) → snapshot restaura assento + estado idêntico ao par; host reconecta → reassume autoridade e difusão. (SC-003)
- [x] **T015** `tests/net/gap-recovery.test.ts` [P]: cliente perde 1 comando difundido → detecta lacuna → recupera via snapshot, converge. (FR-012)

## Fase 6 — Pausa/resiliência — US3

- [x] **T016** `tests/net/pause.test.ts`: desconexão → todos `paused` + status do caído; comando de jogo rejeitado durante pausa; deadline de leilão congela e retoma preservando a janela; reconexão → resume automático; host caído → pausa indefinida. (SC-004, FR-016..020)

## Fase 7 — Integração com o app

- [x] **T017** `src/net/connectStore.ts` — `connectMultiplayer(client)` ADITIVO (decisão de risco: NÃO refatora `store.ts`, single-player fica intacto): sobrescreve os métodos de ação do `useGameStore` para emitir `GameAction` via `client.send` (pessimista) e injeta o `game` difundido no store. Coberto por `tests/net/wiring.test.ts`.
- [x] **T018** `src/App.tsx` + tela mínima de sala (`src/net/ui/OnlineGate.tsx` + `LobbyScreen.tsx`): `?host=1` cria sala; `?room=<id>` entra (nome+cor+iniciar); sem params → single-player intacto (SC-007). O gate monta o transporte Supabase, roda `createHost` no browser de quem criou a sala, liga `connectMultiplayer` quando o `GameState` chega e agenda `host.tick()` (prazos de leilão). Reabrir o link como host reassume a autoridade pelo snapshot (FR-015).

## Fase 8 — Adapter Supabase (connect-ready, sem infra viva)

- [x] **T019** `supabase/migrations/0001_rooms_snapshots.sql` [P]: tabelas `rooms`, `room_seats`, `snapshots` (1 linha/partida, upsert); RLS mínima; nota de canais Realtime.
- [x] **T020** `src/net/supabaseTransport.ts` [P]: adapter implementando `Transport` sobre Realtime (broadcast de comando) + Postgres (upsert/read snapshot) + Presence (desconexão). Lazy-import de `@supabase/supabase-js`; documentar env `VITE_SUPABASE_URL`/`ANON_KEY`.

## Fase 8b — Lobby sobre a rede e infra viva (2026-07-24)

- [x] **T023** `src/net/transport.ts`: a porta ganha o canal de LOBBY — `requestJoin`/`onJoinRequest` (o assento é identificado pelo token da CONEXÃO, não por algo declarado), `rejectJoin`/`onJoinRejected` (recusa com motivo: cheia/cor tomada/já iniciada) e `saveRoom`/`loadRoom` (a sala existe antes de haver `GameState`, então o snapshot não serve). Implementado nos dois transportes.
- [x] **T024** `src/net/host.ts`: `open()` (abre o lobby e, se já houver partida persistida, reassume a autoridade pelo snapshot — FR-015), `startMatch()` (lobby → partida, FR-006), concessão/recusa de assento (FR-002/005) e presença também no lobby. `subscribe()` para a UI da sala.
- [x] **T025** `src/net/client.ts`: `requestJoin`/`joinError`; ao ver a sala sair de `lobby` sem ter o jogo, busca o 1º snapshot (FR-006/014); lê a sala persistida quando ainda não há partida.
- [x] **T026** `tests/net/lobby.test.ts` (10 testes): concessão de assento pelo transporte, identidade pelo token da conexão, cor tomada, sala cheia, recusa dirigida só ao pedinte, início com 2+ e convergência do estado inicial, recusa pós-início, reanexo por token, host reassumindo autoridade após F5.
- [x] **T027** `src/net/supabaseTransport.ts`: `broadcast.self: true` no canal — sem o eco do próprio envio o host não veria os próprios comandos (o modelo da spec é uniforme: todo mundo submete e só aplica o que volta difundido).
- [ ] **T028** Aplicar `supabase/migrations/0001_rooms_snapshots.sql` no projeto (idempotente) e validar uma partida real 2 abas: propagação (SC-002), pausa por desconexão real e custo do free tier (SC-006).

## Fase 9 — Verificação

- [x] **T021** Rodar suíte completa (`bunx vitest run`) — 359 existentes + novos verdes; `bun run build`; `bun run lint` no delta. Confirmar SC-007 (nenhum arquivo de regra de `src/game/*` com comportamento alterado).
- [x] **T022** Atualizar `HANDOVER.md`/memória com o estado da fundação e o passo pendente (conectar Supabase real).
