# Feature Specification: Simulação Automatizada de Partidas (Test Harness)

**Feature Branch**: `036-simulacao-partidas`

**Created**: 2026-07-05

**Status**: Draft

**Depende de**: specs 001–010 (motor), 011–017 (mecânicas avançadas), 026/031 (leilões), 013/027 (negociação), 034 (construção parcial)

**Input**: User description: "Simulação automatizada de partidas (test harness dev-only) para validar o jogo de ponta a ponta com 2, 3 e 6 jogadores. Duas camadas: simulação headless massiva no motor (agentes escolhem ações válidas ao acaso com seed reproduzível) e smoke E2E no browser. Validações: sem crash/ação inválida aceita, invariantes econômicos a cada turno, toda partida termina com 1 vencedor dentro de um teto de turnos. Falha reporta a seed."

> **Conformidade com a constitution**: esta feature é infraestrutura de teste **dev-only**. Os agentes simulados NÃO são IA/bots do produto — a decisão rejeitada "IA/bots fora do escopo v1.0" segue valendo integralmente. Nada desta feature aparece para o usuário final, não altera o `GameState` nem nenhuma regra do SRS (princípio I intacto); ela apenas **exercita** as regras existentes.

## Clarifications

### Session 2026-07-05

- Q: Onde o lote padrão de simulação roda? → A: Dentro da suíte de testes padrão do projeto — todo run paga o lote completo (100 × 3 contagens), respeitando o teto de 2 min (SC-002).
- Q: Como o smoke E2E decide as ações na UI? → A: Roteiro fixo determinístico (mesma sequência de interações em toda execução); fuzzing de regras é papel exclusivo da camada headless.
- Q: Com que estratégia as sondas de ações inválidas rodam? → A: 1 sonda inválida sorteada (pela seed da partida) por turno — afirmar que o gate recusa e o estado permanece inalterado.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Simulação headless massiva com invariantes (Priority: P1)

Como desenvolvedor do Banco Master, quero rodar centenas de partidas completas simuladas — com 2, 3 e 6 jogadores — em segundos, sem browser, onde cada jogador simulado sempre escolhe uma ação **válida** ao acaso, para descobrir automaticamente crashes, regras furadas e estados impossíveis que testes unitários pontuais não cobrem.

**Why this priority**: é o coração da feature — a malha de fuzzing sobre o motor puro é o que efetivamente responde "está funcionando tudo certo?" nas três contagens de jogadores. Sozinha, já entrega o valor principal.

**Independent Test**: executar a suíte de simulação isoladamente e verificar que N partidas por contagem (2/3/6) completam sem violação; injetar deliberadamente um bug no motor (ex.: permitir estoque negativo) e verificar que a simulação o detecta.

**Acceptance Scenarios**:

1. **Given** o motor do jogo no estado atual, **When** a simulação roda o lote padrão de partidas com 2, 3 e 6 jogadores, **Then** todas as partidas completam sem exceção lançada e sem nenhuma ação inválida aceita pelos gates.
2. **Given** uma partida simulada em andamento, **When** qualquer turno é concluído, **Then** todos os invariantes de estado são verificados e nenhuma violação é encontrada (saldos, estoque de construção, posições, limites de mão, contadores de Bus Ticket).
3. **Given** uma partida simulada, **When** ela progride até o fim, **Then** ela atinge o estado de encerramento com exatamente 1 vencedor dentro do teto de rodadas.
4. **Given** um jogador simulado com ações disponíveis (comprar, construir, hipotecar, propor troca, jogar carta, usar Bus Ticket, pedir empréstimo, encerrar turno…), **When** é a vez dele agir, **Then** ele escolhe ao acaso apenas entre ações que as regras permitem naquele momento — nunca uma ação que os gates deveriam recusar.

---

### User Story 2 - Reprodução determinística por seed (Priority: P2)

Como desenvolvedor investigando uma falha encontrada pela simulação, quero reexecutar exatamente a mesma partida a partir da seed reportada, para depurar o problema passo a passo com o mesmo dado, as mesmas cartas e as mesmas decisões dos agentes.

**Why this priority**: sem reprodutibilidade, uma falha achada por fuzzing é quase inútil — vira "aconteceu uma vez e nunca mais". A seed transforma cada falha em bug report determinístico.

**Independent Test**: rodar uma partida com uma seed fixa duas vezes e comparar os estados finais — devem ser idênticos; provocar uma falha e verificar que a mensagem de erro inclui a seed e o contexto (contagem de jogadores, rodada, ação).

**Acceptance Scenarios**:

