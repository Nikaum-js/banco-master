# Feature Specification: Progressão de construção por posse

**Feature Branch**: `048-progressao-construcao-posse`

**Created**: 2026-07-28

**Status**: Aprovada

**Input**: User description: "Com 1 de 3 cidades, liberar no máximo 1 casa; com 2 de 3, no máximo 2 casas por cidade e com uniformidade; com o país completo, liberar 4 casas, hotéis e Skyscraper."

**Depende de**: spec 034 (construção com país parcial e aluguel escalonado por posse)

## Visão geral

A construção parcial continua sendo um caminho de progresso sem exigir o país completo, mas deixa de premiar quem possui menos cidades. Enquanto o país estiver incompleto, a quantidade de cidades possuídas define o nível máximo de cada cidade. Fechar o país libera toda a escada de construção.

## Clarifications

### Session 2026-07-28

- Q: Como igualar o progresso quando jogadores possuem quantidades diferentes de cidades do mesmo país? → A: 1 cidade libera 1 casa; 2 cidades liberam 2 casas por cidade com uniformidade; o país completo libera toda a escada.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Progredir sem vantagem por possuir menos cidades (Priority: P1)

Como jogador com parte de um país, quero que minha progressão de construção aumente conforme amplio minha posse, para que possuir menos cidades nunca permita uma escada maior que possuir mais.

**Why this priority**: Corrige o incentivo inverso observado na partida, em que uma única cidade podia chegar ao segundo hotel enquanto duas cidades do mesmo país precisavam distribuir construções.

**Independent Test**: Comparar países de três cidades com posse de 1/3, 2/3 e 3/3, verificando que os níveis máximos são, respectivamente, 1 casa, 2 casas por cidade e a escada completa.

**Acceptance Scenarios**:

1. **Given** um jogador possui 1 de 3 cidades do país, sem hipoteca e com caixa suficiente, **When** constrói a primeira casa, **Then** a construção é aceita; ao tentar construir a segunda, ela é bloqueada pelo limite de posse.
2. **Given** um jogador possui 2 de 3 cidades do país, ambas sem construção, **When** constrói, **Then** precisa manter a uniformidade e pode chegar a no máximo 2 casas em cada cidade.
3. **Given** um jogador completa as 3 cidades do país, **When** continua construindo uniformemente, **Then** pode percorrer 3 e 4 casas, primeiro hotel, segundo hotel e Skyscraper.
4. **Given** dois jogadores possuem uma cidade cada do mesmo país, com o mesmo nível, caixa e condições, **When** tentam construir, **Then** ambos recebem exatamente a mesma permissão, independentemente do assento, nome, cor ou cidade.

---

### User Story 2 - Entender por que a construção foi bloqueada (Priority: P2)

Como jogador que atingiu o limite da posse parcial, quero receber uma indicação curta e correta, para saber que preciso adquirir mais cidades daquele país antes de avançar.

**Why this priority**: A regra só é percebida como justa se a interface explicar o mesmo motivo aplicado pelo motor, sem confundir limite de posse com uniformidade, caixa ou país completo.

**Independent Test**: Abrir a gestão de uma cidade no limite parcial e verificar que a ação de construir fica indisponível com uma mensagem específica sobre ampliar a posse do país.

**Acceptance Scenarios**:

1. **Given** uma cidade atingiu o nível máximo permitido pela posse parcial, **When** o jogador abre sua gestão, **Then** a ação de construir fica indisponível e informa que é preciso ter mais cidades daquele país para avançar.
2. **Given** a cidade ainda está abaixo do teto, mas outra cidade possuída está em nível menor, **When** o jogador abre sua gestão, **Then** o bloqueio continua sendo explicado como uniformidade.
3. **Given** o jogador não tem caixa suficiente, **When** nenhum bloqueio de posse ou uniformidade se aplica, **Then** a interface informa caixa insuficiente.

### Edge Cases

