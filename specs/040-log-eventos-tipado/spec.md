# Feature Specification: Log de eventos tipado

**Feature Branch**: `main` (fluxo sem branch por feature)

**Created**: 2026-07-26

**Status**: Draft

**Input**: User description: "Log de eventos tipado: `LogEntry` deixa de ser `{ who, what }` com prosa em português e ids `p1..pN` interpolados, e passa a ser união discriminada `{ kind, who, ...campos }`. O motor emite fatos estruturados; a UI compõe a frase e resolve a identidade da sala. Fecha três defeitos: o log é cego para metade do jogo (construção, hipoteca, leilão, pregão, pote e fiança nunca são registrados, e `logEventIcon` testa 8 padrões inalcançáveis), o histórico vaza `p1..pN` que a 038 extinguiu do resto da tela, e som/ícone classificam por substring da frase. Operacionaliza D-032."

**Depende de**: spec 021 (log de eventos — é o que esta spec reescreve), spec 035 (som: `classifyLogEntry` é consumidor), spec 038 (identidade da sala — é o que resolve o nome)

**Regra de origem**: nenhuma. SRS §12.2 ("log de eventos — últimas ações") já está satisfeito e **não muda**. Esta é uma spec de **representação**, autorizada por [D-032](../../docs/adr/D-032-log-de-eventos-tipado-narrativa-e-da-ui.md).

---

## Por que esta spec existe

O log de eventos é a única superfície do jogo em que o motor escreve **prosa**. Todo o resto do `GameState` é dado: `titles`, `cash`, `resolution`, `landAuction`. O log grava `pagou $120 de aluguel a p3` — uma frase — e quem precisa do fato tem que reconstruí-lo de volta do texto.

Isso já produziu três defeitos, e nenhum deles é hipotético:

**1. O log é cego para metade do jogo.** São 14 pontos de emissão em `src/game/**`. Nenhum cobre **construção**, **venda de construção**, **hipoteca**, **deshipoteca**, **abertura ou fecho de leilão e de pregão**, **coleta do Free Parking** ou **fiança de prisão**. O `logEventIcon` (`boards/shared.tsx:1515`) testa `constru|hangar|hotel|arranha|vendeu`, `hipotec`, `leil`, `pote` e `fian` — **oito padrões que o motor nunca emite**. Esses ramos são inalcançáveis, e o que eles revelam não é ícone faltando: é **evento faltando**. Quem constrói um hotel, hipoteca um terreno ou arremata um lote não vê nada no diário de bordo.

**2. O log vaza `p1..pN`.** A spec 038 trocou `p.id` por identidade real da sala em `playersView` e declarou o `pN` extinto da tela. O histórico ficou fora: `CenterLog` renderiza `{l.who}` cru (`shared.tsx:1600`) e colore por índice em `PLAYER_COLORS` em vez da cor da sala. Pior, os textos do motor embutem ids **dentro da frase** — `aluguel a ${owner}`, `${trade.fromId} ↔ ${trade.toId}`, `juros a ${loan.creditorId}`. Enquanto o id estiver dentro da string, a apresentação não tem onde resolver o nome: a frase chega pronta. Nenhum teste pega isso porque o motor está correto — é a apresentação que está errada, e ela não tinha os dados.

**3. Classificação por substring é frágil onde ninguém olha.** `classifyLogEntry` (`classify.ts:72-83`) decide qual som toca com `w.includes('de aluguel a')`, `w.includes('juros')`, `w.includes('pelo GO')`. Reescrever uma frase por motivo de redação — coisa que ninguém trata como mudança de comportamento — muda o som. O modo de falha já se materializou na casa ao lado: a sessão de 2026-07-25 registrou o E2E de 6 jogadores travando porque um rótulo de botão mudou e o roteiro procurava o antigo. E o log fala **outra moeda que o resto do produto**: ele escreve `$1200` enquanto HUD, modais e painéis escrevem `R$ 1.200` (pt-BR, com separador) — porque cada ponto formata dinheiro por conta própria, em seis definições locais copiadas. O `R$` de `emprestimos.ts:153`, que parecia o desvio, é o único ponto do log acidentalmente alinhado com a UI.

