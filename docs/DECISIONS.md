# DECISIONS — Log de decisões

> Registro append-only de decisões de produto e design. Nunca apagar — só adicionar nova entrada que invalide uma anterior (e referenciar a invalidada).
>
> **Formato:** cada decisão tem ID, data, status, contexto e justificativa.
> **Status possíveis:** `aceita` · `rejeitada` · `revogada` (substituída por nova decisão)

---

## Índice

### Aceitas
- [D-001](#d-001--multiplayer-online-exclusivo) — Multiplayer online exclusivo, sem IA, sem hotseat
- [D-002](#d-002--at-8-jogadores-por-sala) — Até 8 jogadores humanos por sala
- [D-003](#d-003--speed-die-aps-1-volta) — Speed Die ativado após 1ª volta
- [D-004](#d-004--construo-com-grupo-parcial) — Construção com grupo parcial permitida (70% / 150%)
- [D-005](#d-005--propriedade-coringa) — ~~2 propriedades coringa no tabuleiro~~ **revogada** (funcionalidade removida)
- [D-006](#d-006--free-parking-com-prmio-acumulado) — Free Parking acumula prêmio (inicial $500)
- [D-007](#d-007--go-progressivo) — GO Progressivo ($100 a $400 por ranking)
- [D-008](#d-008--segundo-hotel-por-propriedade) — Segundo hotel permitido (estoque, não aluguel)
- [D-009](#d-009--emprstimos-entre-jogadores) — Empréstimos entre jogadores (10–50%, cobra por GO)
- [D-010](#d-010--imunidade-de-aluguel-negocivel) — Imunidade de aluguel negociável
- [D-011](#d-011--cartas-em-mo-privadas-e-no-negociveis) — Cartas em mão privadas e não-negociáveis (limite 3)
- [D-012](#d-012--bus-tickets-como-item-separado) — Bus Tickets como item de mão separado das cartas
- [D-013](#d-013--cartas-ofensivas-no-recusveis-sem-reao) — Cartas ofensivas não recusáveis exceto via reação
- [D-014](#d-014--tesouro-precisa-impactar) — Princípio: Tesouro precisa ser impactante (não "casa de troquinho")
- [D-015](#d-015--sem-timer-de-turno) — Sem timer de turno; jogador controla finalização
- [D-016](#d-016--desconexo-pausa-partida) — Desconexão pausa a partida, sem perda de propriedades
- [D-017](#d-017--tabuleiro-de-48-casas) — Tabuleiro expandido para 48 casas (inspirado no Mega Edition)
- [D-018](#d-018--termo-canônico-acaso-antes-surpresa) — Termo canônico "Acaso" (antes "Surpresa")

### Rejeitadas
- [D-R01](#d-r01--sistema-de-draft-rejeitada) — Sistema de draft de propriedades no início
- [D-R02](#d-r02--co-propriedade-rejeitada) — Co-propriedade (dois donos de uma mesma propriedade)

---

## Decisões aceitas

### D-001 — Multiplayer online exclusivo
**Data:** 2026-05 · **Status:** aceita
**Decisão:** O jogo é multiplayer online; sem modo single-player, sem IA, sem hotseat.
**Por quê:** Foco em experiência social/competitiva entre humanos. IA fora do escopo da v1.

### D-002 — Até 8 jogadores por sala
**Data:** 2026-05 · **Status:** aceita
**Decisão:** Cada sala suporta de 2 a 8 jogadores humanos simultâneos.
**Por quê:** Equivalente ao Richup.io. Mais que isso prejudica ritmo de turno.

### D-003 — Speed Die após 1ª volta
**Data:** 2026-05 · **Status:** aceita
**Decisão:** Speed Die é ativado individualmente para cada jogador após completar a 1ª volta do tabuleiro.
**Por quê:** Acelera meio/fim de partida e corrige first-mover advantage. Espelha a regra oficial Monopoly 2006+.

### D-004 — Construção com grupo parcial
**Data:** 2026-05 · **Status:** aceita
**Decisão:** Permitir construção sem grupo completo, com aluguel a 70% (vs. 100% completo).
**Por quê:** Resolve o "jogador travado" sem cooperação obrigatória. Incentivo de completar grupo via trade se mantém.

### D-005 — Propriedade Coringa
**Data:** 2026-05 · **Status:** revogada
**Revogada** (2026-05-23): funcionalidade removida do produto — mudança de escopo. Não há mais propriedades Coringa no tabuleiro; o caminho de progresso sem cooperação obrigatória fica a cargo da construção com grupo parcial ([D-004](#d-004--construo-com-grupo-parcial)).
**Decisão original:** 2 propriedades coringa no tabuleiro, podem representar qualquer cor para construção. Custo +25%. Decisão de cor é irreversível na partida.
**Por quê (original):** Válvula de escape adicional pra grupos fragmentados. Custo extra justifica a flexibilidade.

### D-006 — Free Parking com prêmio acumulado
**Data:** 2026-05 · **Status:** aceita
**Decisão:** Free Parking acumula impostos, multas e multa de prisão. Prêmio inicial $500. Reabastece com $500 ao ser coletado.
**Por quê:** Catch-up discreto. Quem está perdendo torce pra cair lá.

### D-007 — GO Progressivo
**Data:** 2026-05 · **Status:** aceita
**Decisão:** Valor recebido ao passar pelo GO escala inversamente com ranking de patrimônio: $100 (1º) a $400 (último).
**Por quê:** Catch-up natural sem destaque na UI. Valores podem ser ajustados após playtesting.

### D-008 — Segundo hotel por propriedade
**Data:** 2026-05 · **Status:** aceita
**Decisão:** Permitir 2º hotel por propriedade. Não altera aluguel — o valor estratégico é a escassez no estoque global de hotéis.
**Por quê:** Cria pressão sobre o estoque do banco e abre estratégia de "bloqueio" sem inflar aluguel.

### D-009 — Empréstimos entre jogadores
**Data:** 2026-05 · **Status:** aceita
**Decisão:** Jogadores podem emprestar dinheiro entre si. Juros 10–50%. Cobrado a cada passagem do devedor pelo GO. Máximo 1 empréstimo ativo por jogador.
**Por quê:** Cria dinâmicas de aliança/risco. Mantém jogadores em desvantagem no jogo sem precisar vender propriedades.

### D-010 — Imunidade de aluguel negociável
**Data:** 2026-05 · **Status:** aceita
**Decisão:** Imunidade de aluguel pode entrar em propostas de negociação — por N voltas ou até o fim da partida.
**Por quê:** Aumenta superfície de barganha; permite acordos criativos além de propriedade+dinheiro.

### D-011 — Cartas em mão privadas e não-negociáveis
**Data:** 2026-05 · **Status:** aceita
**Decisão:** Cartas em mão são privadas (outros jogadores veem apenas contador), não-negociáveis, com limite de 3 totais somando os dois decks.
**Por quê:** Cartas são alavanca estratégica; tornar pública ou negociável esvazia o mecanismo. Limite de 3 evita acumulação cumulativa.

### D-012 — Bus Tickets como item separado
**Data:** 2026-05 · **Status:** aceita
**Decisão:** Bus Tickets têm contador próprio, separado do limite de 3 cartas.
**Por quê:** Ticket é item de movimento, não carta de efeito. Mistura confundiria limite e comunicação visual.

### D-013 — Cartas ofensivas não-recusáveis (exceto via reação)
**Data:** 2026-05 · **Status:** aceita
**Decisão:** Cartas ofensivas (Aquisição Hostil, Despejo, Auditoria, Boicote) não podem ser recusadas pelo alvo, exceto via carta de reação (ex: Diplomacia).
**Por quê:** Manter peso estratégico das ofensivas. Defesa existe, mas exige investimento prévio em carta de reação.

### D-014 — Tesouro precisa impactar
**Data:** 2026-05 · **Status:** aceita
**Decisão:** Princípio de design: Tesouro não pode virar "casa de troquinho" como no Richup. A diferença entre Surpresa e Tesouro é **temática** (caótico vs. defensivo), não de **magnitude**.
**Por quê:** Tesouro irrelevante quebra a economia de cartas. Jogadores ignorariam o deck ou o usariam só pra completar mão.
**Como aplicar:** Toda carta nova de Tesouro precisa passar pelo teste "isso muda a decisão de alguém no turno?". Se a resposta for "não", redesenhar.

### D-015 — Sem timer de turno
**Data:** 2026-05 · **Status:** aceita
**Decisão:** Não há timer obrigatório no turno. Jogador controla quando finaliza.
**Por quê:** Negociações complexas precisam de tempo. Timer força decisões ruins.

### D-016 — Desconexão pausa a partida
**Data:** 2026-05 · **Status:** aceita
**Decisão:** Em desconexão mid-game, a partida pausa. Propriedades não voltam ao banco. Aguarda reconexão.
**Por quê:** Resiliência de sessão é objetivo central. Perder partida por desconexão é frustrante e quebra a confiança no produto.

### D-017 — Tabuleiro de 48 casas
**Data:** 2026-05-23 · **Status:** aceita
**Decisão:** Expandir o tabuleiro de **40 → 48 casas** (11 por lado + 4 cantos), inspirado no **Monopoly: The Mega Edition** (52 casas). Composição: 28 cidades (grupos 3/3/3/4/4/4/4/3, premium com 4), 4 aeroportos, 3 utilidades, 3 Surpresa, 3 Tesouro, 2 impostos, 1 espaço Bus Ticket, 4 cantos. Cantos nos índices 0/12/24/36. Ajustes de economia que acompanham: dinheiro inicial $1.500 → **$2.000**; estoque global de construção 32 casas/12 hotéis → **40 casas/16 hotéis**.
**Por quê:** Partidas de 7-8 jogadores precisam de mais propriedades e profundidade — 40 casas saturam rápido (~4 compráveis/jogador). Grupos maiores (3-4) tornam o monopólio mais difícil de fechar, segurando o *runaway leader* e forçando mais negociação (mecanismo central do Mega para muitos jogadores). A escolha é coerente: as mecânicas que fazem um tabuleiro maior funcionar — Speed Die ([D-003](#d-003--speed-die-aps-1-volta)), grupo parcial ([D-004](#d-004--construo-com-grupo-parcial)), Bus Tickets ([D-012](#d-012--bus-tickets-como-item-separado)), Skyscraper, Hangares — **já estavam decididas/no SRS**. A expansão completa um design já meio-Mega em vez de divergir do Richup.
**Como aplicar:** SRS §2 é a fonte de verdade da nova estrutura (já atualizado). Preços/aluguéis das 28 cidades partem do Richup como base e estendem-se numa escada mais granular ($60–$400). Speed Die permanece padrão. Valores de dinheiro/estoque são tunáveis após playtesting.

### D-018 — Termo canônico "Acaso" (antes "Surpresa")
**Data:** 2026-05-23 · **Status:** aceita
**Decisão:** O espaço de tabuleiro e o deck de cartas caóticas/ofensivas passam a se chamar **"Acaso"** (era "Surpresa"). "Tesouro" permanece. O `SquareKind` canônico é `'acaso'`.
**Por quê:** O código já migrou para "Acaso" (commits de board) e o termo é mais limpo — espelha o "Chance" clássico; o próprio glossário do SRS já glosava Surpresa como "cartas de acaso". Alinha a fonte de verdade à direção de produto demonstrada.
**Como aplicar:** Propagação **incremental** para não churnar a discovery:
- **Feito agora:** `spec.md` (002) FR-010; glossário SRS §17 (registro do termo canônico); constitution Princípio III (clarificação de termo, bump PATCH 1.0.0 → 1.0.1).
- **Deferido para a spec de Sistema de Cartas:** find-replace de "Surpresa" → "Acaso" em SRS §2.1/§4.6/§10/§13.4 e em `docs/CARTAS.md` (a spec reescreve §10 de qualquer forma).
- O **001** (spec/data-model/research) fica como histórico; não reabrir (aprovada).

---

## Decisões rejeitadas

### D-R01 — Sistema de draft (rejeitada)
**Data:** 2026-05 · **Status:** rejeitada
**Proposta:** Antes de começar a partida, jogadores fazem um draft de propriedades (escolha em rodízio) pra equilibrar distribuição inicial.
**Por que rejeitada:** Quebra a identidade do gênero. Banco Imobiliário é sobre **descoberta tática** durante a partida — quem cai onde, quem se arrisca a comprar. Draft inicial transforma o jogo em outro tipo de produto.
**Não revisitar a não ser que:** O playtesting revele que o first-mover advantage não é resolvido por Speed Die + Mr. Banco Master + GO Progressivo.

### D-R02 — Co-propriedade (rejeitada)
**Data:** 2026-05 · **Status:** rejeitada
**Proposta:** Permitir que dois jogadores sejam donos conjuntos de uma propriedade (ex: comprada em sociedade).
**Por que rejeitada:** Complexidade desproporcional ao benefício. Como dividir aluguel, hipoteca, construção, falência de um dos sócios? Cada regra precisaria de casos especiais. UI também ficaria confusa.
**Alternativa que atende a necessidade:** Empréstimos entre jogadores ([D-009](#d-009--emprstimos-entre-jogadores)) já cobrem o caso "preciso de capital de outro jogador pra investir".
**Não revisitar a não ser que:** Surgir um caso de uso concreto não coberto por empréstimo + negociação + imunidade de aluguel.

---

## Como adicionar uma nova decisão

1. Pegue o próximo ID (`D-XYZ` para aceita, `D-RNN` para rejeitada).
2. Inclua entrada no Índice acima.
3. Adicione a seção completa com data, status, decisão, "por quê" e (se aceita) "como aplicar".
4. Se a decisão **revoga** uma anterior:
   - Mude o status da antiga para `revogada`.
   - Adicione no topo da antiga: `**Revogada por:** D-XYZ`.
   - Na nova, referencie a antiga em "Por quê".
5. Se a decisão altera um princípio do projeto, atualize [`.specify/memory/constitution.md`](../.specify/memory/constitution.md) no mesmo passo.
