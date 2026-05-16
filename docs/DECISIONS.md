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
- [D-008](#d-008--segundo-hotel-por-propriedade) — Segundo hotel permitido (cobra mais aluguel; revista pela D-022)
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
- [D-019](#d-019--autenticação-anônima-por-link-sem-contas-no-v1) — Autenticação anônima por link (sem contas no v1)
- [D-020](#d-020--modelo-de-autoridade--sincronização-host-autoritativo--realtime--snapshot) — Modelo de autoridade & sync: host-autoritativo + Realtime + snapshot
- [D-021](#d-021--espaço-bus-ticket-uso-imediato-ao-parar-revisa-27107) — Espaço Bus Ticket: uso imediato ao parar (revisa §2.7/§10.7) — **revertida (2026-05-27): volta a guardar o ticket**
- [D-022](#d-022--escassez-de-construção-removida-construção-ilimitada) — Escassez de construção removida (construção ilimitada; remove leilão de casas)
- [D-023](#d-023--leilão-de-escassez-de-terrenos-pregão-simultâneo) — Leilão de escassez de terrenos (pregão simultâneo, fim de jogo)
- [D-024](#d-024--economia-recalibrada-tiers-de-casa--aluguel-por-grupo) — Economia recalibrada: tiers de casa + aluguel por grupo (sweet spots; laranja→3)
- [D-025](#d-025--distrito-super-luxo-alta-roda) — Distrito super-luxo dos Emirados (Abu Dhabi/Dubai; 10º grupo, armadilha de prestígio)
- [D-026](#d-026--construção-com-país-parcial--aluguel-escalonado-por-posse) — Construção com país parcial: constrói com 1+ cidade, aluguel escala por posse (revisa D-004)
- [D-027](#d-027--bus-ticket-usável-também-no-fim-do-turno) — Bus Ticket usável também no fim do turno (não só antes de rolar)

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
**Data:** 2026-05 · **Status:** aceita, **SUSPENSO pós-playtest (2026-05-24)**
**Decisão:** Speed Die é ativado individualmente para cada jogador após completar a 1ª volta do tabuleiro.
**Por quê:** Acelera meio/fim de partida e corrige first-mover advantage. Espelha a regra oficial Monopoly 2006+.
**Atualização (2026-05-24):** desativado por feedback de playtest ("o 3º dado gera muita confusão" — Mr.Banco/Ônibus/Triple). Implementado via flag `THEME.SPEED_DIE_ENABLED=false` (jogo rola sempre 2 dados); o motor, os modais (bus-move/triple-dest) e os testes do Speed Die **permanecem** no código — reversível voltando o flag a `true`. Reavaliar se o first-mover advantage voltar a incomodar (ver D-006: depende de Speed Die + Mr.Banco + GO Progressivo).

### D-004 — Construção com grupo parcial
**Data:** 2026-05 · **Status:** ~~aceita~~ **revisada por D-026 (2026-05-27)**
**Decisão:** Permitir construção sem grupo completo, com aluguel a 70% (vs. 100% completo).
**Por quê:** Resolve o "jogador travado" sem cooperação obrigatória. Incentivo de completar grupo via trade se mantém.
**Revisão (2026-05-27, D-026):** a trava de **maioria** caiu (constrói com ≥1 cidade) e o 70%/100% binário virou uma **escala por posse** (50% → 100%). Ver D-026.

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
**Data:** 2026-05 · **Status:** aceita, **REVISTA pós-playtest (2026-05-24)**
**Decisão original:** Valor recebido ao passar pelo GO escala inversamente com ranking de patrimônio: $100 (1º) a $400 (último).
**Por quê (original):** Catch-up natural sem destaque na UI.
**Revisão (2026-05-24):** o GO Progressivo foi **substituído por regra fixa** (feedback de playtest — o valor variável por ranking confundia e parecia "pouco"): **passar pelo GO = $200**; **cair EXATAMENTE no GO = $400** (em dobro). Implementado em `THEME.GO_PASS` + `advance` (dobra ao parar em pos 0) + carta "Volta para o GO" (Acaso) que teleporta ao GO e credita os $400. O catch-up fica por conta do Free Parking (D-006) e tuning futuro.

### D-008 — Segundo hotel por propriedade
**Data:** 2026-05 · **Status:** aceita, **REVISTA (2026-05-25)**
**Decisão:** Permitir 2º hotel por propriedade. Não altera aluguel — o valor estratégico é a escassez no estoque global de hotéis.
**Por quê:** Cria pressão sobre o estoque do banco e abre estratégia de "bloqueio" sem inflar aluguel.
**Revisão (2026-05-25):** com a escassez de construção removida ([D-022](#d-022--escassez-de-construção-removida-construção-ilimitada)), o 2º hotel perdeu o valor de "bloqueio por estoque". Passa a **cobrar mais aluguel que o 1º hotel** (degrau real da escada, `HOTEL2_RENT_MULT` no tema) e a ser o pré-requisito do arranha-céu (2 hotéis → 1 arranha-céu). SRS §14.4 / §13.7 atualizados.

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
**Atualização (2026-05-25):** o **limite global de estoque** de construção (40 casas / 16 hotéis) foi **removido** — casas, hotéis e arranha-céus são ilimitados ([D-022](#d-022--escassez-de-construção-removida-construção-ilimitada)). O tamanho do tabuleiro (48 casas) e o dinheiro inicial ($2.000) permanecem.
**Atualização (2026-05-25, composição):** o SRS §2.3 dizia "8 grupos, premium 4/4/4/4" — divergia do board real. A composição correta é **9 grupos: 8 de 3 + verde (EUA) de 4 = 28** (laranja foi de 2 → 3 com Hamburgo; Salvador saiu). Calibração econômica (preços/aluguéis/custos) recalibrada na [D-024](#d-024--economia-recalibrada-tiers-de-casa--aluguel-por-grupo).
**Atualização (2026-05-25, super-luxo):** com o distrito super-luxo dos Emirados ([D-025](#d-025--distrito-super-luxo-alta-roda)), a composição vira **10 grupos**: 8 de 3 + França (navy) de 2 + Emirados (platinum) de 2 = 28. Verde recua de 4 → 3 (Chicago sai) e França de 3 → 2 (Lyon sai); Abu Dhabi/Dubai entram no topo.

### D-018 — Termo canônico "Acaso" (antes "Surpresa")
**Data:** 2026-05-23 · **Status:** aceita
**Decisão:** O espaço de tabuleiro e o deck de cartas caóticas/ofensivas passam a se chamar **"Acaso"** (era "Surpresa"). "Tesouro" permanece. O `SquareKind` canônico é `'acaso'`.
**Por quê:** O código já migrou para "Acaso" (commits de board) e o termo é mais limpo — espelha o "Chance" clássico; o próprio glossário do SRS já glosava Surpresa como "cartas de acaso". Alinha a fonte de verdade à direção de produto demonstrada.
**Como aplicar:** Propagação **incremental** para não churnar a discovery:
- **Feito agora:** `spec.md` (002) FR-010; glossário SRS §17 (registro do termo canônico); constitution Princípio III (clarificação de termo, bump PATCH 1.0.0 → 1.0.1).
- **Deferido para a spec de Sistema de Cartas:** find-replace de "Surpresa" → "Acaso" em SRS §2.1/§4.6/§10/§13.4 e em `docs/CARTAS.md` (a spec reescreve §10 de qualquer forma).
- O **001** (spec/data-model/research) fica como histórico; não reabrir (aprovada).

### D-019 — Autenticação anônima por link (sem contas no v1)
**Data:** 2026-05-24 · **Status:** aceita
**Decisão:** No v1 não há sistema de contas/login. A identidade do jogador é **anônima por link**: ao entrar numa sala (§11.1/§11.2), o cliente gera/guarda um **token de sessão** (no `localStorage`) e o jogador escolhe **nome + token visual** no lobby. O **link da sala é a credencial** — quem tem o link entra. Sem e-mail, sem senha, sem perfil persistente entre partidas.
**Por quê:** Resolve o item em aberto do SRS §16 ("a definir se auth anônima ou por e-mail"). Entrada sem fricção espelha o Richup.io e é coerente com [D-001](#d-001--multiplayer-online-exclusivo) (social/competitivo, humanos) e [D-002](#d-002--at-8-jogadores-por-sala). Zero PII = menos superfície legal/segurança no v1. Contas/e-mail/perfis ficam candidatos a v2 (SRS §16).
**Como aplicar:** o token de sessão (UUID no `localStorage`) identifica o jogador na sala e **viabiliza a reconexão** ([D-016](#d-016--desconexo-pausa-partida) / §11.4): reabrir o link com o mesmo token re-anexa ao assento. A associação assento↔token vive no estado da sala (servidor). O `GameState` não ganha PII — só ids de jogador (já serializáveis, princípio VII).

### D-020 — Modelo de autoridade & sincronização: host-autoritativo + Realtime + snapshot
**Data:** 2026-05-24 · **Status:** aceita (revisável)
**Decisão:** No v1 a partida é **host-autoritativa**: o cliente **host** roda o reducer puro (o motor M1); os demais clientes **enviam comandos** por canal Supabase Realtime; o host **aplica** o comando e **difunde o snapshot** resultante do `GameState`; após cada comando aceito, o snapshot (JSON) é **persistido** no Postgres (linha da partida). Os critérios de validade já existentes (ex.: `validateTrade`, `canAcquire`, gates de resolução) validam os comandos — sem caminho de regra novo. O reducer permanece **puro/serializável** para poder migrar a **server-autoritativo** (Edge Function rodando o mesmo módulo) depois, sem reescrever regra.
**Por quê:** o motor já é `(state) → state` puro e o `GameState` é JSON puro (M1, princípio VII) — host-autoritativo é a casca de **menor infra** que aproveita isso. Autoridade única **lineariza** os comandos (sem merge/conflito). Casa naturalmente com [D-016](#d-016--desconexo-pausa-partida)/§11.3: **host desconectado → partida pausa indefinidamente, sem transferência de host** (o host É a autoridade). A persistência por snapshot dá a resiliência/recarregamento (§11.4) sem log de eventos.
**Como aplicar:** definir uma interface de **transporte de comandos** + **persistência de snapshot**; a store Zustand atual segue sendo o reducer no host; clientes não-host viram "magros" (enviam comando, renderizam o snapshot recebido). **Trade-offs:** (a) vantagem/latência do host — mitigável com UI otimista local validada pelos mesmos gates; (b) host como ponto único — aceito no v1 por simplicidade e por já ser o modelo de pausa do §11.3; reavaliar server-autoritativo se virar problema. É a base das fatias 1–2 do M3.

### D-021 — Espaço Bus Ticket: uso imediato ao parar (revisa §2.7/§10.7)
**Data:** 2026-05-24 · **Status:** ~~aceita~~ **revertida (2026-05-27)**
**Decisão:** Parar no **espaço Bus Ticket** NÃO banca mais um ticket — abre **na hora** o seletor de "bus ride": o jogador escolhe uma casa do **mesmo lado** e move-se para lá imediatamente (e o destino é resolvido normalmente). O ticket **guardado** passa a vir **apenas** da carta "Passagem de Ônibus" (Tesouro), usável antes de rolar (§10.7 mantido para a carta).
**Por quê:** feedback de playtest — parar no espaço e só receber um ticket "invisível" para usar no turno seguinte foi confuso; o jogador espera **agir na hora**. O uso imediato é mais claro e satisfatório, e a corrida do mesmo lado é a mesma mecânica do §10.7.
**Como aplicar:** motor — o handler `'bus-ticket'` abre `awaitingChoice='bus-ride'` (não credita ticket); `chooseBusRide(dest)` valida mesmo lado, move (credita GO ao cruzar) e resolve o destino. UI — seletor vira modal (`BusPicker`), reusado pela carta guardada. **Atualizar SRS §2.7** (espaço = corrida imediata, não concede ticket) e manter §10.7 para o ticket de carta.

**Reversão (2026-05-27):** volta ao comportamento original do **SRS §2.7** — parar no espaço **GANHA 1 Bus Ticket guardado** (uso facultativo depois, antes de rolar, §10.7). **Por quê:** forçar a viagem na hora tira a agência do jogador; guardar o ticket para usar no momento estratégico é melhor e era a regra escrita no SRS (a atualização do §2.7 prometida pela D-021 nunca foi feita — o texto sempre disse "guardada na mão"). **Como aplicar:** handler `'bus-ticket'` faz `busTickets += 1` e resolve (`done:true`); removida a maquinaria de `bus-ride` (`chooseBusRide`, `awaitingChoice='bus-ride'`, view/modal e ação do store). O ticket — venha da carta ou do espaço — usa o mesmo fluxo `useBusTicket` (botão "Usar Bus Ticket" antes de rolar).

### D-022 — Escassez de construção removida (construção ilimitada)
**Data:** 2026-05-25 · **Status:** aceita
**Decisão:** Remover o **estoque limitado** de construção do banco. Casas, hotéis e arranha-céus são **ilimitados** — construir nunca é travado por falta de peças. Em consequência: (a) o **leilão de casas em escassez** (antigo SRS §5.4 + spec 026) é removido; (b) o **desmonte forçado** ao vender hotel sem casas (antigo §5.5) deixa de existir; (c) o **2º hotel** ganha valor próprio cobrando mais aluguel ([D-008](#d-008--segundo-hotel-por-propriedade) revista).
**Por quê:** a escassez de casas no Monopoly físico é artefato da caixa (32 peças) que a Hasbro codificou em regra; a tática que dela emerge ("house starvation") é um **amplificador de runaway-leader** — quem está à frente tranca o estoque e sufoca os demais. Isso contraria o **Princípio IV** (catch-up discreto) e o objetivo da [D-017](#d-017--tabuleiro-de-48-casas) de segurar o líder. O Richup (referência) também não limita. Ganha-se fluidez e elimina-se uma classe de edge cases.
**Como aplicar:** motor — remover o campo `bank`/`BankStock` e os gates de estoque em `construction.ts`; `rent.ts` ganha `HOTEL2_RENT_MULT` (2º hotel > 1º hotel). SRS §5.2/§5.3 reescritos, §5.4/§5.5 deletados, §7.1/§13.7/§14 atualizados. Spec 026 (leilão de casas) descontinuada. **Leilão por escassez de _terrenos_** (últimos lotes livres do tabuleiro) fica em aberto para desenho futuro — não confundir com este.

### D-023 — Leilão de escassez de terrenos (pregão simultâneo)
**Data:** 2026-05-25 · **Status:** aceita
**Decisão:** Quando restam **≤3 terrenos compráveis sem dono** (cidades/aeroportos/utilidades) **e** há **≥2 jogadores vivos**, abre-se automaticamente um **pregão simultâneo** por esses terrenos — evento autônomo, fora do turno. Cada terreno é um leilão inglês próprio com seu **cronômetro PRÓPRIO** (padrão 8s): um lance reinicia só o prazo **daquele** terreno, e cada terreno **fecha sozinho** quando o seu tempo zera (independente dos demais). Um jogador pode arrematar **vários**, limitado pelo caixa (**trava de solvência**: soma dos lances líderes ≤ caixa). Terreno **sem lance fica livre**. Dispara **1×/episódio** (re-arma se a contagem subir e voltar a cair). Spec 031.
**Por quê:** terrenos são finitos por natureza (≠ casas, que viraram ilimitadas na [D-022]) — a escassez é real. Combate o problema "partida arrastada" (não esperar alguém *cair* nos últimos lotes); fecha o tabuleiro com donos → mais aluguel → fim mais rápido, com clímax. Reusa o motor de leilão (003, §7.2). Princípio IV: o pregão é **neutro**, não se rotula como catch-up; Princípio V: sem lance = sem compra forçada.
**Como aplicar:** SRS §7 ganha o gatilho (7.1) + subseção 7.3 (já atualizado). Motor — novo evento autônomo `GameState.landAuction` (NÃO `resolution`), módulo `economy/landAuction.ts` (`maybeOpenLandAuction`/`placeLandBid`/`closeLandAuction`/`committedCash`), flag `landAuctionArmed`, timer no store reusando o padrão/`deadline` do 003. UI: `LandAuctionLayer` autônoma. **Não** reintroduzir `bank`/`houseAuction` ([D-022]).

---

### D-024 — Economia recalibrada: tiers de casa + aluguel por grupo
**Data:** 2026-05-25 · **Status:** aceita
**Decisão:** Recalibrar a economia (pesquisa cruzada com o Monopoly clássico/Mega). **(1) Custo de casa = tier fixo por grupo** ($40 marrom → $240 navy), não mais proporcional ao preço (`preço×0,5`); cria o *sweet spot* laranja/vermelho (casa barata pro aluguel que rende). **(2) Aluguel = multiplicador POR GRUPO** (não mais um único): curva clássica suavizada — grupos baratos com multiplicador grande, caros pequeno; hotel-topo de ~$360 (marrom) a ~$1.800 (navy), cabendo no caixa de $2.000 (antes o topo era $5.000 = falência instantânea). 2º hotel > 1º (§14.4); arranha-céu = topo (§13.7). **(3) Rebalance do tabuleiro:** laranja 2 → 3 (Hamburgo entra, Salvador sai; China/Brasil reorganizam), verde como único premium de 4 (atualiza [D-017](#d-017--tabuleiro-de-48-casas)).
**Por quê:** o multiplicador único estourava o topo e achatava o piso (spread ~25× vs ~8× do clássico); o custo proporcional eliminava sweet spots (todo terreno com ROI igual). A curva por grupo + tiers devolve profundidade (decisão "onde construir") e segurança (não falir num hotel), alinhada ao Princípio IV. Mantém aeroportos/utilidades/impostos/caixa/GO.
**Como aplicar:** `theme.ts` ganha `HOUSE_COST` (tiers) e `RENT_MULT` (por grupo); `rent.ts` ganha `rentLadder(group,base)` (FONTE ÚNICA, consumida por `rentCity` e pelas UIs de deed — engine↔UI nunca divergem); `construction.ts buildCost` lê o tier; `boardData` rebalanceado. SRS §2.3/§5.1 atualizados. **Não** reintroduz estoque/bank (D-022). Spec 032.

### D-025 — Distrito super-luxo "Alta Roda"
**Data:** 2026-05-25 · **Status:** aceita
**Decisão:** Adicionar um **10º grupo super-luxo** — país **Emirados Árabes** (grupo `platinum`, apelido "Alta Roda"), com 2 cidades — **Abu Dhabi** (~$550) e **Dubai** (~$650) — no clímax do tabuleiro (fim, antes do GO). *(Decisão revista: era Mônaco+Dubai, mas misturava 2 países; padronizado p/ 1 país por grupo — Emirados.)* É a "zona nobre" estilo Boardwalk: preços muito acima do resto, aluguel de prestígio (Dubai: hotel ~$2.300, arranha-céu ~$3.600), custo de casa tier topo ($300) e **ROI propositalmente fraco** (< orange/red) — não é sweet spot, é **flex/ralo de caixa do líder** (armadilha de alto risco). Cor própria (ônix `#26233a`). Pra caber em 48 casas: **verde (EUA) 4→3** (sai Chicago) e **França (navy) 3→2** (sai Lyon) → 10 grupos, 28 cidades. Grupo de 2 = maioria 2 (exige ambas; sem grupo parcial).
**Por quê:** faltava um polo de cobiça de ponta — o "sonho/aposta" que o azul-escuro dá no Monopoly. Como armadilha (caro, raro de cair, no canto), agrega tensão e dreno de caixa **sem** desfazer a curva suavizada da [D-024](#d-024--economia-recalibrada-tiers-de-casa--aluguel-por-grupo) (hotel ~$2.300 ainda é pagável via hipoteca/venda a partir de $2.000, não one-shot garantido).
**Como aplicar:** reusa o modelo D-024 (motor inalterado). `boardData` (`GroupKey += 'platinum'`, `GROUPS`, rebalance do lado direito), `theme.ts` (`HOUSE_COST.platinum`/`RENT_MULT.platinum`), cor em 3 fontes (`GROUPS`/`GROUP_COLOR`/`--color-group-platinum` no `index.css`). SRS §2.3/§5.1 atualizados; [D-017](#d-017--tabuleiro-de-48-casas) → 10 grupos. **Não** reintroduz estoque/bank (D-022). Spec 033.

### D-026 — Construção com país parcial + aluguel escalonado por posse
**Data:** 2026-05-27 · **Status:** aceita (revisa [D-004](#d-004--construo-com-grupo-parcial))
**Decisão:** Construir casas/hotéis NÃO exige mais a maioria do país — basta possuir a cidade (≥1). O aluguel construído deixa de ser 70%/100% binário e passa a escalar pela posse: `fator = 0,5 + 0,5 × (cidades que possui − 1) / (tamanho do país − 1)` — trio 1/3=50% · 2/3=75% · 3/3=100%; duo 1/2=50% · 2/2=100%. **Arranha-céu** segue exigindo país completo (fator sempre 1,0). Aluguel **sem** construção mantém o set bonus (base/150%/200%, §5.1).
**Por quê:** destrava o "jogador parado" (constrói cedo com 1 cidade) sem desbalancear — completar o país **dobra** o aluguel construído, mantendo forte o incentivo de fechar o grupo via trade. Mais granular e justo que o degrau único de 70%.
**Como aplicar:** `rent.ts` (`posseFactor` + ramo construído de `rentCity`), `construction.ts` (remove trava de maioria em `canBuild`), `deedView.ts`/`shared.tsx` (remove razão/mensagem `'maioria'`). SRS §5.1/§5.2/§13.3 atualizados. Spec 034.

### D-027 — Bus Ticket usável também no fim do turno
**Data:** 2026-05-27 · **Status:** aceita
**Decisão:** O Bus Ticket guardado, que só podia ser usado **antes de rolar**, passa a poder ser usado **também no fim do turno** (depois de resolver a casa onde caiu): rolar → comprar → usar o ticket → cair noutra casa do mesmo lado → comprar. Mantém o uso pré-rolagem. Regras do salto inalteradas (mesmo lado, **não** cruza o GO, gasta 1 ticket, sem nova rolagem).
**Por quê:** dá agência tática — o jogador aproveita a jogada normal **e** o salto no mesmo turno, em vez de escolher um ou outro antes de rolar.
**Como aplicar:** `turnMachine.ts` (`useBusTicket` aceita `'aguardando-finalizacao'`), UI (pílula do HUD + `showBusArmed` no `ModalLayer` nesse estado). SRS §10.7 atualizado. Spec 034.

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
