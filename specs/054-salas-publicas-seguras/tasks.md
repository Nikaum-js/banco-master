# Tasks: Diretório opt-in de salas públicas anônimas

**Input**: documentos em `/specs/054-salas-publicas-seguras/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: obrigatórios por FR-047/FR-048 e pelos gates aprovados.

**Organization**: tarefas agrupadas por história; testes de cada camada precedem sua
implementação. `[P]` indica arquivos independentes.

## Phase 1: Setup

**Purpose**: preparar superfícies exclusivas da spec sem alterar os fluxos privados.

- [X] T001 Criar os contratos TypeScript e o parser deny-by-default do diretório em `src/net/publicRoomDirectory.ts`
- [X] T002 [P] Registrar o script isolado `attack:public-rooms` em `package.json`
- [X] T003 [P] Acrescentar a rota pública `?public=<listingId>` ao contrato em `src/net/session.ts`

---

## Phase 2: Foundational

**Purpose**: schema, autorização e seams que bloqueiam todas as histórias.

**⚠️ CRITICAL**: nenhuma UI pública é funcional antes desta fase.

- [X] T004 [P] Escrever testes SQL inicialmente falhos para schema fechado, publicação, projeção, limites e admissão em `tests/db/public_room_directory.sql`
- [X] T005 [P] Escrever testes unitários inicialmente falhos do parser, respostas e erros RPC em `tests/net/publicRoomDirectory.test.ts`
- [X] T006 Criar `supabase/migrations/0008_public_room_directory.sql` com tabelas internas, RLS sem policies, grants mínimos, helpers e `rooms.created_at`
- [X] T007 Implementar RPCs `public_room_publication`, `publish_public_room`, `unpublish_public_room`, `heartbeat_public_room` e `list_public_rooms` em `supabase/migrations/0008_public_room_directory.sql`
- [X] T008 Implementar `join_public_room` atômica, credenciais do assento e aviso Realtime em `supabase/migrations/0008_public_room_directory.sql`
- [X] T009 Implementar o client RPC injetável, validação por allowlist e tradução de falhas em `src/net/publicRoomDirectory.ts`
- [X] T010 Integrar `ensureSession()` e o cliente real ao diretório sem `service_role` em `src/net/supabaseClient.ts`
- [X] T011 Executar `tests/db/public_room_directory.sql` no Supabase local e corrigir o contrato foundational

**Checkpoint**: backend deny-by-default e client estreito prontos.

---

## Phase 3: User Story 1 — Host publica e retira seu lobby (Priority: P1) 🎯 MVP

**Goal**: host anônimo controla opt-in sem alterar sala, assentos ou convite.

**Independent Test**: sala nova não aparece; host publica/despublica; convidado é recusado.

### Tests for User Story 1

- [X] T012 [P] [US1] Escrever testes de estado e erro do controle do host em `tests/ui/publicRoomControl.test.tsx`
- [X] T013 [P] [US1] Cobrir publicação forjada, segundo lobby e 3 salas/10 min em `tests/db/public_room_directory.sql`

### Implementation for User Story 1

- [X] T014 [US1] Criar controle acessível privada/visível/oculta com feedback de limite em `src/net/ui/PublicRoomControl.tsx`
- [X] T015 [US1] Montar o controle somente para o host sem alterar kick, convite ou Ritual em `src/net/ui/LobbyScreen.tsx`
- [X] T016 [US1] Injetar callbacks de publicação e telemetria na tela de lobby em `src/net/ui/OnlineGate.tsx`
- [X] T017 [US1] Estilizar o controle nos temas existentes e em mobile em `src/index.css`

**Checkpoint**: publicação/despublicação testável isoladamente.

---

## Phase 4: User Story 2 — Pessoa encontra e entra em sala pública (Priority: P1)

**Goal**: listar, filtrar e admitir anonimamente sem revelar destino antes do sucesso.

**Independent Test**: dois lobbies, filtros locais e entrada pública completa.

### Tests for User Story 2

- [X] T018 [P] [US2] Escrever testes de loading, listagem, filtros, atualização e seleção em `tests/ui/publicRoomDirectory.test.tsx`
- [X] T019 [P] [US2] Escrever testes da rota e admissão na máquina de sessão em `tests/net/roomSession.test.ts`
- [X] T020 [P] [US2] Cobrir allowlist, ordenação, expiração, limite de 10/min e corrida da última vaga em `tests/db/public_room_directory.sql`

### Implementation for User Story 2

- [X] T021 [US2] Implementar hook de consulta única, cooldown, polling e filtros locais em `src/net/publicRoomDirectory.ts`
- [X] T022 [US2] Criar diretório acessível com filtros de vagas/Ritual e cards mínimos em `src/net/ui/PublicRoomDirectory.tsx`
- [X] T023 [US2] Integrar o diretório compartilhado aos dois temas em `src/net/ui/HomeScreen.tsx`, `src/net/ui/home/HomeAtlas.tsx`, `src/net/ui/home/HomeNeonArcade.tsx` e `src/net/ui/home/HomeMapPanel.tsx`
- [X] T024 [US2] Preservar o nome lembrado e navegar por `listingId` em `src/net/ui/home/homeShared.ts`
- [X] T025 [US2] Implementar admissão pública antes de abrir o transporte em `src/net/roomSession.ts`
- [X] T026 [US2] Ligar a rota pública à identidade, substituir por link privado após sucesso e tratar indisponibilidade em `src/net/ui/OnlineGate.tsx`
- [X] T027 [US2] Estilizar lista, filtros, cards, cooldown e breakpoint móvel em `src/index.css`

**Checkpoint**: diretório e entrada pública funcionam sem depender de convite.

---

## Phase 5: User Story 3 — Salas privadas permanecem secretas (Priority: P1)

**Goal**: provar que a exceção pública não reabre `rooms`, snapshots ou escrita alheia.

**Independent Test**: ataques com credencial pública retornam somente a projeção opt-in.

### Tests for User Story 3

- [X] T028 [P] [US3] Criar roteiro real de ataque com sessões anônimas independentes em `scripts/attack-public-rooms.ts`
- [X] T029 [P] [US3] Acrescentar regressões de convite privado e `room_preview` em `tests/net/conformance.test.ts`
- [X] T030 [US3] Provar grants, RLS, payload exato, mutações alheias e listing expirado em `tests/db/public_room_directory.sql`

### Implementation for User Story 3

- [X] T031 [US3] Endurecer grants, ownership, validações e respostas sem `roomId` recusado em `supabase/migrations/0008_public_room_directory.sql`
- [X] T032 [US3] Adicionar o contrato SQL novo e o ataque público ao job `database` em `.github/workflows/ci.yml`
- [X] T033 [US3] Garantir que toda falha do diretório termina no módulo público sem fallback em `src/net/publicRoomDirectory.ts`

**Checkpoint**: vetores relevantes executáveis com a mesma credencial do produto.

---

## Phase 6: User Story 4 — Listagem acompanha o lobby sem controlar a sala (Priority: P2)

**Goal**: vagas, presença, início e revanche convergem sem punir desconexão.

**Independent Test**: lotação esconde, vaga reaparece, ausência esconde, início encerra e
revanche permanece privada.

### Tests for User Story 4

- [X] T034 [P] [US4] Cobrir heartbeat, 60 s, lotação, início e revanche no relógio SQL em `tests/db/public_room_directory.sql`
- [X] T035 [P] [US4] Cobrir timers, cleanup e recuperação do controle em `tests/ui/publicRoomControl.test.tsx`

### Implementation for User Story 4

- [X] T036 [US4] Criar trigger idempotente que encerra publicação fora do lobby em `supabase/migrations/0008_public_room_directory.sql`
- [X] T037 [US4] Implementar heartbeat de 30 s, reaparecimento e cleanup no host em `src/net/ui/PublicRoomControl.tsx`
- [X] T038 [US4] Atualizar a projeção ao ocupar/liberar vaga sem despublicar em `src/net/publicRoomDirectory.ts`

**Checkpoint**: ciclo público converge e as regras privadas permanecem independentes.

---

## Phase 7: User Story 5 — Estados adversos acessíveis (Priority: P2)

**Goal**: diretório utilizável por teclado, leitor de tela e celular em todos os estados.

**Independent Test**: axe, teclado e viewport móvel sobre loading, vazio, erro, limite e
indisponibilidade.

### Tests for User Story 5

- [X] T039 [P] [US5] Completar testes de ARIA, foco e estados adversos em `tests/ui/publicRoomDirectory.test.tsx`
- [X] T040 [P] [US5] Criar E2E real com host, entrada pública e convidado privado em BrowserContexts isolados em `e2e/publicRooms.spec.ts`

### Implementation for User Story 5

- [X] T041 [US5] Implementar regiões vivas, nomes, foco e recuperação em `src/net/ui/PublicRoomDirectory.tsx`
- [X] T042 [US5] Garantir alvos de toque, zoom, reduced motion e ausência de overflow em `src/index.css`
- [X] T043 [US5] Incluir `e2e/publicRooms.spec.ts` no job E2E com Supabase local em `.github/workflows/ci.yml`

**Checkpoint**: caminho público AA e multiplayer isolado cobertos.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: telemetria anônima, regressão completa e entrega.

- [X] T044 [P] Escrever testes dos eventos públicos sem identificadores em `tests/telemetry/port.test.ts`
- [X] T045 Implementar `public_directory_opened`, `public_room_published` e `public_room_joined` em `src/telemetry/port.ts` e `src/telemetry/supabaseSink.ts`
- [X] T046 Integrar eventos sem payload livre em `src/net/ui/HomeScreen.tsx`, `src/net/ui/PublicRoomControl.tsx` e `src/net/roomSession.ts`
- [X] T047 Executar Supabase local do zero, contratos SQL e `bun run attack:public-rooms`
- [X] T048 Executar `bunx playwright test e2e/publicRooms.spec.ts` com BrowserContexts isolados e corrigir falhas
- [X] T049 Executar `bun run lint`, `bun run typecheck`, `bunx vitest run`, `bun run build` e `git diff --check`
- [X] T050 Inspecionar `dist` por credencial administrativa e validar o quickstart em `specs/054-salas-publicas-seguras/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup**: independente.
- **Foundational**: depende de Setup e bloqueia todas as histórias.
- **US1/US2/US3**: dependem de Foundational; são P1.
- **US4**: depende do estado de publicação da US1 e da projeção da US2.
- **US5**: depende da UI da US2 e dos estados da US4.
- **Polish**: depende de todas as histórias.

### User Story Dependencies

- **US1**: controla publicação sem depender da UI do diretório.
- **US2**: consome os contratos foundational e é testável com publicação criada por RPC.
- **US3**: audita US1/US2, sem alterar o fluxo funcional.
- **US4**: estende o ciclo de US1 e a atualização de US2.
- **US5**: endurece a apresentação de US2/US4.

### Within Each User Story

- testes falham antes da implementação;
- contratos server-side antes do client;
- parser/client antes da UI;
- história fecha seus testes antes da próxima dependente.

### Parallel Opportunities

- T004 e T005 podem ser escritos em paralelo.
- T012 e T013 exercitam camadas distintas.
- T018, T019 e T020 exercitam UI, sessão e banco.
- T028 e T029 são roteiros independentes.
- T034 e T035 dividem banco e UI.
- T039 e T040 dividem componente e navegador.

## Implementation Strategy

1. Fechar schema e contratos deny-by-default.
2. Entregar opt-in do host.
3. Entregar listagem e admissão atômica.
4. Rodar ataques antes do ciclo avançado.
5. Fechar presença, acessibilidade e E2E.
6. Executar todos os gates, corrigir e só então versionar.
