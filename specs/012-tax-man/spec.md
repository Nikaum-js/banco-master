# Feature Specification: Tax Man (Fiscal)

**Feature Branch**: `012-tax-man`

**Created**: 2026-05-24

**Status**: Draft

**Input**: User description: "Tax Man / Fiscal (SRS §13.8): token do banco que rola os dados a cada turno e se move; se cair em propriedade com dono, o dono paga ao banco o aluguel daquela propriedade; outras casas, nenhum efeito; cai na própria propriedade do que rolou → paga mesmo assim. Catch-up discreto que pune quem domina o tabuleiro."

**Depende de**: [`002`](../002-fluxo-de-turno/spec.md) (FSM do turno, `advanceSeat`, RNG) · [`003`](../003-compra-aluguel/spec.md) (aluguel de cidade/aeroporto/utilidade, títulos) · [`007`](../007-balanceamento-catchup/spec.md) (pote do Free Parking, porta `onPayToCenter`) · [`011`](../011-construcao-avancada/spec.md) (aluguel com 2º hotel/Skyscraper/Hangar)

> **Escopo desta spec:** o **Tax Man** (§13.8) — token do banco que se move **a cada turno** e cobra do dono o aluguel da propriedade onde para. É a última mecânica de balanceamento pendente. É **automático** (sem decisão de jogador): aplica-se no fim de cada turno. **Não** cobre UI dedicada (o efeito é silencioso/log, coerente com o catch-up discreto, princípio IV). Fonte de verdade: [`docs/SRS.md`](../../docs/SRS.md) §13.8.

## Clarifications

### Session 2026-05-24

- Q: O dono paga "ao banco" o aluguel — esse dinheiro **some** da economia (banco) ou vai para o **pote do Free Parking** (redistribuído)? → A: **Ao banco — removido da economia.** O valor sai do dono e some (deflacionário). Leitura literal de "ao banco" e coerente com "pune quem domina, beneficia **indiretamente** quem está atrás" (drena o líder sem premiar ninguém diretamente; não infla o pote). Catch-up discreto (princípio IV).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - O Fiscal pune quem domina o tabuleiro (Priority: P1)

Como **jogador atrás na partida**, a cada turno o **Fiscal** (token do banco) rola os dados e se move; se ele parar numa **propriedade com dono**, o **dono paga ao banco** o aluguel daquela propriedade — mesmo que seja sua própria. Quem tem mais (e melhores) propriedades é cobrado com mais frequência, criando um catch-up **discreto** (sem destacar na UI que é catch-up, princípio IV).

**Why this priority**: é a feature inteira — fecha as mecânicas de balanceamento (§13). MVP.

**Independent Test**: posicionar o Fiscal para cair numa propriedade com dono e verificar que o dono é debitado do aluguel daquela propriedade (ao destino definido em Clarifications) e que cair em casa sem dono/sem efeito não cobra nada.

**Acceptance Scenarios**:

1. **Given** o Fiscal vai parar numa **cidade com dono** (não hipotecada), **When** o turno termina e o Fiscal se move, **Then** o dono é **debitado** do aluguel daquela cidade (mesmo cálculo de quando um jogador para nela: construção, grupo, ×3 de Skyscraper) e o valor vai ao destino (Clarifications).
2. **Given** o Fiscal vai parar numa propriedade **do próprio jogador** cujo turno acabou, **When** o Fiscal se move, **Then** esse jogador **paga mesmo assim** (sem isenção, §13.8).
3. **Given** o Fiscal para numa casa **sem dono** (livre), num **canto**, imposto, carta ou Bus Ticket, **When** o Fiscal se move, **Then** **nenhum** efeito (não cobra, não compra, não saca).
4. **Given** o Fiscal para numa propriedade **hipotecada**, **When** o Fiscal se move, **Then** **não** há cobrança (hipoteca isenta, como no aluguel normal).
5. **Given** um **aeroporto com Hangar** ou uma **utilidade** com dono, **When** o Fiscal para nela, **Then** o dono paga o aluguel correspondente (aeroporto: pela contagem ×2 do Hangar; utilidade: pelo valor dos dados do Fiscal).
6. **Given** o turno termina (passa a vez), **When** isso ocorre, **Then** o Fiscal se move **exatamente uma vez** por turno (não por re-rolagem de dupla — a dupla é o mesmo turno).

---

### Edge Cases

