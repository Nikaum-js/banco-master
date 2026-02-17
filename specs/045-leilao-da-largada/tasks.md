# Tasks: Leilão da Largada

**Input**: Design documents from `/specs/045-leilao-da-largada/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: obrigatórios pela spec (SC-001..007), escritos antes da implementação correspondente.

## Phase 1: Setup

**Purpose**: preparar persistência e contrato executável da nova fase.

- [x] T001 Criar `supabase/migrations/0005_opening_auction.sql` com `opening_auction`, persistência e redação de `openingBid` em `room_preview`/`read_snapshot`/funções de escrita
- [x] T002 [P] Atualizar o espelho estrutural do Supabase e o contrato de persistência em `tests/net/fakeSupabase.ts` e `tests/net/conformance.test.ts`

---

## Phase 2: Foundational

**Purpose**: estado de sala e porta privada que bloqueiam todas as histórias.

- [x] T003 Escrever testes falhos dos reducers de faixa, passo, duplicata, $0 por prazo, ordenação e desempate em `tests/net/openingAuction.test.ts`
- [x] T004 Implementar tipos, normalização, constantes e reducers do Leilão da Largada em `src/net/room.ts`
- [x] T005 [P] Escrever casos falhos de autoria/recorte/paridade do lance privado em `tests/net/conformance.test.ts`
- [x] T006 Implementar `submitOpeningBid`/`onOpeningBid` em `src/net/transport.ts`, `src/net/localTransport.ts`, `src/net/supabaseTransport.ts` e manter passthrough em `src/net/durableWrites.ts`
- [x] T007 Atualizar serialização pública/privada e compatibilidade de sala em `src/net/room.ts`, `src/net/client.ts`, `src/net/supabaseTransport.ts` e `src/net/localTransport.ts`

**Checkpoint**: fase `bidding` persiste e um lance chega apenas à autoridade com autoria atestada.

---

## Phase 3: User Story 1 — Comprar posição sem sair da partida (P1)

**Goal**: fechar o leilão em ordem, debitar cada jogador e financiar a Loteria.

**Independent Test**: uma mesa headless fecha com lances diferentes/empatados e produz ordem, caixas e `centerPot` corretos.

- [x] T008 [P] [US1] Escrever testes falhos de conservação, caixa e Loteria em `tests/game/openingAuction.test.ts`
- [x] T009 [US1] Implementar aplicação econômica pura em `src/game/openingAuction.ts`
- [x] T010 [US1] Escrever testes falhos do lifecycle host-autoritativo, fechamento cedo/prazo e reassunção em `tests/net/hostOpeningAuction.test.ts`
- [x] T011 [US1] Integrar abertura, recepção, persistência, guard de fechamento, snapshot e `tick` em `src/net/host.ts`
- [x] T012 [US1] Atualizar testes de lobby/ordem legados para D-046 em `tests/net/lobby.test.ts`, `tests/net/room.test.ts` e `tests/net/reentry.test.ts`

**Checkpoint**: a nova economia funciona sem UI e Free Parking continua coletando/resetando o mesmo `centerPot`.

---

## Phase 4: User Story 2 — Ver compromisso e revelação (P1)

**Goal**: permitir lacre secreto e comunicar resultado com a linguagem visual da sala de mapas.

**Independent Test**: durante coleta, cada cliente vê só seu valor; na revelação, todos veem ordem/lances/caixa/Loteria.

- [x] T013 [US2] Escrever testes falhos de `myOpeningBid`, fases e ausência de valor alheio em `tests/net/boot.test.ts` e `tests/net/openingAuction.test.ts`
- [x] T014 [US2] Integrar envio/recuperação do próprio lance e fases `auction`/`reveal` em `src/net/client.ts` e `src/net/roomSession.ts`
- [x] T015 [P] [US2] Implementar `OpeningAuction` e `TurnOrderReveal` acessíveis em `src/net/ui/LobbyScreen.tsx`
- [x] T016 [US2] Rotear coleta/revelação e seus estados em `src/net/ui/OnlineGate.tsx`
- [x] T017 [P] [US2] Adicionar composição responsiva, estados lacrados e animações com reduced motion em `src/index.css`

**Checkpoint**: a experiência inteira é demonstrável em dois navegadores, ainda sem depender do clique final.

---

## Phase 5: User Story 3 — Entrar sem segundo aceite (P1)

**Goal**: remover o botão local “Começar” e levar toda tela automaticamente ao tabuleiro.

**Independent Test**: depois de lacrar, o convidado fica intocado e chega ao tabuleiro em até 6 segundos.

- [x] T018 [US3] Escrever teste falho de transição automática e reconexão pós-início em `tests/net/boot.test.ts`
- [x] T019 [US3] Implementar fecho automático da revelação sem gate de domínio em `src/net/ui/LobbyScreen.tsx` e `src/net/roomSession.ts`
- [x] T020 [US3] Atualizar o roteiro real de dois contextos para leilão → revelação → tabuleiro em `e2e/multiplayer.spec.ts`

**Checkpoint**: nenhum cliente oferece ou exige “Começar” depois da ação inicial do host.

---

## Phase 6: Polish & Cross-Cutting

- [x] T021 [P] Cobrir normalização de salas legadas em `tests/net/openingAuction.test.ts`
- [x] T022 [P] Atualizar comentários/documentação operacional da quinta migration em `docs/RUNBOOK.md` e arquivos tocados de `src/net/`
- [x] T023 Rodar `/speckit-analyze` e corrigir gaps críticos entre `spec.md`, `plan.md` e `tasks.md`
- [x] T024 Executar `bunx vitest run`, `bun run lint`, `bun run typecheck` e `bun run build`
- [x] T025 Executar revisão React de hooks, acessibilidade, renderização e bundle nos TSX alterados
- [x] T026 Subir o app, capturar screenshots reais em 1440 × 900 e 740 × 360, rodar axe e iterar visualmente conforme `quickstart.md`

---

## Phase 7: User Story 4 — Escolher o ritual da mesa (P1)

**Goal**: o host escolhe no lobby entre Leilão secreto e Maior dado; convidados observam a mesma seleção e ambos os modos chegam ao tabuleiro automaticamente.

**Independent Test**: alternar a preferência numa mesa headless, iniciar uma partida em cada modo e comparar ordem, rolagens, caixas e Loteria.

- [x] T027 [US4] Atualizar D-046, `docs/SRS.md`, `CONTEXT.md` e os artefatos de `specs/045-leilao-da-largada/` para os dois modos
- [x] T028 [US4] Escrever testes falhos de default, seleção no lobby, rolagens, desempate e economia em `tests/net/openingAuction.test.ts`
- [x] T029 [US4] Implementar `OpeningMode`, `openingRoll`, seleção e ordem por dois dados em `src/net/room.ts`
- [x] T030 [US4] Escrever testes falhos do lifecycle host/sessão e persistência nos dois adapters em `tests/net/hostOpeningAuction.test.ts`, `tests/net/boot.test.ts` e `tests/net/conformance.test.ts`
- [x] T031 [US4] Integrar preferência, caminho Maior dado e persistência em `src/net/host.ts`, `src/net/roomSession.ts`, `src/net/localTransport.ts`, `src/net/supabaseTransport.ts`, `tests/net/fakeSupabase.ts` e `supabase/migrations/0005_opening_auction.sql`
- [x] T032 [US4] Implementar seletor do host e revelação por dados em `src/net/ui/LobbyScreen.tsx`, `src/net/ui/OnlineGate.tsx` e `src/index.css`
- [x] T033 [US4] Atualizar o E2E em `e2e/multiplayer.spec.ts` para selecionar explicitamente o modo e cobrir Maior dado
- [x] T034 [US4] Rodar `/speckit-analyze`, testes, lint, typecheck, build, screenshots e axe dos dois modos

---

## Dependencies & Execution Order

- Phase 1 → Phase 2 → US1 → US2 → US3 → Polish → US4.
- T003 precede T004; T005 precede T006; T008 precede T009; T010 precede T011; T013 precede T014; T018 precede T019.
- T015 e T017 podem avançar em paralelo depois do contrato de sessão; T021/T022 são paralelizáveis após a implementação funcional.
- A autoridade e o snapshot de US1 bloqueiam a revelação de US2; a revelação bloqueia a transição automática de US3.

## Parallel Example

```text
T015: implementar as duas superfícies em LobbyScreen.tsx
T017: preparar classes/tokens/animações em index.css
```

## Implementation Strategy

1. Fechar o caminho headless completo e a privacidade antes de renderizar.
2. Entregar coleta + revelação como uma composição única do design system.
3. Remover o aceite local somente quando o snapshot já for a fonte do início.
4. Validar em dois navegadores, movimento reduzido e viewport compacta antes do handoff.
5. Preservar `sealed-bid` como default e tratar `dice-roll` como caminho econômico neutro sobre o mesmo snapshot/reveal.