Além de fechar os três, o evento tipado é **pré-requisito** de três coisas que o backlog quer depois e que hoje são impossíveis: explicação de aluguel na UI (precisa de base/multiplicador/posse, não de uma frase), cor por tipo no histórico, e i18n (inviável com português compilado dentro do reducer).

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - O histórico chama as pessoas pelo nome (Priority: P1) 🎯 MVP

Um jogador olha o diário de bordo no centro do tabuleiro e lê "**Ana** pagou $120 de aluguel a **Bruno**", com a cor que Ana escolheu na sala. Em nenhum lugar do histórico aparece `p1`, `p2` ou `p3`.

**Why this priority**: é o defeito visível. A 038 extinguiu o `pN` de toda a UI e o histórico ficou para trás — é o único lugar do produto que ainda mostra id de banco de dados para o jogador. Entregar só isto já corrige a inconsistência mais evidente, e exige exatamente a mudança estrutural que o resto da spec aproveita.

**Independent Test**: montar uma partida com sala (nomes e cores reais), provocar aluguel, troca e juros de empréstimo — os três eventos que hoje interpolam id — e verificar que o histórico renderizado não contém nenhum id de jogador e que cada linha usa a cor da sala.

**Acceptance Scenarios**:

1. **Given** uma sala com Ana e Bruno e uma partida em curso, **When** Ana paga aluguel a Bruno, **Then** a entrada do histórico nomeia **Ana** como autora e **Bruno** como proprietário, e nenhum id aparece.
2. **Given** a mesma partida, **When** uma troca é aceita entre Ana e Bruno, **Then** a entrada nomeia os dois pelos nomes da sala (hoje sai `p1 ↔ p2`).
3. **Given** Ana devendo juros de empréstimo a Bruno, **When** ela passa pelo GO e paga os juros, **Then** a entrada nomeia Bruno e o valor sai na **mesma moeda que o resto da UI** — `R$` no formato pt-BR, com separador de milhar (hoje o log escreve `$1200`, enquanto HUD, modais e painéis escrevem `R$ 1.200`).
4. **Given** uma partida **sem** sala (boot local, `?players=N`), **When** qualquer evento é registrado, **Then** o histórico usa o rótulo de fallback da 038 (`Jogador N`) e continua legível — a ausência de sala não derruba a tela nem revela o id.
5. **Given** um evento cujo autor é o banco, **When** ele aparece, **Then** ele é identificado como banco com o selo próprio, sem ser confundido com jogador.
6. **Given** a cor de Ana na sala, **When** a linha dela aparece no histórico, **Then** a cor usada é a **da sala**, não a derivada da posição dela em `PLAYER_COLORS`.

---

### User Story 2 - O histórico registra o jogo inteiro (Priority: P1)

Um jogador constrói um hotel, hipoteca um terreno, arremata um lote no pregão e paga fiança para sair da prisão. Cada uma dessas ações aparece no diário de bordo, com o ícone do seu tipo.

**Why this priority**: também P1, e não P2, porque é o defeito **maior** — um log que não registra construção nem leilão não cumpre o que o SRS §12.2 pede ("últimas ações"). Está separado da US1 porque é entregável e testável de forma independente: a US1 conserta **como** o evento é exibido, a US2 conserta **quais** eventos existem.

**Independent Test**: exercitar cada ação hoje silenciosa (construir, vender construção, hipotecar, deshipotecar, abrir/fechar leilão, fechar lote de pregão, coletar Free Parking, pagar fiança) e verificar que cada uma produz exatamente uma entrada no log, com ícone não-nulo.

**Acceptance Scenarios**:

