# Tasks: Fuligem — mecânicas próprias e legibilidade

## Fase 1 — Contrato de regra

- [x] T001 Registrar D-070 e D-071 e atualizar índice de ADRs
- [x] T002 Atualizar SRS v1.31 e `CONTEXT.md`
- [x] T003 Criar spec, pesquisa, plano, modelo, contrato e quickstart da 056

## Fase 2 — Minas sem aluguel (US1, FR-001–FR-006)

- [x] T004 Remover `MINE_RENT` e `rentMine` do motor
- [x] T005 Encerrar pouso em Mina ocupada sem transferência, dívida ou log
- [x] T006 Remover aluguel de Mina da simulação e consumidores auxiliares
- [x] T007 Simplificar apresentação/popover da Mina para bônus, preço e hipoteca
- [x] T008 Atualizar testes de Minas para renda zero e bônus hipotecáveis

## Fase 3 — Legibilidade do tabuleiro (US2, FR-007–FR-009)

- [x] T009 Remover `MapZones`, `BoardZones` e CSS de zonas/divisórias
- [x] T010 Aumentar a profundidade da faixa periférica da topologia Fuligem
- [x] T011 Renderizar nomes completos e quebra de linha nas células Fuligem
- [x] T012 Cobrir topologia, ausência de zonas e nomes completos por teste
- [x] T013 Reduzir a carga animada do cenário Fuligem duplicado atrás do tabuleiro

## Fase 4 — Leilão estratégico (US3, FR-010, FR-012)

- [x] T014 Adicionar variante transparente, sem blur, ao `Overlay`
- [x] T015 Aplicar a variante somente ao modal de leilão
- [x] T016 Testar transparência, trap de foco e preservação dos demais modais

## Fase 5 — Verificação e entrega (FR-011, SC-001–SC-005)

- [x] T017 Executar lint, typecheck, testes focados, suíte Vitest e build
- [x] T018 Capturar e inspecionar screenshots reais do tabuleiro e do leilão
- [x] T019 Revisar diff e criar micro-commits sem arquivos alheios
- [x] T020 Fazer push de `main` e acompanhar CI/deploy até estado terminal
