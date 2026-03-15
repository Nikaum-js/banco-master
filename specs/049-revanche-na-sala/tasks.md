# Tasks: Revanche na mesma sala

**Input**: documentos em `/specs/049-revanche-na-sala/`

**Prerequisites**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/rematch-lifecycle.md`

**Tests**: obrigatórios por FR-025 e SC-006; escrever e observar falha antes da implementação.

## Phase 1: Setup

- [x] T001 Confirmar D-052, SRS v1.19 e vocabulário Revanche em `docs/adr/`, `docs/SRS.md` e `CONTEXT.md`
- [x] T002 Confirmar feature ativa `specs/049-revanche-na-sala` em `.specify/feature.json`

---

## Phase 2: Foundational

**Purpose**: estabelecer geração, revisão e operação atômica compartilhadas por todas as histórias.

- [x] T003 [P] Criar testes vermelhos do reducer `prepareRematch` e normalização legada em `tests/net/rematch.test.ts`
- [x] T004 [P] Criar testes vermelhos do contrato `reopenRoom` no adapter local em `tests/net/conformance.test.ts`
- [x] T005 Implementar `matchGeneration`, `revision`, comparação de versões e `prepareRematch` em `src/net/room.ts`
- [x] T006 Adicionar `Transport.reopenRoom` e invariantes de snapshot em `src/net/transport.ts`
- [x] T007 Implementar reset atômico e guarda por geração no `LocalHub` em `src/net/localTransport.ts`
- [x] T008 Implementar migration aditiva e RPC `reopen_room` em `supabase/migrations/0006_rematch_generation.sql`
- [x] T009 Atualizar leitura/escrita de geração e reabertura no adapter em `src/net/supabaseTransport.ts`

**Checkpoint**: adapters compartilham o mesmo contrato de geração e reset.

---

## Phase 3: User Story 1 — Voltar à mesma sala (Priority: P1)

**Goal**: host e convidado deixam o resumo individualmente e recuperam o mesmo lobby.

**Independent Test**: encerrar, voltar com convidado e host, confirmar espera/autoridade e identidades.

### Tests

- [x] T010 [US1] Criar testes vermelhos de retorno individual, host e reload encerrado em `tests/net/rematch.test.ts`
- [x] T011 [P] [US1] Atualizar teste de boot que recusava sala encerrada em `tests/net/boot.test.ts`

### Implementation

- [x] T012 [US1] Marcar `Room.status = 'ended'` na transição autoritativa em `src/net/host.ts`
- [x] T013 [US1] Implementar `Host.reopenRoom()` idempotente e durável em `src/net/host.ts`
- [x] T014 [US1] Implementar `RoomSession.returnToLobby()` e reentrada do assento encerrado em `src/net/roomSession.ts`
- [x] T015 [US1] Priorizar lobby/ritual vigente sem fechar resumo alheio em `src/net/client.ts` e `src/net/roomSession.ts`
- [x] T016 [US1] Conectar o CTA final à sessão ativa em `src/game/ui/GameHUD.tsx`
- [x] T017 [US1] Exibir espera pós-jogo coerente no lobby em `src/net/ui/OnlineGate.tsx` e `src/net/ui/LobbyScreen.tsx`

**Checkpoint**: cada cliente sai do resumo sem navegar à home; host reabre canonicamente a sala.

---

## Phase 4: User Story 2 — Começar uma partida realmente nova (Priority: P1)

**Goal**: o host inicia outra partida na mesma sala sem resíduos de jogo.

**Independent Test**: comparar a revanche a um estado inicial e confirmar identidade preservada.

### Tests

- [x] T018 [US2] Criar teste vermelho de duas partidas sequenciais e `seq` monotônico em `tests/net/rematch.test.ts`
- [x] T019 [P] [US2] Cobrir novo snapshot depois de lobby reaberto em `tests/net/boot.test.ts`

### Implementation

- [x] T020 [US2] Manter `seq` global monotônico e `revision` sincronizada em `src/net/host.ts`
- [x] T021 [US2] Fazer cliente substituir jogo encerrado pelo snapshot da nova geração em `src/net/client.ts`
- [x] T022 [US2] Limpar todos os campos do Ritual de Largada em `prepareRematch` em `src/net/room.ts`
- [x] T023 [US2] Garantir reconexão de host no lobby reaberto sem reaprender snapshot antigo em `src/net/host.ts`

**Checkpoint**: segunda partida começa limpa e todos continuam com a mesma identidade.

---

## Phase 5: User Story 3 — Resultado final com hierarquia clara (Priority: P2)

**Goal**: tela final Atlas clara, responsiva, acessível e com ação contextual.

**Independent Test**: renderizar online/local e viewport estreita sem rolagem horizontal.

### Tests

- [x] T024 [US3] Cobrir conteúdo, rótulos online/local e ação em `tests/ui/endGame/endGameScreen.test.tsx`

### Implementation

- [x] T025 [US3] Refinar hierarquia e identidade do vencedor em `src/game/ui/EndGameScreen.tsx`
- [x] T026 [US3] Implementar layout responsivo e foco visível em `src/index.css`

**Checkpoint**: resultado oficial legível e CTA correto nos dois modos.

---

## Phase 6: User Story 4 — Não ressuscitar a partida anterior (Priority: P2)

**Goal**: geração/revisão vencem snapshots e salas atrasadas.

**Independent Test**: reordenar escritas/mensagens entre fim, lobby e revanche.

### Tests

- [x] T027 [US4] Criar casos vermelhos de sala/snapshot atrasados em `tests/net/rematch.test.ts`
- [x] T028 [P] [US4] Cobrir compatibilidade de sala sem geração em `tests/net/rematch.test.ts`
- [x] T029 [P] [US4] Cobrir guarda SQL/shape RPC por inspeção em `tests/net/conformance.test.ts`

### Implementation

- [x] T030 [US4] Ignorar `PublicRoom` anterior por geração/revisão em `src/net/client.ts`
- [x] T031 [US4] Rejeitar snapshot obsoleto por geração e `seq` nos adapters em `src/net/localTransport.ts` e migration `0006`
- [x] T032 [US4] Normalizar geração/revisão ausentes em `src/net/room.ts`

**Checkpoint**: reload e atraso de rede nunca restauram o ciclo encerrado.

---

## Phase 7: Polish & Cross-Cutting

- [x] T033 Atualizar comentários históricos “sem revanche” nos arquivos tocados
- [x] T034 Marcar este `tasks.md` como concluído e rodar a análise de consistência da spec
- [x] T035 Rodar testes focados descritos em `quickstart.md`
- [x] T036 Rodar `bun run typecheck`, `bun run lint` e `bun run build`
- [x] T037 Rodar `bunx vitest run --maxWorkers=1`
- [x] T038 Rodar o gate exato `bunx vitest run tests/game`
- [x] T039 Validar a migration localmente/por inspeção e registrar necessidade de aplicação em produção
- [x] T040 Executar verificação visual real quando houver browser disponível
- [x] T041 Criar micro-commits, enviar `main` e acompanhar CI/deploy até estado terminal

## Dependencies & Execution Order

- Phase 2 bloqueia US1, US2 e US4.
- US1 e US2 compartilham `Host`/`RoomSession`, portanto seguem nessa ordem.
- US3 é independente da persistência depois do contrato do CTA.
- US4 fecha as guardas depois do caminho feliz.
- Testes de cada história são escritos e executados com falha antes da implementação correspondente.

## Implementation Strategy

1. Fechar geração e reset atômico.
2. Entregar retorno individual e reabertura do host.
3. Provar segunda partida limpa.
4. Fechar apresentação final e atrasos de rede.
5. Rodar gates completos, versionar e publicar.
