# Tasks: Avatares finais

## Phase 1 — Setup

- [x] T001 Remover dependências experimentais `@react-spring/web` e `animejs` de `package.json` e `bun.lock`
- [x] T002 Substituir o catálogo antigo de skins pelos módulos canônicos em `src/boards/playerAvatarCatalog.ts` e `src/boards/playerAvatars.tsx`

## Phase 2 — Foundational

- [x] T003 Definir `AvatarId`, catálogo fechado, fallback e normalização em `src/boards/playerAvatarCatalog.ts`
- [x] T004 Integrar `avatar` ao `PlayerFace` e remover a API `skin` em `src/boards/shared.tsx`
- [x] T005 [P] Cobrir catálogo e fallback em `tests/boards/playerAvatars.test.tsx`
- [x] T006 Adicionar `avatar` a `Seat`, `Identity` e `normalizeRoom` em `src/net/room.ts`
- [x] T007 Adicionar `avatar` à projeção `PlayerIdentity` em `src/net/identity.ts`

## Phase 3 — User Story 1: Escolher o avatar final (P1)

**Goal**: seleção direta das cinco opções no formulário.

**Independent Test**: cada botão atualiza preview, `aria-pressed` e valor submetido.

- [x] T008 [US1] Tornar `AvatarConceptLab` controlado e renderizar miniaturas canônicas em `src/net/ui/AvatarConceptLab.tsx`
- [x] T009 [US1] Conectar estado e submissão do avatar em `src/net/ui/LobbyScreen.tsx`
- [x] T010 [US1] Propagar a terceira dimensão da identidade em `src/net/ui/OnlineGate.tsx`
- [x] T011 [US1] Criar estados selecionado, foco e grade responsiva em `src/index.css`
- [x] T012 [US1] Atualizar testes de catálogo, acessibilidade e submissão em `tests/ui/avatarConceptLab.test.tsx`

## Phase 4 — User Story 2: Reconhecer o avatar durante a partida (P1)

**Goal**: a mesma forma acompanha o jogador em todas as superfícies.

**Independent Test**: iniciar partida com avatares distintos e comparar lobby, token, painel e turno.

- [x] T013 [US2] Adicionar avatar ao view-model de jogadores em `src/game/ui/panels/playersView.ts`
- [x] T014 [US2] Renderizar cor e avatar da sala nos tokens em `src/game/ui/LiveTokens.tsx`
- [x] T015 [US2] Propagar `avatar` pelos usos identitários de `PlayerFace` em lobby, painéis, HUD, modais, diário e negociação
- [x] T016 [US2] Cobrir a projeção e os tokens em `tests/net/identity.test.ts`, `tests/game/ui/playersView.test.ts` e `tests/game/ui/liveTokens.test.tsx`

## Phase 5 — User Story 3: Movimento discreto e legível (P2)

**Goal**: idles lentos, intermitentes e estáticos sob movimento reduzido.

**Independent Test**: observar cada forma por 20 segundos e medir ciclo mínimo de 7 segundos.

- [x] T017 [US3] Implementar camadas SVG legíveis das cinco formas em `src/boards/playerAvatars.tsx`
- [x] T018 [US3] Recalibrar bob, blink e gestos específicos para ciclos de 8–12s em `src/index.css`
- [x] T019 [US3] Cobrir catálogo, classes, estado adormecido e tamanhos em `tests/boards/playerAvatars.test.tsx`; movimento reduzido é garantido pelo media query comum de `.avatar-face`

## Phase 6 — User Story 4: Preservar a escolha na reconexão (P2)

**Goal**: avatar público atravessa transporte, persistência e reentrada.

**Independent Test**: criar assento não clássico, persistir, recarregar e reanexar conservando o id.

- [x] T020 [US4] Adicionar `avatar` ao `SessionIdentity` e `JoinRequest` em `src/net/roomSession.ts` e `src/net/transport.ts`
- [x] T021 [US4] Transportar `avatar` no hub local pelo contrato compartilhado de `src/net/localTransport.ts`
- [x] T022 [US4] Adaptar o parâmetro legado `piece` para `avatar` em `src/net/supabaseTransport.ts`
- [x] T023 [US4] Espelhar o contrato no fake do Supabase em `tests/net/fakeSupabase.ts`
- [x] T024 [US4] Cobrir criação, join, wire contract, persistência e reentrada em `tests/net/room.test.ts`, `tests/net/conformance.test.ts` e `tests/net/reentry.test.ts`

## Phase 7 — Polish & Cross-Cutting

- [x] T025 Substituir `src/boards/faceSkins.tsx` pelos catálogos independentes de forma e skin
- [x] T026 Verificar desktop 1440×820, mobile 390×844 e tokens 16/24/32/72px conforme `specs/046-avatares-finais/quickstart.md`
- [x] T027 Rodar lint delta, typecheck, testes direcionados, suíte completa e build conforme `specs/046-avatares-finais/quickstart.md`
- [x] T028 Confirmar ausência de regressão no transporte e registrar resultados em `specs/046-avatares-finais/tasks.md`

## Correção de escopo — combinação Avatar + Skin

- [x] T029 Restaurar o catálogo fechado de oito skins em `src/boards/playerSkinCatalog.ts`
- [x] T030 Redesenhar cada skin como camada compatível com as cinco formas em `src/boards/playerSkins.tsx` e compor no `PlayerFace`
- [x] T031 Refazer o menu com seletores independentes de Avatar e Skin e preview composto
- [x] T032 Persistir `skin` ao lado de `avatar` em assento, identidade, sessão, transporte e reentrada
- [x] T033 Propagar a composição por todas as superfícies de identidade do jogo
- [x] T034 Cobrir a matriz completa de quarenta combinações e os fallbacks legados
- [x] T035 Rodar lint, typecheck, suíte completa e build após a correção

## Validation Results

- `bunx eslint <arquivos alterados>`: passou.
- `bun run typecheck`: passou.
- `bunx vitest run`: 116 arquivos e 1002 testes passaram.
- `bun run build`: passou.
- `bun run lint`: o comando cru encontra um worktree alheio em `.claude/worktrees/046-ui-ux-pro-max-board`, que cria múltiplos `tsconfigRootDir`; o lint completo passou excluindo esse worktree e `.playwright-mcp/`.
- `bunx playwright test e2e/avatarSkins.spec.ts`: 3 testes passaram sobre o build, cobrindo as quarenta combinações, desktop 1440×820, mobile 390×844, scroll até o CTA e tokens reais no tabuleiro.
- T026: screenshots reais confirmaram o menu em desktop/mobile e Prisma + Cartola / Totem + Astronauta no tabuleiro; tamanhos 16/24/32/72px permanecem cobertos pelo contrato automatizado.

## Dependencies

```text
Setup → Foundational
Foundational → US1
Foundational → US4
US1 + US4 → US2
Foundational → US3
US1 + US2 + US3 + US4 → Polish
```

## Parallel Opportunities

- T005 pode rodar em paralelo com T006–T007.
- T013 e T014 podem avançar em paralelo depois da projeção de identidade.
- T017–T019 podem avançar em paralelo ao transporte T020–T024.

## Implementation Strategy

1. Fechar catálogo e identidade persistente.
2. Entregar seleção direta no lobby.
3. Propagar o mesmo `PlayerFace` para a partida.
4. Recalibrar os idles e validar tamanhos reais.
5. Executar gates e marcar todas as tasks concluídas.