1. **Given** um jogador que pode construir, **When** ele constrói uma casa, um hotel, um hangar ou um arranha-céu, **Then** o log registra o que foi construído, onde, e por quanto.
2. **Given** um jogador com construção, **When** ele vende uma construção, **Then** o log registra a venda e o valor recebido.
3. **Given** um jogador com propriedade livre de construção, **When** ele hipoteca, **Then** o log registra a hipoteca e o valor levantado; **When** ele deshipoteca, **Then** o log registra o custo pago.
4. **Given** um leilão comum aberto por recusa de compra, **When** ele fecha com vencedor, **Then** o log registra quem arrematou, o quê e por quanto; **When** ele fecha sem lance, **Then** o log registra que a propriedade ficou livre.
5. **Given** um pregão simultâneo, **When** um lote fecha, **Then** o log registra aquele lote individualmente — um lote, uma entrada.
6. **Given** um jogador que para no Free Parking, **When** ele coleta o pote, **Then** o log registra a coleta e o valor.
7. **Given** um jogador na prisão, **When** ele paga a fiança, **Then** o log registra o pagamento.
8. **Given** cada tipo de evento que o log emite, **When** a linha é renderizada, **Then** ela tem um ícone correspondente ao tipo — nenhum tipo cai no ramo sem ícone por esquecimento.

---

### User Story 3 - Som e ícone param de adivinhar (Priority: P2)

Um desenvolvedor reescreve o texto de uma entrada do histórico por motivo de redação. O som que toca e o ícone exibido continuam exatamente os mesmos, porque nenhum dos dois lê a frase.

**Why this priority**: P2 porque o jogador não percebe diretamente — mas é o que impede a próxima mudança de redação de virar um bug de áudio silencioso. Depende da estrutura da US1/US2 já existir.

**Independent Test**: reescrever a frase de cada tipo de evento e verificar que a suíte de som e de ícone continua verde sem alteração; e acrescentar um tipo de evento novo sem tratá-lo, verificando que a verificação de exaustividade **falha**.

**Acceptance Scenarios**:

1. **Given** o classificador de som, **When** a frase de um evento é reescrita, **Then** o cue escolhido não muda.
2. **Given** o seletor de ícone, **When** a frase de um evento é reescrita, **Then** o ícone não muda.
3. **Given** um tipo de evento novo acrescentado ao log, **When** ninguém decide o som e o ícone dele, **Then** a verificação de exaustividade falha e aponta o tipo não tratado — igual ao que `localView.test.ts` já faz para os comandos da 038.
4. **Given** o evento de saque de carta, **When** ele classifica o som, **Then** o cue continua **genérico** — o log não ganha campo de raridade nem de identidade da carta sacada (princípio VI, FR-016 da 035).

---

### Edge Cases

- **Snapshot antigo**: uma sala persistida antes desta spec tem log no formato `{ who, what }`. A entrada sem tipo é renderizada como texto solto, sem ícone e sem resolução de nome — não derruba a tela, e é o único tratamento de compatibilidade previsto (D-032, "custo aceito"). Não há migração.
- **Jogador eliminado como sujeito**: uma entrada pode nomear alguém que já saiu (o aluguel que ele pagou continua no histórico). O nome tem que continuar resolvendo — a identidade da sala não desaparece com a eliminação.
- **Jogador que saiu da sala**: entrou, jogou, foi removido no lobby ou fechou a aba. A entrada antiga dele ainda precisa de nome; sem sala para consultar, cai no fallback em vez de exibir o id.
- **Log no teto de 50**: o `shift` continua valendo. A chave de comparação usada pelo som para detectar entradas novas passa a ser derivada dos campos, não da frase — e precisa continuar distinguindo duas entradas idênticas em valor (dois "rolou 3+4" seguidos) sem re-tocar histórico.
- **Evento sem autor jogador**: Fiscal do banco cobrando, imposto, pote acumulando. O autor é o banco, e a entidade "banco" não tem assento na sala.
- **Valor zero**: aluguel $0 por greve, bônus $0. A frase não pode dizer "pagou $0 de aluguel" quando o evento não deveria existir — evento com valor nulo não é emitido, como já é hoje (o `resolveRentable` sai antes por boicote/imunidade).
- **Mesmo evento em cliente e host**: o log é parte do `GameState` difundido; a frase é composta no cliente. Dois clientes com a mesma sala veem a mesma frase; um cliente sem sala vê fallback. A **convergência é do estado**, não da frase — e é isso que precisa ser preservado.
- **Duas construções na mesma jogada**: construir duas casas gera duas entradas, não uma agregada. Agregação é decisão de apresentação e não entra nesta fatia.

