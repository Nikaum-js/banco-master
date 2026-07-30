# Tasks: Convite por QR Code e compartilhamento

**Input**: documentos em `/specs/052-convite-qr-compartilhamento/`

**Tests**: obrigatórios pelo brief; cada história começa pelo teste observável.

## Phase 1: Fundação

- [x] T001 Adicionar `uqr` com Bun em `package.json` e `bun.lock`
- [x] T002 Criar contratos puros do convite em `src/net/invite.ts`

## Phase 2: User Story 1 — Compartilhar pelo dispositivo (P1)

- [x] T003 [US1] Escrever testes de título/texto/URL e cancelamento em `tests/net/invite.test.ts`
- [x] T004 [US1] Escrever teste da Web Share API em `tests/ui/roomInviteDialog.test.tsx`
- [x] T005 [US1] Implementar ação nativa e feedback acessível em `src/net/ui/RoomInviteDialog.tsx`

## Phase 3: User Story 2 — Ler por QR Code (P1)

- [x] T006 [US2] Testar payload/matriz e ausência de request externo em `tests/net/invite.test.ts`
- [x] T007 [US2] Renderizar QR SVG local com quiet zone em `src/net/ui/RoomInviteDialog.tsx`
- [x] T008 [US2] Estilizar o QR de modo responsivo em `src/index.css`

## Phase 4: User Story 3 — Fallback sem Web Share API (P2)

- [x] T009 [US3] Testar fallback, clipboard e codificação do WhatsApp em `tests/ui/roomInviteDialog.test.tsx`
- [x] T010 [US3] Implementar cópia, WhatsApp e orientação para Discord em `src/net/ui/RoomInviteDialog.tsx`
- [x] T011 [US3] Integrar gatilho sem remover a cópia atual em `src/net/ui/LobbyScreen.tsx`

## Phase 5: User Story 4 — Acessibilidade (P1)

- [x] T012 [US4] Testar trap, `Escape` e retorno de foco em `tests/ui/roomInviteDialog.test.tsx`
- [x] T013 [US4] Cobrir fluxo, axe e viewports em `e2e/inviteRetention.spec.ts`

## Phase 6: Validação

- [x] T014 Executar Vitest direcionado da 052
- [x] T015 Executar Playwright desktop/740×360 e registrar screenshots
- [x] T016 Executar lint, typecheck e build

## Dependências

- T001 → T002 → T003/T006.
- T002 → T005/T007/T010.
- T005/T007/T010 → T011 → T013.
- T003–T013 → T014–T016.
