# Tasks: Cidade da Fuligem

> Checklist da spec 055. Fases do [plan.md](./plan.md); cada task referencia FRs da [spec.md](./spec.md).

## Fase 1 — Fundação de dados (FR-001, FR-002, FR-006, FR-007)

- [ ] T001 `src/lib/boardData.ts`: `uf` opcional em `PropertySquare` + `icon?: PropertyIconId`
- [ ] T002 `src/lib/mapCatalog.ts`: `BoardId`, `MapCatalog` (id, nome, board, grupos, labels, cardText), `catalogOf`, catálogo `atlas` (apresentação atual, byte-idêntica) e `fuligem` (board derivado de `BOARD` por overlay de pos)
- [ ] T003 Conteúdo Fuligem: 28 propriedades/10 bairros (com reparo registrado na spec), Ferrovias N/S/L/O por lado, Mina de Carvão/Usina Elétrica/Companhia de Água, Imposto da Cidade/Taxa de Fumaça, Sorte Grande, Bilhete de Trem, labels (Oficina/Fábrica/Complexo de Fábricas/Torre de Ferro/Estação de Carga)
- [ ] T004 `tests/lib/mapCatalog.test.ts`: paridade econômica byte a byte com `BOARD` (pos/kind/group/price/rent/amount), 10 grupos, sem `uf` na Fuligem, labels do vocabulário aprovado, atlas idêntico ao atual

## Fase 2 — Sala com `boardId` (FR-003)

- [ ] T005 `src/net/room.ts`: `boardId` em `Room`/`PublicRoom`/`toPublicRoom`/`normalizeRoom`/`createRoom`; `prepareRematch` preserva
- [ ] T006 `src/net/roomSession.ts`: opção `initialBoardId` → `createRoom`
- [ ] T007 Transportes: `supabaseTransport` (5 pontos + fallbacks de assinatura), `localTransport`, `tests/net/fakeSupabase.ts`
- [ ] T008 `supabase/migrations/0009_room_board_id.sql`: coluna + CHECK, `room_preview`/`read_snapshot` recriadas, overloads `write_room`/`write_snapshot`/`reopen_room`; `tests/db/rpc.sql`
- [ ] T009 Testes de rede: criação com `fuligem`, fallback `atlas` (sala legada/snapshot antigo), preservação em revanche, propagação a convidado/reload/reconexão, imutabilidade (sem mutador)

## Fase 3 — Eixo visual pelo mapa autoritativo (FR-005)

- [ ] T010 `boardTheme.ts`: `['atlas','fuligem']`, colapso tema=mapa; `roomStore.setRoom` aplica `room.boardId`
- [ ] T011 `OnlineGate`/`HomeScreen`: seleção viaja por `?map=` (host e local dev); `session.create({boardId})`
- [ ] T012 Camada de apresentação: `activeBoard()`/`activeGroups()`/`mapLabels()`/`cardLabel|Desc` com override — varrer consumidores de `BOARD`/`GROUPS`/strings de rótulo na UI (lista da pesquisa §3)

## Fase 4 — Remoção Neon + Fuligem visual (FR-004, FR-006, FR-008–FR-013, FR-015)

- [ ] T013 Remover `HomeNeonArcade`, `NeonBackdrop`, `GridPattern` neon, ramos neon (`HomeMapPanel`, `HomeScreen`, `entryShell`, `StageBackdrop`, `shared.tsx`), CSS neon (faixas do plan), `@fontsource/press-start-2p`
- [ ] T014 Tokens Fuligem (`:root[data-board-theme="fuligem"]`) + cromo de casas (rebites/placa) + seletores negados corrigidos
- [ ] T015 `HomeFuligem` + `FuligemBackdrop` + `FoundryPattern` + palco de partida; home com os dois mapas jogáveis
- [ ] T016 Lobby: fábrica acesa por assento (cor do assento), sirene+portões no início; convite/QR/histórico/presets vestem o tema
- [ ] T017 Tabuleiro: placa/luz de dono, HIPOTECADA, conexão de Bairro Completo, Estação de Carga visível, pote Sorte Grande físico, ícones de propriedade sem bandeira
- [ ] T018 Cartas/escrituras/modais/HUD/log/leilões/trocas/empréstimos/dívida/classificação/orientação com labels e cromo do mapa
- [ ] T019 Landing: `aside.mk-next-board` apresenta o segundo mapa (só isso)
- [ ] T020 Prova de remoção: grep sem referências funcionais a neon/1UP/high score/synthwave/Press Start

## Fase 5 — Som (FR-014)

- [ ] T021 Resolução de cue por mapa (`fuligem--<cue>` com fallback) + assets dos eventos do brief + sirene de início

## Fase 6 — Testes, validação visual e gates (SC-001…SC-005, FR-011, FR-012)

- [ ] T022 Atualizar `entryThemeIsolation` (mounts===1 com fuligem) e `homeMapSelector` (segundo mapa jogável)
- [ ] T023 E2E: seleção na home → sala fuligem → convidado por link (BrowserContexts isolados) → reload; partida dirigida no mapa fuligem; axe home/lobby/tabuleiro fuligem; reduced-motion
- [ ] T024 Screenshots reais (13 cenas × 1440×900/1024×768/740×360) inspecionadas
- [ ] T025 Gates: lint, typecheck, vitest, Playwright da feature, build; docs sincronizados (HANDOVER/README se preciso)