1. **Given** uma seed conhecida, **When** a mesma partida é executada duas vezes, **Then** a sequência de estados e o estado final são idênticos nas duas execuções.
2. **Given** uma partida simulada que falha (violação de invariante, exceção ou teto de rodadas estourado), **When** a falha é reportada, **Then** o relatório inclui a seed, a contagem de jogadores, a rodada e a descrição da violação — suficiente para reproduzir com um comando.
3. **Given** uma seed reportada em uma falha, **When** o desenvolvedor reexecuta a simulação com essa seed, **Then** a mesma falha ocorre no mesmo ponto.

---

### User Story 3 - Smoke E2E no browser (Priority: P3)

Como desenvolvedor, quero uma verificação de fumaça que abra o jogo real no browser e conduza uma partida curta por contagem de jogadores (2, 3 e 6) através da interface, para garantir que a camada visual (modais, painéis, animações, controles) não quebrou — algo que a simulação headless não enxerga.

**Why this priority**: complementa a US1 cobrindo a integração motor↔UI, mas é mais lenta e frágil; o grosso da confiança vem da camada headless.

**Independent Test**: executar apenas o smoke E2E e verificar que, para cada contagem, uma partida inicia, progride por um número mínimo de rodadas interagindo só pela UI e nenhum erro de runtime aparece.

**Acceptance Scenarios**:

1. **Given** o app rodando, **When** o smoke E2E cria uma partida com 2, 3 e depois 6 jogadores, **Then** cada partida inicia pela interface e os elementos essenciais (tabuleiro, painéis dos jogadores, dados) estão visíveis e funcionais.
2. **Given** uma partida E2E em andamento, **When** o fluxo executa um número mínimo de rodadas interagindo exclusivamente pela UI (rolar dados, resolver compras/modais, encerrar turno), **Then** nenhum erro de runtime ocorre e o estado exibido permanece coerente com as ações executadas.

---

### Edge Cases

- Partida que não termina dentro do teto de rodadas (economia estagnada/deadlock): é **falha** — reportar seed e estado-resumo; é exatamente o sinal de balanceamento/travamento que se quer detectar.
- Jogador entra em dívida no meio de um leilão ou de uma troca: agentes precisam conseguir resolver a pendência pelas ações válidas (vender, hipotecar, empréstimo ou falência) sem travar o fluxo.
- Falência em cadeia (2 jogadores falindo na mesma rodada) reduzindo a partida a 1 jogador: encerramento correto com vencedor único.
- Troca proposta a um agente que já está em dívida ou eliminado: gates devem recusar; a simulação verifica que a recusa acontece.
- Mão cheia (3 cartas) ao cair em casa de carta: o fluxo de descarte/limite deve operar sem travar o turno.
- Estoque global de construção esgotado com múltiplos compradores: fluxo de leilão de escassez (spec 026) exercitado sob aleatoriedade.
- Log de eventos atingindo o limite de retenção durante partida longa: nenhuma verificação pode depender de histórico completo.
- Seeds diferentes produzindo a mesma sequência (colisão de gerador): aceitável; o requisito é seed igual ⇒ partida igual, não o inverso.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O harness MUST executar partidas completas de forma headless (sem browser), dirigindo o motor pelas mesmas operações que a interface usa, para as contagens de **2, 3 e 6 jogadores**.
- **FR-002**: Cada jogador simulado MUST, em cada ponto de decisão, enumerar somente as ações válidas segundo as regras vigentes e escolher uma ao acaso; a escolha MUST cobrir todo o repertório de ações do jogo (rolar, comprar, recusar, leiloar, construir, vender, hipotecar, des-hipotecar, propor/aceitar/recusar trocas, jogar cartas da mão, usar Bus Ticket, pedir/pagar empréstimo, pagar/rolar na prisão, encerrar turno).
- **FR-003**: Toda aleatoriedade da simulação (dados, embaralhamento, decisões dos agentes) MUST derivar de uma única seed por partida; a mesma seed MUST reproduzir exatamente a mesma partida.
- **FR-004**: O harness MUST verificar, ao fim de cada turno, os invariantes de estado: (a) nenhum saldo é não-numérico e nenhum saldo fica negativo fora do estado de dívida previsto pelas regras; (b) transferências entre jogadores conservam a soma (o que um paga o outro recebe); (c) estoque global de casas/hotéis nunca fica negativo nem excede o total definido; (d) posições dos peões sempre no intervalo válido do tabuleiro; (e) limite de mão ≤ 3 cartas por jogador; (f) contadores de Bus Ticket nunca negativos; (g) toda propriedade tem no máximo 1 dono e todo dono existe.
- **FR-005**: O harness MUST falhar imediatamente se o motor lançar exceção ou se uma ação que os gates deveriam recusar for aceita. Verificação por sonda: **a cada turno, 1 ação deliberadamente inválida** é sorteada de um catálogo (derivada da mesma seed da partida) e disparada — o gate MUST recusá-la e o estado MUST permanecer inalterado.
- **FR-006**: Toda partida simulada MUST terminar no estado de encerramento com exatamente 1 vencedor dentro de um teto de rodadas configurável; estourar o teto é falha reportável.
- **FR-007**: Em qualquer falha (exceção, invariante violado, ação inválida aceita, teto estourado), o relatório MUST incluir: seed, contagem de jogadores, rodada, ação em execução e descrição da violação.
- **FR-008**: O lote padrão MUST executar um número configurável de partidas por contagem de jogadores (default: 100 por contagem) com seeds distintas e reportar um resumo (partidas ok, falhas, duração, distribuição de rodadas até o fim).
- **FR-009**: O harness MUST oferecer um modo de reexecução de uma única partida por seed explícita, para depuração.
- **FR-010**: O smoke E2E MUST conduzir, pela interface real, 1 partida por contagem (2, 3, 6) por um número mínimo de rodadas (default: 10), seguindo um **roteiro fixo determinístico** (mesma sequência de interações em toda execução) exclusivamente pelos controles visíveis, e MUST falhar em qualquer erro de runtime ou elemento essencial ausente.
- **FR-011**: O lote padrão headless MUST fazer parte da suíte de testes padrão do projeto — toda execução da suíte roda o lote completo (100 partidas × 3 contagens), dentro do teto de duração de SC-002.
- **FR-012**: Nada desta feature MUST ser incluído no bundle do produto nem alterar comportamento de produção; agentes e verificadores vivem exclusivamente na área de testes.
- **FR-013**: A simulação MUST usar a configuração padrão do produto (flags de tema/mecânicas como estão, ex.: Speed Die desativado por D-003) — sem modos especiais que desviem do jogo real.

