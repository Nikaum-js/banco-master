# Tasks: Partida online jogável — perspectiva local, identidade real e roteamento

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Research**: [research.md](./research.md) · **Contrato**: [contracts/local-view.md](./contracts/local-view.md)

Legenda: `[P]` = paralelizável (arquivo independente) · `[USn]` = user story da spec. Ordem = dependência técnica.

> **Status (2026-07-25): US1–US5 implementadas.** `bunx vitest run` → **436 testes / 60 arquivos** verdes (era 397/56); `tsc`, `eslint` do delta e `bun run build` limpos; `bun run scripts/net-smoke.ts` verde contra a infra real, agora validando também a perspectiva local. Restam T036 (roteiro manual em dois browsers) e T037 (docs finais).

**Testes**: obrigatórios. A spec tem success criteria verificáveis headless, e a fatia mexe em 11 arquivos de UI — sem suíte, a regressão do single-player (SC-007) é invisível. Lógica em módulos puros, testada em `tests/net/` (decisão D8 do research).

---

## Fase 1 — Fundação da perspectiva (bloqueia todas as US)

- [x] **T001** `src/game/commands.ts`: extrair `actorOfKind(state, kind)` da tabela que `actorOf` já usa e reescrever `actorOf` como consumidor dela (zero duplicação). Comandos cujo ator depende do payload (`place-bid`, `propose-trade`) devolvem `null` em `actorOfKind` com comentário do porquê — a UI compõe com elegibilidade.
- [x] **T002** `tests/net/localView.test.ts` [P]: teste de **exaustividade** — itera todo `GameAction['kind']` e falha se algum não tiver perspectiva decidida. É o teste que impede a tabela de apodrecer.
- [x] **T003** `src/net/localView.ts`: `localView(game, room, myToken)` conforme [contracts/local-view.md](./contracts/local-view.md) — `seatId`, `role`, `isMe`, `mayAct`, `waitingFor`. Sem sala → `role: 'local'`, `mayAct` sempre `true` (FR-029).
- [x] **T004** `tests/net/localView.test.ts`: identidade × elegibilidade (lance de leilão), ator fora do turno (troca recebida, reação, empréstimo), eliminado não age (FR-007), single-player não bloqueia nada.
- [x] **T005** `src/net/identity.ts` [P]: `identityOf(room, playerId) → {name, color, piece}` + catálogo de 8 peças; fallback `Jogador N` sem sala (FR-009/FR-023).
- [x] **T006** `tests/net/identity.test.ts` [P]: nomes duplicados distinguíveis por cor/peça (FR-011); fallback single-player; **`GameState` serializado não contém nome algum** (D-019).
- [x] **T007** `src/net/roomStore.ts`: store Zustand aditivo (`room`, `myToken`) + hooks `useLocalView()`/`useIdentity()`; `connectStore.ts` passa a alimentá-lo junto com o `game`.

**Checkpoint**: perspectiva disponível para a UI, sem nenhuma tela alterada ainda.

---

## Fase 2 — US1: cada um joga do seu lugar (P1) 🎯 MVP

**Meta**: nenhum controle de decisão alheio acionável; mão privada de verdade.

- [x] **T008** [US1] `src/game/ui/GameDriver.tsx`: auto-resolve/auto-finalize só quando `mayAct` (research D5).
- [x] **T009** [US1] `src/game/ui/modals/activeModal.ts`: o descritor do modal passa a carregar o **ator** da decisão, para o layer não recalcular.
- [x] **T010** [US1] `src/game/ui/modals/ModalLayer.tsx`: ator vê controles; demais veem a mesma superfície em modo "assistindo" com `aguardando <nome>` (research D4).
- [x] **T011** [P] [US1] `src/game/ui/cards/handView.ts` + `HandPanel.tsx` + `HandCardLayer.tsx`: mão do **dono da tela** (FR-005); contador para os outros (FR-006).
- [x] **T012** [P] [US1] `src/game/ui/trade/TradeLayer.tsx`: proposta recebida só no destinatário; proponente vê "aguardando <nome>".
- [x] **T013** [P] [US1] `src/game/ui/landAuction/LandAuctionLayer.tsx`: lance fixo no próprio assento (o seletor de licitante do 031 vira o meu).
- [x] **T014** [US1] `src/game/ui/GameHUD.tsx`: barra de decisão (prisão/dívida/reação) só quando `mayAct`; painel de jogadores permanece público (§12.3).
- [x] **T015** [US1] `tests/net/perspective.test.ts`: sobre o `LocalHub`, 3 clientes — cada ponto de decisão do roteiro é acionável só no cliente do ator (SC-001); comando de não-ator continua descartado pelo host.

**Checkpoint**: US1 demonstrável em dois browsers. É o MVP da spec.

---

## Fase 3 — US2: todo mundo tem nome (P2)

- [x] **T016** [P] [US2] `src/game/ui/GameHUD.tsx`: nome/cor no lugar de `p.id` (linhas 181, 288, 377 — vitória, jogador ativo, pedido de empréstimo).
- [x] **T017** [P] [US2] `src/game/ui/LiveTokens.tsx` + `src/boards/shared.tsx`: peça e cor por identidade da sala (§12.5).
- [x] **T018** [P] [US2] `src/game/ui/deed/deedView.ts` + log de eventos: dono/atores por nome.
- [x] **T019** [US2] `tests/net/identity.test.ts`: varredura — nenhuma superfície derivada expõe `p1..p8` quando há sala (SC-002).

