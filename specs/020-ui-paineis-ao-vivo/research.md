# Research: UI painéis ao vivo (M2 fatia 1)

Sem NEEDS CLARIFICATION.

## R1 — `playersView(game)` puro + `useLivePlayers()`

**Decisão**: `playersView(game): Player[]` mapeia `game.players` → view-model `Player` (shared.tsx): `name=id`, `color=PLAYER_COLORS[seat]`, `money=cash`, `pos`, `cardsInHand=hand.length`, `busTickets`, `speedDieReady=completouPrimeiraVolta`, `active = id===jogador-da-vez`, `bankrupt=eliminated`, `loanActive = loans.some(debtor===id)`, `immune = immunities.some(beneficiary===id)`. `useLivePlayers()` = `playersView(useGameStore(s=>s.game))`.

**Rationale**: separar a transformação (pura, testável) do acesso ao store (hook). Reusa o componente `PlayerRow` sem tocá-lo.

## R2 — Paleta de cores por assento

**Decisão**: `PLAYER_COLORS` = 8 cores disjuntas das cores de grupo (reaproveitando a paleta dos MOCK_PLAYERS). Cor = `PLAYER_COLORS[seat % 8]`.

**Rationale**: o motor não guarda token/cor (virá do Lobby, M3). Cor estável por assento evita boneco com a cor da casa.

## R3 — Seção "Turno" (ActionsPanel)

**Decisão**: `active = playersView(game).find(active)`; `Próx. GO = goBonus(game, activeId)`; `pote = game.centerPot`; cartas/Bus Tickets do ativo. Substitui `ACTIVE_GO_VALUE` e `MOCK_PARKING_POT`.

**Rationale**: valores reais reativos reusando o bloco visual. `goBonus` é leitura pura (balancing).

## R4 — Fora de escopo nesta fatia

**Decisão**: **Log de eventos** (não há histórico no `GameState`; precisaria de um event log — fatia futura) e **Trades** (não há estado de proposta; `executeTrade` é instantâneo) seguem MOCK. Animação de token e modais novos: fatias seguintes.

**Rationale**: manter a fatia pequena e de baixo risco visual; entregar o "render reativo" sem inventar estado novo.

## R5 — Testes

**Decisão**: `playersView` (puro) coberto por Vitest; UI validada por `bun run build` + `bun run dev` (sem RTL no projeto).

**Rationale**: maximizar a cobertura testável sem introduzir uma stack de teste de componente nesta fatia.