---

## Requirements *(mandatory)*

### Functional Requirements

**Forma do evento**

- **FR-001**: `LogEntry` MUST ser uma união discriminada por um campo `kind` de literais fechados; o conjunto de `kind` MUST ser exaustivo e verificável em tempo de compilação.
- **FR-002**: Cada entrada MUST carregar os dados do evento em **campos estruturados** (valor, posição, alvo, deck), e MUST NOT carregar prosa formatada pelo motor.
- **FR-003**: Referências a jogadores MUST ser **ids** em campos próprios (`who`, e um campo de alvo quando houver), nunca interpoladas em texto.
- **FR-004**: O evento MUST permanecer serializável em JSON puro — o log é parte do `GameState` difundido e persistido (princípio VII, D-020).
- **FR-005**: O log MUST continuar limitado a 50 entradas, descartando as mais antigas.
- **FR-006**: O motor MUST NOT ler `state.log` para decidir comportamento — o log continua sendo saída, nunca entrada de regra.

**Cobertura de eventos**

- **FR-007**: O sistema MUST registrar **construção** (casa, hotel, hangar, arranha-céu), com o que foi construído, onde e o custo.
- **FR-008**: O sistema MUST registrar **venda de construção**, com o que foi vendido, onde e o valor recebido.
- **FR-009**: O sistema MUST registrar **hipoteca** e **deshipoteca**, com a propriedade e o valor movido.
- **FR-010**: O sistema MUST registrar o **fecho de leilão comum**, distinguindo arremate (vencedor, propriedade, valor) de lote sem lance (propriedade fica livre).
- **FR-011**: O sistema MUST registrar o **fecho de cada lote de pregão** individualmente, com a origem do pregão disponível para a apresentação.
- **FR-012**: O sistema MUST registrar a **coleta do Free Parking**, com o valor — respeitando princípio IV: a entrada relata o valor recebido, sem rótulo de catch-up.
- **FR-013**: O sistema MUST registrar o **pagamento de fiança** de prisão.
- **FR-014**: O sistema MUST preservar todos os eventos que já registra hoje: rolagem, passagem/parada no GO, compra, aluguel, imposto, espaço Bus Ticket, saque de carta, efeito imediato de carta, dívida paga, falência, troca aceita, juros de empréstimo e juros não cobertos.
- **FR-015**: O saque de carta MUST permanecer **genérico** — sem raridade e sem identidade da carta quando ela vai para a mão (princípio VI; FR-016 da spec 035).

**Apresentação**

- **FR-016**: A frase exibida MUST ser composta na camada de apresentação, a partir dos campos do evento.
- **FR-017**: A apresentação MUST resolver ids de jogador pela identidade da sala (nome e cor), com o fallback da 038 quando não houver sala.
- **FR-018**: O histórico MUST NOT exibir id de jogador em nenhuma entrada, em nenhum estado da partida.
- **FR-019**: A cor da linha do histórico MUST vir da identidade da sala, não da posição do jogador numa paleta.
- **FR-020**: A formatação de dinheiro MUST ter uma fonte única, e o log MUST usar a **mesma convenção da UI** (`R$` no formato pt-BR, com separador de milhar). As definições locais duplicadas do formatador MUST convergir para essa fonte.
- **FR-021**: Cada `kind` MUST ter um ícone decidido; a ausência de decisão MUST ser detectada por teste, não descoberta em tela.
- **FR-022**: A apresentação MUST tolerar entrada legada sem `kind`, exibindo-a como texto solto sem derrubar a tela.

**Consumidores**

- **FR-023**: O classificador de som MUST ramificar por `kind`, e MUST NOT inspecionar texto.
- **FR-024**: O seletor de ícone MUST ramificar por `kind`, e MUST NOT inspecionar texto.
- **FR-025**: A detecção de entradas novas pelo som MUST derivar sua chave dos campos do evento, preservando o comportamento atual: entradas repetidas em valor contam como distintas, e log irreconhecível (reset/reconexão) não re-toca histórico.
- **FR-026**: Acrescentar um `kind` novo sem tratá-lo em som e ícone MUST falhar a verificação de exaustividade.

