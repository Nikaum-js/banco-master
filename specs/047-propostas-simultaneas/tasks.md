# Tasks: Propostas de negociação simultâneas

## Phase 1 — Regra e contratos

- [x] T001 Registrar D-048 e atualizar SRS 1.15 e `CONTEXT.md`
- [x] T002 Criar spec, plano, pesquisa, modelo, contrato e quickstart da 047

## Phase 2 — Fundação do estado

- [x] T003 [P] Criar testes de múltiplas propostas e resposta por id em `tests/game/economy/negociacao-ui.test.ts`
- [x] T004 Definir `TradeProposal`, coleção e contador em `src/game/economy/types.ts`, `src/game/turn/types.ts` e `src/game/setup.ts`
- [x] T005 Refatorar `proposeTrade`, `acceptTrade` e `rejectTrade` em `src/game/economy/trade.ts`
- [x] T006 Migrar `PlayerAction`, `applyCommand` e `actorOf` para `proposalId` em `src/game/commands.ts`
- [x] T007 Atualizar `LocalView` para ação completa e remover propostas do indicador bloqueante em `src/net/localView.ts`
- [x] T008 Normalizar snapshots legados em `src/net/supabaseTransport.ts`
- [x] T009 Remover propostas do jogador eliminado em `src/game/falencia/falencia.ts`

## Phase 3 — Lista compacta (US2)

- [x] T010 [P] Reescrever regressões de apresentação em `tests/ui/tradePresentation.test.tsx`
- [x] T011 [US2] Redesenhar `TradeRow` e `ActionsPanel` em `src/boards/shared.tsx` sem preview da composição
- [x] T012 [US2] Limitar a altura da lista e preservar o CTA em `src/index.css`

## Phase 4 — Seleção, inspeção e composição (US1/US3)

- [x] T013 [US3] Substituir `dismissed` por `selectedProposalId` em `src/game/ui/trade/tradeUI.ts`
- [x] T014 [US3] Abrir `Received` pelo id selecionado e restringir resposta ao destinatário em `src/game/ui/trade/TradeLayer.tsx`
- [x] T015 [US1] Tornar compositor independente da coleção ativa em `src/game/ui/trade/TradeLayer.tsx`

## Phase 5 — Simulação, laboratório e compatibilidade

- [x] T016 [P] Atualizar invariantes, conservação, probes e enumeração de ações em `tests/sim/engine/`
- [x] T017 [P] Atualizar casos do laboratório e testes em `src/game/ui/lab/cases.ts` e `tests/game/ui/visualLab.test.ts`
- [x] T018 [P] Atualizar testes de autoridade e visão local em `tests/net/localView.test.ts`

## Phase 6 — Validação

- [x] T019 Rodar testes direcionados de economia, rede, UI e simulador
- [x] T020 Rodar `bun run lint`, `bun run typecheck`, `bunx vitest run` e `bun run build`
- [ ] T021 Inspecionar o painel com uma e oito propostas conforme `quickstart.md`

## Validation Results

- `bun run lint`: passou.
- `bun run typecheck`: passou.
- `bunx vitest run`: 121 arquivos e 1.016 testes passaram.
- `bun run build`: passou; o aviso existente de chunk acima de 500 kB permanece.
- T021: bloqueada nesta sessão porque não há navegador conectado; interações de abrir o compositor com proposta ativa e selecionar proposta por id passaram em jsdom.
