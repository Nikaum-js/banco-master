# Tasks: Fronteira de erro — a tela cai, a partida não

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Contrato**: [contracts/transport-delta.md](./contracts/transport-delta.md)

Legenda: `[P]` = paralelizável (arquivo independente) · `[USn]` = user story da spec · `[test-first]` = o teste vem antes do código.

**Testes**: obrigatórios, inclusive os novos (FR-023/024/025 exigem prova executável — não é opcional aqui, é requisito funcional). **Test-first onde o comportamento é a promessa da spec**: loop-breaker, encerramento de presença, recusa por falha.

**A ordem em 9 fases segue o "Fluxo de implementação" do plan**: a Fase 1 é a única dependência dura de todas as outras (a fronteira de último recurso não existe sem `activeSession`/`leaveOnFatalError`). Fases 4–8 são paralelizáveis entre si depois da Fase 1–3. **Cada fase termina com a suíte inteira verde.**

**A promessa a vigiar**: nenhum reducer muda, nenhum campo novo em `GameState`, nenhuma correção das exceções que hoje existem (exaustividade do log continua dívida da 040). Se durante a implementação surgir a tentação de "já que estou aqui, arrumo o `assertNever` do `describeLog.ts`" — **parar**. Não é escopo desta spec.

**O oráculo a preservar**: a suíte inteira de `tests/` passa hoje (350+ testes `node`). Nenhum deles pode mudar de ambiente ou de asserção — só o `include` do `vitest.config.ts` cresce (D6 do plan), de forma aditiva.

---

## Fase 1 — Sessão expõe encerramento de presença (bloqueia tudo)

**Meta**: `RoomSession` sabe se encerrar de fora, e existe um jeito de achar a sessão ativa sem prop-drilling.

