# Tasks: Progressão de construção por posse

**Input**: Design documents from `/specs/048-progressao-construcao-posse/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/elegibilidade-construcao.md](./contracts/elegibilidade-construcao.md)

**Tests**: obrigatórios e executados em ciclos red → green nos seams públicos `buildHouse`/`canBuildHouse` e `deedView`.

## Phase 1: Regra e contrato

**Purpose**: Fixar a decisão de produto antes do código.

- [x] T001 Registrar D-050, atualizar D-026 e consolidar o teto por posse no SRS v1.17 em `docs/adr/D-050-limite-de-construcao-por-posse.md`, `docs/adr/D-026-construcao-com-pais-parcial-aluguel-escalonado-por-posse.md`, `docs/adr/README.md` e `docs/SRS.md`

---

## Phase 2: User Story 1 — Progredir sem vantagem por possuir menos cidades (Priority: P1) 🎯 MVP

**Goal**: Fazer 1/3 parar no nível 1, 2/3 parar no nível 2 e país completo liberar a escada integral, preservando uniformidade.

**Independent Test**: Dois jogadores com uma cidade chinesa cada recebem a mesma elegibilidade; adquirir a segunda cidade eleva o teto para 2 e completar o país libera até o Skyscraper.

### Tests for User Story 1

- [x] T002 [US1] Escrever regressões do teto 1/3, 2/3, 3/3, país-duo e paridade entre jogadores em `tests/game/economy/construction.test.ts`
- [x] T003 [US1] Executar `tests/game/economy/construction.test.ts` e registrar a falha anterior à implementação

### Implementation for User Story 1

- [x] T004 [US1] Implementar o teto derivado e aplicá-lo à elegibilidade e ao próximo alvo em `src/game/economy/construction.ts`
- [x] T005 [US1] Ajustar fixtures que dependiam de hotéis com país incompleto e preservar os cenários avançados em `tests/game/economy/construction.test.ts` e `tests/game/economy/construcao-avancada.test.ts`
- [x] T006 [US1] Executar os testes de economia em `tests/game/economy/construction.test.ts` e `tests/game/economy/construcao-avancada.test.ts` até ficarem verdes

**Checkpoint**: A autoridade rejeita qualquer progressão acima do teto sem alterar caixa, nível ou log.

---

## Phase 3: User Story 2 — Entender por que a construção foi bloqueada (Priority: P2)

**Goal**: Projetar a mesma regra na gestão de propriedade com motivo específico e curto.

**Independent Test**: Uma cidade no teto parcial retorna `podeConstruir=false` com razão `limite-posse`; uniformidade e caixa continuam retornando suas próprias razões.

### Tests for User Story 2

- [x] T007 [US2] Escrever regressões de `limite-posse`, uniformidade, caixa e desbloqueio por país completo em `tests/game/ui/deedView.test.ts`

### Implementation for User Story 2

- [x] T008 [US2] Derivar a razão `limite-posse` a partir do teto central sem duplicar a fórmula em `src/game/ui/deed/deedView.ts`
- [x] T009 [US2] Adicionar a mensagem curta do bloqueio ao mapa exaustivo em `src/boards/shared.tsx`
- [x] T010 [US2] Executar `tests/game/ui/deedView.test.ts` junto dos testes de construção até ficarem verdes

**Checkpoint**: Motor e interface concordam sobre permissão e motivo em todos os estados cobertos.

---

## Phase 4: Compatibilidade e validação

**Purpose**: Fechar snapshots legados e gates do projeto.

- [x] T011 Validar estados persistidos acima do teto, venda, aluguel, hipoteca e comandos em `tests/game/economy/`, `tests/game/ui/` e `tests/net/`
- [x] T012 Executar `bun run lint`, `bun run typecheck`, `bunx vitest run` e `bun run build`, corrigindo somente regressões relacionadas à feature
- [x] T013 Revisar a consistência de `specs/048-progressao-construcao-posse/` e marcar todas as tarefas concluídas em `specs/048-progressao-construcao-posse/tasks.md`

---

## Dependencies & Execution Order

- T001 antecede qualquer código de produção.
- T002 → T003 → T004 → T005 → T006 formam o ciclo red → green da US1.
- T007 → T008 → T009 → T010 formam o ciclo red → green da US2 e dependem de T004.
- T011–T013 dependem das duas histórias verdes.

## Parallel Opportunities

Não há tarefas de implementação seguras em paralelo: os testes e o motor compartilham os mesmos contratos, e a worktree já contém mudanças não relacionadas que devem ser preservadas.

## Implementation Strategy

1. Fixar a regra e provar o comportamento antigo em vermelho.
2. Implementar somente o teto necessário para a US1.
3. Projetar o novo motivo na UI em um segundo ciclo.
4. Fechar compatibilidade e gates completos.