- **Dono sem caixa para a cobrança**: o Fiscal cobra do dono; se o caixa não cobrir, ver Assumptions (debita o que houver; não falir nesta versão).
- **Fiscal não é jogador**: não recebe bônus de GO, não vai preso, não saca carta, não compra — só **move e cobra**. Movimento puro (sem creditar GO ao cruzar o 0).
- **Partida com 1 jogador / encerrada**: o Fiscal não opera (sem oponentes ou fim de jogo).
- **Quem rola pelo Fiscal**: o SRS deixa "a definir" (sugestão: jogador após o ativo). Como o efeito (dono paga ao banco) **independe** de quem rola, isso é cosmético no digital — não afeta a regra (ver Assumptions).
- **Destino do dinheiro**: ao **banco** — removido da economia (resolvido em Clarifications).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST mover um token **Fiscal** (do banco) **uma vez por turno**, ao final de cada turno (quando a vez passa ao próximo), rolando os dados (2 dados brancos) e avançando esse número de casas.
- **FR-002**: O movimento do Fiscal MUST ser **puro**: não credita bônus de GO, não envia à prisão, não saca carta nem compra — apenas reposiciona o token.
- **FR-003**: Se o Fiscal parar em **propriedade com dono e não hipotecada**, o sistema MUST **debitar do dono** o aluguel daquela propriedade — o **mesmo** valor que seria cobrado se um jogador parasse nela (incluindo construção, grupo, ×3 de Skyscraper, ×2 de Hangar; utilidade pelo valor dos dados do Fiscal).
- **FR-004**: A cobrança MUST ocorrer **mesmo quando** a propriedade é do jogador cujo turno acabou (sem isenção, §13.8).
- **FR-005**: Se o Fiscal parar em casa **sem dono**, hipotecada, ou não-propriedade (canto/imposto/carta/Bus Ticket), o sistema MUST NOT cobrar nem produzir qualquer outro efeito.
- **FR-006**: O valor cobrado pelo Fiscal MUST ser **removido da economia** (pago ao banco, não ao pote do Free Parking) — catch-up deflacionário.
- **FR-007**: O Fiscal MUST se mover **uma vez por turno**, não por rolagem extra de dupla (a dupla é o mesmo turno).
- **FR-008**: O efeito MUST ser **discreto** (princípio IV) — sem rótulo de catch-up na UI; aplica-se automaticamente.
- **FR-009**: O estado do Fiscal (posição) MUST ser **serializável** (princípio VII) e determinístico sob RNG injetável (testável).
- **FR-010**: O Fiscal MUST NOT operar quando a partida estiver **encerrada** (`phase==='ended'`) ou pausada.

### Key Entities *(include if feature involves data)*

- **Fiscal / Tax Man (token)**: posição no tabuleiro (`taxManPos: number`, inicia em GO=0), controlada pelo banco. Não é um jogador (sem caixa, sem títulos, sem mão).
- **Cobrança do Fiscal**: débito ao dono = aluguel da propriedade onde o Fiscal parou; destino = **banco** (removido da economia).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% das paradas do Fiscal em propriedade com dono não hipotecada debitam do dono exatamente o aluguel daquela propriedade (mesmo cálculo do aluguel normal).
- **SC-002**: 100% das paradas em casas sem dono/hipotecada/não-propriedade não produzem cobrança nem efeito.
- **SC-003**: O Fiscal se move exatamente **uma vez por turno** (verificável por contagem de movimentos × turnos).
- **SC-004**: A cobrança ocorre inclusive sobre a propriedade do jogador cujo turno acabou (sem isenção).
- **SC-005**: O estado do Fiscal é determinístico sob RNG injetável e sobrevive a round-trip JSON.

## Assumptions

- **Automático e silencioso**: o Fiscal não exige input do jogador; aplica-se no fim do turno (em `advanceSeat`), coerente com o catch-up discreto (princípio IV). "Quem rola" é cosmético no digital e não afeta a regra.
- **Token começa em GO (0)** e usa **2 dados brancos** (sem Speed Die — o Speed Die é progresso de jogador, não do token).
- **Movimento puro** (sem GO/prisão/carta) — o Fiscal só move e cobra.
- **Dono sem caixa**: debita o que houver (sem caixa negativo); a falência **provocada pelo Fiscal** sobre um jogador **não-ativo** fica **fora de escopo** (a resolução de dívida do 008 é centrada no jogador ativo). Documentado para revisão.
- **Utilidade**: aluguel = multiplicador × **valor dos dados do Fiscal** (não houve rolagem de jogador).
- **Sem UI dedicada** (consistente com construção do 004/011 — o motor é o foco; visual do token fica para M2).