**Checkpoint**: a mesa tem identidade; vitória celebra gente, não `p1`.

---

## Fase 4 — US3: ninguém é punido por cair (P3)

- [x] **T020** [US3] `src/net/room.ts` + `src/net/host.ts`: gatilho de pausa passa a ignorar assentos de jogadores **eliminados** (`anyDisconnected(room, game)`); retomada não espera eliminados (D-029/FR-018a). **Test-first** — ver T021.
- [x] **T021** [US3] `tests/net/pause.test.ts`: eliminado que cai NÃO pausa; jogador vivo que cai continua pausando (não afrouxar o que a 037 provou).
- [x] **T022** [US3] `src/net/ui/PauseBanner.tsx` [P]: quem caiu (por nome), mensagem específica para host ausente (FR-017), sem contagem regressiva (FR-019).
- [x] **T023** [US3] `src/game/ui/GameHUD.tsx`: status de conexão por assento no painel (FR-015).
- [x] **T024** [US3] `src/net/ui/OnlineGate.tsx`: aba que perdeu o assento por takeover avisa em vez de ficar morta (FR-020).

**Checkpoint**: pausa deixa de parecer travamento.

---

## Fase 5 — US4: entrar e sair da sala (P4)

- [x] **T025** [US4] `src/net/room.ts`: `kickSeat(room, token)` puro — libera cor/peça, host não se remove (FR-024/025).
- [x] **T026** [US4] `src/net/transport.ts` + `src/net/host.ts`: remoção publica a sala sem o assento e recusa o token com motivo `kicked` (research D6); reabrir o link após remoção volta a ser pedido novo (FR-026).
- [x] **T027** [P] [US4] `tests/net/kick.test.ts`: remoção no lobby, cor liberada, host não se remove, removido não readquire assento sozinho.
- [x] **T028** [US4] `src/net/ui/HomeScreen.tsx` [P]: criar sala / colar link (FR-021).
- [x] **T029** [US4] `src/net/ui/OnlineGate.tsx`: roteador de fases `home | identity | lobby | match | ended` (FR-027/028), preservando o boot single-player (FR-029).
- [x] **T030** [US4] `src/net/ui/LobbyScreen.tsx`: escolha de **peça** além de nome/cor (FR-022), botão de remover para o host, aviso ao removido.

**Checkpoint**: dá para jogar sem nunca editar a URL.

---

## Fase 6 — US5: a ordem da mesa é sorteada (P5)

- [x] **T031** [US5] `src/net/room.ts` + `src/net/host.ts`: ordem sorteada no início com o RNG do host, alimentando `playerIdsInOrder` (FR-030) — composição sobre o `turnOrder` que já existe.
- [x] **T032** [US5] `tests/net/lobby.test.ts`: ordem idêntica em todos os clientes (FR-031); com seeds distintas, varia (SC-008).
- [x] **T033** [US5] `src/net/ui/LobbyScreen.tsx`: tela de ordem sorteada antes do primeiro turno.

---

## Fase 7 — Verificação

- [x] **T034** Gates: `bunx vitest run` (motor intacto — SC-007), `bunx tsc --noEmit -p tsconfig.app.json`, `bunx eslint src/net src/game/ui src/App.tsx`, `bun run build`.
- [x] **T035** `scripts/net-smoke.ts`: passo de perspectiva contra a infra real (convidado não consegue acionar decisão do host; host sim).
- [x] **T036** **Automatizado** em `e2e/multiplayer.spec.ts` (dois `BrowserContext` isolados — abas do mesmo browser compartilhariam o token de sessão): home → criar sala → entrar por link → iniciar → ordem sorteada → identidade sem `pN` → só o ator tem "Rolar dados" → jogada propaga. ~7s, 3/3 estável. O passo de **pausa por queda** ficou em teste OPT-IN (`E2E_PRESENCE=1`): depende do heartbeat do Realtime (imediato em fechamento limpo, ~60-75s em queda abrupta) e não pode ser gate.
- [x] **T037** `HANDOVER.md` + `docs/PRD.md` + memória atualizados.

---

## Dependências

- **Fase 1 bloqueia tudo** (T001–T007). Dentro dela: T001 → T003 → T007; T005/T006 são independentes [P].
- **US1 (Fase 2)** depende só da Fase 1 — é o MVP e pode parar aí.
- **US2, US3, US4, US5** dependem da Fase 1 e são independentes entre si (podem ser reordenadas por prioridade de demo).
- T020 (D-029) é a única tarefa que muda comportamento de rede já provado — vai test-first (T021 antes de T020).

## Estratégia

Entregar **US1 primeiro e validar em dois browsers** antes de seguir: é a fatia que muda a natureza do produto (de "sincronizado" para "jogável"). US2 logo depois, porque é o critério de DoD do PRD que mais salta aos olhos numa demo. US3–US5 são incrementos que não bloqueiam ninguém.