- País de duas cidades: possuir 1/2 libera no máximo 1 casa; possuir 2/2 libera toda a escada.
- Completar o país eleva o teto imediatamente, sem exigir nova volta ou novo turno.
- Construções acima do novo teto que já existam em uma sala persistida não são removidas, rebaixadas nem reembolsadas; apenas não podem avançar enquanto a posse não liberar o nível seguinte.
- Venda de construção continua permitida e segue a uniformidade atual, inclusive para estados persistidos acima do novo teto.
- Hipoteca, custo de construção, fator de aluguel por posse, estoque ilimitado e Hangar permanecem inalterados.
- Skyscraper continua exigindo país completo e uniformidade entre todas as cidades do país.
- Um comando inválido de construção continua sem alterar caixa, nível ou log.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST permitir iniciar construção com pelo menos uma cidade do país.
- **FR-002**: Enquanto o país estiver incompleto, o sistema MUST limitar o nível máximo de cada cidade à quantidade de cidades daquele país que o jogador possui.
- **FR-003**: Em país de três cidades, o sistema MUST limitar 1/3 a 1 casa e 2/3 a 2 casas por cidade; 3/3 MUST liberar toda a escada.
- **FR-004**: Em país de duas cidades, o sistema MUST limitar 1/2 a 1 casa; 2/2 MUST liberar toda a escada.
- **FR-005**: O sistema MUST manter a uniformidade entre as cidades do país possuídas pelo jogador, construindo primeiro nas cidades de menor nível.
- **FR-006**: O sistema MUST aplicar a mesma elegibilidade a jogadores em estados equivalentes, sem depender do assento, nome, cor ou cidade escolhida dentro do país.
- **FR-007**: O sistema MUST manter inalterados o custo, o fator de aluguel por posse, a hipoteca, a venda, o estoque ilimitado, o Hangar e a sequência de níveis.
- **FR-008**: O sistema MUST manter o Skyscraper condicionado ao país completo e à uniformidade.
- **FR-009**: O sistema MUST preservar construções persistidas acima do novo teto, sem mutação retroativa, e MUST bloquear apenas novas progressões que excedam o teto vigente.
- **FR-010**: A interface MUST distinguir o bloqueio por limite de posse dos bloqueios por uniformidade, caixa, hipoteca, topo e país incompleto para Skyscraper.
- **FR-011**: Ao bloquear pelo limite de posse, a interface MUST comunicar de forma curta que o jogador precisa de mais cidades daquele país para avançar.
- **FR-012**: Um comando de construção bloqueado MUST preservar integralmente o estado da partida.

### Key Entities

- **Cidade**: propriedade de um país com nível de construção entre 0 e 7.
- **País**: grupo de duas ou três cidades; seu tamanho e a quantidade possuída determinam o teto parcial.
- **Nível de construção**: 0 sem construção, 1–4 casas, 5 primeiro hotel, 6 segundo hotel e 7 Skyscraper.
- **Teto de construção por posse**: nível máximo permitido na cidade; equivale à quantidade possuída enquanto o país está incompleto e ao topo da escada quando o país está completo.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Em 100% dos países de três cidades, uma posse de 1/3 não ultrapassa 1 casa e uma posse de 2/3 não ultrapassa 2 casas por cidade.
- **SC-002**: Em 100% dos países de duas cidades, uma posse de 1/2 não ultrapassa 1 casa.
- **SC-003**: Em 100% dos países completos, a progressão uniforme alcança todos os sete níveis.
- **SC-004**: Dois jogadores em estados equivalentes recebem a mesma permissão de construção em 100% dos assentos e países.
- **SC-005**: Em todos os bloqueios de construção, a interface apresenta o motivo correspondente à primeira restrição aplicável sem alterar o estado da partida.
- **SC-006**: Todos os cenários de construção, aluguel, venda, hipoteca e gestão de propriedade existentes continuam aprovados após a mudança.

## Assumptions

- O limite parcial usa o nível numérico da escada, não a quantidade visual de peças.
- Fechar o país é a única forma de liberar hotéis e Skyscraper.
- A regra é aplicada na próxima tentativa de construção; não há migration de snapshots nem correção destrutiva de partidas em andamento.
- A feature refina D-026 e segue D-050, sem alterar o princípio de construção parcial.
