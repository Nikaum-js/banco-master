# Research: Leilão da Largada

## D1 — A fase vive na sala, o resultado econômico vive no primeiro snapshot

**Decisão:** persistir prazo e compromissos no `Room`; só criar `GameState` depois do fechamento.

**Rationale:** antes da partida não há snapshot válido nem sequência de comandos. A sala já é a entidade persistida que existe no lobby. Cobrar apenas ao construir o primeiro snapshot mantém ordem, caixa e Loteria atômicos.

**Alternativas consideradas:**

- Criar o jogo antes do leilão — introduz uma fase de jogo que não é turno e abre risco de snapshot parcialmente cobrado.
- Manter tudo em memória do host — perde lances/prazo no reload e contraria resiliência.

## D2 — O lance usa o tópico privado do assento

**Decisão:** evento específico `opening-bid` no mesmo `room:<id>:s:<uid>` de comandos privados.

**Rationale:** esse tópico já entrega autoria atestada pelo endereço e só é lido pelo dono/autoridade. Não há motivo para RPC ou canal novo; a porta continua explícita e coberta por conformance.

**Alternativas consideradas:**

- Broadcast no lobby — o valor ficaria visível ao inspecionar tráfego, quebrando o lacre.
- Campo `uid` no payload — identidade declarada pelo cliente reabre o problema resolvido pela D-042.
- Reusar `GameCommand` — não existe `GameState` durante a coleta e o comando não é ação de turno.

## D3 — Persistir valor no assento e redigir por fase

**Decisão:** `Seat.openingBid` é persistido; `bidLocked` é público; `toPublicRoom` e `room_preview` removem valores alheios enquanto `bidding`.

**Rationale:** permite reload do host e do convidado sem um segundo armazenamento. Depois de `playing`, os valores são deliberadamente públicos para a revelação.

**Alternativas consideradas:**

- Mapa privado só no host — não sobrevive ao reload.
- Tabela separada de lances — aumenta superfície de RLS, limpeza e atomicidade para no máximo oito números de vida curta.

## D4 — Empate é shuffle dentro do grupo

**Decisão:** ordenar por lance descrescente e aplicar Fisher-Yates somente entre assentos com o mesmo valor.

**Rationale:** preserva integralmente a preferência comprada e usa o mesmo RNG injetável da autoridade. A UI pode representar o desempate como dados do banco sem transformar dados em regra adicional.

**Alternativas consideradas:**

- Ordem de entrada — favorece silenciosamente host/primeiros convidados.
- Rolar dois dados até desempatar — adiciona várias rodadas e estados sem ganho estratégico.

## D5 — A animação nunca é relógio de domínio

**Decisão:** o fechamento cria e grava o jogo antes da revelação; cada cliente troca para o tabuleiro por timer apenas de apresentação.

**Rationale:** cliente lento, aba em background, movimento reduzido ou reload não podem atrasar a mesa nem exigir aceite.

**Alternativas consideradas:**

- Host esperar confirmações de animação — reintroduz exatamente o clique/espera que a feature remove.
- Comando “começar” por cliente — múltiplas autoridades e risco de mesa dividida.

## D6 — Direção visual: casa de leilões náutica

**Decisão:** tratar a sala de mapas como uma casa de leilões de rotas: lote numerado, bilhete lacrado, marcador de prazo inspirado em instrumento de navegação e fichas indo para a Loteria.

**Rationale:** estende o vocabulário já presente em vez de inserir uma estética de cassino ou dashboard genérico. A personalidade vem de composição, tipografia, marcas de registro e movimento com propósito.

**Alternativas consideradas:**

- Cassino/neon — compete com o tema “Cidades do Mundo” e com o latão do produto.
- Modal genérico com slider — comunica formulário, não ritual compartilhado.

## D7 — O modo escolhido pertence à sala

**Decisão:** persistir `openingMode` no `Room`, publicar a preferência para todos e permitir mutação somente pela autoridade enquanto `status === 'lobby'`.

**Rationale:** a escolha acontece antes de existir `GameState`, precisa sobreviver a reload e deve ser visível aos convidados antes do início. A sala já é a fonte persistida desse estágio.

**Alternativas consideradas:**

- Estado local do host — convidado não vê e reload perde.
- Parâmetro apenas de `startMatch` — o clique poderia divergir da opção mostrada no lobby.
- Comando de jogo — ainda não existe snapshot nem turno.

## D8 — Maior dado é resolvido automaticamente pela autoridade

**Decisão:** no clique de início, a autoridade gera dois d6 por assento, ordena pela soma e usa o mesmo RNG para desempatar grupos iguais. As rolagens ficam no assento para a revelação.

**Rationale:** concretiza a regra histórica do SRS (“maior valor começa”) sem introduzir uma rodada de confirmações que poderia travar a mesa. Dois dados brancos reutilizam a linguagem do jogo; o Speed Die não participa.

**Alternativas consideradas:**

- Cada cliente clicar para rolar — reintroduz espera/timeout e exige novo protocolo de autoria.
- Reusar `shuffleSeatOrder` — não produz o resultado de dados pedido nem permite revelá-lo.
- Um único d6 — gera muito mais empates em mesas de até oito jogadores.

## D9 — Uma revelação, duas leituras

**Decisão:** manter a fase de apresentação `reveal` e variar apenas o conteúdo conforme `openingMode`.

**Rationale:** snapshot, reconexão, timer automático e entrada no tabuleiro são iguais nos dois modos. Duplicar a máquina de sessão criaria dois caminhos para a mesma transição.

**Alternativas consideradas:**

- Entrar direto no tabuleiro em Maior dado — esconderia o resultado que definiu a ordem.
- Fases separadas — estado adicional sem diferença de domínio.
