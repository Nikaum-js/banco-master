# Tasks: Retenção leve na sala privada

**Input**: documentos em `/specs/053-retencao-leve-sala/`

**Tests**: obrigatórios pelo brief; contratos puros e de persistência precedem a implementação.

## Phase 1: Fundação de domínio

- [x] T001 Escrever testes de normalização/idempotência/limite/privacidade em `tests/net/roomHistory.test.ts`
- [x] T002 Adicionar tipos/defaults de `historyId` e `matchHistory` em `src/net/room.ts`
- [x] T003 Implementar gravação e estatísticas puras em `src/net/roomHistory.ts`

## Phase 2: User Story 1 — Histórico da sala (P1)

- [x] T004 [US1] Integrar registro anterior ao snapshot final em `src/net/host.ts`
- [x] T005 [US1] Estender revanche/reload/convergência em `tests/net/rematch.test.ts`
- [x] T006 [US1] Preservar histórico nos adapters local e público

## Phase 3: User Story 4 — Persistência privada (P1)

- [x] T007 [US4] Criar migration aditiva `supabase/migrations/0007_room_match_history.sql`
- [x] T008 [US4] Estender escrita/leitura e fallback em `src/net/supabaseTransport.ts`
- [x] T009 [US4] Atualizar fake/conformidade/fallback em `tests/net/fakeSupabase.ts`, `tests/net/conformance.test.ts` e `tests/net/supabaseFallback.test.ts`
- [x] T010 [US4] Estender contrato real de RPC em `tests/db/rpc.sql`

## Phase 4: User Story 2 — Estatísticas derivadas (P2)

- [x] T011 [US2] Validar agregados contra oráculo em `tests/net/roomHistory.test.ts`
- [x] T012 [US2] Criar painel compacto em `src/net/ui/RoomHistoryPanel.tsx`
- [x] T013 [US2] Integrar somente no lobby de revanche em `src/net/ui/LobbyScreen.tsx`
- [x] T014 [US2] Testar estado vazio, 8 jogadores e 10 partidas em `tests/ui/roomHistoryPanel.test.tsx`

## Phase 5: User Story 3 — Presets existentes (P1)

- [x] T015 [US3] Escrever catálogo/memória e testes em `src/net/roomPresets.ts` e `tests/net/roomPresets.test.ts`
- [x] T016 [US3] Aplicar preferência somente em `RoomSession.create()` em `src/net/roomSession.ts`
- [x] T017 [US3] Ligar armazenamento no boot em `src/net/ui/OnlineGate.tsx`
- [x] T018 [US3] Substituir opções hardcoded pelo catálogo em `src/net/ui/LobbyScreen.tsx`
- [x] T019 [US3] Testar convidado, pós-início e autoridade publicada em `tests/net/roomPresets.test.ts`

## Phase 6: Interface e documentação

- [x] T020 Estilizar painel/disclosure responsivo em `src/index.css`
- [x] T021 Atualizar contagem/procedimento de migrations em `docs/RUNBOOK.md`
- [x] T022 Adicionar Playwright dirigido a histórico/presets/convite com BrowserContexts isolados

## Phase 7: Validação

- [x] T023 Executar Vitest direcionado e completo
- [x] T024 Executar migrations/RPCs em Supabase local e E2E real
- [x] T025 Executar Playwright, axe e screenshots desktop/740×360
- [x] T026 Executar lint, typecheck e build

## Dependências

- T001 → T002/T003 → T004–T006.
- T007 → T008–T010.
- T003 → T011–T014.
- T015 → T016–T019.
- T004–T20 → T022–T026.