### Key Entities

- **Evento de log** (`LogEntry`): fato ocorrido na partida, tipado por `kind`, com autor (`who`) e campos próprios do tipo. Entidade **existente** (spec 021), reformada por esta spec de `{ who, what }` para união discriminada. Vive em `GameState.log`, é serializável e difundida.
- **Tipo de evento** (`kind`): literal fechado que discrimina a união. É o **contrato** entre motor e consumidores — é sobre ele que som, ícone e frase ramificam, e é sua exaustividade que o compilador cobra.
- **Descritor de evento**: função de apresentação que converte evento → frase, resolvendo identidade e formatando dinheiro. Entidade **nova**, vive na camada de UI. Não é parte do `GameState`.
- **Identidade da sala**: nome, cor e peça de um assento. Entidade **existente** (spec 038, `src/net/identity.ts`) — esta spec a torna consumidora do log, que é o último lugar da UI que ainda não a usava.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Zero ocorrências de id de jogador (`p` seguido de dígito) no histórico renderizado, em partida com sala e sem sala, verificado por teste.
- **SC-002**: Os 8 padrões hoje inalcançáveis do seletor de ícone passam a ser alcançáveis: cada um tem ao menos um evento do motor que o produz, verificado por teste.
- **SC-003**: 100% dos `kind` têm som e ícone decididos, e a verificação de exaustividade falha ao se acrescentar um `kind` não tratado — provado sabotando a união com um tipo novo.
- **SC-004**: Zero consumidores classificando o log por conteúdo de texto: nenhuma comparação de substring sobre a frase sobrevive em `src/`.
- **SC-005**: Nenhuma regra do motor muda: a suíte existente continua verde, com asserção reescrita **apenas** onde ela afirmava o formato antigo da entrada de log.
- **SC-006**: Formatação de dinheiro consistente em 100% das entradas do log **e** igual à do resto da UI (`R$ 1.200`, pt-BR); as definições locais duplicadas do formatador caem de 6 para 1, verificado por busca e por teste.
- **SC-007**: Em partida de 3+ clientes, `GameState.log` é idêntico byte a byte entre todos os clientes — o evento tipado não introduz dependência de cliente no estado.
- **SC-008**: A cobertura de eventos do log sai de 14 pontos de emissão para cobrir também as famílias hoje silenciosas (construção, venda, hipoteca, deshipoteca, leilão, pregão, pote, fiança), medido por contagem de `kind` exercitados numa partida simulada.
- **SC-009**: O som não regride: os cues que toca hoje para os eventos existentes continuam idênticos, verificado caso a caso contra a tabela atual de `classifyLogEntry`.

## Assumptions

- **A decisão já está tomada** em [D-032](../../docs/adr/D-032-log-de-eventos-tipado-narrativa-e-da-ui.md): união discriminada, narrativa na UI, sem migração de snapshot. Esta spec operacionaliza, não reabre. A alternativa "acrescentar `kind` ao lado de `what`" foi considerada e rejeitada lá.
- **O SRS não muda.** §12.2 pede "log de eventos (últimas ações)" e continua satisfeito — esta é representação, não regra. Nenhum bump de versão do SRS.
- **Não há migração de snapshot.** Sala persistida com log antigo é tolerada em exibição (FR-022) e nada mais; o produto é pré-lançamento e a única sala real é de teste.
- **A privacidade não afrouxa.** O log não ganha nada que o princípio VI proíba, e a reserva da D-030 (garantia de apresentação, não de dados) continua valendo sem mudança.
- **A UI reusa o histórico existente** (`CenterLog`) — esta spec não pede painel novo, só que ele leia campos em vez de frase.
- **Explicação de aluguel, cor por tipo e i18n ficam FORA.** Esta fatia os torna possíveis; entregá-los é decisão separada. O evento de aluguel MAY carregar os campos que a explicação vai precisar, mas a explicação não é construída aqui.
- **Agregação de eventos fica fora.** Duas construções na mesma jogada são duas entradas.
- **O motor permanece puro e serializável** (constitution: reducers `(state, ctx) → state`), e nenhum reducer passa a ler o log (FR-006).