### Key Entities

- **Agente simulado**: jogador automatizado dev-only; possui apenas uma política de decisão (aleatória seedada sobre ações válidas). Não existe no `GameState` — é um consumidor externo do motor, indistinguível de um humano do ponto de vista das regras.
- **Partida simulada**: uma execução completa do jogo com N agentes (N ∈ {2, 3, 6}), identificada por uma seed; produz um veredito (ok/falha) e métricas (rodadas até o fim, ações executadas).
- **Invariante de estado**: propriedade que deve valer em todo estado alcançável (FR-004); a lista é parte desta spec e cresce junto com novas mecânicas.
- **Relatório de simulação**: resumo do lote (FR-008) + detalhe de cada falha (FR-007) com seed reprodutível.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: O lote padrão (100 partidas × 3 contagens) completa com **0 falhas** no estado atual do motor — ou cada falha encontrada é reproduzível por seed em 100% das tentativas.
- **SC-002**: O lote padrão headless completa em **menos de 2 minutos** em máquina de desenvolvimento, permitindo uso rotineiro em pre-commit/CI.
- **SC-003**: Reexecutar qualquer partida pela seed produz estado final **idêntico** ao da execução original em 100% dos casos.
- **SC-004**: Um bug injetado deliberadamente em qualquer categoria de invariante (FR-004a–g) é detectado pelo lote padrão em pelo menos 95% das execuções do lote.
- **SC-005**: O smoke E2E (3 partidas, 10 rodadas cada) completa em menos de 5 minutos e falha ao ser executado contra uma UI com erro de runtime introduzido propositalmente.
- **SC-006**: 100% das partidas do lote padrão terminam com exatamente 1 vencedor dentro do teto de rodadas.

## Assumptions

- **Teto de rodadas**: default 300 rodadas completas (todas as cadeiras jogam) por partida; configurável. Estourar o teto é tratado como falha (sinal de deadlock ou economia estagnada), conforme escolha do usuário.
- **Tamanho do lote**: default 100 partidas por contagem de jogadores por execução; configurável para lotes maiores em execuções noturnas.
- **Contagens cobertas**: 2, 3 e 6 jogadores (pedido explícito). Outras contagens (4, 5, 7, 8) ficam fora do lote padrão, mas o harness não as impede.
- **Multiplayer local**: o app hoje é single-client (todas as cadeiras na mesma tela); o smoke E2E dirige todas as cadeiras num único browser. Quando o multiplayer em rede (M3/D-025) chegar, estender o E2E é feature futura.
- **Política dos agentes**: aleatória pura seedada (estilo fuzzing), por decisão do usuário — sem heurística de "jogador razoável" nesta versão.
- **Trocas entre agentes**: o agente que recebe uma proposta decide aceitá-la/recusá-la também ao acaso; propostas geradas são sempre válidas pelos gates (conteúdo aleatório dentro do permitido).
- **Conservação de dinheiro**: o banco emite e recolhe dinheiro por regra (GO, impostos, cartas, empréstimos) — o invariante econômico é a conservação **nas transferências entre jogadores** e a coerência de cada emissão/recolhimento com a regra que a gerou, não uma soma global constante.