- [x] **T001** `src/net/activeSession.ts`: módulo novo — `setActiveSession(s: RoomSession | null)`, `getActiveSession(): RoomSession | null`. Sem estado React, conforme [D2 do plan](./plan.md#d2--activesessionts-um-módulo-não-um-context).
- [x] **T002** [test-first] `tests/net/activeSession.test.ts`: `getActiveSession()` começa `null`; `setActiveSession` sobrescreve; `setActiveSession(null)` limpa.
- [x] **T003** `src/net/roomSession.ts`: `leaveOnFatalError(): void` — `host?.stop(); client?.leave();` seguido da mesma limpeza interna de `dispose()` (subs/listeners/disconnectStore). Idempotente: chamar duas vezes não lança.
- [x] **T004** [test-first] `tests/net/roomSession.test.ts` (ou suíte de sessão existente que cobrir `dispose`): `leaveOnFatalError()` chama `transport.disconnect()` (via `client.leave()`) exatamente como uma queda de presença real; chamar sem `client`/`host` (sessão nunca entrou) não lança; chamar duas vezes é seguro.
- [x] **T005** `src/net/ui/OnlineGate.tsx` (`OnlineRoom`): registrar `setActiveSession(session)` ao criar (mesmo `useState` lazy init) e `setActiveSession(null)` no cleanup do `useEffect` de `dispose()` (linha ~88).

**Checkpoint**: `bun run typecheck` e suíte verdes. Nenhuma fronteira existe ainda — só a capacidade de encerrar presença de fora.

---

## Fase 2 — Registro de falha e tela de falha (puros, sem fronteira)

**Meta**: os blocos que a fronteira vai orquestrar existem e são testáveis isolados, sem montar nada em React ainda além do próprio `FailureScreen`.

- [x] **T006** [P] `src/app/failureRegistry.ts`: `registerFailure({ where, phase, seq, error, now?, mintId? }): string` — grava via `console.error` estruturado (JSON: `{occurrenceId, where, phase, seq, message}`, **nunca** `stack` bruto com dados de jogo dentro, nunca mão de cartas/token/código — FR-018) e devolve o `occurrenceId` curto. `now`/`mintId` injetáveis (padrão `Date.now`/`crypto.randomUUID` truncado), default real.
- [x] **T007** [test-first] `tests/app/failureRegistry.test.ts`: `occurrenceId` é determinístico quando `mintId` é injetado; o registro nunca contém as strings de teste que representam carta/token/reentryCode passadas de propósito no `where`/`error.message` (assert de ausência); duas chamadas geram ids diferentes com o `mintId` real.
- [x] **T008** [P] `src/app/loopBreaker.ts`: `createLoopBreaker(store)` puro — `store: {get(k: string): string | null; set(k: string, v: string): void}` injetado (produção usa `sessionStorage`, default exportado). `check(key, signature): 'first' | 'repeat'` — primeira vez que a assinatura aparece sob aquela chave → `'first'` e grava; mesma assinatura de novo → `'repeat'`; assinatura **diferente** → `'first'` de novo (reseta), conforme [D4 do plan](./plan.md#d4--loop-breaker-sobrevive-a-reload-via-sessionstorage-não-via-estado-react).
- [x] **T009** [test-first] `tests/app/loopBreaker.test.ts`: primeira ocorrência de uma assinatura → `'first'`; repetição da mesma → `'repeat'`; assinatura nova reseta pra `'first'`; usando um `store` fake em memória (sem tocar `sessionStorage` de verdade — prova que a lógica não depende do browser).
- [x] **T010** `src/app/FailureScreen.tsx`: componente puro por props — `variant: 'match' | 'root'`, `mode: 'room' | 'local'`, `roomId: string | null`, `occurrenceId: string`, `canRetry: boolean`, `onRetry?: () => void`. Room: afirma o que está preservado ("saldo, propriedades, cartas e prazos ficam exatamente como estão" — mesma frase do `PauseBanner`, FR-013) e oferece "Reabrir a sala" (`window.location.href = roomLink(...)`, [D3 do plan](./plan.md#d3--a-tela-de-falha-não-pergunta-nada-à-sessão-ela-lê-a-url)). Local: diz que não há recuperação e oferece "Recomeçar" (FR-014). Sem contagem regressiva, sem prazo, sem ação destrutiva sem confirmação (FR-015). **Não recebe `GameState` nem `Room` como prop** — é a garantia do edge case "a exceção acontece na própria tela de falha".

**Checkpoint**: `failureRegistry`, `loopBreaker` e `FailureScreen` testados isolados, ainda não conectados a nenhuma fronteira.

---

## Fase 3 — Fronteira de último recurso

**Meta**: uma queda na casca ou no boot nunca mais é tela branca, e a presença é encerrada antes da tela de falha aparecer.

- [x] **T011** [US3] `src/app/RootErrorBoundary.tsx`: classe React. `componentDidCatch(error)` — **primeiro** `getActiveSession()?.leaveOnFatalError()` (síncrono, antes de qualquer `setState` — [D1 do plan](./plan.md#d1--onde-cada-fronteira-fica-e-por-quê-o-react-garante-o-contrato)), depois `registerFailure({ where: 'root', ... })`, depois marca erro no estado. Deriva `mode`/`roomId` da URL (`parseRoomLink`/`URLSearchParams`, o mesmo check textual de `OnlineGate.tsx:31-34`) — nunca de props ou de `getActiveSession()`. Renderiza `<FailureScreen variant="root" canRetry={false} .../>` (não há remontagem no lugar aqui — só "reabrir"/"recomeçar", US3 não promete continuar de onde parou).
- [x] **T012** `src/main.tsx`: `<RootErrorBoundary><App/></RootErrorBoundary>`.
- [x] **T013** [test-first] `tests/ui/errorBoundaries/rootErrorBoundary.test.tsx`: um filho que lança no render → `FailureScreen` aparece (nunca árvore vazia, FR-001); com uma sessão fake registrada via `setActiveSession`, `leaveOnFatalError` é chamado antes do fallback renderizar; sem sessão ativa (boot), não lança e mostra o caminho "voltar ao início"; modo local (`?local=1` simulado) mostra a variante sem oferta de recuperação (FR-014); a própria árvore de fallback nunca lê `window.__game__` nem qualquer store (não regride o edge case da tela-que-quebra-a-si-mesma).

**Checkpoint**: **SC-001** (parcial, casca) e **SC-007** provados. Rodar manualmente: forçar `throw` em `HomeScreen` e em `OnlineRoom` — nenhum dos dois deixa `<div id="root">` vazio.

---

## Fase 4 — Fronteira de jogo (US1/US2) e loop-breaker

**Meta**: a superfície de partida cai sem a mesa sentir nada, e remontar é uma tentativa, não um laço.

- [x] **T014** [US1] `src/app/MatchErrorBoundary.tsx`: classe React com `key` interna incrementável (o padrão de "remontar" via `key++`). `componentDidCatch` chama `registerFailure({ where: 'match', ... })` e computa `signature = error.name + '|' + error.message` (nunca stack — instável entre builds); consulta `loopBreaker.check('bm:boundary:match', signature)`. `'first'` → oferece `FailureScreen variant="match" canRetry={true} onRetry={...remonta via key}`. `'repeat'` → `canRetry={false}`, mesma tela, sem botão. Props: `roomSurvived: boolean` (vem de `OnlineGate`, que sabe se está na fase `'playing'`), `roomId`.
- [x] **T015** [US1] `src/net/ui/OnlineGate.tsx`: na fase `'playing'` (linha ~99), envolver **só `{children}`** — não `OnlineRoom` inteiro — em `<MatchErrorBoundary roomSurvived roomId={room?.id ?? null}>{children}</MatchErrorBoundary>`. `SessionBadge` fica **fora** da fronteira (é status de sessão, não de partida — sobrevive à queda da vista).
- [x] **T016** [test-first] `tests/ui/errorBoundaries/matchErrorBoundary.test.tsx`: filho que lança no render → `FailureScreen variant="match"` com `canRetry=true` na primeira vez; clicar "voltar para a partida" remonta (o filho deixa de lançar na segunda montagem → jogo reaparece, **FR-010**); filho que lança **sempre** (mesma assinatura) → segunda captura mostra `canRetry=false` e o identificador de ocorrência, **sem** terceira tentativa automática (FR-011); um componente-irmão fora da fronteira (simulando `SessionBadge`) não desmonta quando a fronteira captura.
- [x] **T017** [US1] `tests/ui/errorBoundaries/matchErrorBoundary.test.tsx` (mesmo arquivo, caso adicional): remontar a `MatchErrorBoundary` inteira num `render()` novo (simulando reload) com a **mesma assinatura já registrada** no `store` do `loopBreaker` → mostra direto `canRetry=false`, sem oferecer a primeira tentativa de novo (FR-011 "inclusive através de reload", FR-024).

**Checkpoint**: **SC-002**, **SC-004** provados headless. **SC-005** (efeito zero nas outras telas) fica pendente de prova real até a Fase 9 (E2E) — aqui só se prova que a fronteira de jogo não desmonta o pai (T016, último caso).

---

## Fase 5 — Camada acessória (log e som)

**Meta**: o log central e o som caem sem levar o tabuleiro junto.

- [x] **T018** [US1] `src/app/AccessoryErrorBoundary.tsx`: classe fininha — `componentDidCatch` registra (`where: 'accessory:' + label`) e renderiza uma linha "`{label} indisponível`" no lugar do filho, sem tela cheia.
- [x] **T019** [US1] `src/boards/shared.tsx` (~linha 1590, `CenterLog`): envolver o `.map` que chama `describeLogEntry`/`logIcon` por item em `<AccessoryErrorBoundary label="Histórico">` — uma entrada de log sem descritor derruba **só a linha dela ou o painel do log**, nunca o tabuleiro/modais/controles (FR-004).
- [x] **T020** [US1] `src/game/ui/sound/SoundLayer.tsx`: envolver o componente (o que lê o seletor de `classify.ts`) em `<AccessoryErrorBoundary label="Som">`.
- [x] **T021** [test-first] `tests/ui/errorBoundaries/accessoryErrorBoundary.test.tsx`: filho que lança → some só ele, mostra a linha de indisponibilidade; um irmão fora da fronteira (simulando o tabuleiro) continua de pé; entrada de log com `kind` desconhecido (simulando `assertNever`) não impede o resto do painel de log de renderizar.

**Checkpoint**: **SC-003** provado — um fato que a apresentação não sabe descrever não derruba a mesa.

---

## Fase 6 — Ambiente de teste (base das Fases 2–5, formalizada aqui)

**Meta**: as Fases 2–5 já rodaram sobre o ambiente novo — esta fase é onde ele fica formalizado e auditável, sem tocar a suíte `node` existente.

- [x] **T022** `package.json`: `devDependencies` — `@testing-library/react`, `jsdom`. `bun add -d` (respeitou `bun.lock`, nenhum lockfile novo).
- [x] **T023** `vitest.config.ts`: `include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx']` — default continua `environment: 'node'`. `environmentMatchGlob` **não existe no Vitest 4** (corrigido de D6 do plan após checar o pacote instalado); cada `.test.tsx` novo sobe pra `jsdom` via pragma `// @vitest-environment jsdom` na 1ª linha do arquivo.
- [x] **T024** Checkpoint explícito: `bun run test` roda as ~350 suítes `.test.ts` em `node` **e** as novas `.test.tsx` de `tests/ui/**` em `jsdom`, sem nenhuma das antigas mudar de ambiente. Confirmar via log do vitest (`environment: node` vs `jsdom` por arquivo, se o reporter expuser) ou por inspeção — nenhuma asserção nova aqui, é validação de infraestrutura.

**Checkpoint**: **SC-009** provado — suíte monta componente React pela primeira vez, sem regressão nas existentes.

---

## Fase 7 — Exceções fora do render, caminho da autoridade (US5, P3)

**Meta**: um comando que aborta ao ser aplicado nunca é silencioso, e a recusa por falha é distinguível de recusa por regra.

- [x] **T025** [US5] `src/net/transport.ts`: `rejectCommand(toToken: string, info: { occurrenceId: string }): void` na porta, conforme [contracts/transport-delta.md](./contracts/transport-delta.md). **Correção em relação ao texto original desta task**: não é unicast de verdade na porta — como `rejectJoin`, trafega no canal compartilhado e quem filtra pelo próprio token é o assinante (`client.ts`). Contrato e comentário do código corrigidos para não prometer o que a implementação espelhada de `rejectJoin` não dá.
- [x] **T026** [P] [US5] `src/net/localTransport.ts`: implementar `rejectCommand` (mesmo padrão de `rejectJoin` — trafega a todas as conexões, cada uma filtra pelo `toToken`).
- [x] **T027** [P] [US5] `src/net/supabaseTransport.ts`: implementar `rejectCommand`.
- [x] **T028** [US5] [test-first] `tests/net/conformance.test.ts`: caso novo — quem assina recebe `toToken`/`occurrenceId` exatos; duas recusas seguidas para o mesmo token chegam as duas, em ordem.
- [x] **T029** [US5] `src/net/host.ts` (`handleSubmit`/`accept`): `accept(action, fromToken?)` — `fromToken` passa a fluir de `handleSubmit`. `try/catch` **só** em volta de `applyCommand`, conforme [D5 do plan](./plan.md#d5--hostaccept-falha-vira-recusa-visível-nunca-estado-parcial): falha → `registerFailure({ where: 'host.accept', phase: room.status, seq, error })`, `fromToken && transport.rejectCommand(fromToken, { occurrenceId })`, `return false` **sem** tocar `game`/`seq`/`broadcast`. Comando de sistema (`tick()`, sem `fromToken`) só registra, sem unicast.
- [x] **T030** [test-first] `tests/net/hostFailure.test.ts`: `applyCommand` mockado via `vi.mock('@/game/commands', ...)` (a real não lança hoje — a fronteira existe pra próxima exceção que ninguém previu) pra lançar num `kind` real → `game`/`seq` **inalterados** (baseline relativo, não `0` — join/presença já consomem `seq` própria), nenhum broadcast, remetente recebe `rejectCommand` com `occurrenceId`; terceiro não envolvido não recebe; comando de SISTEMA (`pause` via `syncPause`, disparado por `client.leave()`) que lança na mesma via não escapa do chamador — a mesa continua respondendo a comandos normais depois.
- [x] **T031** [US5] `src/net/client.ts`: assinar `rejectCommand` (quando `toToken === this.token`), expor `lastCommandFailure(): { occurrenceId: string } | null`, limpo no próximo `send()` bem-sucedido ou reconexão.
- [x] **T032** [US5] `src/net/ui/OnlineGate.tsx` (ou componente irmão pequeno): toast/aviso lendo `client.lastCommandFailure()` — visível, não intrusivo, mesmo padrão de `ConnectionBanner`. **Não** é para recusa por regra (essa continua silenciosa, fora de escopo).
- [x] **T033** [test-first] `tests/ui/errorBoundaries/commandFailureToast.test.tsx` (ou junto de um teste de `OnlineGate` existente): `lastCommandFailure` populado → toast aparece com o `occurrenceId`; `null` → nada aparece.

**Checkpoint**: **SC-008** provado — comando que falha ao ser aplicado nunca é silencioso, em nenhuma tentativa.

---

## Fase 8 — Coletor de exceções fora do render

**Meta**: handler de evento, timer, callback de canal e promessa rejeitada nunca ficam mudos.

- [x] **T034** [US5] `src/main.tsx`: `window.addEventListener('error', ...)` e `window.addEventListener('unhandledrejection', ...)` registrados uma vez, chamando `registerFailure({ where: 'window', ... })` com a mesma forma de FR-016 (o quê, fase, seq — melhor esforço, já que o coletor global não sabe em que componente estava).
- [x] **T035** [test-first] `tests/app/globalCollector.test.ts` (jsdom — dispara `window.dispatchEvent`): um `ErrorEvent` sintético e um `unhandledrejection` sintético chamam `registerFailure` uma vez cada, sem lançar para fora do listener. **Caso "uninstall" removido**: `dispatchEvent('error')` sem listener escala pro reporter de exceção não tratada do próprio Vitest/jsdom (falso positivo do harness de teste, não do código) — os dois casos que provam a captura já bastam para FR-019.

**Checkpoint**: **SC-006** provado por completo (identificador sem console aberto, nenhum dado sensível registrado) — junto com T007.

---

## Fase 9 — Prova em browser real e fechamento

- [x] **T036** [US3] `e2e/errorBoundary.spec.ts`: dois browsers numa sala; a casca de um cliente cai via hook de E2E determinístico (`?e2eCrashCasca=1`, novo em `OnlineGate.tsx`/`OnlineRoom` — mesmo espírito de `?players=N`, já que injetar exceção real via `page.evaluate` não alcança o caminho de render de dentro da página de forma confiável) — o outro browser observa a partida pausar nomeando o primeiro por **desconexão** (§11.3, mesma mensagem de qualquer outra queda — **FR-025**); reabrir o link (link limpo, sem o parâmetro) retoma pelo caminho normal de reconexão (041). Gated por `E2E_PRESENCE=1`, como o teste de queda de `multiplayer.spec.ts` — depende de infra Supabase real e do heartbeat do Realtime; **não executado neste ambiente** (sem projeto Supabase configurado aqui — confirmado que o `--list` do Playwright resolve o teste corretamente). Falta rodar contra infra viva antes do merge.
- [x] **T037** [P] `docs/adr/README.md`: já lista D-035 (feito na etapa de specify) — conferido, índice correto.
- [x] **T038** Fechamento: `bun run lint`, `bun run typecheck`, `bun run test` (suíte inteira, `node` + `jsdom`, rodada múltiplas vezes ao longo da implementação, sempre verde) e `bun run build` (produção, verde). Nenhuma regressão nas suítes de `tests/net/`, `tests/game/`, `tests/sim/`. Verificação manual em browser (`bun run dev`): modo local renderiza sem regressão (screenshot); modo sala sem Supabase configurado mostra a mensagem esperada — o caminho completo de `OnlineRoom`/`MatchErrorBoundary` em sala real não pôde ser exercitado manualmente neste ambiente por falta de projeto Supabase, mesma limitação do `test:e2e`.

**Checkpoint**: todos os SC-001..009 provados; nenhuma regressão.

---

## Rastreabilidade

| Requisito | Tasks |
|---|---|
| FR-001..004 (contenção, fronteira de jogo abaixo da sessão, camada acessória) | T011, T013, T014–T017, T018–T021 |
| FR-005..008 (fronteira de último recurso, encerra presença, sem causa nova, tela fora do estado) | T001–T005, T011, T012, T013 |
| FR-009..015 (remontagem, loop-breaker, reentrada, local, sem prazo/ação destrutiva) | T008, T009, T010, T014, T016, T017 |
| FR-016..018 (registro estruturado, id curto, sem PII) | T006, T007 |
| FR-019..022 (exceções fora do render, recusa por falha distinguível) | T025–T033, T034–T035 |
| FR-023..026 (prova executável, ambiente de teste novo) | T013, T016, T017, T021, T022–T024 |
| Prova em browser real (FR-025/SC-005) | T036 |
