# Feature Specification: UI jogável (M2) — painéis laterais ao vivo

**Feature Branch**: `020-ui-paineis-ao-vivo`

**Created**: 2026-05-24

**Status**: Draft

**Input**: User description: "Primeira fatia do M2: ligar os painéis laterais ao store real. O PlayersPanel (lista de jogadores: caixa, token, mão, Bus Tickets, vez ativa, eliminado, empréstimo/imunidade) e a seção 'Turno' do ActionsPanel (jogador da vez, Próx. GO, pote, cartas/tickets) deixam de usar MOCK e passam a refletir o GameState. Reusa os componentes visuais existentes (abordagem Richup). Log de eventos e Trades ficam para a fatia seguinte."

**Depende de**: M1 (motor completo, `useGameStore`) · `boards/shared.tsx` (componentes `PlayerRow`/`PlayerFace`/painéis já desenhados) · `balancing.goBonus` (Próx. GO).

> **Escopo desta spec:** a **1ª fatia do M2** (escolhida) — **render reativo do estado** nos painéis laterais, **reusando os visuais existentes**. (1) `PlayersPanel` lista os jogadores **reais** (mapeando `GameState` → o view-model `Player` do `shared.tsx`). (2) A seção **"Turno"** do `ActionsPanel` reflete o jogador da vez real + Próx. GO (real) + pote (real) + cartas/Bus Tickets (real). **Não** cobre: o **log de eventos** (segue MOCK — fatia seguinte), o painel **Trades** (sem estado de proposta no motor — fatia futura), animação de token, modais novos. Sem mudança de regra. Fonte: SRS §12.3.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Painel de jogadores reflete a partida (Priority: P1)

Como jogador, eu vejo no **painel lateral** os jogadores **reais** da partida: caixa, token (cor por assento), contador de mão, Bus Tickets, quem é a **vez**, quem está **eliminado**, e marcadores de empréstimo/imunidade ativos — atualizando ao vivo conforme o jogo avança pelo HUD.

**Why this priority**: é a fundação do M2 ("consumir o store; render reativo"). MVP.

**Independent Test**: rodar `bun run dev`; agir pelo HUD (rolar, comprar, etc.) e ver o painel de jogadores refletir caixa/posição/vez em tempo real; um jogador falido aparece como eliminado.

**Acceptance Scenarios**:

1. **Given** uma partida em andamento, **When** o painel de jogadores renderiza, **Then** mostra **um item por jogador real** com caixa, mão e Bus Tickets corretos.
2. **Given** o jogador da vez muda, **When** o turno avança, **Then** o destaque de "vez ativa" segue o jogador ativo real.
3. **Given** um jogador é eliminado, **When** o painel renderiza, **Then** ele aparece como **falido**.
4. **Given** um jogador é devedor de empréstimo / beneficiário de imunidade, **When** o painel renderiza, **Then** mostra os marcadores correspondentes.

---

### User Story 2 - Cabeçalho do turno ao vivo (Priority: P2)

Como jogador, a seção **"Turno"** mostra o **jogador da vez** real, seu **Próx. GO** (bônus progressivo real), o **pote** do Free Parking real e os contadores de **cartas/Bus Tickets** do ativo.

**Why this priority**: completa o estado reativo visível; reusa o bloco já desenhado.

**Independent Test**: comparar os valores do painel "Turno" com o estado real (HUD/store) ao longo do jogo.

**Acceptance Scenarios**:

1. **Given** o jogador da vez, **When** a seção "Turno" renderiza, **Then** nome/cor/cartas/Bus Tickets são os do ativo real e o **pote** é o `centerPot` real.
2. **Given** o ranking de patrimônio, **When** o "Próx. GO" renderiza, **Then** é o valor de `goBonus` do ativo.

---

### Edge Cases

- **Sem nome/cor no motor**: o `GameState` tem `id` (ex.: `p1`), não nome/cor. O nome exibido é o `id`; a cor vem de uma **paleta por assento**. (Nomes/tokens reais virão do Lobby — M3.)
- **Fim de jogo / eliminados**: eliminados aparecem como falidos; o destaque de vez segue o ativo real.
- **Log e Trades**: continuam MOCK nesta fatia (documentado).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O `PlayersPanel` MUST listar os jogadores **reais** do `GameState` (via `useGameStore`), mapeando para o view-model `Player` existente: `name=id`, `color` por assento (paleta), `money=cash`, `pos`, `cardsInHand=hand.length`, `busTickets`, `active` (= jogador da vez), `bankrupt=eliminated`, `loanActive`/`immune` derivados de `loans`/`immunities`.
- **FR-002**: A seção **"Turno"** do `ActionsPanel` MUST refletir o jogador da vez real (nome/cor/cartas/Bus Tickets), o **Próx. GO** (`goBonus` real) e o **pote** (`centerPot` real).
- **FR-003**: O mapeamento `GameState → Player[]` MUST ser uma função **pura** (`playersView(game)`) — testável —, com um hook fino consumindo o store.
- **FR-004**: A fatia MUST **reusar os componentes visuais existentes** (`PlayerRow`/`PlayerFace`/blocos do painel) — sem novo design.
- **FR-005**: A fatia MUST NOT alterar regras nem o motor; é só leitura reativa.
- **FR-006**: Log de eventos e painel Trades MAY permanecer MOCK nesta fatia (fora de escopo).

### Key Entities *(include if feature involves data)*

- **Player (view-model, `shared.tsx`)**: já existe (`name/color/money/pos/cardsInHand/busTickets/active/bankrupt/loanActive/immune/speedDieReady`). Esta fatia o **alimenta** a partir do `GameState`.
- **Paleta de cores por assento**: array fixo (cores disjuntas das cores de grupo) — token de cada jogador por índice de assento.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: O painel de jogadores mostra exatamente os jogadores reais com caixa/mão/Bus Tickets/vez/eliminado corretos (verificável no `bun run dev` e via teste de `playersView`).
- **SC-002**: A seção "Turno" mostra ativo/Próx. GO/pote/cartas/tickets reais.
- **SC-003**: `playersView(game)` (puro) é coberto por teste unitário.
- **SC-004**: `bun run build` verde; suíte de motor permanece verde (sem regressão — nada do motor mudou).

## Assumptions

- **Reuso visual total** (abordagem comprometida): nenhum novo layout; só troca a fonte de dados (MOCK → store). Validação visual pelo usuário no `bun run dev`.
- **Nome = id, cor = paleta por assento** até o Lobby (M3) trazer nome/token escolhidos.
- **Sem testes de componente** (projeto não tem React Testing Library); a parte testável é `playersView` (pura). Verificação visual é manual.
- **Log/Trades** seguem MOCK (próximas fatias do M2).
