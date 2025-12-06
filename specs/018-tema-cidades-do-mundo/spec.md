# Feature Specification: Tema "Cidades do Mundo" — valores oficiais

**Feature Branch**: `018-tema-cidades-do-mundo`

**Created**: 2026-05-24

**Status**: Draft

**Input**: User description: "Oficializar o tema 'Cidades do Mundo': os valores econômicos (preços, aluguéis-base, multiplicadores de construção, aeroporto, utilidade, imposto, GO progressivo, estoques, custos) deixam de ser provisórios e passam a ser os valores oficiais do tema, centralizados num único ponto tunável. Mantém o modelo base×multiplicador (calibração, sem nova regra). Corrige polimentos do tema (nomes de casa duplicados)."

**Depende de**: [`001`](../001-tabuleiro-48-casas/spec.md) (board/`boardData`) · 003–017 (todos os módulos que consomem os valores: aluguel, construção, balanceamento, hipoteca, turno). **Nenhuma regra nova** — apenas oficializa/centraliza os dados de tema.

> **Escopo desta spec:** **calibração + oficialização** dos valores do tema (abordagem aprovada). (1) Centralizar os "botões" econômicos hoje espalhados em **`src/game/theme.ts`** (fonte única, tunável); os módulos passam a derivar deles **sem mudar os valores** (zero mudança de comportamento). (2) **Polir o tema**: corrigir nomes de casa **duplicados** (aeroportos "Nova York"/"Tóquio" colidem com cidades). (3) **Relabelar** o `boardData` (de "provisório" → "oficial do tema, tunável") e **documentar** a ficha do tema. **Não** cobre: tabela de aluguel **por propriedade** (modelo clássico — caminho rejeitado nesta spec; segue base×mult) nem mudança de regras. Fonte: [`docs/SRS.md`](../../docs/SRS.md) §2/§3/§5/§13.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Valores oficiais centralizados e tunáveis (Priority: P1)

Como mantenedor do jogo, eu quero **todos os números econômicos do tema** num **único arquivo** (`theme.ts`) — dinheiro inicial, estoques do banco (casas/hotéis/skyscrapers), pote do Free Parking, faixa do GO progressivo, multiplicadores de aluguel (casa/hotel/skyscraper), escada de aeroporto, multiplicadores de utilidade, custo do Hangar, razão do custo de construção, taxas de hipoteca/transferência, multa de prisão, valores de imposto — para **calibrar o balanceamento num lugar só**, sem caçar literais espalhados.

**Why this priority**: é a essência de "oficializar o tema" — fonte única de verdade tunável. MVP.

**Independent Test**: alterar um valor em `theme.ts` e ver o efeito propagar pelos módulos; a suíte continua verde (valores atuais preservados → sem regressão).

**Acceptance Scenarios**:

1. **Given** os valores hoje espalhados (em `store.ts`, `rent.ts`, `construction.ts`, `balancing.ts`, `mortgage.ts`, `turn/`), **When** centralizados em `theme.ts`, **Then** os módulos derivam de `theme.ts` e os **valores observáveis não mudam** (suíte 002–017 verde, sem alteração).
2. **Given** `theme.ts`, **When** se ajusta um knob (ex.: dinheiro inicial), **Then** o efeito é único e propagado (um ponto de calibração).

---

### User Story 2 - Tema coerente: sem nomes de casa duplicados (Priority: P2)

Como jogador, eu não quero **duas casas com o mesmo nome** no tabuleiro. Os aeroportos "Nova York" (pos 6) e "Tóquio" (pos 30) colidem com as cidades de mesmo nome (EUA pos 37 / Japão pos 13). Os aeroportos passam a ter **nomes próprios** (de aeroporto/hub), preservando o código IATA.

**Why this priority**: defeito de coerência do tema; barato de corrigir. Polimento.

**Independent Test**: listar os nomes das 48 casas e verificar que não há duplicatas.

**Acceptance Scenarios**:

1. **Given** os 4 aeroportos, **When** renomeados para nomes de aeroporto/hub (IATA preservado), **Then** **nenhum** nome de casa do tabuleiro se repete.

---

### Edge Cases

- **Sem mudança de regra/valor observável**: a centralização preserva exatamente os números atuais; só a *origem* muda. Calibração de balanceamento de verdade fica como ajuste futuro (tunável no `theme.ts`).
- **Campo `rent` decorativo de aeroporto**: o aluguel de aeroporto vem da escada em `theme.ts` (`rentAirport`), não do campo `rent` do `boardData` — documentar que é decorativo.
- **Nomes de aeroporto em UI**: renomear não quebra render (o `boardData` é a fonte; a UI lê `name`).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST ter um único módulo `src/game/theme.ts` exportando os **valores econômicos do tema** (dinheiro inicial; `bank` casas/hotéis/skyscrapers; pote do Free Parking; faixa do GO progressivo; mults de aluguel casa/hotel/skyscraper; escada de aeroporto; mults de utilidade; custo do Hangar; razão do custo de construção; multa de prisão; taxas de hipoteca/deshipoteca/transferência; valores de imposto Renda/Luxo).
- **FR-002**: Os módulos (`store`, `rent`, `construction`, `balancing`, `mortgage`, `turnMachine`) MUST **derivar** esses valores de `theme.ts`, preservando seus **exports atuais** (`HANGAR_COST`, `JAIL_FINE`, `PARKING_SEED` etc.) para não quebrar importadores.
- **FR-003**: A centralização MUST NOT alterar nenhum valor observável — a suíte 002–017 MUST permanecer **verde sem edição** (zero regressão).
- **FR-004**: O tabuleiro MUST NOT ter **nomes de casa duplicados**; os 4 aeroportos recebem nomes próprios (IATA preservado).
- **FR-005**: O `boardData` MUST ser **relabelado** (comentário "PROVISÓRIA" → valores oficiais do tema, tunáveis em `theme.ts`).
- **FR-006**: O tema MUST ser **documentado** (ficha de referência dos valores) em `docs/`.

### Key Entities *(include if feature involves data)*

- **Theme (constantes)**: o conjunto de knobs econômicos do tema "Cidades do Mundo" (fonte única em `theme.ts`). Sem novo estado de runtime no `GameState`.
- **Board (dados)**: os 48 squares (`boardData`) — preços/aluguéis-base por cidade, IATA dos aeroportos, ícones de utilidade, valores de imposto. Nomes únicos.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% dos knobs econômicos do tema vivem em `theme.ts` (fonte única); nenhum literal econômico duplicado nos módulos.
- **SC-002**: A suíte completa (002–017) permanece **verde sem edição** após a centralização (prova de zero mudança de comportamento).
- **SC-003**: 0 nomes de casa duplicados no tabuleiro.
- **SC-004**: `bun run build` verde; o `boardData` não rotula mais os valores como provisórios.
- **SC-005**: Existe um doc de referência do tema com todos os valores.

## Assumptions

- **Modelo base×multiplicador mantido** (abordagem aprovada): não há tabela de aluguel por propriedade nesta spec; a calibração é dos knobs centralizados.
- **Valores atuais preservados na centralização** (oficialização ≠ rebalanceamento): mudanças de balanceamento de verdade ficam como ajustes posteriores no `theme.ts`, fora desta entrega.
- **Renomear aeroportos** não afeta valores nem testes (nenhum teste depende de `name`).
- **`theme.ts` é folha** (só constantes; não importa módulos do jogo) — sem ciclos.
